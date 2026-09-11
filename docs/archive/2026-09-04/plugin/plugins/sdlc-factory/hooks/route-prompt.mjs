#!/usr/bin/env node
//
// UserPromptSubmit: put constitution §9 in front of the model on every turn,
// not once at session start.
//
// `/factory-init` wires `@sdlc-factory/CLAUDE.md` into the project's root
// CLAUDE.md, so the constitution is loaded — once, at the top. Three hundred
// lines of it, and by turn forty it is a long way back in a context that has
// since filled with code, test output and file contents. The classification
// step in §9 is the first thing to fall off, and when it does the model
// answers the request directly instead of routing it. Nothing announces that
// this has happened.
//
// This is the cheap half of the fix: a short card, re-stated every turn, that
// costs a few hundred tokens and cannot decay. The expensive half — actually
// refusing the write — is `guard-corpus-write.mjs`.
//
// Two rules govern what goes in here. It must be SHORT, because it is paid
// for on every single turn; and it must be a POINTER, never a restatement —
// the constitution is the one home for these rules (rule 2.4: one claim, one
// home). Until 0.11.0 this file carried its own eleven-row verb table, a
// second copy of §4 that had already drifted (it routed to `/blueprint`, a
// verb nothing calls). Now the card RENDERS §4's routing map — read from
// this plugin's own templates/constitution.md, the doctrine version the hook
// ships with, never the project's copy, which may lag — and prints only the
// rows whose caller is `owner`. The map is the one home; this is a view of
// it, and hooks/test.mjs asserts the two cannot drift.
//
// Fails open, as every hook here does: if the template cannot be read or the
// map is not found, the card falls back to the §9 sentence and a pointer to
// §4 — never a stale copy, never a throw. Silent in any repository without
// a corpus, which is what keeps it out of every unrelated session.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hasCorpus, readPayload } from "./corpus.mjs";

const off = (process.env.SDLC_FACTORY_ROUTER || "").toLowerCase();
if (off === "off" || off === "0" || off === "false") process.exit(0);

const p = await readPayload();
if (!p) process.exit(0);
if (!hasCorpus(p.cwd)) process.exit(0);

const HERE = dirname(fileURLToPath(import.meta.url));
export const CONSTITUTION = join(HERE, "..", "templates", "constitution.md");
export const MANIFEST = join(HERE, "..", ".claude-plugin", "plugin.json");

/**
 * The plugin's namespace — the prefix that makes a verb resolve in every
 * session (constitution §4, "Typing a verb"). Read from this plugin's own
 * manifest so a rename travels; "sdlc-factory" if the manifest is unreadable.
 */
export function pluginNamespace(path = MANIFEST) {
  try {
    const name = JSON.parse(readFileSync(path, "utf8")).name;
    return typeof name === "string" && /^[a-z0-9-]+$/.test(name) ? name : "sdlc-factory";
  } catch {
    return "sdlc-factory";
  }
}
/** `/wave` → `/sdlc-factory:wave`: the form that resolves. */
export const typed = (verb, ns) => verb.replace(/^\//, `/${ns}:`);

/**
 * Read §4's routing map out of the constitution template: the table whose
 * header row opens `| Stage | Verb | Caller |`. Returns every row as
 * { stage, verb, caller, agent, skill, model } with backticks stripped, or
 * null when the template is unreadable or carries no such table. Exported
 * so the test can assert parity between what the map says and what the
 * card shows.
 */
export function readRoutingMap(path = CONSTITUTION) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  const lines = text.split("\n");
  const start = lines.findIndex((l) => /^\|\s*Stage\s*\|\s*Verb\s*\|\s*Caller\s*\|/i.test(l));
  if (start === -1) return null;
  const rows = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (!l.startsWith("|")) break;
    if (/^\|\s*-+\s*\|/.test(l)) continue; // the separator row
    const cells = l.split("|").slice(1, -1).map((c) => c.replace(/`/g, "").trim());
    if (cells.length < 3) continue;
    const [stage, verb, caller, agent = "", skill = "", model = ""] = cells;
    rows.push({ stage, verb, caller, agent, skill, model });
  }
  return rows.length ? rows : null;
}

/** The owner-facing surface: rows whose caller is exactly `owner`. */
export const ownerRows = (rows) => rows.filter((r) => r.caller.toLowerCase() === "owner");

const rows = readRoutingMap();
const owner = rows ? ownerRows(rows) : null;
const ns = pluginNamespace();

const surface = owner && owner.length
  ? [
      "The owner-facing surface is these rows of §4's routing map — the only",
      "place routing is stated; this card is a view of it, not a copy. Verbs",
      `are printed in the form that resolves (§4, "Typing a verb"): the bare`,
      "name may not.",
      "",
      "| Stage | Type this |",
      "|---|---|",
      ...owner.map((r) => `| ${r.stage} | \`${typed(r.verb, ns)}\` |`),
      "",
      `Every other verb in the map is internal — invoked by \`${typed("/factory", ns)}\` or by an`,
      "owner verb, never something to remember.",
    ].join("\n")
  : [
      `The owner-facing surface is \`${typed("/factory", ns)}\` and the five owner verbs; the`,
      "routing map is constitution §4 (this card could not read it — open",
      "sdlc-factory/CLAUDE.md §4).",
    ].join("\n");

const card = `<sdlc-factory-routing>
This project is governed by sdlc-factory/CLAUDE.md. Before answering, work
constitution §9: classify each statement in the message as **new requirement ·
change to an existing artifact (name the ID) · question · feedback on built
software · architectural constraint**, echo the classification as a short
table, then dispatch. Never silently drop a statement.

The default dispatch for anything corpus-shaped is \`${typed("/factory", ns)}\` — the
orchestrator loop: it classifies, consults \`factory-console next\`, drives
the subagent chains end to end, and stops only at one batched owner
checkpoint (rule 9.1). Reach for a single verb only for surgical work.

Dispatch means the verb, not doing it yourself. The corpus is written by
agents; §4's tables are the ownership and routing record.

${surface}

Not everything is a dispatch. A question, a code change outside the corpus, or
work on tooling is answered directly — over-routing is its own failure. The
owner verbs are the owner's: propose them, never assume them.

Writes into the corpus from this session are refused by a PreToolUse gate —
if you find yourself about to edit a file under the docs root, that is the
signal you skipped a verb.
</sdlc-factory-routing>`;

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: card },
}));
