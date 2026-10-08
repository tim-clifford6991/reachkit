// src/lib/market/infer/read-terms.ts — a market's search terms, bought
// (SPEC §6, owner D49 of 2026-10-05, issue 1270): one model call proposes
// the candidates and one keyword-overview call reads their volume. What is
// done with them is `terms.ts`.
import type { Locale } from "@/lib/locale/locales";
import { z } from "zod";
import { MARKET_TERMS } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { llm } from "@/lib/llm";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import { candidateTerms, searchedTerms } from "./terms";
import type { MarketConclusion } from "./types";

export const TERMS_SCHEMA = z.strictObject({
  terms: z.preprocess(
    (value) => (Array.isArray(value) && value.length > MARKET_TERMS.MAX ? value.slice(0, MARKET_TERMS.MAX) : value),
    z.array(z.strictObject({ term: z.string(), otherMeaning: z.boolean() })).max(MARKET_TERMS.MAX)
  ),
});

export type TermsAnswer = z.infer<typeof TERMS_SCHEMA>;

export const TERMS_TASK = [
  "You list the search terms with the most monthly Google searches for the market given.",
  "The market's category and synonyms are labels taken from one company's own copy and may be invented: do not repeat one unless it is what the industry really calls this. Start from what you know of the industry: the names analysts, vendors and trade press use for this category, each acronym spelled out, and the short head terms a buyer types when they shop for it. Most of the list is those established names, 2 or 3 words each, with and without a word like \"tool\" or \"software\". At most three are the outcome in a buyer's own words (for a project-tracking market: \"track team tasks\").",
  "Every term is on this market: a buyer who types it wants what this business sells. Never a term for a market on notOurMarket, never a company or product name, never a question, and no year.",
  "Write each term as a sentence would: lower case, with only acronyms and product names of search engines or assistants in capitals (\"CRM software\", \"email marketing for Shopify\").",
  "otherMeaning is true where most people typing that exact phrase want something else — a bare acronym or a word that belongs to another field.",
].join(" ");

export const TERMS_FIELDS = Object.freeze({
  terms: `up to ${MARKET_TERMS.MAX} objects {term, otherMeaning}, the most searched first`,
});

/**
 * The market's terms, read: one `haiku` call for the candidates and one
 * keyword-overview call for their volume, both on the caller's money.
 * Unmeasured where either did not come back — the market then keeps what
 * it had, and the next pass asks again.
 */
export async function readMarketTerms(
  c: CostContext,
  a: { market: MarketConclusion; siteName: string | null; domain: string; at: Date; locale: Locale }
): Promise<Measured<Required<Pick<MarketConclusion, "terms" | "searchTerm" | "termsAt">>>> {
  const { market } = a;
  const answer = await llm(c, {
    site: "market-terms",
    input: {
      task: TERMS_TASK,
      fields: TERMS_FIELDS,
      market: {
        category: market.category,
        synonyms: market.synonyms,
        buyer: market.buyer,
        job: market.job,
        notOurMarket: market.notOurMarket,
        rivals: market.rivals.map((r) => ({ name: r.name, reason: r.reason })),
      },
    },
    schema: TERMS_SCHEMA,
    tier: "sonnet",
    locale: a.locale,
  });
  if (answer.kind === "unmeasured") return unmeasured(answer.reason, answer.at, answer.because);
  const brands = [a.siteName ?? "", a.domain.split(".")[0] ?? "", ...market.rivals.flatMap((r) => [r.name, r.domain.split(".")[0] ?? ""])];
  const candidates = candidateTerms(answer.value.terms, { brands, keep: market.terms ?? [] });
  if (candidates.length === 0) return unmeasured("not_attempted", a.at);

  const { keywordOverview } = await import("@/lib/vendors/dataforseo");
  const volumes = await keywordOverview(c, { keywords: candidates.map((x) => x.term), locale: a.locale });
  if (volumes.kind === "unmeasured") return unmeasured(volumes.reason, volumes.at, volumes.because);
  return measured({ ...searchedTerms(candidates, volumes.value), termsAt: a.at.toISOString() }, a.at);
}

// ── D65: the searches a pass is about to measure, judged ───────────────────

/** How many searches one judgement reads: the twelve and their runners-up. */
export const JUDGED_SEARCHES_MAX = 24;

const VERDICTS = ["on_market", "other_meaning", "other_market", "company_name"] as const;

export const SEARCHES_SCHEMA = z.strictObject({
  searches: z.array(z.strictObject({ search: z.string(), verdict: z.enum(VERDICTS) })).max(JUDGED_SEARCHES_MAX * 2),
});

export const SEARCHES_TASK = [
  "You judge Google searches against one market. A business is about to measure where it stands for each search, and a search that is not its market measures nothing.",
  "For each search under `searches`, answer one verdict, and answer for every search exactly as it is written.",
  "on_market: most people who type it want what this business sells, or are choosing among or learning about products that do its job.",
  "other_meaning: the phrase mostly means something else to the people who type it — a word or acronym that belongs to another field, or a broader subject where this market is a small part of what they want.",
  "other_market: they want a different kind of product or service — one on notOurMarket, or a service bought from an agency or a professional where this business sells a product (or the reverse).",
  "company_name: the search is the name of a company, a product or a website, typed to go there. A name beside another word (\"alternatives\", \"pricing\", \"vs\") is not this.",
  "Judge what the searcher wants, never how the business would like to be found. Where you cannot tell, answer on_market.",
].join(" ");

/**
 * The searches judged against the market (SPEC §6, owner D65, issue 1303):
 * the same judgement the terms call makes of a term that mostly means
 * something else, asked of the searches a pass selected. `true` where a
 * search is on the market. A search the answer left out is not judged.
 */
export async function judgeSearches(
  c: CostContext,
  a: { market: MarketConclusion; searches: readonly string[]; locale?: Locale }
): Promise<Measured<Record<string, boolean>>> {
  const at = new Date();
  const searches = [...new Set(a.searches.map((search) => search.toLowerCase().trim()))].filter(Boolean).slice(0, JUDGED_SEARCHES_MAX);
  if (searches.length === 0) return measured({}, at);
  const { market } = a;
  const answer = await llm(c, {
    site: "market-searches",
    input: {
      task: SEARCHES_TASK,
      fields: { searches: "one object {search, verdict} for each search given, in the order given" },
      market: {
        category: market.category,
        searchedAs: (market.terms ?? []).filter((t) => t.volume > 0 && t.polluted !== true).map((t) => t.term),
        buyer: market.buyer,
        job: market.job,
        notOurMarket: market.notOurMarket,
        rivals: market.rivals.map((r) => r.name),
      },
      searches,
    },
    schema: SEARCHES_SCHEMA,
    tier: "sonnet",
    ...(a.locale === undefined ? {} : { locale: a.locale }),
  });
  if (answer.kind === "unmeasured") return unmeasured(answer.reason, answer.at, answer.because);
  const asked = new Set(searches);
  const judged: Record<string, boolean> = {};
  for (const entry of answer.value.searches) {
    const search = entry.search.toLowerCase().trim();
    if (asked.has(search)) judged[search] = entry.verdict === "on_market";
  }
  return measured(judged, answer.at);
}
