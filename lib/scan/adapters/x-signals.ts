/**
 * X (Twitter) real-time pain signals — RESERVED SLOT, intentionally disabled.
 *
 * ChannelIntel wants live X posts where people describe the problem a product
 * solves (and competitor frustrations). X post-reads cost ~$0.005 each and a
 * typical scan runs $0.50–$1.00 — more than the entire current paid budget — so
 * this is deferred. The interface below is the seam a future phase fills in
 * (wire a real client, add an env key + budget) without refactoring callers.
 *
 * Until then `gatherXSignals` is a no-op that returns []. The `xSignals` demand
 * source is declared but disabled.
 */

/** One pain/competitor signal observed on X. */
export interface XSignal {
  /** Post URL. */
  url: string;
  /** Post text (trimmed). */
  text: string;
  /** Author handle. */
  author: string;
  /** Engagement proxy (likes + reposts) when available. */
  engagement: number;
  /** ISO timestamp. */
  postedAt: string | null;
}

/** Demand-source identifiers. `x` is declared but disabled (see module note). */
export const DEMAND_SOURCES = ["reddit", "hacker_news", "x"] as const;
export type DemandSource = (typeof DEMAND_SOURCES)[number];

/** Whether the X source is wired. Always false until the adapter is implemented. */
export const X_SIGNALS_ENABLED = false;

/**
 * RESERVED: gather X pain signals for a query. Disabled — returns [] so callers
 * can opt in without branching. Implement against the X API here (and gate on a
 * dedicated budget) to turn it on.
 */
export async function gatherXSignals(_query: string): Promise<XSignal[]> {
  void _query;
  return [];
}
