// src/lib/market/infer/types.ts — the market and rivals ReachKit concludes
// for a site, with a reason for each (SPEC §0 Market and Rival, §5 and §6,
// owner D28 of 2026-10-02, #1185).
//
// Plain data only, so the setup screen, Settings, the passes and the
// offline proof can all name these without a runtime edge into the model
// seam.

/** What a rival was concluded from — the three kinds of evidence #1185
 *  names, in its own order. */
export type RivalBasis = "ai_answer" | "ranks" | "same_job";

export interface RivalConclusion {
  /** Registrable domain, lower-cased. */
  domain: string;
  /** The product's own name, as a buyer says it. */
  name: string;
  basis: RivalBasis;
  /** One line: why this is a rival. */
  reason: string;
}

/** The structured market (#1159), concluded from evidence. */
export interface MarketConclusion {
  /** Who buys. */
  buyer: string;
  /** The job they hire the product for. */
  job: string;
  /** The category, in the words a buyer would search. */
  category: string;
  /** Two to four other names buyers use for the same category. */
  synonyms: readonly string[];
  differentiators: readonly string[];
  /** Adjacent markets this site is not in — the head categories a guess
   *  could slide into. */
  notOurMarket: readonly string[];
  /** One line: why this category. */
  categoryReason: string;
  /** Three to five real competitors, closest first. */
  rivals: readonly RivalConclusion[];
}

/**
 * What `sites.market` holds: the market in force, the one a pass inferred
 * that differs from it and waits for a second pass, and the founder's
 * overrides. `current` is what the passes measure; a field the founder
 * overrode is never replaced by a conclusion (D28).
 */
export interface StoredMarket {
  current: MarketConclusion | null;
  /** When `current` was adopted, ISO. */
  adoptedAt: string | null;
  /** A differing conclusion seen once, waiting to be seen again. */
  pending: MarketConclusion | null;
  /** True where the founder set the category themselves. */
  categoryOverridden: boolean;
  /** True where the founder set the rivals themselves. */
  rivalsOverridden: boolean;
}

export const EMPTY_STORED_MARKET: StoredMarket = Object.freeze({
  current: null,
  adoptedAt: null,
  pending: null,
  categoryOverridden: false,
  rivalsOverridden: false,
});
