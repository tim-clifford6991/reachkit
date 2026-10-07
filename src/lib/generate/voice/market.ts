// SPEC §7 (2026-10-04, issue 1248) — the market a page is written for.
//
// The writer read its category off the stored report's own market reading,
// which is the category that pass was bought under and is not kept current.
// The market ReachKit concludes and re-checks each pass is `sites.market`
// (D28), so that is what a page is written for: its category, who buys, the
// job, the rivals and the markets the site is not in. The report's category
// stands in only on a site no market was ever concluded for.
//
// Plain data and a pure projection: the read is the caller's
// (`@/lib/market/infer/stored`).
import { spoken, unsearched } from "@/lib/market/infer/terms";
import type { StoredMarket } from "@/lib/market/infer/types";

/** The caps a prompt holds the market to — a founder cannot lengthen it. */
const MARKET_PROMPT = { rivals: 5, notOurMarket: 6, chars: 200 } as const;

/** The market as a prompt states it. No reason lines and no synonyms: those
 *  are for the passes that measure it. */
export interface PromptMarket {
  category: string;
  /** Who buys; `null` where the conclusion holds none. */
  buyer: string | null;
  /** The job they hire the product for; `null` where it holds none. */
  job: string | null;
  /** The rivals in force, closest first. */
  rivals: readonly { name: string; domain: string }[];
  /** Adjacent markets this site is not in. */
  notOurMarket: readonly string[];
}

/** Where a page's category came from, as its row records it. */
export type MarketSource = "site" | "report";

export interface WritingMarket {
  category: string;
  from: MarketSource;
  /** The category's other names — its other searched terms where they
   *  were read (D49), else the conclusion's: what a news search is also
   *  asked (D48). Never handed to the writer. Empty where the
   *  report's category stands in, or the founder set their own. */
  synonyms: readonly string[];
  /** The market's labels nobody searches (D49): never printed, so a stored
   *  question that carries one is not a Q&A's question. Empty where the
   *  market's terms were never read. */
  unsearched: readonly string[];
  /** Every rival the conclusion names, in force or not — a founder's own
   *  choice of rivals leaves some out. Never handed to the writer: a Q&A
   *  reads it to tell which products a question names (issue 1263). */
  concluded: readonly { name: string; domain: string }[];
  /** `null` where no market is stored and the report's category stands in. */
  market: PromptMarket | null;
}

/**
 * The market's searched terms, as a search is made for each (D49): its
 * search term, then its other searched terms, most searched first — the
 * order the market stores them in. They are what a Q&A whose own SERP is
 * thin is also read beside (owner, D62; issue 1297). None where the
 * report's category stands in: no market was concluded to hold any.
 */
export function marketSearches(market: WritingMarket): string[] {
  if (market.from === "report") return [];
  return [market.category, ...market.synonyms].map((term) => term.trim()).filter((term) => term !== "");
}

function bounded(value: string): string | null {
  const text = value.trim().slice(0, MARKET_PROMPT.chars);
  return text === "" ? null : text;
}

/**
 * The market a page is written for. `site` is what `readSiteMarket`
 * returned (`null` where it could not be read); `reportCategory` is the
 * stored report's, used only where no market is stored.
 *
 * A founder's override stands (D28): a category they set is `sites.category`
 * and is used over the conclusion's, and rivals they chose are
 * `sites.competitors`, named from the conclusion where it knows them.
 *
 * The conclusion's own category and synonyms are labels (SPEC §6, D49,
 * issue 1270): the page is written for the market's search term and its
 * other searched terms, and a label nobody searches is never printed.
 * `founderBuyer` is the founder's setup answer about who buys, which
 * outranks the inferred buyer.
 */
export function writingMarket(a: {
  site: { category: string | null; competitors: readonly string[]; stored: StoredMarket } | null;
  reportCategory: string;
  founderBuyer?: string | null;
}): WritingMarket {
  const current = a.site?.stored.current ?? null;
  if (a.site === null || current === null) return { category: a.reportCategory, from: "report", synonyms: [], unsearched: [], concluded: [], market: null };

  const own = a.site.stored.categoryOverridden ? (a.site.category ?? "").trim() : "";
  const words = spoken(current);
  const category = own === "" ? words.category.trim() : own;
  const named = new Map(current.rivals.map((rival) => [rival.domain, rival.name]));
  const rivals = a.site.stored.rivalsOverridden
    ? a.site.competitors.map((domain) => ({ name: named.get(domain) ?? domain, domain }))
    : current.rivals.map((rival) => ({ name: rival.name, domain: rival.domain }));
  return {
    category,
    from: "site",
    // A category the founder set is not the one these were concluded for.
    synonyms: own === "" ? words.synonyms : [],
    unsearched: own === "" ? unsearched(current) : [],
    concluded: current.rivals.map((rival) => ({ name: rival.name, domain: rival.domain })),
    market: {
      category,
      buyer: bounded(a.founderBuyer ?? "") ?? bounded(current.buyer),
      job: bounded(current.job),
      rivals: rivals.slice(0, MARKET_PROMPT.rivals),
      notOurMarket: current.notOurMarket
        .map(bounded)
        .filter((entry): entry is string => entry !== null)
        .slice(0, MARKET_PROMPT.notOurMarket),
    },
  };
}
