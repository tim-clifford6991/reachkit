// scripts/live-drafts/proof.ts — issue #321, the run the owner ruled on
// 2026-09-22: three drafts written by the live model, for three different
// target searches, every hard rule and the claim check run on each, spend
// capped at €1.35, nothing published.
//
// # What is real and what is not
//
// Real: the writer. `generateDraft` is called unmodified, so the facts are
// read and ordered by the product's own grounding read, the brief, outline,
// draft and answerability prompts are the product's own, every model call
// goes through the `llm()` seam at the tier and the call site the product
// pins, the sixteen hard rules and the do-not-claim check are the product's
// own battery, and every cent is settled from the vendor's own reported
// `usage` numbers against the product's own `CAPS.DRAFT_C`.
//
// Not real: the database. This box has no Postgres, so two reads are served
// from a fixture and the draft rows are held in memory — the two seams
// `./fixture.ts` names, and nothing between them. Nothing publishes: the run
// writes files and stops, and the rows it writes live in this process only.
//
// # The finding is the report
//
// A draft that fails a rule is the answer to #321, not a prompt to be
// tuned. This file reports what the battery decided and changes nothing to
// make it decide otherwise.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CAPS, INFERENCE_MAX_OUTPUT_TOKENS, INFERENCE_PRICE_BOOK } from "@/lib/config/constants";
import { generateDraft, type GenerateOutcome } from "@/lib/generate/pipeline";
import { readRecordedRules, readRecordedVerdict } from "@/lib/generate/record";
import { HARD_RULES, type HardRule } from "@/lib/generate/rules/types";
import { setGenerateStore } from "@/lib/generate/store";
import { proofLedger, type ProofLedger } from "./cost";
import {
  CATEGORY,
  DOMAIN,
  PAGES,
  PROFILE,
  SCAN_ID,
  SITE_ID,
  TARGETS,
  VOICE_TEXT,
  knownFor,
  linksFor,
  memoryStore,
  opportunityFor,
  siteRuleInputs,
  type Target,
} from "./fixture";

export interface Options {
  /** False is a dry run: it prints the arithmetic and spends nothing. */
  run: boolean;
  /** The owner's ceiling for the whole run, in ledger cents. */
  runCapCents: number;
  /** Where the drafts and the rule results are written. */
  outDir: string;
  /** Spend the pipeline's own automatic regeneration on this draft of the
   *  run already in `outDir`, instead of writing three new drafts. */
  regenerate: number | null;
}

/** The `llm()` call sites one draft uses, in the order the pipeline
 *  reaches them (`generate.answer_box` only where the short answer is
 *  outside its 40–60 words). Named so the dry run can show what each is allowed to
 *  generate before a penny is spent. */
const CALL_SITES = [
  "generate.brief",
  "generate.outline",
  "generate.draft",
  "generate.sections",
  "generate.answer_box",
  "generate.answerability",
  "generate.claim_check",
] as const;

const cents = (n: number): string => `${n.toFixed(3)}c`;

/** The owner's ruling of 2026-09-22, in the ledger's own cent. The run
 *  accepts a smaller ceiling on the command line; this is the one the
 *  report names as the owner's. */
export const OWNER_RUN_CAP_C = 135;

/** One draft's whole record — what goes to `.review/321/` and what the
 *  summary is drawn from. */
interface DraftRecord {
  index: number;
  target: Target;
  /** `generateDraft`'s own outcome, flattened for the report. */
  outcome:
    | { kind: "passed" }
    | { kind: "rules"; failed: HardRule[]; attempt: number; recovery: string }
    | { kind: "step_failed"; step: string }
    | { kind: "not_started"; reason: string };
  title: string | null;
  bodyMarkdown: string | null;
  description: string | null;
  grounded: { url: string; passage: string; readAt: string } | null;
  factsUsed: readonly { passage: string; url: string }[];
  /** Every rule, with what the battery decided about it. */
  rules: { rule: HardRule; verdict: "passed" | "failed"; detail?: unknown }[];
  claim: { state: string; reason?: string; matchedEntry?: string } | null;
  hardRulesPassed: boolean;
  costCents: number;
  calls: { source: string; costCents: number; tokensIn: number | null; tokensOut: number | null; durationMs: number }[];
}

function plan(opts: Options): void {
  console.log(`# Three live-model drafts (#321)\n`);
  console.log(`business       Acme at ${DOMAIN}, ${CATEGORY} — the fixture business on origin/main`);
  console.log(`pages read     ${PAGES.length} of the customer's own, from the fixture`);
  console.log(`model price    ${INFERENCE_PRICE_BOOK.haiku.inCentsPerM}c/Mtok in, ${INFERENCE_PRICE_BOOK.haiku.outCentsPerM}c/Mtok out (both tiers)`);
  console.log(`per draft      CAPS.DRAFT_C = ${cents(CAPS.DRAFT_C)} — the product's own ceiling, enforced per draft`);
  console.log(`run cap        ${cents(opts.runCapCents)}${opts.runCapCents === OWNER_RUN_CAP_C ? " — the owner's ruling of 2026-09-22" : " (the owner's ruling is 135.000c)"}`);
  console.log(`worst case     3 x ${cents(CAPS.DRAFT_C)} = ${cents(3 * CAPS.DRAFT_C)}, and a draft is not started unless`);
  console.log(`               the whole of ${cents(CAPS.DRAFT_C)} still fits under the run cap\n`);
  console.log(`steps, and what each may generate:`);
  for (const site of CALL_SITES) {
    console.log(`  ${site.padEnd(24)} max ${String(INFERENCE_MAX_OUTPUT_TOKENS[site]).padStart(5)} output tokens`);
  }
  console.log(`\nthe three target searches:`);
  for (const [index, target] of TARGETS.entries()) {
    console.log(`  ${index + 1}. ${target.search.padEnd(34)} ${target.type}`);
  }
  console.log(`output         ${opts.outDir} (gitignored)`);
  console.log(`publishes      nothing — the run writes files and stops\n`);
}

/** The rule column of the report: every rule, and what the battery decided.
 *  Read back off the row the pipeline wrote, through the product's own
 *  reader, so the report says what was recorded and not what was returned. */
function rulesOf(recorded: unknown): DraftRecord["rules"] {
  const failures = readRecordedRules(recorded) ?? [];
  const byRule = new Map(failures.map((failure) => [failure.rule, failure]));
  return HARD_RULES.map((rule) => {
    const failure = byRule.get(rule);
    return failure === undefined
      ? { rule, verdict: "passed" as const }
      : { rule, verdict: "failed" as const, ...(failure.detail === undefined ? {} : { detail: failure.detail }) };
  });
}

function flatten(outcome: GenerateOutcome): DraftRecord["outcome"] {
  if (outcome.ok) return { kind: "passed" };
  if (outcome.reason === "rules") {
    return {
      kind: "rules",
      failed: outcome.failed.map((failure) => failure.rule),
      attempt: outcome.attempt,
      recovery: outcome.recovery,
    };
  }
  return { kind: "step_failed", step: outcome.step };
}

async function writeOne(
  ledger: ProofLedger,
  store: ReturnType<typeof memoryStore>,
  target: Target,
  index: number,
  retry: { draftId: string; priorCents: number } | null = null
): Promise<DraftRecord> {
  const before = ledger.rows.length;
  const cost = ledger.contextFor(index, retry?.priorCents ?? 0);
  const outcome = await generateDraft(cost, {
    siteId: SITE_ID,
    opportunity: opportunityFor(target),
    scheduledFor: target.scheduledFor,
    site: siteRuleInputs(),
    voiceText: VOICE_TEXT,
    category: CATEGORY,
    links: linksFor(target),
    known: knownFor(target),
    profile: PROFILE,
    factsOff: [],
    scanId: SCAN_ID,
    // The rewrite of the date's one row (#788), exactly as the day-page
    // caller's attempt loop hands it on the second attempt.
    ...(retry === null ? {} : { draftId: retry.draftId }),
  });

  const draftId = outcome.ok ? outcome.draftId : outcome.draftId;
  const row = draftId === null ? null : await store.draftById(draftId);
  const meta = (row?.meta ?? null) as {
    description?: unknown;
    factsUsed?: readonly { passage: string; url: string }[];
  } | null;
  const grounded = (row?.grounded_fact ?? null) as
    | { url?: unknown; passage?: unknown; readAt?: unknown }
    | null;
  const verdict = row === null ? null : readRecordedVerdict(row.claim_check);

  return {
    index,
    target,
    outcome: flatten(outcome),
    title: row?.title ?? null,
    bodyMarkdown: row?.body_md ?? null,
    description: typeof meta?.description === "string" ? meta.description : null,
    grounded:
      grounded === null || typeof grounded.passage !== "string"
        ? null
        : {
            url: String(grounded.url ?? ""),
            passage: grounded.passage,
            readAt: String(grounded.readAt ?? ""),
          },
    factsUsed: meta?.factsUsed ?? [],
    rules: rulesOf(row?.rule_failures ?? null),
    claim:
      verdict === null
        ? null
        : verdict.state === "unrun"
          ? { state: verdict.state, reason: verdict.reason }
          : verdict.state === "failed"
            ? { state: verdict.state, matchedEntry: verdict.matchedEntry }
            : { state: verdict.state },
    hardRulesPassed: outcome.ok,
    costCents: row?.cost_cents ?? 0,
    calls: ledger.rows.slice(before).map((call) => ({
      source: call.source,
      costCents: call.costCents,
      tokensIn: call.tokensIn,
      tokensOut: call.tokensOut,
      durationMs: call.durationMs,
    })),
  };
}

function notStarted(target: Target, index: number, reason: string): DraftRecord {
  return {
    index,
    target,
    outcome: { kind: "not_started", reason },
    title: null,
    bodyMarkdown: null,
    description: null,
    grounded: null,
    factsUsed: [],
    rules: [],
    claim: null,
    hardRulesPassed: false,
    costCents: 0,
    calls: [],
  };
}

function draftMarkdown(record: DraftRecord): string {
  const head = [
    `<!-- #321 live-model draft ${record.index} of ${TARGETS.length}. Not published, not customer-facing. -->`,
    `<!-- target search: ${record.target.search} · type: ${record.target.type} -->`,
    `<!-- outcome: ${record.outcome.kind} · cost: ${cents(record.costCents)} -->`,
    "",
  ];
  if (record.bodyMarkdown === null) {
    head.push(`_No page was written: ${JSON.stringify(record.outcome)}._`);
    return head.join("\n");
  }
  head.push(`# ${record.title ?? "(no title)"}`, "", record.bodyMarkdown, "");
  if (record.description !== null) head.push("---", "", `Search-result description: ${record.description}`);
  if (record.grounded !== null) {
    head.push("", `Grounded fact: "${record.grounded.passage}" — ${record.grounded.url} (read ${record.grounded.readAt})`);
  }
  return head.join("\n");
}

function summaryMarkdown(records: readonly DraftRecord[], ledger: ProofLedger, opts: Options): string {
  const lines: string[] = [];
  lines.push(`Three drafts, written by \`claude-haiku-4-5\` through the product's own \`llm()\` seam, for the fixture business (Acme, ${DOMAIN}, ${CATEGORY}) on \`origin/main\`. Nothing published.`);
  lines.push("");
  lines.push("## The three drafts");
  lines.push("");
  for (const record of records) {
    lines.push(`**${record.index}. ${record.title ?? "(no page written)"}**`);
    lines.push(`- target search: \`${record.target.search}\` (${record.target.type})`);
    lines.push(`- outcome: ${describe(record)}`);
    lines.push(`- cost: ${cents(record.costCents)}`);
    lines.push("");
  }
  lines.push("## Every rule, per draft");
  lines.push("");
  const header = ["rule", ...records.map((record) => `draft ${record.index}`)];
  lines.push(`| ${header.join(" | ")} |`);
  lines.push(`|${header.map(() => "---").join("|")}|`);
  for (const rule of HARD_RULES) {
    const cells = records.map((record) => {
      const found = record.rules.find((entry) => entry.rule === rule);
      if (found === undefined) return "not run";
      return found.verdict === "passed" ? "pass" : "**FAIL**";
    });
    lines.push(`| \`${rule}\` | ${cells.join(" | ")} |`);
  }
  lines.push("");
  lines.push("## Spend");
  lines.push("");
  lines.push(`| draft | calls | tokens in | tokens out | cost |`);
  lines.push(`|---|---|---|---|---|`);
  for (const record of records) {
    const tokensIn = record.calls.reduce((sum, call) => sum + (call.tokensIn ?? 0), 0);
    const tokensOut = record.calls.reduce((sum, call) => sum + (call.tokensOut ?? 0), 0);
    lines.push(`| ${record.index} | ${record.calls.length} | ${tokensIn} | ${tokensOut} | ${cents(record.costCents)} |`);
  }
  lines.push(`| **total** | ${ledger.rows.length} | | | **${cents(ledger.spentCents())}** |`);
  lines.push("");
  const owners = opts.runCapCents === OWNER_RUN_CAP_C ? " — the owner's €1.35, in the ledger's own cent" : "";
  lines.push(`Run cap ${cents(opts.runCapCents)}${owners}. Per-draft cap \`CAPS.DRAFT_C\` = ${cents(CAPS.DRAFT_C)}, enforced by the product's own reservation arithmetic. Every figure above is settled from the vendor's own reported \`usage\` numbers, not from an estimate.`);
  if (ledger.refusals.length > 0) {
    lines.push("");
    lines.push(`Calls the cap refused: ${ledger.refusals.map((refusal) => `${refusal.source} (${refusal.ceiling})`).join(", ")}.`);
  }
  return lines.join("\n");
}

function describe(record: DraftRecord): string {
  const outcome = record.outcome;
  switch (outcome.kind) {
    case "passed":
      return "**passes every hard rule and the claim check**";
    case "rules":
      return `stopped by ${outcome.failed.map((rule) => `\`${rule}\``).join(", ")} on attempt ${outcome.attempt}; the pipeline's recovery is \`${outcome.recovery}\` (not spent here)`;
    case "step_failed":
      return `step \`${outcome.step}\` did not run — not a rule failure`;
    case "not_started":
      return `not started: ${outcome.reason}`;
  }
}

export async function main(opts: Options): Promise<number> {
  plan(opts);
  if (opts.regenerate !== null) {
    if (!opts.run) {
      console.log(`Dry run — draft ${opts.regenerate} would be regenerated from ${opts.outDir}. Pass --run to spend.`);
      return 0;
    }
    return regenerate(opts, opts.regenerate);
  }
  if (!opts.run) {
    console.log("Dry run — no model was called and nothing was spent. Pass --run to spend.");
    return 0;
  }

  const ledger = proofLedger(opts.runCapCents);
  const store = memoryStore();
  setGenerateStore(store);

  const records: DraftRecord[] = [];
  try {
    for (const [offset, target] of TARGETS.entries()) {
      const index = offset + 1;
      if (!ledger.canStartDraft()) {
        const reason = `the run has ${cents(ledger.headroomCents())} left and a draft may cost ${cents(CAPS.DRAFT_C)}`;
        console.log(`\n${index}. ${target.search} — NOT STARTED: ${reason}`);
        records.push(notStarted(target, index, reason));
        continue;
      }
      console.log(`\n${index}. ${target.search} (${target.type}) — writing...`);
      const record = await writeOne(ledger, store, target, index);
      records.push(record);
      console.log(`   ${describe(record)}`);
      console.log(`   ${cents(record.costCents)} over ${record.calls.length} calls; run total ${cents(ledger.spentCents())}`);
    }
  } finally {
    setGenerateStore(null);
  }

  mkdirSync(opts.outDir, { recursive: true });
  for (const record of records) {
    writeFileSync(path.join(opts.outDir, `draft-${record.index}.md`), draftMarkdown(record));
    writeFileSync(path.join(opts.outDir, `draft-${record.index}.json`), `${JSON.stringify(record, null, 2)}\n`);
  }
  const summary = summaryMarkdown(records, ledger, opts);
  writeFileSync(path.join(opts.outDir, "summary.md"), `${summary}\n`);
  writeFileSync(
    path.join(opts.outDir, "summary.json"),
    `${JSON.stringify({ runCapCents: opts.runCapCents, spentCents: ledger.spentCents(), calls: ledger.rows, refusals: ledger.refusals, records }, null, 2)}\n`
  );

  console.log(`\n${summary}\n`);
  console.log(`Drafts and rule results are in ${opts.outDir} (gitignored).`);
  return 0;
}

/** The first run's records, as `main` wrote them. */
function readRun(outDir: string): { spentCents: number; records: DraftRecord[] } {
  const summary = JSON.parse(readFileSync(path.join(outDir, "summary.json"), "utf8")) as {
    spentCents: number;
    records: DraftRecord[];
  };
  return summary;
}

/**
 * The pipeline's own automatic regeneration, spent on one draft of an
 * earlier run (owner ruling 2026-09-23).
 *
 * What the day-page caller does on a rule stop, and nothing else: the same
 * opportunity, links and profile are handed to `generateDraft` again with
 * the date's row, so the row is rewritten in place (#788), stands on the
 * passage it already records, and is held to what is left of its one
 * `CAPS.DRAFT_C`. The store is rebuilt from the first run's records — the
 * stopped row with its one counted attempt, and the other drafts as the
 * queued pages the near-duplicate gate compares it against.
 */
async function regenerate(opts: Options, index: number): Promise<number> {
  const first = readRun(opts.outDir);
  const stopped = first.records.find((record) => record.index === index);
  if (stopped === undefined || stopped.bodyMarkdown === null || stopped.grounded === null) {
    throw new Error(`draft ${index} of ${opts.outDir} wrote no row to regenerate`);
  }
  if (stopped.outcome.kind !== "rules" || stopped.outcome.recovery !== "regenerate_once") {
    throw new Error(`draft ${index} is not a rule stop the pipeline would regenerate (${JSON.stringify(stopped.outcome)})`);
  }

  const store = memoryStore();
  for (const record of first.records) {
    if (record.bodyMarkdown === null || record.grounded === null) continue;
    const id = `draft-${record.index}`;
    store.rows.set(id, {
      id,
      site_id: SITE_ID,
      opportunity_id: record.target.id,
      state: "generating",
      title: record.title,
      body_md: record.bodyMarkdown,
      meta: { description: record.description, factsUsed: record.factsUsed },
      grounded_fact: record.grounded,
      attribution: null,
      hard_rule_attempts: record.outcome.kind === "rules" ? record.outcome.attempt : 0,
      rule_failures: record.rules.filter((rule) => rule.verdict === "failed").map(({ rule, detail }) => ({ rule, ...(detail === undefined ? {} : { detail }) })),
      claim_check: null,
      cost_cents: record.costCents,
      scheduled_for: record.target.scheduledFor,
      veto_deadline: null,
      created_at: new Date().toISOString(),
    });
  }

  const ledger = proofLedger(opts.runCapCents, first.spentCents);
  if (ledger.headroomCents() < CAPS.DRAFT_C - stopped.costCents) {
    console.log(`Refusing: ${cents(ledger.headroomCents())} left under the run cap.`);
    return 1;
  }
  setGenerateStore(store);
  let record: DraftRecord;
  try {
    console.log(`\n${index}. ${stopped.target.search} — regenerating draft-${index} (attempt 2)...`);
    record = await writeOne(ledger, store, stopped.target, index, {
      draftId: `draft-${index}`,
      priorCents: stopped.costCents,
    });
  } finally {
    setGenerateStore(null);
  }

  const attemptCents = record.calls.reduce((sum, call) => sum + call.costCents, 0);
  const base = path.join(opts.outDir, `draft-${index}-attempt-2`);
  writeFileSync(`${base}.md`, draftMarkdown(record));
  writeFileSync(`${base}.json`, `${JSON.stringify({ ...record, attemptCents }, null, 2)}\n`);

  const lines = [
    `Draft ${index}, attempt 2 — the pipeline's own regeneration of \`draft-${index}\` (same row, same grounded passage, same opportunity).`,
    "",
    `- title: ${record.title ?? "(no page written)"}`,
    `- outcome: ${describe(record)}`,
    `- this attempt: ${cents(attemptCents)} over ${record.calls.length} calls; the draft's two attempts together: ${cents(record.costCents)} of \`CAPS.DRAFT_C\` ${cents(CAPS.DRAFT_C)}`,
    `- run total under the ruling: ${cents(ledger.spentCents())} of ${cents(opts.runCapCents)}`,
    "",
    "| rule | attempt 1 | attempt 2 |",
    "|---|---|---|",
    ...HARD_RULES.map((rule) => {
      const verdict = (r: DraftRecord) => {
        const found = r.rules.find((entry) => entry.rule === rule);
        return found === undefined ? "not run" : found.verdict === "passed" ? "pass" : "**FAIL**";
      };
      return `| \`${rule}\` | ${verdict(stopped)} | ${verdict(record)} |`;
    }),
  ];
  writeFileSync(`${base}.summary.md`, `${lines.join("\n")}\n`);
  console.log(`\n${lines.join("\n")}\n`);
  return 0;
}
