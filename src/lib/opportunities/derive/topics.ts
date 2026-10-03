// SPEC §6 *Topics by business fit* (owner, 2026-09-29 and 2026-10-03; issue
// 1134) — where a topic comes from, and the write targets a pass proposes
// from the business outward.
//
// Two things, both pure:
//
//   `sourceOf`        the source of any search, decided in code from the
//                     search's own words and never from an intent kind or by
//                     the model. `ai_gap` is not decided here: it is a
//                     measured fact (an answer that names or cites a rival
//                     and not the site), so only `derive/write.ts` may claim
//                     it, and a proposed topic never can.
//   `proposedTopics`  the searches a pass proposes beside the twelve it
//                     measured: the market's own vocabulary — the buyer, the
//                     job, the synonyms, the not-our-market contrasts and
//                     the rivals — and the searches the pass read but did
//                     not ask (its market set, below the volume floor
//                     included).
//
// A proposal is not yet a candidate. The pass's one fit judgement
// (`derive/fit.ts`) scores it, and only one at fit 3 is written down: "a
// search at fit 3 is a write target even below the volume floor, including
// zero-volume problem and product-anchored searches" (owner, 2026-10-03).
import { EFFORT_BY_TYPE, TOPIC_FIT } from "@/lib/config/constants";
import type { MarketConclusion } from "@/lib/market/infer/types";
import { brandOf, classifyIntent } from "@/lib/market/questions/select";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import type { StoredReport } from "@/lib/scan/report";
import { queryKey } from "../cluster";
import { FAMILY_OF, type Evidence, type OpportunityType, type TopicSource } from "../types";
import { demandBand } from "../winnability/band";
import { qualifyingDemand } from "../winnability/bars";
import { slugify, type Candidate } from "./candidate";

const BEST_X = /\b(?:best|top)\b/;
const PRODUCT_SHAPES = /\b(?:vs|versus|alternatives?|pricing|price|cost|integrations?)\b/;
const COMPARISON_SHAPES = /\b(?:vs|versus|alternatives?)\b/;
const PROBLEM_SHAPES =
  /^(?:how|why)\b|\b(?:problems?|issues?|errors?|not working|fix|troubleshoot(?:ing)?|broken)\b/;

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function names(text: string, brands: readonly string[]): boolean {
  const padded = ` ${text} `;
  return brands.some((brand) => brand.length > 2 && padded.includes(` ${brand} `));
}

/**
 * The source of a search that no answer measured: `product` where it names
 * the site or a rival, or is a comparison, a price or an integration;
 * `best_x` for a category's "best" or "top" list; `problem` for a how, a why
 * or a pain; otherwise `category`.
 */
export function sourceOf(
  query: string,
  a: { brands: readonly string[] }
): Exclude<TopicSource, "ai_gap"> {
  const text = normalise(query);
  if (names(text, a.brands.map(normalise))) return "product";
  if (BEST_X.test(text)) return "best_x";
  if (PRODUCT_SHAPES.test(text)) return "product";
  if (PROBLEM_SHAPES.test(text)) return "problem";
  return "category";
}

/** A search the pass proposes, before its fit is known. */
export interface ProposedTopic {
  query: string;
  source: Exclude<TopicSource, "ai_gap">;
  /** The demand the pass read for it, where its market set carried the
   *  search; `null` where nothing measured it. */
  volume: number | null;
  /** The rival the search names, where it names one. */
  rival: string | null;
}

/** A phrase from the market as a search would carry it: one line, no closing
 *  punctuation, and short enough to be something a buyer types. */
function phrase(text: string, maxWords: number): string | null {
  const cleaned = text.replace(/\s+/g, " ").trim().replace(/[.?!]+$/, "");
  if (cleaned === "") return null;
  return cleaned.split(" ").length > maxWords ? null : cleaned.toLowerCase();
}

function lowerFirst(text: string): string {
  return text.length === 0 ? text : text[0]!.toLowerCase() + text.slice(1);
}

/** The brands a search may name: the site's own tokens and each rival's
 *  name and domain label. */
export function brandsOf(a: {
  report: StoredReport;
  market: MarketConclusion | null;
}): { own: string[]; rivals: string[] } {
  const own =
    a.report.market.kind === "unmeasured" ? [] : [...a.report.market.value.profile.brandTokens];
  own.push(brandOf(a.report.domain));
  const rivals: string[] = [];
  for (const rival of a.market?.rivals ?? []) rivals.push(rival.name, brandOf(rival.domain));
  if (a.report.rivals.kind !== "unmeasured") {
    for (const rival of a.report.rivals.value) rivals.push(brandOf(rival.domain));
  }
  const clean = (list: string[]) => [...new Set(list.map(normalise).filter((b) => b.length > 2))];
  return { own: clean(own), rivals: clean(rivals) };
}

/**
 * The pass's proposals, in the order SPEC §6 offers the sources: searches
 * anchored on the product, then problems, then the market set the pass read.
 * Distinct by `queryKey`, never one of `taken` (the searches the pass
 * already derived a candidate for), never one naming only the site itself,
 * and at most `max`.
 */
export function proposedTopics(a: {
  report: StoredReport;
  market: MarketConclusion | null;
  taken: readonly string[];
  ownRanked: number;
  max: number;
}): ProposedTopic[] {
  const { own, rivals } = brandsOf(a);
  const brands = [...own, ...rivals];
  const seen = new Set(a.taken.map(queryKey));
  const out: ProposedTopic[] = [];
  const volumes = new Map<string, number>();
  const suggestions = a.report.market.kind === "unmeasured" ? [] : a.report.market.value.suggestions;
  for (const row of suggestions) {
    if (!volumes.has(queryKey(row.keyword))) volumes.set(queryKey(row.keyword), row.volume);
  }
  const add = (query: string, source: ProposedTopic["source"], rival: string | null): void => {
    const key = queryKey(query);
    if (key === "" || seen.has(key) || out.length >= a.max) return;
    seen.add(key);
    out.push({ query: key, source, volume: volumes.get(key) ?? null, rival });
  };

  const market = a.market;
  if (market !== null) {
    const product = own[0] ?? null;
    const category = phrase(market.category, 6);
    const namesOfMarket = [category, ...market.synonyms.map((synonym) => phrase(synonym, 6))].filter(
      (name): name is string => name !== null
    );
    const buyer = phrase(market.buyer, 8);
    const job = phrase(market.job, 9);

    // Anchored on the product: against each rival, a rival's alternatives,
    // the category for its buyer, its price, and what it is not.
    for (const rival of market.rivals) {
      const name = phrase(rival.name, 4) ?? brandOf(rival.domain);
      add(`${name} alternatives`, "product", rival.domain);
      if (product !== null) add(`${product} vs ${name}`, "product", rival.domain);
    }
    for (const name of namesOfMarket) {
      if (buyer !== null) add(`${name} for ${buyer}`, "product", null);
      add(`${name} pricing`, "product", null);
    }
    if (category !== null) {
      for (const contrast of market.notOurMarket) {
        const other = phrase(contrast, 5);
        if (other !== null) add(`${category} vs ${other}`, "product", null);
      }
    }
    // The problem the product is hired for.
    if (job !== null) add(`how to ${lowerFirst(job)}`, "problem", null);
  }

  // What the pass read and did not ask: its market set, largest first, at
  // any volume the site may be offered. Its own name is never a topic.
  const ceiling = qualifyingDemand(a.ownRanked);
  const profile = a.report.market.kind === "unmeasured" ? null : a.report.market.value.profile;
  const read = [...suggestions]
    .filter((row) => row.volume <= ceiling)
    .filter((row) => profile === null || classifyIntent(row.keyword, profile) !== "own_brand")
    .sort((x, y) => y.volume - x.volume || (x.keyword < y.keyword ? -1 : 1));
  for (const row of read) add(row.keyword, sourceOf(row.keyword, { brands }), null);

  return out;
}

/** The first rival a proposal can point at: the one it names, else the
 *  market's closest. `null` where the site has none — then there is no
 *  rival row to write, and the proposal is not a candidate. */
function rivalFor(topic: ProposedTopic, a: { report: StoredReport; market: MarketConclusion | null }): string | null {
  if (topic.rival !== null) return topic.rival;
  const concluded = a.market?.rivals[0]?.domain;
  if (concluded !== undefined) return concluded;
  return a.report.rivals.kind === "unmeasured" ? null : (a.report.rivals.value[0]?.domain ?? null);
}

/**
 * A proposal the pass judged at the top fit, as a Write candidate.
 *
 * Nothing about it was measured in a top ten, and nothing here says it was:
 * its rival's address and position are `unmeasured`, its volume is the
 * market set's reading or `unmeasured`, and its acceptance is the plain
 * top-20 test. It never claims an AI-answer gap. `null` where the search is
 * outsized for the site, or the site has no rival to point it at.
 */
export function candidateFor(
  topic: ProposedTopic,
  a: { siteId: string; scanId: string; report: StoredReport; market: MarketConclusion | null; ownRanked: number }
): Candidate | null {
  const at = a.report.verdict.measuredAt;
  const rival = rivalFor(topic, a);
  if (rival === null) return null;
  const band = topic.volume === null ? "winnable" : demandBand({ volume: topic.volume, ownRanked: a.ownRanked });
  if (band === "not-yet") return null;

  const volume: Measured<number> =
    topic.volume === null ? unmeasured<number>("not_attempted", at) : measured(topic.volume, at);
  const type: OpportunityType = COMPARISON_SHAPES.test(topic.query) ? "comparison_page" : "keyword_page";
  const evidence: Evidence = {
    family: "write",
    query: topic.query,
    volume,
    rival: {
      domain: rival,
      url: unmeasured<string>("not_attempted", at),
      position: unmeasured<number>("not_attempted", at),
    },
  };
  return {
    siteId: a.siteId,
    scanId: a.scanId,
    type,
    family: FAMILY_OF[type],
    targetQuery: topic.query,
    targetRef: slugify(topic.query),
    title: null,
    volume,
    evidence,
    acceptance: { form: "top20", query: topic.query },
    fitBand: band,
    businessFit: TOPIC_FIT.writeAt,
    source: topic.source,
    effort: EFFORT_BY_TYPE[type],
  };
}
