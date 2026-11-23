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

/** Holds readiness stored that no pass clears, so a held row is not supply. */
const HELD: ReadonlySet<string> = new Set(["resting"]);

/** A row a day may be written from: an open Write or Earn at or above readiness's fit floor, not resting. */
export function writable(row: Pick<Opportunity, "family" | "status" | "businessFit"> & Partial<Pick<Opportunity, "ready" | "unreadyReason">>): boolean {
  const fit = row.businessFit ?? null;
  const held = row.ready === false && HELD.has(row.unreadyReason ?? "");
  return (row.family === "write" || row.family === "earn") && row.status === "open" && (fit === null || fit >= TOPIC_FIT.gate) && !held;
}

/** Pure. `stages` lists each topic's class at every stage it reached; `rows` is what the site holds after the pass. */
export function supplyLedger(a: {
  stages: Partial<Record<LedgerStage, readonly LedgerSource[]>>;
  rows: readonly Parameters<typeof writable>[0][];
  unworded?: number;
  topUp?: TopUpRecord;
}): SupplyLedger {
  const sources = Object.fromEntries(
    LEDGER_SOURCES.map((source) => [source, Object.fromEntries(LEDGER_STAGES.map((stage) => [stage, 0]))])
  ) as Record<LedgerSource, SourceCounts>;
  for (const stage of LEDGER_STAGES) {
    for (const source of a.stages[stage] ?? []) sources[source][stage] += 1;
  }
  const have = a.rows.filter(writable).length;
  return {
    sources,
    have,
    short: Math.max(0, PLAN_DEPTH - have),
    dry: LEDGER_SOURCES.filter((source) => sources[source].added === 0),
    unworded: a.unworded ?? 0,
    ...(a.topUp === undefined ? {} : { topUp: a.topUp }),
  };
}
