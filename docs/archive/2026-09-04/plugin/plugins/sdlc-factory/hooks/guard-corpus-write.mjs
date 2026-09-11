#!/usr/bin/env node
//
// PreToolUse gate: agents are the only writers of a corpus.
//
// Until this existed, "agents are the only writers" was doctrine and nothing
// more — the constitution said it, and nothing enforced it. The failure mode
// is predictable and was never hypothetical: three hundred lines of
// constitution loaded at session start, eighty thousand tokens of
// conversation since, a request that sounds small, and the main model simply
// opens `requirements/REQ-045.md` and edits it. No analyst, no review rounds,
// no rule 3.4. The corpus still parses. The gate was never run.
//
// The signal that makes this enforceable is that a PreToolUse hook receives
// `agent_type` ONLY when it fires inside a subagent. Its absence is a
// reliable statement that the main model is the one writing.
//
//   no agent_type          → deny, and name the verb that would have worked
//   agent_type owns zone   → allow, silently
//   agent_type, wrong zone → ask, and let the owner decide
//
// Deliberately NOT a blanket deny for the wrong agent: §4's table is a record
// of intent, and an agent doing something adjacent to its row is a judgement
// call the owner should make, not one a hook should make for them.
//
// Escape hatch: SDLC_FACTORY_GUARD=off disables it entirely, for the case
// where the owner genuinely means to hand-edit the corpus and does not want
// to answer a prompt per file.
//
// Unattended mode: SDLC_FACTORY_GUARD=log. The `ask` branch is a prompt, and
// a prompt nobody is there to answer stalls the run — the overnight 0.12.0
// build stopped on exactly that. In log mode an out-of-row subagent write is
// ALLOWED and RECORDED instead: one line in the written work order's own
// `## Log` (rule 6.1 — the log is the checkpoint, and this is a fact about
// who touched the file), or, for a file with no `## Log`, one line in
// `<docsRoot>/registry/guard.md`. Main-session writes stay denied in every
// mode — that branch is the whole point of the gate. If the record cannot
// be written, the write is still allowed: a guard that blocks because its
// own bookkeeping failed is the stall this mode exists to remove.
//
// Fails open on every unexpected condition. A hook that cannot read its own
// input must not be able to halt the session.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { classify, findCorpus, isOwner, readPayload, VERBS } from "./corpus.mjs";

const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

function decide(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

const mode = (process.env.SDLC_FACTORY_GUARD || "").toLowerCase();
if (mode === "off" || mode === "0" || mode === "false") process.exit(0);
const LOG_MODE = mode === "log";

/**
 * Log mode's record. A work order (any file with a `## Log` section) gets
 * the line at the end of that section — before the next `## ` heading, the
 * validation report by the template's order — in rule 6.1's own grammar. A
 * file with no `## Log` is recorded in registry/guard.md, created with a
 * banner on first use. Never throws: the caller allows the write either way.
 */
function record(corpus, filePath, agent, zone) {
  const date = new Date().toISOString().slice(0, 10);
  const rel = relative(corpus.docsAbs, filePath);
  const line = `- ${date} guard — ${agent} wrote ${rel} outside §4's ${zone}/ row — allowed under SDLC_FACTORY_GUARD=log`;
  try {
    if (existsSync(filePath)) {
      const text = readFileSync(filePath, "utf8");
      const m = text.match(/^## Log[^\n]*\n/m);
      if (m) {
        const start = m.index + m[0].length;
        const rest = text.slice(start);
        const next = rest.search(/^## /m);
        const blockEnd = next === -1 ? text.length : start + next;
        const block = text.slice(start, blockEnd).replace(/\n+$/, "\n");
        const tail = text.slice(blockEnd);
        writeFileSync(filePath, `${text.slice(0, start)}${block}${line}\n${next === -1 ? "" : "\n"}${tail}`, "utf8");
        return `${rel} ## Log`;
      }
    }
    const guardLog = join(corpus.docsAbs, "registry", "guard.md");
    mkdirSync(dirname(guardLog), { recursive: true });
    if (!existsSync(guardLog)) {
      writeFileSync(guardLog,
        "# Guard log — out-of-row writes allowed under SDLC_FACTORY_GUARD=log\n\n" +
        "> Written by `hooks/guard-corpus-write.mjs` in log mode, one line per write a\n" +
        "> subagent made outside its constitution §4 row on a file with no `## Log`\n" +
        "> of its own. Each line is a fact about who touched what; the librarian\n" +
        "> audits them on /sync. Never hand-edited.\n\n", "utf8");
    }
    writeFileSync(guardLog, readFileSync(guardLog, "utf8") + line + "\n", "utf8");
    return "registry/guard.md";
  } catch {
    return null;
  }
}

const p = await readPayload();
if (!p || !WRITE_TOOLS.has(p.tool_name)) process.exit(0);

// Write/Edit use file_path; NotebookEdit uses notebook_path.
const filePath = p.tool_input?.file_path || p.tool_input?.notebook_path;
const corpus = findCorpus(filePath);
if (!corpus) process.exit(0); // not a corpus file — every non-factory repo lands here

const { kind, zone, file } = classify(corpus.rel);
if (kind === "exempt") process.exit(0);

// The scaffolding exemption. `/factory-init` runs from the main model and
// writes `registry/` and `design/` stubs before any agent exists to own them;
// once those files are on disk they are the librarian's and the
// design-guardian's. Artifacts get no such exemption — creating one is
// precisely the act being guarded.
if (kind === "curated" && !existsSync(filePath)) process.exit(0);

const agent = p.agent_type || null;
const verb = VERBS[zone] || "the matching owner verb";

// The archive is written by `factory-console pivot` alone (rule 7.5) — it
// runs from the shell, so no Write/Edit ever legitimately lands here, from
// any agent or from the main session. Denied whoever asks.
if (kind === "archive") {
  decide("deny",
    `${file} is under ${zone}/ — the record a pivot wrote (constitution rule 7.5). Nothing edits an archive: ` +
    `if the shape is changing again, that is a new decision and a new pivot (${VERBS.archive}), never an edit here.`);
}

if (!agent) {
  decide("deny",
    `${file} is corpus, not code — ${zone}/ belongs to an agent (constitution §4), and this write is coming from the main session, not a subagent.\n\n` +
    `Route it: ${verb}\n\n` +
    `That verb dispatches the owning agent and runs the gates attached to it (rule 3.4's two review rounds, the librarian's status audit). ` +
    `Writing the file here produces an artifact that parses but never passed them.\n\n` +
    `If you genuinely mean to hand-edit the corpus, re-run with SDLC_FACTORY_GUARD=off.`);
}

if (!isOwner(agent, zone)) {
  if (LOG_MODE) {
    // Unattended: allow, and leave the fact where the next agent resumes.
    record(corpus, filePath, agent, zone);
    process.exit(0);
  }
  decide("ask",
    `${agent} is writing ${file}, but §4 gives ${zone}/ to ${(VERBS[zone] ? "another agent" : "no one")}. ` +
    `Allow if this is deliberate — the librarian and the reviewer legitimately write everywhere, and §4 is a record of intent, not a fence. ` +
    `(Unattended runs: SDLC_FACTORY_GUARD=log allows and records the write in the work order's log instead of asking.)`);
}

process.exit(0);
