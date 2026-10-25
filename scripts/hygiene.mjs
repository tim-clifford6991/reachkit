#!/usr/bin/env node
// Documents, gates, and the box agree with Current.
// Every finding fails the run. The script does not edit the tree.
// --box adds the host, which a GitHub checkout does not contain.
// --file-issue comments on the open [hygiene] issue, or opens one.
// A green run prints one line and stops.
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { budgetFindings } from "./lib/budgets.mjs";
import { mainCheckoutFinding } from "./lib/main-checkout.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "tim-clifford6991/reachkit";
const TITLE = "[hygiene] consistency check is red";
const MAIN = "/root/projects/reachkitv3";
const TEMPLATE = "/root/projects/lean-template";
const NEW_PROJECT = "/root/projects/new-project.sh";
const OPS = "/root/ops/reachkit";
const GUARD = "/root/ops/reachkit/bin/resource-guard.sh";
const WRAPPER = "/root/ops/reachkit/bin/hygiene.sh";

const args = new Set(process.argv.slice(2));
const wantBox = args.has("--box");
const wantIssue = args.has("--file-issue");
const locked = args.has("--locked");

const AUTHORITY = [
  "README.md",
  "docs/SPEC.md",
  "docs/DESIGN.md",
  "docs/PROCESS.md",
  "docs/GO-LIVE.md",
  "docs/RUNBOOK.md",
  "CLAUDE.md",
];
const GATES = ["typecheck · lint · unit", "audit", "schema · RLS", "no overflow · axe"];
const CURRENT_HEADINGS = [
  "### Source of truth",
  "### Roles",
  "### Four steps",
  "### Gates",
  "### Coherence",
  "### Testing budget",
  "### Deploys",
  "### Worktrees",
  "### What gets worked",
  "### Never",
];
const CITED = [
  "scripts/smoke.sh",
  "scripts/land.sh",
  "scripts/db-substrate/up.sh",
  "scripts/drift-audit.mjs",
  "scripts/box.mjs",
  "docs/walk/panel/sites.json",
  ".github/workflows/ci.yml",
  ".github/workflows/drift-audit.yml",
];
const PACKAGE_SCRIPTS = ["typecheck", "lint", "panel", "costs", "box", "test:layout:full"];
const BINS = ["heavy.sh", "redeploy.sh", "deploy-dev-once.sh", "resource-guard.sh", "deployer.sh"];
const ABSENT_ON_BOX = [
  "/root/ops/reachkit/corpus-drafts",
  "/root/ops/reachkit/state/archive",
  "/root/ops/reachkit/bin/watch-and-merge-prs.sh",
  "/root/ops/reachkit/state/decisions-index.md",
  "/root/ops/reachkit/state/baselines-fired.txt",
];
const UNITS = ["rk-guard.service", "rk-deployer.service", "rk-hygiene.timer"];
const TEXT = new Set([
  ".md", ".mjs", ".js", ".cjs", ".ts", ".tsx", ".yml", ".yaml",
  ".sh", ".json", ".sql", ".toml", ".css", ".mdx", ".html", ".txt",
]);
// This file holds the list, so the scan skips it. Live product and library
// text is not on the list: a mock factory, micromark-factory, React's
// dispatcher, the TODO(copy) marker, and a comment that cites an old
// decisions file. A file named DECISIONS.md is still a finding.
const DROPPED = [
  "sdlc-factory",
  "master-approved",
  "REQUEST_NEXT",
  "rk-implementer",
  "rk-fixer",
  "rk-reader",
  "rk-worker",
  "regen-baselines",
  "review-gallery",
  "docs/archive",
];
const SKIP_SCAN = new Set(["scripts/hygiene.mjs", "package-lock.json"]);

const findings = [];
const seen = new Set();
function add(scope, detail) {
  const line = `${scope}: ${detail}`;
  if (seen.has(line)) return;
  seen.add(line);
  findings.push(line);
}

function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, { encoding: "utf8", ...opts });
  return {
    ok: r.status === 0,
    status: r.status,
    stdout: r.stdout || "",
    stderr: r.stderr || "",
    error: r.error || null,
  };
}

function readRel(rel) {
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) return null;
  return readFileSync(abs, "utf8");
}

function extOf(rel) {
  const base = path.basename(rel);
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot);
}

function lineHits(text, token) {
  const hits = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(token)) hits.push(i + 1);
    if (hits.length === 8) break;
  }
  return hits;
}

function scanText(scope, rel, text) {
  if (!text) return;
  for (const token of DROPPED) {
    const hits = lineHits(text, token);
    if (hits.length) add(scope, `${rel}:${hits.join(",")} contains "${token}"`);
  }
}

function trackedFiles() {
  const listed = run("git", ["-C", ROOT, "ls-files", "-z", "-c", "-o", "--exclude-standard"], {
    maxBuffer: 32 * 1024 * 1024,
  });
  if (!listed.ok) {
    add("repo", `git ls-files failed (${listed.stderr.trim() || listed.error?.message || listed.status})`);
    return [];
  }
  return listed.stdout.split("\0").filter(Boolean);
}

function checkRepo() {
  for (const rel of AUTHORITY) {
    if (!existsSync(path.join(ROOT, rel))) add("repo", `missing ${rel}`);
  }
  const readme = readRel("README.md");
  if (readme) {
    for (const rel of AUTHORITY) {
      if (!readme.includes(`\`${rel}\``)) add("repo", `README.md does not name ${rel}`);
    }
  }

  const processDoc = readRel("docs/PROCESS.md");
  if (processDoc) {
    const currentAt = processDoc.indexOf("\n## Current\n");
    const historyAt = processDoc.indexOf("\n## History\n");
    if (currentAt < 0 || historyAt < 0 || currentAt > historyAt) {
      add("repo", "docs/PROCESS.md does not put ## Current before ## History");
    } else {
      const current = processDoc.slice(currentAt, historyAt);
      for (const gate of GATES) {
        if (!current.includes(gate)) add("repo", `Current does not name the gate ${gate}`);
      }
      for (const heading of CURRENT_HEADINGS) {
        if (!current.includes(`\n${heading}\n`) && !current.startsWith(heading)) {
          add("repo", `Current is missing ${heading}`);
        }
      }
      if (!current.includes("scripts/hygiene.mjs")) {
        add("repo", "Current does not name scripts/hygiene.mjs");
      }
      if (!current.includes("[hygiene]")) add("repo", "Current does not name the [hygiene] issue");
      checkParents(current);
    }
  }

  const claude = readRel("CLAUDE.md");
  if (claude) {
    if (!claude.includes("docs/PROCESS.md")) add("repo", "CLAUDE.md does not point at docs/PROCESS.md");
    if (!claude.includes("Current")) add("repo", "CLAUDE.md does not point at Current");
  }

  const runbook = readRel("docs/RUNBOOK.md");
  if (runbook) {
    for (const gate of GATES) {
      if (!runbook.includes(gate)) add("repo", `docs/RUNBOOK.md does not name the gate ${gate}`);
    }
    if (!runbook.includes("rk-hygiene.timer")) add("repo", "docs/RUNBOOK.md does not name rk-hygiene.timer");
    if (!runbook.includes("scripts/hygiene.mjs")) add("repo", "docs/RUNBOOK.md does not name scripts/hygiene.mjs");
  }

  const ci = readRel(".github/workflows/ci.yml");
  if (ci) {
    for (const name of ["name: typecheck · lint · unit", "name: schema · RLS", "name: no overflow · axe"]) {
      if (!ci.includes(name)) add("repo", `.github/workflows/ci.yml is missing ${name}`);
    }
  }
  const audit = readRel(".github/workflows/drift-audit.yml");
  if (audit) {
    for (const needle of ["scripts/drift-audit.mjs", "scripts/hygiene.mjs", "17 5 * * *", "issues: write", "--file-issue"]) {
      if (!audit.includes(needle)) add("repo", `.github/workflows/drift-audit.yml is missing ${needle}`);
    }
  }

  if (existsSync(path.join(ROOT, "docs/archive"))) add("repo", "docs/archive exists");
  if (existsSync(path.join(ROOT, "PROCESS.md"))) add("repo", "a second PROCESS.md is at the repo root");
  if (existsSync(path.join(ROOT, "DECISIONS.md"))) add("repo", "DECISIONS.md is at the repo root");
  if (existsSync(path.join(ROOT, "docs/DECISIONS.md"))) add("repo", "docs/DECISIONS.md exists");
  if (!existsSync(path.join(ROOT, "supabase/migrations"))) add("repo", "missing supabase/migrations");

  for (const rel of CITED) {
    if (!existsSync(path.join(ROOT, rel))) add("repo", `missing ${rel}`);
  }

  const pkgText = readRel("package.json");
  if (pkgText) {
    let pkg;
    try {
      pkg = JSON.parse(pkgText);
    } catch {
      add("repo", "package.json is not valid JSON");
      pkg = null;
    }
    if (pkg) {
      for (const name of PACKAGE_SCRIPTS) {
        if (!pkg.scripts || !pkg.scripts[name]) add("repo", `package.json has no script ${name}`);
      }
    }
  }

  const files = trackedFiles();
  const processPages = files.filter((f) => f === "PROCESS.md" || f.endsWith("/PROCESS.md"));
  for (const f of processPages) {
    if (f !== "docs/PROCESS.md") add("repo", `second process page ${f}`);
  }
  for (const f of files) {
    if (f === "DECISIONS.md" || f.endsWith("/DECISIONS.md")) add("repo", `decisions page ${f}`);
    if (f === "docs/archive" || f.startsWith("docs/archive/")) add("repo", `tracked ${f}`);
  }

  const texts = [];
  for (const rel of files) {
    if (SKIP_SCAN.has(rel)) continue;
    if (!TEXT.has(extOf(rel))) continue;
    const abs = path.join(ROOT, rel);
    let st;
    try {
      st = lstatSync(abs);
    } catch {
      continue;
    }
    if (!st.isFile() || st.size > 5_000_000) continue;
    let text;
    try {
      text = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    scanText("repo", rel, text);
    texts.push({ rel, text });
  }
  checkBudgets(texts);
}

// On a pull request the checkout is the merge commit, so HEAD^1 is the base it merges into.
function checkBudgets(texts) {
  let budgets;
  try {
    budgets = JSON.parse(readRel("scripts/budgets.json") ?? "null");
  } catch {
    add("repo", "scripts/budgets.json is not valid JSON");
    return;
  }
  const shown = run("git", ["-C", ROOT, "show", "HEAD^1:scripts/budgets.json"]);
  let base = null;
  try {
    base = shown.ok ? JSON.parse(shown.stdout) : null;
  } catch {
    base = null;
  }
  for (const finding of budgetFindings({ budgets, base, files: texts })) add("repo", finding);
}

// Issue 1482: a Coherence registry parent stays open while its row stands.
// A state that cannot be read is a finding too, so a failed lookup is never green.
function checkParents(current) {
  const start = current.indexOf("\n### Coherence\n");
  if (start < 0) return;
  const rest = current.slice(start + 1);
  const end = rest.slice(1).search(/\n### /);
  const section = end < 0 ? rest : rest.slice(0, end + 1);
  const parents = [...section.matchAll(/^\| #(\d+) \|/gm)].map((m) => m[1]);
  for (const number of parents) {
    const viewed = run("gh", ["issue", "view", number, "--repo", REPO, "--json", "state", "--jq", ".state"]);
    const state = viewed.stdout.trim();
    if (!viewed.ok || !state) {
      add("repo", `could not read the state of registry parent #${number} (${viewed.stderr.trim().split("\n")[0] || viewed.error?.message || viewed.status})`);
    } else if (state !== "OPEN") {
      add("repo", `registry parent #${number} is ${state.toLowerCase()} while its Coherence row stands; reopen it`);
    }
  }
}

function walkFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".next") continue;
    const abs = path.join(dir, entry.name);
    let st;
    try {
      st = lstatSync(abs);
    } catch {
      continue;
    }
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) walkFiles(abs, out);
    else if (st.isFile()) out.push(abs);
  }
  return out;
}

function checkBox() {
  if (!existsSync(path.join(TEMPLATE, "PROCESS.md"))) add("box", "lean-template has no PROCESS.md");
  for (const rel of ["docs/PROCESS.md", "DECISIONS.md", "docs/DECISIONS.md"]) {
    if (existsSync(path.join(TEMPLATE, rel))) add("box", `lean-template has ${rel}`);
  }
  const templateProcess = existsSync(path.join(TEMPLATE, "PROCESS.md"))
    ? readFileSync(path.join(TEMPLATE, "PROCESS.md"), "utf8")
    : "";
  if (templateProcess) {
    for (const heading of ["## Roles", "## Four steps", "## Gates", "## Decisions", "## Copy", "## Never"]) {
      if (!templateProcess.includes(`\n${heading}\n`) && !templateProcess.startsWith(heading)) {
        add("box", `lean-template PROCESS.md is missing ${heading}`);
      }
    }
    scanText("box", "lean-template/PROCESS.md", templateProcess);
  }
  const templatePages = walkFiles(TEMPLATE).filter((abs) => path.basename(abs) === "PROCESS.md");
  for (const abs of templatePages) {
    if (abs !== path.join(TEMPLATE, "PROCESS.md")) add("box", `lean-template has a second process page ${abs}`);
  }
  for (const abs of walkFiles(TEMPLATE)) {
    if (path.basename(abs) === "DECISIONS.md") add("box", `lean-template has ${abs}`);
    if (abs.endsWith(`${path.sep}PROCESS.md`)) continue;
    if (!TEXT.has(extOf(abs))) continue;
    let st;
    try {
      st = lstatSync(abs);
    } catch {
      continue;
    }
    if (st.size > 5_000_000) continue;
    scanText("box", path.relative(TEMPLATE, abs), readFileSync(abs, "utf8"));
  }

  if (!existsSync(NEW_PROJECT)) add("box", "missing /root/projects/new-project.sh");
  else {
    const text = readFileSync(NEW_PROJECT, "utf8");
    if (text.includes("DECISIONS.md")) add("box", "new-project.sh names DECISIONS.md");
    scanText("box", "new-project.sh", text);
  }

  for (const abs of ABSENT_ON_BOX) {
    if (existsSync(abs)) add("box", `${abs} is back`);
  }
  for (const abs of walkFiles(OPS)) {
    if (path.basename(abs) === "PROCESS.md") add("box", `rules copied to ${abs}`);
  }
  for (const name of BINS) {
    if (!existsSync(path.join(OPS, "bin", name))) add("box", `missing /root/ops/reachkit/bin/${name}`);
  }

  if (!existsSync(GUARD)) add("box", "missing resource-guard.sh");
  else {
    const guard = readFileSync(GUARD, "utf8");
    const breaches = guard.split("\n").filter((line) => line.includes("RULE BREACH:"));
    if (breaches.length !== 1 || !breaches[0].includes("/root/projects/reachkitv3")) {
      add("box", "resource-guard.sh RULE BREACH is not only the main checkout");
    }
    for (const needle of ["LOW MEMORY", "SWAP NEARLY FULL", "LOAD HIGH", "cwd deleted"]) {
      if (!guard.includes(needle)) add("box", `resource-guard.sh does not watch ${needle}`);
    }
    scanText("box", "resource-guard.sh", guard);
  }

  if (!existsSync(WRAPPER)) add("box", "missing /root/ops/reachkit/bin/hygiene.sh");
  else {
    const wrapper = readFileSync(WRAPPER, "utf8");
    if (!wrapper.includes("scripts/hygiene.mjs")) add("box", "hygiene.sh does not run scripts/hygiene.mjs");
    scanText("box", "hygiene.sh", wrapper);
  }

  for (const unit of [
    ["/etc/systemd/system/rk-hygiene.service", "hygiene.sh"],
    ["/etc/systemd/system/rk-hygiene.timer", "05:30"],
  ]) {
    if (!existsSync(unit[0])) add("box", `missing ${unit[0]}`);
    else {
      const text = readFileSync(unit[0], "utf8");
      if (!text.includes(unit[1])) add("box", `${unit[0]} does not name ${unit[1]}`);
      scanText("box", unit[0], text);
    }
  }

  for (const unit of UNITS) {
    const enabled = run("systemctl", ["is-enabled", unit]);
    const state = enabled.stdout.trim() || enabled.stderr.trim() || "not enabled";
    if (state !== "enabled") add("box", `${unit} is ${state}`);
  }

  let unitFiles = [];
  try {
    unitFiles = readdirSync("/etc/systemd/system");
  } catch {
    add("box", "cannot read /etc/systemd/system");
  }
  for (const name of unitFiles) {
    if (/(lander|dispatch|digest|sdlc|factory)/i.test(name)) add("box", `unit ${name} is installed`);
  }

  const branch = run("git", ["-C", MAIN, "rev-parse", "--abbrev-ref", "HEAD"]);
  if (!branch.ok) add("box", `main checkout branch unreadable (${branch.stderr.trim() || branch.error?.message})`);
  else if (branch.stdout.trim() !== "main") add("box", `main checkout is on ${branch.stdout.trim()}`);

  const dirty = run("git", ["-C", MAIN, "status", "--porcelain"]);
  if (!dirty.ok) add("box", "main checkout status failed");
  else if (dirty.stdout.trim()) {
    const n = dirty.stdout.trim().split("\n").length;
    add("box", `main checkout has uncommitted changes (${n} paths)`);
  }

  const behind = mainCheckoutFinding(MAIN, Date.now());
  if (behind) add("box", behind);
}

function printFindings() {
  if (findings.length === 0) {
    console.log("hygiene: clean");
    return;
  }
  console.log(`hygiene: ${findings.length} finding${findings.length === 1 ? "" : "s"}`);
  for (const line of findings) console.log(`- ${line}`);
}

function issueBody() {
  const shown = findings.slice(0, 40);
  const more = findings.length > shown.length ? `\n\n${findings.length - shown.length} more findings were not listed.\n` : "\n";
  const when = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  return [
    "The hygiene check is red. It does not edit the tree.",
    "",
    "One session, one worktree off `origin/main`, then the tab closes. Fix the findings. Close this issue when a later run is clean.",
    "",
    ...shown.map((line) => `- ${line}`),
    more,
    `Ran ${when}. Root \`${ROOT}\`. Box: ${wantBox ? "yes" : "no"}.`,
    "",
  ].join("\n");
}

function fileIssue() {
  const bodyPath = path.join(tmpdir(), `hygiene-issue-${process.pid}.md`);
  writeFileSync(bodyPath, issueBody());
  try {
    const listed = run("gh", [
      "issue", "list",
      "--repo", REPO,
      "--state", "open",
      "--limit", "30",
      "--json", "number,title",
      "--search", "hygiene in:title",
    ]);
    if (!listed.ok) {
      console.log(`hygiene: could not list issues (${listed.stderr.trim() || listed.error?.message})`);
      return;
    }
    let issues = [];
    try {
      issues = JSON.parse(listed.stdout).filter((issue) => String(issue.title || "").startsWith("[hygiene]"));
    } catch {
      console.log("hygiene: issue list was not JSON");
      return;
    }
    issues.sort((a, b) => a.number - b.number);
    if (issues.length) {
      const number = String(issues[0].number);
      const commented = run("gh", ["issue", "comment", number, "--repo", REPO, "--body-file", bodyPath]);
      if (!commented.ok) console.log(`hygiene: could not comment on #${number} (${commented.stderr.trim()})`);
      else console.log(`hygiene: commented on #${number}`);
      return;
    }
    const created = run("gh", ["issue", "create", "--repo", REPO, "--title", TITLE, "--body-file", bodyPath]);
    if (!created.ok) console.log(`hygiene: could not open an issue (${created.stderr.trim()})`);
    else console.log(`hygiene: opened ${created.stdout.trim()}`);
  } finally {
    try {
      unlinkSync(bodyPath);
    } catch {
      // The body is a temp file. Leaving it is not a finding.
    }
  }
}

checkRepo();
if (wantBox) checkBox();

if (wantIssue && findings.length > 0 && !locked) {
  const child = spawnSync(
    "flock",
    ["-w", "90", "/tmp/hygiene-issue.lock", process.execPath, fileURLToPath(import.meta.url), ...process.argv.slice(2), "--locked"],
    { stdio: "inherit" },
  );
  if (child.error) {
    printFindings();
    console.log(`hygiene: could not file an issue (${child.error.message})`);
    process.exit(1);
  }
  process.exit(child.status === null ? 1 : child.status);
}

printFindings();
if (wantIssue && findings.length > 0) fileIssue();
process.exit(findings.length === 0 ? 0 : 1);
