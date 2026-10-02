// scripts/eval-content/repair.ts — #1178: on the same inputs, how often a
// day ends in a page when a stopped draft is re-rolled blind, and how often
// when it is repaired from its failures.
//
// Per domain and round, on one row:
//
//   1. **First attempt.** `generateDraft` as the product runs it, which now
//      repairs a mechanical stop in code. Whether the page passed *before*
//      that repair is read off the row's `meta.repairs`.
//   2. **Blind second attempt**, where the raw first attempt failed: the
//      same inputs with no `fix`. It passes blind only if it passed without
//      a repair of its own.
//   3. **Informed second attempt**, where the product's first attempt
//      failed: the same inputs with the first attempt's `fix`, repairs on.
//
// Blind publishes = raw first ∨ raw blind second. Repaired publishes =
// first ∨ informed second. A tool, not a gate; the one committed output is
// `docs/walk/content-repair.md`.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CAPS } from "@/lib/config/constants";
import { generateDraft, type GenerateOutcome } from "@/lib/generate/pipeline";
import type { RepairRecord } from "@/lib/generate/pipeline/repair";
import { setGenerateStore, type GenerateStore } from "@/lib/generate/store";
import { proofLedger } from "../live-drafts/cost";
import { prepare } from "./eval";
import { servePages } from "./measured-text";
import { EVAL_SET } from "./set";

export interface RepairOptions {
  run: boolean;
  only: readonly string[];
  rounds: number;
  tablePath: string;
}

interface Row {
  domain: string;
  round: number;
  first: string;
  rawFirst: boolean;
  repairedFirst: boolean;
  blindSecond: string | null;
  informedSecond: string | null;
  blind: boolean;
  repaired: boolean;
  repairs: RepairRecord[];
  costCents: number;
}

const cents = (n: number): string => `${n.toFixed(2)}¢`;

async function repairsOn(store: GenerateStore, draftId: string | null): Promise<RepairRecord[]> {
  if (draftId === null) return [];
  const meta = (await store.draftById(draftId))?.meta as { repairs?: RepairRecord[] } | null;
  return meta?.repairs ?? [];
}

function said(outcome: GenerateOutcome): string {
  if (outcome.ok) return "passed";
  return outcome.reason === "rules" ? `stopped: ${outcome.failed.map((f) => f.rule).join(", ")}` : `step failed: ${outcome.step}`;
}

export async function main(opts: RepairOptions): Promise<number> {
  const slots = EVAL_SET.filter((slot) => slot.domain !== null && (opts.only.length === 0 || opts.only.includes(slot.domain)));
  const runCap = slots.length * opts.rounds * CAPS.DRAFT_C;
  console.log(`# Repair against blind (#1178)\n\ndomains ${slots.map((s) => s.domain).join(", ")}; rounds ${opts.rounds}; worst case ${cents(runCap)}\n`);
  if (!opts.run) {
    console.log("Dry run — nothing was spent. Pass --run to spend.");
    return 0;
  }

  const today = new Date().toISOString().slice(0, 10);
  const ledger = proofLedger(runCap);
  const rows: Row[] = [];
  for (let round = 1; round <= opts.rounds; round++) {
    for (const slot of slots) {
      const index = EVAL_SET.indexOf(slot);
      const prepared = prepare(slot, index, today);
      if (!prepared.ok || !ledger.canStartDraft()) continue;
      const { store, siteId, pages, args } = prepared;
      setGenerateStore(store);
      servePages({ siteId, domain: slot.domain!, pages });
      const cost = ledger.contextFor(index + 1 + (round - 1) * EVAL_SET.length);
      try {
        let first = await generateDraft(cost, args);
        if (!first.ok && first.reason === "step_failed" && first.draftId === null) first = await generateDraft(cost, args);
        const firstRepairs = await repairsOn(store, first.draftId);
        const rawFirst = first.ok && firstRepairs.length === 0;
        const draftId = first.draftId ?? undefined;

        let blindSecond: GenerateOutcome | null = null;
        let rawBlind = false;
        if (!rawFirst && draftId !== undefined) {
          const before = (await repairsOn(store, draftId)).length;
          blindSecond = await generateDraft(cost, { ...args, draftId });
          rawBlind = blindSecond.ok && (await repairsOn(store, draftId)).length === before;
        }
        let informedSecond: GenerateOutcome | null = null;
        if (!first.ok && first.reason === "rules" && draftId !== undefined) {
          informedSecond = await generateDraft(cost, { ...args, draftId, ...(first.fix === undefined ? {} : { fix: first.fix }) });
        }
        const row: Row = {
          domain: slot.domain!,
          round,
          first: said(first),
          rawFirst,
          repairedFirst: first.ok && !rawFirst,
          blindSecond: blindSecond === null ? null : said(blindSecond),
          informedSecond: informedSecond === null ? null : said(informedSecond),
          blind: rawFirst || rawBlind,
          repaired: first.ok || informedSecond?.ok === true,
          repairs: await repairsOn(store, first.draftId),
          costCents: cost.spentCents(),
        };
        rows.push(row);
        console.log(`${row.domain} r${round}: blind ${row.blind ? "page" : "no page"}, repaired ${row.repaired ? "page" : "no page"}; ${cents(row.costCents)}`);
      } finally {
        setGenerateStore(null);
        servePages(null);
      }
    }
  }

  const share = (pick: (r: Row) => boolean): string => `${rows.filter(pick).length}/${rows.length}`;
  const perRule = new Map<string, { tried: number; cleared: number }>();
  for (const repair of rows.flatMap((r) => r.repairs)) {
    const tally = perRule.get(repair.rule) ?? { tried: 0, cleared: 0 };
    tally.tried += 1;
    if (repair.cleared) tally.cleared += 1;
    perRule.set(repair.rule, tally);
  }
  const lines = [
    "# Repair against blind",
    "",
    `Written by \`node scripts/eval-content.mjs --repair --run --rounds ${opts.rounds}\` on ${today} (#1178). A tool, not a gate. Each row is one day on the evaluation set's inputs: the first attempt, then a blind second attempt and an informed one on the same row. Nothing was published.`,
    "",
    `**A day ends in a page:** blind ${share((r) => r.blind)}, repaired ${share((r) => r.repaired)}. First attempt passing as written ${share((r) => r.rawFirst)}; passing after the repair in code ${share((r) => r.repairedFirst)}.`,
    "",
    "| Site | Round | First attempt | Repaired in code | Blind second | Informed second | Blind: page | Repaired: page | Cost |",
    "|---|---|---|---|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${r.domain} | ${r.round} | ${r.first} | ${r.repairs.map((x) => `${x.rule} ${x.cleared ? "cleared" : "not cleared"}`).join(", ") || "—"} | ${r.blindSecond ?? "—"} | ${r.informedSecond ?? "—"} | ${r.blind ? "yes" : "no"} | ${r.repaired ? "yes" : "no"} | ${cents(r.costCents)} |`
    ),
    "",
    "## Repairs in code, per rule",
    "",
    "| Rule | Tried | Cleared |",
    "|---|---|---|",
    ...[...perRule].map(([rule, t]) => `| ${rule} | ${t.tried} | ${t.cleared} |`),
    "",
    `Total spend ${cents(ledger.spentCents())}.`,
    "",
  ];
  mkdirSync(path.dirname(opts.tablePath), { recursive: true });
  writeFileSync(opts.tablePath, lines.join("\n"));
  console.log(`\nTable: ${opts.tablePath}`);
  return 0;
}
