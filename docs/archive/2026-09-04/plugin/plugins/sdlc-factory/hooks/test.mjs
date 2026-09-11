// The hooks, driven the way Claude Code drives them: a JSON payload on
// stdin, a decision on stdout.
//
// Both hooks sit in front of every write and every prompt in every session,
// which makes their FAILURE modes more important than their success ones. A
// guard that throws on a malformed payload does not fail safe — it halts the
// session. So the cases that matter most here are the ones where the hook is
// asked something it does not understand, and has to get out of the way.
//
// Run against a throwaway corpus built in a temp directory: these hooks make
// decisions from the filesystem (does this file already exist? is there a
// docs root above it?), so a fixture of pure strings would test nothing.

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const GUARD = join(HERE, "guard-corpus-write.mjs");
const ROUTER = join(HERE, "route-prompt.mjs");

const checks = [];
const assert = (label, ok, detail) => checks.push({ label, ok, detail });

// ---- a corpus that looks like a real one ----------------------------------
const root = mkdtempSync(join(tmpdir(), "sdlc-hooks-"));
const docs = join(root, "sdlc-factory", "docs");
for (const d of ["requirements", "blueprints", "work-orders", "journeys", "registry", "design", "feedback", "decisions", "archive"]) {
  mkdirSync(join(docs, d), { recursive: true });
}
const REQ = join(docs, "requirements", "REQ-001.md");
writeFileSync(REQ, "---\nid: REQ-001\ntype: requirement\nstatus: draft\n---\n\n# REQ-001\n");
writeFileSync(join(docs, "requirements", "_TEMPLATE.md"), "template\n");
const WAVES = join(docs, "registry", "waves.md");
writeFileSync(WAVES, "# Waves\n");

// A directory with no corpus at all — the case every unrelated repository on
// the machine is in, and the one where these hooks must be perfectly inert.
const plain = mkdtempSync(join(tmpdir(), "plain-"));
mkdirSync(join(plain, "src"), { recursive: true });

function run(script, payload) {
  const out = execFileSync("node", [script], { input: JSON.stringify(payload), encoding: "utf8" });
  if (!out.trim()) return { decision: null, raw: "" };
  try {
    const j = JSON.parse(out);
    return { decision: j.hookSpecificOutput?.permissionDecision ?? null, ctx: j.hookSpecificOutput?.additionalContext ?? null, raw: out };
  } catch {
    return { decision: null, raw: out };
  }
}
const write = (file, extra) => ({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: file }, cwd: root, ...extra });

// ---- 1. the main model is refused -----------------------------------------
{
  const r = run(GUARD, write(REQ));
  assert("main-session edit of a requirement is DENIED", r.decision === "deny", `${r.decision} :: ${r.raw.slice(0, 90)}`);
  assert("...and the refusal names the verb that would have worked", /\/require/.test(r.raw), r.raw.slice(0, 120));
  assert("...and names the escape hatch", /SDLC_FACTORY_GUARD=off/.test(r.raw), "no escape hatch mentioned");
}
{
  const fresh = join(docs, "requirements", "REQ-045.md");
  const r = run(GUARD, write(fresh));
  assert("INVENTING a new requirement from the main session is denied too",
    r.decision === "deny", String(r.decision));
}

// ---- 2. the owning agent is not ------------------------------------------
for (const [agent, file, label] of [
  ["requirements-analyst", REQ, "the analyst may write requirements/"],
  ["sdlc-factory:requirements-analyst", REQ, "...namespaced the same way"],
  ["librarian", REQ, "the librarian may write anywhere — it sets statuses (§4)"],
  ["reviewer", REQ, "the reviewer may write anywhere — it leaves open questions (rule 3.4)"],
  ["librarian", WAVES, "the librarian owns registry/"],
  ["planner", join(docs, "work-orders", "WO-001.md"), "the planner may write work-orders/"],
  ["validator", join(docs, "work-orders", "WO-001.md"), "so may the validator — the verdict gates `done`"],
  ["implementer", join(docs, "work-orders", "WO-001.md"), "so may the implementer — the `## Log` is its checkpoint"],
  ["design-guardian", join(docs, "work-orders", "WO-001.md"), "so may the design-guardian — rule 7.3's preview line and its placement questions"],
]) {
  const r = run(GUARD, write(file, { agent_type: agent, agent_id: "sub-1" }));
  assert(label, r.decision === null, `got ${r.decision}`);
}
{
  const r = run(GUARD, write(REQ, { agent_type: "implementer", agent_id: "sub-2" }));
  assert("an agent writing outside its row is ASKED, not denied — §4 is intent, not a fence",
    r.decision === "ask", String(r.decision));
}

// ---- 2b. log mode: unattended runs are recorded, never prompted ------------
// SDLC_FACTORY_GUARD=log turns the `ask` branch into allow-and-record: a
// work order gets the line in its own ## Log; a file with no ## Log is
// recorded in registry/guard.md. The deny branch is untouched.
{
  const env = { ...process.env, SDLC_FACTORY_GUARD: "log" };
  const runLog = (payload) => {
    const out = execFileSync("node", [GUARD], { input: JSON.stringify(payload), encoding: "utf8", env });
    return out.trim() ? JSON.parse(out).hookSpecificOutput?.permissionDecision ?? null : null;
  };
  const WO = join(docs, "work-orders", "WO-007.md");
  writeFileSync(WO, "---\nid: WO-007\ntype: work-order\nstatus: approved\n---\n\n# WO-007\n\n## Goal\nx\n\n## Log\n- 2026-09-01 created — planner\n\n## Validation report (appended by validator)\n");
  assert("log mode: an out-of-row agent write to a work order is ALLOWED", runLog(write(WO, { agent_type: "architect", agent_id: "sub-9" })) === null, "was not allowed");
  const woText = readFileSync(WO, "utf8");
  assert("...and recorded as one line at the end of its ## Log, in rule 6.1's grammar",
    /## Log\n- 2026-09-01 created — planner\n- \d{4}-\d{2}-\d{2} guard — architect wrote work-orders\/WO-007\.md outside §4's work-orders\/ row — allowed under SDLC_FACTORY_GUARD=log\n\n## Validation report/.test(woText), woText.slice(-260));
  assert("log mode: an out-of-row write to a file with no ## Log is ALLOWED", runLog(write(REQ, { agent_type: "implementer", agent_id: "sub-9" })) === null, "was not allowed");
  const guardLog = join(docs, "registry", "guard.md");
  assert("...and recorded in registry/guard.md, created with its banner", existsSync(guardLog) && /^# Guard log/.test(readFileSync(guardLog, "utf8")) && /implementer wrote requirements\/REQ-001\.md outside §4's requirements\/ row/.test(readFileSync(guardLog, "utf8")), "no record");
  assert("log mode: an in-row agent write records nothing", (runLog(write(WO, { agent_type: "planner", agent_id: "sub-9" })), (readFileSync(WO, "utf8").match(/guard —/g) || []).length) === 1, "a second line appeared");
  assert("log mode: the main session is still DENIED", runLog(write(REQ)) === "deny", "not denied");
  const r = run(GUARD, write(REQ, { agent_type: "implementer", agent_id: "sub-2" }));
  assert("default mode still asks, and the prompt names the unattended mode", r.decision === "ask" && /SDLC_FACTORY_GUARD=log/.test(r.raw), `${r.decision}`);
  rmSync(guardLog, { force: true });
}

// ---- 3. scaffolding still works -------------------------------------------
// /factory-init runs from the main session and writes the registry and design
// stubs. If the guard denied those, initialising a project would be
// impossible — the hook would have made the doctrine unusable to install.
{
  const r = run(GUARD, write(join(docs, "registry", "structure.md")));
  assert("main-session CREATION of a registry stub is allowed (/factory-init)", r.decision === null, String(r.decision));
  const r2 = run(GUARD, write(WAVES));
  assert("...but EDITING one that already exists is denied — it is the librarian's now",
    r2.decision === "deny", String(r2.decision));
  const r3 = run(GUARD, write(join(docs, "requirements", "_TEMPLATE.md")));
  assert("_TEMPLATE.md is furniture, never guarded", r3.decision === null, String(r3.decision));
  const r4 = run(GUARD, write(join(docs, "00-project.md")));
  assert("00-project.md is furniture, never guarded", r4.decision === null, String(r4.decision));
}

// ---- 3b. the archive is written by nobody (rule 7.5, 0.12.0) ---------------
// `factory-console pivot` writes it from the shell; a Write/Edit under
// archive/ is denied whoever asks — creation and edit alike, agent or main
// session — and the refusal names the command.
{
  mkdirSync(join(docs, "archive", "2026-09-03-streams", "blueprints"), { recursive: true });
  const archived = join(docs, "archive", "2026-09-03-streams", "blueprints", "BP-001.md");
  writeFileSync(archived, "---\nid: BP-001\n---\n");
  const fresh = join(docs, "archive", "2026-09-03-streams", "README.md");
  for (const [label, file, extra] of [
    ["main session editing an archived artifact is DENIED", archived, {}],
    ["main session CREATING a file under archive/ is DENIED (no scaffolding exemption)", fresh, {}],
    ["the architect editing an archived blueprint is DENIED — not asked", archived, { agent_type: "architect", agent_id: "sub-3" }],
    ["the librarian, universal elsewhere, is DENIED under archive/", archived, { agent_type: "librarian", agent_id: "sub-4" }],
  ]) {
    const r = run(GUARD, write(file, extra));
    assert(label, r.decision === "deny", `${r.decision} :: ${r.raw.slice(0, 90)}`);
  }
  const r = run(GUARD, write(archived));
  assert("...and the refusal names factory-console pivot", /factory-console pivot/.test(r.raw), r.raw.slice(0, 160));
}

// ---- 4. everything else on the machine is untouched ------------------------
{
  const r = run(GUARD, write(join(plain, "src", "index.ts"), { cwd: plain }));
  assert("a file in a repo with no corpus is never guarded", r.decision === null, String(r.decision));
  const r2 = run(GUARD, write(join(root, "src", "app.ts")));
  assert("code inside a factory project is never guarded — only the corpus is",
    r2.decision === null, String(r2.decision));
  const r3 = run(GUARD, { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "rm -rf /" }, cwd: root });
  assert("a non-write tool is ignored", r3.decision === null, String(r3.decision));
}

// ---- 5. it fails OPEN, always ----------------------------------------------
// Each of these is a payload the hook cannot make sense of. Every one must
// come back with no decision: a guard that blocks when confused is a guard
// that bricks the session.
for (const [label, payload] of [
  ["no tool_input at all", { hook_event_name: "PreToolUse", tool_name: "Write" }],
  ["no file_path", { hook_event_name: "PreToolUse", tool_name: "Write", tool_input: {} }],
  ["a relative path", { hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: "docs/REQ-001.md" } }],
  ["a null file_path", { hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: null } }],
  ["an empty payload", {}],
]) {
  const r = run(GUARD, payload);
  assert(`fails open: ${label}`, r.decision === null, String(r.decision));
}
{
  const out = execFileSync("node", [GUARD], { input: "not json at all", encoding: "utf8" });
  assert("fails open: stdin is not JSON", out.trim() === "", out.slice(0, 60));
}
{
  const out = execFileSync("node", [GUARD], { input: JSON.stringify(write(REQ)), encoding: "utf8", env: { ...process.env, SDLC_FACTORY_GUARD: "off" } });
  assert("SDLC_FACTORY_GUARD=off disables the guard entirely", out.trim() === "", out.slice(0, 60));
}

// ---- 6. the router ---------------------------------------------------------
{
  const r = run(ROUTER, { hook_event_name: "UserPromptSubmit", cwd: root, prompt: "add a way to export reports" });
  assert("in a factory project the router injects the §9 card", typeof r.ctx === "string" && r.ctx.includes("§9"), String(r.ctx).slice(0, 60));
  assert("...naming the owner verbs", r.ctx.includes("/sdlc-factory:require") && r.ctx.includes("/sdlc-factory:decide"), "verbs missing");
  assert("...and saying that not everything is a dispatch", /Not everything is a dispatch/.test(r.ctx), "no escape from over-routing");
  assert("...staying small enough to pay for every turn", r.ctx.length < 2000, `${r.ctx.length} chars`);

  // 0.11.0: the card RENDERS §4's routing map — it carries exactly the
  // owner-facing surface (/factory and the five owner verbs), no internal
  // verb, and its verb set equals the map's `owner` rows, read from the
  // same template the hook reads. The map is the one home; this is the
  // assertion that the view cannot drift from it.
  const OWNER_SURFACE = ["/factory", "/require", "/requirement-cleanup", "/decide", "/wave", "/feedback"];
  for (const v of OWNER_SURFACE) assert(`...the card names ${v} in the form that resolves`, r.ctx.includes(`\`/sdlc-factory:${v.slice(1)}\``), "missing");
  assert("...and never a bare owner verb as the thing to type", !/\| [a-z ]+ \| `\/[a-z-]+` \|/.test(r.ctx), "a bare verb in the Type this column");
  for (const v of ["/implement", "/validate", "/regress", "/workorder", "/expand-requirement", "/relink", "/sync", "/design", "/console"]) {
    assert(`...and never the internal ${v}`, !r.ctx.includes(`\`${v}\``), "internal verb on the card");
  }
  const mapText = readFileSync(join(HERE, "..", "templates", "constitution.md"), "utf8");
  const mapStart = mapText.split("\n").findIndex((l) => /^\|\s*Stage\s*\|\s*Verb\s*\|\s*Caller\s*\|/.test(l));
  assert("the constitution template carries §4's routing map", mapStart !== -1, "no | Stage | Verb | Caller | header");
  const mapOwnerVerbs = mapText.split("\n").slice(mapStart + 2)
    .filter((l) => l.startsWith("|"))
    .map((l) => l.split("|").slice(1, -1).map((c) => c.replace(/`/g, "").trim()))
    .filter((c) => c[2]?.toLowerCase() === "owner")
    .map((c) => c[1]);
  const cardVerbs = [...r.ctx.matchAll(/^\| [^|]+ \| `\/sdlc-factory:([a-z-]+)` \|$/gm)].map((m) => `/${m[1]}`);
  assert("the card's verb list equals the map's owner rows, in order (parity — the two cannot drift)",
    JSON.stringify(cardVerbs) === JSON.stringify(mapOwnerVerbs), `${JSON.stringify(cardVerbs)} vs ${JSON.stringify(mapOwnerVerbs)}`);
  assert("the map's owner rows are exactly the six", JSON.stringify(mapOwnerVerbs) === JSON.stringify(OWNER_SURFACE), JSON.stringify(mapOwnerVerbs));

  // Fails open: a copy of the hook with no templates/ beside it still emits
  // a card — the §9 sentence and a pointer to §4 — rather than nothing or a
  // throw. A hook that cannot find its own doctrine must not halt the turn.
  const orphanDir = mkdtempSync(join(tmpdir(), "sdlc-hook-orphan-"));
  mkdirSync(join(orphanDir, "hooks"), { recursive: true });
  for (const f of ["route-prompt.mjs", "corpus.mjs"]) copyFileSync(join(HERE, f), join(orphanDir, "hooks", f));
  const o = run(join(orphanDir, "hooks", "route-prompt.mjs"), { hook_event_name: "UserPromptSubmit", cwd: root, prompt: "hello" });
  assert("with no template beside it the router still emits the §9 card", typeof o.ctx === "string" && o.ctx.includes("§9"), String(o.ctx).slice(0, 60));
  assert("...pointing at §4 instead of restating a table", /routing map is constitution §4/.test(o.ctx) && !o.ctx.includes(":require`"), String(o.ctx).slice(0, 200));
  assert("...and still printing /factory namespaced from the fallback name", o.ctx.includes("`/sdlc-factory:factory`"), String(o.ctx).slice(0, 200));
  rmSync(orphanDir, { recursive: true, force: true });

  const q = run(ROUTER, { hook_event_name: "UserPromptSubmit", cwd: plain, prompt: "hello" });
  assert("in a repo with no corpus the router is silent", !q.ctx && q.raw.trim() === "", JSON.stringify(q).slice(0, 80));

  const off = execFileSync("node", [ROUTER], { input: JSON.stringify({ cwd: root }), encoding: "utf8", env: { ...process.env, SDLC_FACTORY_ROUTER: "off" } });
  assert("SDLC_FACTORY_ROUTER=off silences it", off.trim() === "", off.slice(0, 60));
}

// ---- 7. the manifest is wired to files that exist --------------------------
{
  const manifest = JSON.parse(execFileSync("node", ["-e", `process.stdout.write(require("fs").readFileSync("${join(HERE, "hooks.json")}","utf8"))`], { encoding: "utf8" }));
  const cmds = JSON.stringify(manifest);
  assert("hooks.json registers UserPromptSubmit and PreToolUse",
    !!manifest.hooks.UserPromptSubmit && !!manifest.hooks.PreToolUse, Object.keys(manifest.hooks).join(","));
  assert("...pointing at both scripts by their real names",
    cmds.includes("route-prompt.mjs") && cmds.includes("guard-corpus-write.mjs"), cmds.slice(0, 100));
  assert("...and matching every write tool",
    /Write\|Edit\|MultiEdit\|NotebookEdit/.test(cmds), "matcher too narrow");
}

rmSync(root, { recursive: true, force: true });
rmSync(plain, { recursive: true, force: true });

const w = Math.max(...checks.map((c) => c.label.length));
for (const c of checks) console.log(`  ${c.ok ? "ok  " : "FAIL"}   ${c.label.padEnd(w)}   ${c.ok ? "" : c.detail ?? ""}`);
console.log(`\n${checks.length} assertions.`);
if (!checks.every((c) => c.ok)) {
  console.error("hooks gate FAIL.");
  process.exit(1);
}
console.log("hooks gate PASS.");
