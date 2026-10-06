// src/lib/market/infer/types.ts — the market and rivals ReachKit concludes
// for a site, with a reason for each (SPEC §0 Market and Rival, §5 and §6,
// owner D28 of 2026-10-02, #1185).
//
// Plain data only, so the setup screen, Settings, the passes and the
// offline proof can all name these without a runtime edge into the model
// seam.

/** §0: a site has 3–5 rivals. */
export const RIVALS_MAX = 5;

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

/** One search term buyers type for the market, with how often it is
 *  searched (SPEC §6, owner D49 of 2026-10-05, issue 1270). */
export interface MarketTerm {
  /** As a title would write it: "AI SEO", "generative engine optimization". */
  term: string;
  /** Searches a month in the market's location. 0 where the vendor has
   *  none: the term stays internal and is never printed. */
  volume: number;
  /** True where the phrase mostly means something else to the people who
   *  type it ("geo", "aeo"). Never the search term, never printed. */
  polluted?: true;
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
  /** The market's candidate search terms with their measured volume, most
   *  searched first (D49). Absent until a pass has read them. */
  terms?: readonly MarketTerm[];
  /** The most-searched term that is on the market and not polluted by
   *  another meaning; `null` where none of `terms` is searched (D49). */
  searchTerm?: string | null;
  /** When `terms` were read, ISO. */
  termsAt?: string;
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
