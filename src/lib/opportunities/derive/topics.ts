// SPEC §6 *Topics by business fit*: where a topic comes from, and the write targets a pass proposes from the business outward.
// Pure. `sourceOf` reads a search's own words, never `ai_gap`, which only a measured answer claims (`write.ts`, `market/competitor-wins.ts`).
// `proposedTopics` are the searches beside the twelve measured; the one fit judgement writes down only those at fit 3.
import { PRICE_FILLER, SHAPES, languagePack } from "@/lib/locale/language";
import { LANGUAGES, measuredLocale, type Language } from "@/lib/locale/locales";
import { ASKED_TOPICS, CONTENT_MIX, EFFORT_BY_TYPE, TOPIC_FIT } from "@/lib/config/constants";
import { comparisonsOf, ownSearched, searched } from "@/lib/market/infer/demand";
import type { MarketConclusion } from "@/lib/market/infer/types";
import { placeOf } from "@/lib/locale/place";
import { placelessSeeds } from "@/lib/market/questions/offerings";
import { brandOf, classifyIntent, ownBrandTokens, passesRelevanceGuard, stemKey } from "@/lib/market/questions/select";
import { malformedSearch } from "@/lib/market/questions/well-formed";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import type { PromptAnswer, StoredReport } from "@/lib/scan/report";
import { queryKey } from "../cluster";
import { contentTypeOf } from "../content-type";
import { FAMILY_OF, type BusinessFit, type Evidence, type ReadTrend, type TopicSource } from "../types";
import { demandBand } from "../winnability/band";
import { qualifyingDemand } from "../winnability/bars";
import { slugify, trendRead, type Candidate } from "./candidate";

/** A "vs" that also asks for alternatives, a price or an integration is anchored on a product by those words. */
const COMPARISON_ONLY_BY_NAME = new RegExp(`${SHAPES.alternatives.source}|${SHAPES.price.source}`, "u");

/** A search or a name as these rules compare it: lower case, punctuation
 *  to spaces. Its letters stay as they are written (issue 1314): "Zuni
 *  Café" is "zuni café", never "zuni caf", in every topic it names. */
function normalise(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

/** Accents folded, for telling whether a name is said: a buyer types "zuni cafe" for Zuni Café. */
function folded(text: string): string {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function names(text: string, brands: readonly string[]): boolean {
  const padded = ` ${folded(text)} `;
  return brands.some((brand) => brand.length > 2 && padded.includes(` ${folded(brand)} `));
}

/**
 * The source of a search that no answer measured: `product` where it names
 * the site or a rival, or is a comparison, a price or an integration;
 * `best_x` for a category's "best" or "top" list; `problem` for a how, a why
 * or a pain; otherwise `category`. A "vs" between two category terms names
 * no product ("aeo vs geo") and is `category` (issue 1506): it asks what
 * two things are, and no product is its subject. `products` are the other
 * products a pass read a brand volume for, which a "vs" may name too.
 */
export function sourceOf(query: string, a: { brands: readonly string[]; products?: readonly string[] }): Exclude<TopicSource, "ai_gap"> {
  const text = normalise(query);
  if (names(text, a.brands.map(normalise))) return "product";
  if (SHAPES.best.test(text)) return "best_x";
  if (SHAPES.versus.test(text) && !COMPARISON_ONLY_BY_NAME.test(text) && !names(text, (a.products ?? []).map(normalise))) {
    return "category";
  }
  if (SHAPES.product.test(text)) return "product";
  if (SHAPES.problem.test(text)) return "problem";
  return "category";
}

/**
 * SPEC §6 (2026-10-03, issue 1208): a rival's own price is a topic only as
 * a comparison. Where `query` asks nothing but what one rival costs, the
 * rival it names and the comparison that stands in for it ("reachkit vs
 * meltwater pricing"; `null` where the site has no name to set against it,
 * or its brand is not searched (D50) — the rival's alternatives page, where
 * the rival is searched, then carries its price).
 * `null` for every other search — the site's own price and a comparison
 * that already names both included.
 */
export function rivalPriceOf(
  query: string,
  a: { own: readonly string[]; ownSearched: boolean; rivals: readonly { name: string; domain: string }[]; language?: Language }
): { rival: string; comparison: string | null } | null {
  const text = normalise(query);
  if (!SHAPES.price.test(text) || SHAPES.comparison.test(text) || names(text, a.own)) return null;
  for (const rival of a.rivals) {
    const name = normalise(rival.name);
    if (name.length <= 2 || !` ${text} `.includes(` ${name} `)) continue;
    const rest = ` ${text} `.replace(` ${name} `, " ").trim().split(" ").filter((word) => !PRICE_FILLER.has(word));
    if (rest.length > 0) return null;
    const product = a.ownSearched ? (a.own[0] ?? null) : null;
    const pack = languagePack(a.language ?? "en");
    return { rival: rival.domain, comparison: product === null ? null : pack.priceSearch(pack.versusSearch(product, name)) };
  }
  return null;
}

/**
 * SPEC §6 (owner D50 of 2026-10-05, issue 1271): whether `query` is a
 * comparison of named products that nobody searches for. True where it sets
 * the business against anything while the business's own brand is not
 * searched, and where it names products of which none is searched. A
 * comparison that names no product ("geo vs seo") is not judged here.
 *
 * A product a pass read and did not keep as a rival is still a named
 * product (issue 1285): it is known by the keyword its brand volume was
 * read under. "aeo engine alternatives" stayed open at 70 searches because
 * AEO Engine had left the rivals.
 */
export function comparisonWithoutDemand(
  query: string,
  a: { market: MarketConclusion | null; own: readonly string[] }
): boolean {
  const text = normalise(query);
  if (!SHAPES.comparison.test(text)) return false;
  const namesOwn = names(text, a.own);
  const standing = a.market?.rivals ?? [];
  const rivals = standing.filter((rival) => names(text, [normalise(rival.name), brandOf(rival.domain)]));
  const held = new Set(standing.flatMap((rival) => [rival.name, ...(rival.searchNames ?? [])].map(normalise)));
  const others = Object.entries(a.market?.demand?.brands ?? {}).filter(([keyword]) => {
    const brand = normalise(keyword);
    return !held.has(brand) && !a.own.includes(brand) && names(text, [brand]);
  });
  if (!namesOwn && rivals.length === 0 && others.length === 0) return false;
  if (namesOwn && !ownSearched(a.market)) return true;
  return !namesOwn && !rivals.some((rival) => searched(rival.volume)) && !others.some(([, volume]) => searched(volume));
}

const MARKET_SUFFIX = /\s+(?:tools?|software|platforms?|apps?|systems?)$/;

/**
 * SPEC §6: why a topic is no longer relevant to the market in force, or `null` where it still is.
 * `former_rival`: it names a product a pass read as a rival and did not keep, known by its brand-volume keyword; judged
 * only where the volumes were read and the market holds rivals. `not_our_market`: it uses a `notOurMarket` phrase, or
 * that phrase without its closing "software" or "tools" where two words are left; one word alone would take "geo vs seo".
 */
export function noLongerRelevant(
  query: string,
  a: { market: MarketConclusion | null; own: readonly string[] }
): "former_rival" | "not_our_market" | null {
  if (a.market === null) return null;
  const text = normalise(query);
  for (const contrast of a.market.notOurMarket) {
    const phrase = normalise(contrast);
    const head = phrase.replace(MARKET_SUFFIX, "");
    const terms = [phrase, ...(head.includes(" ") ? [head] : [])].filter((term) => term.length > 2);
    if (names(text, terms)) return "not_our_market";
  }
  if (a.market.demand === undefined || a.market.rivals.length === 0) return null;
  const held = new Set(
    a.market.rivals.flatMap((rival) => [rival.name, brandOf(rival.domain), ...(rival.searchNames ?? [])].map(normalise))
  );
  const own = new Set(a.own.map(normalise));
  const former = Object.keys(a.market.demand.brands)
    .map(normalise)
    .filter((brand) => !held.has(brand) && !own.has(brand));
  return names(text, former) ? "former_rival" : null;
}

/** Whether a search is only a rival's brand name: navigational, so no page of this business answers it. A rival's name
 *  beside anything else ("otterly pricing") is another search. Names are the rivals' search names and the read brands. */
export function rivalBrandOnly(
  query: string,
  a: { market: MarketConclusion | null; own: readonly string[]; rivals: readonly string[] }
): boolean {
  const text = normalise(query);
  if (text === "" || a.own.includes(text)) return false;
  const brands = new Set(a.rivals.map(normalise));
  for (const rival of a.market?.rivals ?? []) {
    for (const name of [rival.name, rival.domain, brandOf(rival.domain), ...(rival.searchNames ?? [])]) brands.add(normalise(name));
  }
  for (const keyword of Object.keys(a.market?.demand?.brands ?? {})) brands.add(normalise(keyword));
  return brands.has(text);
}

/** The products a search names, as one comparable string: two searches worded alike are one question only where they
 *  name the same products, as a buyer leaving one product is not a buyer leaving another. */
export function productsNamed(query: string, a: { market: MarketConclusion | null; rivals: readonly string[] }): string {
  const text = ` ${normalise(query)} `;
  const brands = new Set(a.rivals.map(normalise));
  for (const rival of a.market?.rivals ?? []) {
    for (const name of [rival.name, brandOf(rival.domain), ...(rival.searchNames ?? [])]) brands.add(normalise(name));
  }
  for (const keyword of Object.keys(a.market?.demand?.brands ?? {})) brands.add(normalise(keyword));
  // The first word of a name is the product ("otterly ai" is Otterly).
  const named = [...brands].filter((brand) => brand.length > 2 && text.includes(` ${brand} `)).map((brand) => brand.split(" ")[0]!);
  return [...new Set(named)].sort().join(" ");
}

export function rivalNamesOf(a: { report: StoredReport; market: MarketConclusion | null }): { name: string; domain: string }[] {
  const concluded = (a.market?.rivals ?? []).flatMap(({ name, domain }) => [{ name, domain }, { name: brandOf(domain), domain }]);
  const read = a.report.rivals.kind === "unmeasured" ? [] : a.report.rivals.value.map(({ domain }) => ({ name: brandOf(domain), domain }));
  return [...concluded, ...read];
}

/** A search the pass proposes, before its fit is known. */
export interface ProposedTopic {
  query: string;
  source: TopicSource;
  /** The demand the pass read for it, where its market set carried the search; `null` where nothing measured it. */
  volume: number | null;
  /** The rival the search names, where it names one. */
  rival: string | null;
  /** Where buyers were seen asking it (issue 1519): the search whose SERP showed it and when that SERP was bought. */
  asked?: { term: string; serpAt: Date; newSince?: Date };
  /** The trend the market set read for it, where the vendor gave one. */
  trend?: Omit<ReadTrend, "at">;
  /** Issue 1520: a search ReachKit composed from the market's own words
   *  (`composedSearches`), not one anyone was seen typing. */
  composed?: true;
  /** Composed from a further line the business sells (issue 1454). */
  offering?: true;
  /** The competitor's page an AI answer linked, which proposed it. */
  cited?: string;
  /** The tracked prompt whose answer gave a competitor and not the site (`market/competitor-wins.ts`). */
  prompt?: { id: string; text: string };
  win?: Extract<Evidence, { family: "write" }>["win"];
}

/** A phrase from the market as a search would carry it: one line, no closing
 *  punctuation, and short enough to be something a buyer types. */
function phrase(text: string, maxWords: number): string | null {
  const cleaned = text.replace(/\s+/g, " ").trim().replace(/[.?!]+$/, "");
  if (cleaned === "") return null;
  return cleaned.split(" ").length > maxWords ? null : cleaned.toLowerCase();
}

/** The brands a search may name: the site's own tokens and each rival's name and domain label. */
export function brandsOf(a: {
  report: StoredReport;
  market: MarketConclusion | null;
}): { own: string[]; rivals: string[] } {
  const own = a.report.market.kind === "unmeasured" ? [] : [...ownBrandTokens(a.report.market.value.profile)];
  own.push(brandOf(a.report.domain));
  const rivals = rivalNamesOf(a).map((rival) => rival.name);
  const clean = (list: string[]) => [...new Set(list.map(normalise).filter((b) => b.length > 2))];
  return { own: clean(own), rivals: clean(rivals) };
}

/** The names a comparison is read by (issue 1506): the business's own, the
 *  rivals in force, and every other product a pass read a brand volume for
 *  (a rival it dropped is still a product). Lower case, as `normalise`. */
export interface ComparisonBrands {
  own: readonly string[];
  rivals: readonly string[];
  others: readonly string[];
  /** Each rival's name, as `rivals` holds it, to the domain a measured
   *  answer names it by (issue 1520). Absent reads no answer as naming one. */
  domains?: Readonly<Record<string, string>>;
}

export function comparisonBrands(a: { report: StoredReport | null; market: MarketConclusion | null }): ComparisonBrands {
  const { own, rivals } =
    a.report === null
      ? {
          own: [],
          rivals: [...new Set((a.market?.rivals ?? []).flatMap((rival) => [rival.name, brandOf(rival.domain)]).map(normalise).filter((b) => b.length > 2))],
        }
      : brandsOf({ report: a.report, market: a.market });
  for (const rival of a.market?.rivals ?? []) for (const name of rival.searchNames ?? []) rivals.push(normalise(name));
  const known = new Set([...own, ...rivals]);
  const others = Object.keys(a.market?.demand?.brands ?? {}).map(normalise).filter((b) => b.length > 2 && !known.has(b));
  const domains: Record<string, string> = {};
  const read = a.report === null || a.report.rivals.kind === "unmeasured" ? [] : a.report.rivals.value;
  for (const rival of read) domains[normalise(brandOf(rival.domain))] = rival.domain;
  for (const rival of a.market?.rivals ?? []) {
    for (const name of [rival.name, brandOf(rival.domain), ...(rival.searchNames ?? [])]) domains[normalise(name)] = rival.domain;
  }
  return { own, rivals, others, domains };
}

/**
 * The products a "vs" search sets against each other (issue 1506), or
 * `null` where it is not a "vs" between products: no "vs" at all, or one
 * between two category terms ("aeo vs geo"), which names none.
 */
export function brandVersus(query: string, brands: ComparisonBrands): { own: boolean; rivals: string[]; others: string[] } | null {
  const text = normalise(query);
  if (!SHAPES.versus.test(text)) return null;
  const own = names(text, brands.own);
  const rivals = brands.rivals.filter((rival) => names(text, [rival]));
  const others = brands.others.filter((other) => !brands.own.includes(other) && names(text, [other]));
  if (!own && rivals.length === 0 && others.length === 0) return null;
  return { own, rivals, others };
}

/** The products whose alternatives a search asks for (issue 1520): "{rival}
 *  alternatives", in any supported language, naming a rival or another
 *  product a pass read a brand volume for. `null` for every other search,
 *  a "vs" included. */
export function alternativesOf(query: string, brands: ComparisonBrands): { rivals: string[]; others: string[] } | null {
  const text = normalise(query);
  if (!SHAPES.alternatives.test(text) || SHAPES.versus.test(text)) return null;
  const rivals = brands.rivals.filter((rival) => names(text, [rival]));
  const others = brands.others.filter((other) => !brands.own.includes(other) && names(text, [other]));
  return rivals.length === 0 && others.length === 0 ? null : { rivals, others };
}

/** Whether `text` names `brand`, as these rules compare names. */
export function namesBrand(text: string, brand: string): boolean {
  return names(normalise(text), [normalise(brand)]);
}

/** One SERP the site's research read for what buyers ask beside it (D61,
 *  D62's store): its search, its "People also ask" and its related
 *  searches. */
export interface AskedBeside {
  term: string;
  peopleAlsoAsk: readonly string[];
  related: readonly string[];
  /** When the SERP was bought (issue 1519). Absent where the reader did not say. */
  at?: Date;
}

/** A "People also ask" question or a related search, as a topic (issue
 *  1519): the search it was seen beside and when that SERP was bought. */
export interface AskedTopic {
  query: string;
  term: string;
  serpAt: Date;
  /** The latest earlier week's read of `term`, which did not show it: first seen this week. */
  newSince?: Date;
}

/** The SERPs the report's own measured searches bought, as what buyers were
 *  seen asking beside each (issue 1519). Nothing is bought. */
export function askedOfReport(report: Pick<StoredReport, "questions" | "serps">): AskedBeside[] {
  if (report.questions.kind === "unmeasured") return [];
  return report.questions.value.flatMap((question, index) => {
    const serp = report.serps[index];
    if (serp === undefined || serp.kind === "unmeasured") return [];
    return [{ term: question.search.keyword, peopleAlsoAsk: serp.value.peopleAlsoAsk ?? [], related: serp.value.relatedSearches ?? [], at: serp.at }];
  });
}

/**
 * SPEC §6: the questions and related searches buyers were seen asking beside the site's searches, as topics: each
 * SERP's "People also ask" first, one from each SERP in turn so no one search fills the list, then its related searches
 * the same way. One line each, no closing punctuation, at most `ASKED_TOPICS.maxWords` words, never the SERP's own
 * search, distinct, from a SERP no older than `ASKED_TOPICS.maxAgeDays`, and at most `ASKED_TOPICS.max`. Pure.
 */
export function askedTopics(asked: readonly AskedBeside[], now: Date, max: number = ASKED_TOPICS.max): AskedTopic[] {
  const since = now.getTime() - ASKED_TOPICS.maxAgeDays * 86_400_000;
  const fresh = asked.filter((serp) => serp.at === undefined || serp.at.getTime() >= since);
  const out: AskedTopic[] = [];
  const seen = new Set(fresh.map((serp) => queryKey(serp.term)));
  for (const list of [(serp: AskedBeside) => serp.peopleAlsoAsk, (serp: AskedBeside) => serp.related]) {
    const longest = Math.max(0, ...fresh.map((serp) => list(serp).length));
    for (let rank = 0; rank < longest; rank += 1) {
      for (const serp of fresh) {
        const text = list(serp)[rank];
        const query = text === undefined ? null : phrase(text, ASKED_TOPICS.maxWords);
        if (query === null || seen.has(query) || out.length >= max) continue;
        seen.add(query);
        out.push({ query, term: serp.term, serpAt: serp.at ?? now, newSince: newSince(query, serp.term, asked, now) });
      }
    }
  }
  return out;
}

/** Where `query` was first shown on `term`'s results this week, the latest read of `term` from an earlier week; none where
 *  no earlier read is stored, as not measured is not new. A weekly read a day early is still an earlier week. */
function newSince(query: string, term: string, asked: readonly AskedBeside[], now: Date): Date | undefined {
  const reads = asked.flatMap((serp) => (serp.at === undefined || queryKey(serp.term) !== queryKey(term) ? [] : [{ at: serp.at.getTime(), shows: [...serp.peopleAlsoAsk, ...serp.related].some((text) => phrase(text, ASKED_TOPICS.maxWords) === query) }]));
  const first = Math.min(...reads.filter((read) => read.shows).map((read) => read.at));
  const before = Math.max(...reads.filter((read) => read.at <= first - 6 * 86_400_000).map((read) => read.at));
  return Number.isFinite(first) && first >= now.getTime() - 7 * 86_400_000 && Number.isFinite(before) ? new Date(before) : undefined;
}

/** Whether `query` names the business itself and sets it against no rival:
 *  a name search wants the business's own site, never a new page. */
export function namesOwnOnly(query: string, a: { own: readonly string[]; rivals: readonly string[] }): boolean {
  const text = normalise(query);
  return names(text, a.own) && !(SHAPES.versus.test(text) && names(text, a.rivals));
}

/** Whether a question buyers were seen asking is a topic for this site
 *  (issue 1519): on the market in force (D59), not the business's own name,
 *  and never a rival's name asked about as a word (issue 1506). */
export function askedOnMarket(
  query: string,
  a: { market: MarketConclusion | null; own: readonly string[]; rivals: readonly string[] }
): boolean {
  if (namesOwnOnly(query, a) || noLongerRelevant(query, { market: a.market, own: a.own }) !== null) return false;
  return !(names(normalise(query), a.rivals) && SHAPES.wordSense.test(normalise(query)));
}

/** Whether `query` names any of `brands` as a word (issue 1549). */
export function namesAnyBrand(query: string, brands: readonly string[]): boolean {
  return names(normalise(query), brands);
}

/** Whether `query` is something buyers were seen asking beside another
 *  search: one of its related searches, or a "People also ask" question
 *  that holds every word of it but its "vs" (issue 1506; the SEO master
 *  review of 2026-10-18). The query's own SERP does not count. */
export function askedBesideTerms(query: string, asked: readonly AskedBeside[]): boolean {
  const text = normalise(query);
  const wanted = text.split(" ").filter((word) => word !== "" && !SHAPES.versus.test(word));
  if (wanted.length === 0) return false;
  return asked.some((serp) => {
    if (normalise(serp.term) === text) return false;
    if (serp.related.some((search) => normalise(search) === text)) return true;
    return serp.peopleAlsoAsk.some((question) => {
      const said = new Set(normalise(question).split(" "));
      return wanted.every((word) => said.has(word));
    });
  });
}

/** One measured answer to a tracked prompt, as the demand rules read it. */
export type MeasuredAnswer = Pick<PromptAnswer, "promptId" | "named" | "linked" | "rivals" | "alternatives">;

/**
 * SPEC §6 (issue 1506, as issue 1520 amended it): a comparison,
 * alternatives or composed search that nothing observed anyone asking.
 * Each is observed where its volume is above zero, or where buyers were
 * seen asking it beside the market's searches (`asked`, 0¢). Beyond that:
 *
 *   - a "vs" between products, where the AI answer it was found in
 *     (`answeredRival`, a rival's domain) named one of its rivals, or a
 *     tracked prompt that names one of them was answered, in a measured
 *     answer, by one naming every side. A tracked prompt is ReachKit's own
 *     wording, and its comparison prompts set the rivals against each other
 *     by template, so a "vs" the business is no side of is not observed by
 *     one (issue 1552);
 *   - "{rival} alternatives", where a measured answer named the rival and
 *     cited an address that holds "alternative";
 *   - a search ReachKit composed (`composed`), by nothing more.
 *
 * A "vs" between two category terms, or any other search, is not one. Pure.
 */
export function comparisonUnasked(a: {
  query: string;
  volume: number;
  brands: ComparisonBrands;
  prompts: readonly { id?: string; text: string }[];
  /** The newest measured answers to the tracked prompts. Absent reads none. */
  answers?: readonly MeasuredAnswer[];
  answeredRival?: string | null;
  asked?: readonly AskedBeside[];
  composed?: boolean;
}): boolean {
  const versus = brandVersus(a.query, a.brands);
  const alternatives = versus === null ? alternativesOf(a.query, a.brands) : null;
  if ((versus === null && alternatives === null && a.composed !== true) || a.volume > 0) return false;
  if (askedBesideTerms(a.query, a.asked ?? [])) return false;
  const answers = a.answers ?? [];
  const domainOf = (name: string): string | null => a.brands.domains?.[normalise(name)] ?? null;
  if (versus !== null) {
    const named = (text: string) => versus.rivals.some((rival) => namesBrand(text, rival));
    if (a.answeredRival != null && named(brandOf(a.answeredRival))) return false;
    if (!versus.own) return true;
    // A product no answer can name, one that is not a rival, is a side no answer attests.
    const sides = new Set(versus.rivals.map(domainOf));
    if (versus.others.length > 0 || sides.has(null) || sides.size + (versus.own ? 1 : 0) < 2) return true;
    const everySide = (answer: MeasuredAnswer) =>
      (!versus.own || answer.named || answer.linked) && [...sides].every((domain) => answer.rivals.includes(domain!));
    return !a.prompts.some(
      (prompt) => named(prompt.text) && answers.some((answer) => answer.promptId === prompt.id && everySide(answer))
    );
  }
  if (alternatives !== null) {
    const domains = alternatives.rivals.map(domainOf);
    if (alternatives.others.length > 0 || domains.includes(null)) return true;
    return !answers.some(
      (answer) => (answer.alternatives ?? []).length > 0 && domains.every((domain) => answer.rivals.includes(domain!))
    );
  }
  return true;
}

/**
 * The searches a pass composes from the market's own words, in `language`
 * (issue 1520): the category and each synonym for its buyer and with its
 * price, the category against each thing it is not, and the job as a how.
 * They are ReachKit's words until someone is seen asking them.
 */
export function composedSearches(
  market: Pick<MarketConclusion, "category" | "synonyms" | "buyer" | "job" | "notOurMarket">,
  language: Language
): { query: string; source: "product" | "problem" }[] {
  const pack = languagePack(language);
  const out: { query: string; source: "product" | "problem" }[] = [];
  const category = phrase(market.category, 6);
  const namesOfMarket = [category, ...market.synonyms.map((synonym) => phrase(synonym, 6))].filter(
    (name): name is string => name !== null
  );
  const buyer = phrase(market.buyer, 8);
  const job = phrase(market.job, 9);
  for (const name of namesOfMarket) {
    if (buyer !== null) out.push({ query: pack.forBuyerSearch(name, buyer), source: "product" });
    out.push({ query: pack.priceSearch(name), source: "product" });
  }
  if (category !== null) {
    for (const contrast of market.notOurMarket) {
      const other = phrase(contrast, 5);
      if (other !== null) out.push({ query: pack.versusSearch(category, other), source: "product" });
    }
  }
  if (job !== null) out.push({ query: pack.jobSearch(job), source: "problem" });
  return out;
}

/** Whether `query` is one of the market's composed searches in any
 *  supported language, a plural read as its singular (`stemKey`). */
export function composedSearch(
  query: string,
  market: Pick<MarketConclusion, "category" | "synonyms" | "buyer" | "job" | "notOurMarket"> | null
): boolean {
  if (market === null) return false;
  return (Object.keys(LANGUAGES) as Language[]).some((language) => {
    const key = stemKey(query, language);
    return key !== "" && composedSearches(market, language).some((composed) => stemKey(composed.query, language) === key);
  });
}

/**
 * The pass's proposals, in the order SPEC §6 offers the sources: searches
 * anchored on the product, then problems, then the market set the pass read;
 * a short site's written searches and further lines before them all.
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
  /** The comparisons standing in for a rival's own price (`rivalPriceOf`). */
  comparisons?: readonly { query: string; rival: string }[];
  /** The buyer's own searches the pass wrote (`derive/buyer-searches.ts`), problems first. */
  written?: readonly string[];
  /** The language the searches composed here are written in (D66). Absent is English. */
  language?: Language;
  /** What buyers were seen asking beside the site's searches (`askedTopics`, issue 1519). */
  asked?: readonly AskedTopic[];
  /** The SERPs buyers were seen asking beside, which a one-place business's rival alternatives need (issue 1520). */
  seen?: readonly AskedBeside[];
  /** The site holds under `PLAN_DEPTH` writable rows; then `area`, the place it serves, is never in an offering's topic. */
  short?: boolean;
  area?: MarketConclusion["serves"];
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
  const trends = new Map(suggestions.map((row) => [queryKey(row.keyword), row.trend] as const).reverse());
  // SPEC §6: a comparison search the pass read the volume of carries it; one nobody searches stays unmeasured.
  for (const [search, volume] of Object.entries(a.market?.demand?.searches ?? {})) {
    if (volume > 0 && !volumes.has(queryKey(search))) volumes.set(queryKey(search), volume);
  }
  const add = (query: string, source: ProposedTopic["source"], rival: string | null, more: Pick<ProposedTopic, "asked" | "composed" | "cited" | "offering"> = {}): void => {
    const key = queryKey(query);
    if (key === "" || seen.has(key) || out.length >= a.max) return;
    if (rivalBrandOnly(key, { market: a.market, own, rivals }) || namesOwnOnly(key, { own, rivals })) return;
    // Issue 1314: a search nobody would type as it stands is no topic.
    if (malformedSearch(key, a.market?.rivals) !== null) return;
    // A comparison of names nobody searches is no topic, unless the pass read demand for the search itself.
    if (!volumes.has(key) && comparisonWithoutDemand(key, { market: a.market, own })) return;
    seen.add(key);
    out.push({ query: key, source, volume: volumes.get(key) ?? null, rival, ...(trends.get(key) === undefined ? {} : { trend: trends.get(key) }), ...more });
  };

  const market = a.market;
  const language = a.language ?? "en";
  const profile = a.report.market.kind === "unmeasured" ? null : a.report.market.value.profile;
  // A short site is offered its buyers' own searches and its further lines first, so `max` cuts a comparison instead.
  for (const search of a.short === true ? (a.written ?? []) : []) add(search, sourceOf(search, { brands }), null);
  if (a.short === true && market !== null && profile !== null) {
    const places = [market.serves ?? null, a.area ?? null, placeOf(profile.town)].filter((place) => place !== null);
    for (const category of placelessSeeds({ ...profile, language }, places)) {
      const line = { category, synonyms: [], buyer: market.buyer, job: "", notOurMarket: [] };
      for (const composed of composedSearches(line, language)) add(composed.query, composed.source, null, { composed: true, offering: true });
    }
  }

  for (const comparison of a.comparisons ?? []) add(comparison.query, "product", comparison.rival);

  if (market !== null) {
    const product = own[0] ?? null;
    // Issue 1520: a business that serves one place is offered a rival's
    // alternatives only where buyers were seen asking for them — its
    // rivals' names are what buyers type to reach those rivals.
    const compared = comparisonBrands({ report: a.report, market });
    const unasked = (query: string): boolean =>
      market.serves != null &&
      alternativesOf(query, compared) !== null &&
      comparisonUnasked({
        query,
        volume: volumes.get(queryKey(query)) ?? 0,
        brands: compared,
        prompts: a.report.prompts?.asked ?? [],
        answers: a.report.prompts?.answers ?? [],
        asked: a.seen ?? [],
      });

    // Anchored on the product: a searched rival's alternatives, the
    // product against each rival where its own brand is searched — else the
    // most-searched rivals against each other (D50) — the category for its
    // buyer, its price, and what it is not.
    // D50's comparisons, by the one derivation the pass read volumes for (D64).
    for (const comparison of comparisonsOf({ rivals: market.rivals, product, ownSearched: ownSearched(market), searchedOnly: true, language })) {
      if (!unasked(comparison.query)) add(comparison.query, "product", comparison.rival);
    }
    for (const search of a.written ?? []) add(search, sourceOf(search, { brands }), null);
    // The market's own names, what it is not, and the problem the product is
    // hired for. They are the vendor's words until the pass's "would a buyer
    // search this?" check says a buyer types them, and composed (issue 1520)
    // until someone is seen asking them.
    for (const composed of composedSearches(market, language)) add(composed.query, composed.source, null, { composed: true });
  }

  // What buyers were seen asking beside the site's searches, on the market in force and never a rival's name as a word.
  for (const topic of a.asked ?? []) {
    if (!askedOnMarket(topic.query, { market: a.market, own, rivals })) continue;
    add(topic.query, sourceOf(topic.query, { brands }), null, { asked: { term: topic.term, serpAt: topic.serpAt, newSince: topic.newSince } });
  }

  // What the pass read and did not ask: its market set, largest first, at any volume the site may be offered; never its own name.
  const ceiling = qualifyingDemand(a.ownRanked);
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

/** The type a proposed search's Write row takes. */
export const writeTypeOf = (query: string) => (SHAPES.comparison.test(query) ? "comparison_page" : "keyword_page");

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
  const type = writeTypeOf(topic.query);
  const evidence: Evidence = {
    family: "write",
    query: topic.query,
    volume,
    rival: {
      domain: rival,
      url: topic.cited === undefined ? unmeasured<string>("not_attempted", at) : measured(topic.cited, at),
      position: unmeasured<number>("not_attempted", at),
    },
    ...(topic.asked === undefined ? {} : { askedBeside: topic.asked }),
    ...trendRead(topic.trend, at),
    ...(topic.composed === undefined ? {} : { composed: true as const }), ...("topUp" in topic ? { topUp: true as const } : {}),
    ...(topic.prompt === undefined ? {} : { prompt: topic.prompt }),
    ...(topic.win === undefined ? {} : { win: topic.win }),
  };
  return {
    siteId: a.siteId,
    scanId: a.scanId,
    type,
    family: FAMILY_OF[type],
    targetQuery: topic.query,
    targetRef: slugify(topic.query, measuredLocale(a.report).language),
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

/** A question buyers were seen asking, with the fit and passage a pass judged for it, `null` where no pass has. */
export type AskedSupply = { topic: ProposedTopic; fit: BusinessFit | null; fact?: Extract<Evidence, { family: "write" }>["fitFact"]; angle?: Extract<Evidence, { family: "write" }>["angle"] };

/**
 * SPEC §7 (issue 1549): the questions buyers were seen asking that a pass
 * writes below the top fit, best first. Pure.
 *
 * The ones the pass judged to help, then the ones it never reached — those
 * asked beside the market's own searched terms first, and only where the
 * business's vocabulary supports every word and no rival is named. Each is
 * on the market, a search a buyer would type, not a rival's bare name,
 * written as a Q&A, how-to or documentation page, and
 * on no search the site already holds or dismissed. The collapse then folds
 * each into the page of the results page it was seen on.
 */
export function askedSupply(a: {
  report: StoredReport;
  market: MarketConclusion | null;
  asked: readonly AskedBeside[];
  spare: readonly AskedSupply[];
  refused: readonly string[];
  /** Every search the site already holds a row on, or absorbed. */
  taken: readonly string[];
  /** The searches of its dismissed rows. */
  dismissed: readonly string[];
  now: Date;
}): AskedSupply[] {
  const { own, rivals } = brandsOf(a);
  const brands = [...own, ...rivals];
  const seen = new Set([...a.taken, ...a.dismissed, ...a.refused].map(queryKey));
  const answers = (query: string): boolean =>
    (CONTENT_MIX.NON_COMMERCIAL_TYPES as readonly string[]).includes(contentTypeOf({ type: "keyword_page", targetQuery: query }) ?? "");
  const usable = (query: string): boolean =>
    !seen.has(queryKey(query)) &&
    answers(query) &&
    askedOnMarket(query, { market: a.market, own, rivals }) &&
    malformedSearch(query, a.market?.rivals) === null &&
    !rivalBrandOnly(query, { market: a.market, own, rivals });

  // §6.7's relevance guard holds a question no pass judged, such as an acronym's other field. No profile, none.
  const profile = a.report.market.kind === "unmeasured" ? null : a.report.market.value.profile;
  const marketWords = [a.market?.category ?? "", ...(a.market?.synonyms ?? [])].filter((word) => word.trim() !== "").join(" ");
  const onTopic = (query: string): boolean =>
    profile !== null &&
    passesRelevanceGuard(query, profile, marketWords === "" ? undefined : marketWords) &&
    !namesAnyBrand(query, rivals);

  const out: AskedSupply[] = [];
  const take = (supply: AskedSupply): void => {
    if (!usable(supply.topic.query) || (supply.fit === null && !onTopic(supply.topic.query))) return;
    seen.add(queryKey(supply.topic.query));
    out.push(supply);
  };
  for (const spare of a.spare) take(spare);

  const terms = new Set(
    a.report.questions.kind === "unmeasured"
      ? []
      : a.report.questions.value.filter((question) => question.search.term === true).map((question) => queryKey(question.search.keyword))
  );
  const byTerm = [...a.asked].sort((x, y) => Number(terms.has(queryKey(y.term))) - Number(terms.has(queryKey(x.term))));
  for (const asked of askedTopics(byTerm, a.now, Number.POSITIVE_INFINITY)) {
    take({ topic: { query: queryKey(asked.query), source: sourceOf(asked.query, { brands }), volume: null, rival: null, asked: { term: asked.term, serpAt: asked.serpAt, newSince: asked.newSince } }, fit: null });
  }
  return out;
}
