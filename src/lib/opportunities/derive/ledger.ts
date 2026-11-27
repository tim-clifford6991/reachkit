// What one pass's new-page supply came from, so a thin pass and a source that ran dry read differently.
import { PLAN_DEPTH, TOPIC_FIT } from "@/lib/config/constants";
import type { Opportunity, TopicSource } from "../types";
import type { TopUpRecord } from "./top-up";

export const LEDGER_SOURCES = ["product", "problem", "category", "best_x", "ai_gap", "asked", "cited", "written", "offering", "earned"] as const;
export type LedgerSource = (typeof LEDGER_SOURCES)[number];

/** The stages a topic passes, in order: offered, "would a buyer search this?", fit 3, candidate, kept by the collapse. */
export const LEDGER_STAGES = ["offered", "searched", "fit", "candidates", "added"] as const;
export type LedgerStage = (typeof LEDGER_STAGES)[number];

export type SourceCounts = Record<LedgerStage, number>;

export interface SupplyLedger {
  sources: Record<LedgerSource, SourceCounts>;
  /** Open new-page rows after the pass that a day may be written from. */
  have: number;
  short: number;
  /** The sources that added no row. */
  dry: LedgerSource[];
  /** `ai_gap` prompts no stored "People also ask" or related search was close enough to word. */
  unworded: number;
  /** The Monday top-up's sources tried, where the pass may top up. */
  topUp?: TopUpRecord;
}

/** The ledger's class of a topic: an answer that gave a rival and not the site, where buyers were seen asking it, the rival page an answer cited, the buyer's searches the model wrote, a further line the business sells, else its own source. */
export function ledgerSourceOf(topic: {
  source?: TopicSource | null;
  asked?: unknown;
  cited?: unknown;
  written?: boolean;
  offering?: true;
}): LedgerSource {
  if (topic.source === "ai_gap") return "ai_gap";
  if (topic.cited !== undefined) return "cited";
  if (topic.asked !== undefined) return "asked";
  if (topic.written === true) return "written";
  if (topic.offering === true) return "offering";
  return topic.source ?? "category";
}

/** A row a day may be written from: an open Write or Earn at or above readiness's fit floor that readiness, once it has run, does not hold. */
export function writable(row: Pick<Opportunity, "family" | "status" | "businessFit"> & Partial<Pick<Opportunity, "ready" | "unreadyReason">>): boolean {
  const held = row.ready === false && row.unreadyReason !== "not_assessed";
  return (row.family === "write" || row.family === "earn") && row.status === "open" && (row.businessFit ?? TOPIC_FIT.gate) >= TOPIC_FIT.gate && !held;
}

/** The ledger with `have` and `short` read again from rows readiness has just assessed. */
export function afterReadiness(ledger: SupplyLedger, rows: readonly Parameters<typeof writable>[0][]): SupplyLedger {
  const have = rows.filter(writable).length;
  return { ...ledger, have, short: Math.max(0, PLAN_DEPTH - have) };
}

/** Pure. `stages` lists each topic's class at every stage it reached; `rows` is what the site holds after the pass. */
export function supplyLedger(a: {
  stages: Partial<Record<LedgerStage, readonly LedgerSource[]>>;
  rows: readonly Parameters<typeof writable>[0][];
  unworded?: number;
  topUp?: TopUpRecord;
}): SupplyLedger {
  const sources = Object.fromEntries(LEDGER_SOURCES.map((source) => [source, Object.fromEntries(LEDGER_STAGES.map((stage) => [stage, 0]))])) as Record<LedgerSource, SourceCounts>;
  for (const stage of LEDGER_STAGES) {
    for (const source of a.stages[stage] ?? []) sources[source][stage] += 1;
  }
  const dry = LEDGER_SOURCES.filter((source) => sources[source].added === 0);
  return afterReadiness({ sources, have: 0, short: 0, dry, unworded: a.unworded ?? 0, ...(a.topUp === undefined ? {} : { topUp: a.topUp }) }, a.rows);
}

/** Pure. A short week's sources for the digest: per source, what was offered, then its rows placed and held by each reason. */
export function shortfallOf(sources: SupplyLedger["sources"], rows: readonly Opportunity[], twins: ReadonlySet<string>): string {
  const counts = new Map<LedgerSource, Record<string, number>>();
  for (const row of rows.filter((one) => one.family === "write" || one.family === "earn")) {
    const reason = twins.has(row.id) ? "live_twin" : writable(row) ? "placed" : (row.unreadyReason ?? "not_assessed");
    const of = counts.get(ledgerSourceOf(row)) ?? {};
    counts.set(ledgerSourceOf(row), { ...of, [reason]: (of[reason] ?? 0) + 1 });
  }
  const line = (source: LedgerSource) => [`offered ${sources[source].offered}`, ...Object.entries(counts.get(source) ?? {}).map(([reason, n]) => `${reason} ${n}`)].join(", ");
  return LEDGER_SOURCES.filter((source) => sources[source].offered > 0 || counts.has(source)).map((source) => `${source}: ${line(source)}`).join("; ") || "none";
}
