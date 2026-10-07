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
  /** The keywords a buyer types to find the product, lower-cased (D50):
   *  its name, unless most people typing that want something else, and the
   *  name as buyers qualify it ("notion calendar"). Empty where nothing a
   *  buyer types means this product. Absent on a rival concluded before
   *  D50, which is read under its name. */
  searchNames?: readonly string[];
  /** Its brand's searches a month in the market's location, the most under
   *  any of `searchNames` (SPEC §6, owner D50 of 2026-10-05, issue 1271).
   *  Absent until a pass has read it. */
  volume?: number;
}

/** How often the business's and its rival candidates' brands are searched
 *  (D50). `brands` is keyed by the keyword read, lower-cased, and holds
 *  every candidate a pass read, so the next pass buys only new names. */
export interface BrandDemand {
  /** When the volumes were read, ISO. */
  at: string;
  /** The business's own brand, searches a month. */
  own: number;
  brands: Readonly<Record<string, number>>;
  /** The derived comparison searches ("profound alternatives", "profound
   *  vs otterly") and their monthly volume, read in the same call as the
   *  brands (SPEC §6, owner D64, issue 1301). Never a brand: nothing that
   *  reads `brands` as the products of a market reads these. */
  searches?: Readonly<Record<string, number>>;
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
  /** Brand search volume for the business and its rival candidates (D50).
   *  Absent until a pass has read it. */
  demand?: BrandDemand;
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
