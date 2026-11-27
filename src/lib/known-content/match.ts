// SPEC §7 (2026-09-20, #928) — "Known content": is this topic already
// covered, and by which page?
//
// Pure. The shortlist is read out of Postgres (`store.ts`), the score is
// `topicSimilarity`'s, and the decision is here — which is what lets the
// whole of the net-new rule be asserted without a database.
//
// **A topic is matched by its words, not by its address.** A planned page
// has a target search and, once typed, a proposed title; a known page has a
// title and its own headings. Every candidate text is compared against
// every page text and the best pair wins, so a post whose *heading* is the
// topic is found even where its title is a house style ("Notes from the
// studio"). Each comparison is short against short, which is what the
// threshold was measured on: folding a page's headings into one string
// would dilute every score by the length of the page.
import { KNOWN_CONTENT } from "@/lib/config/constants";
import { marketTokens, type MarketWords } from "@/lib/market/infer/terms";
import type { MarketConclusion } from "@/lib/market/infer/types";
import { brandOf } from "@/lib/market/questions/select";
import { namesBrand } from "@/lib/opportunities/derive/topics";
import { topicSimilarity } from "./similarity";
import type { KnownMatch, KnownPage } from "./types";

/** The words a planned page is about: its target search, and its proposed
 *  title where the typing step has given it one. */
export interface PlannedTopic {
  query: string | null;
  title?: string | null;
  /** A list or comparison topic only: the business and its tracked rivals, which such a page compares, and the pages naming them. */
  products?: { names: readonly string[]; pages: readonly KnownPage[] };
}

/** The business and its tracked rivals, by name. */
export function productsOf(domain: string, market: Pick<MarketConclusion, "rivals"> | null): string[] {
  return [brandOf(domain), ...(market?.rivals ?? []).map((rival) => rival.name)];
}

/** A live page whose headings name the products this topic's page would compare, all but at most one and at most one
 *  other: the same products in the same shape are the same question, however the search is worded. */
function sameProducts(topic: PlannedTopic, page: KnownPage): boolean {
  const all = topic.products?.names ?? [];
  if (!page.live || page.url === null || all.length === 0) return false;
  const asked = all.filter((product) => namesBrand(topic.query ?? "", product));
  const mine = asked.length >= 2 ? asked : all;
  const named = all.filter((product) => page.headings.some((heading) => namesBrand(heading, product)));
  return mine.length >= 3 && mine.filter((p) => !named.includes(p)).length <= 1 && named.filter((p) => !mine.includes(p)).length <= 1;
}

function textsOf(topic: PlannedTopic): string[] {
  return [topic.query, topic.title].filter((text): text is string => (text ?? "").trim() !== "");
}

function pageTexts(page: KnownPage): string[] {
  return [page.title, ...page.headings.slice(0, KNOWN_CONTENT.HEADINGS_COMPARED)]
    .map((text) => text.trim())
    .filter((text) => text !== "");
}

/** How close one known page is to one planned topic: the best pair of
 *  texts, either side. Where both name the site's market, also as the market's own words read them. */
export function pageScore(topic: PlannedTopic, page: KnownPage, market?: MarketWords | null): number {
  let best = 0;
  for (const mine of textsOf(topic)) {
    for (const theirs of pageTexts(page)) {
      const score = Math.max(topicSimilarity(mine, theirs), inMarketWords(mine, theirs, market));
      if (score > best) best = score;
    }
  }
  return best;
}

function inMarketWords(mine: string, theirs: string, market: MarketWords | null | undefined): number {
  if (market == null) return 0;
  const [a, b] = [marketTokens(mine, market), marketTokens(theirs, market)];
  if (!a.joined || !b.joined) return 0;
  const score = topicSimilarity(a.tokens.join(" "), b.tokens.join(" "));
  const [kind, other] = [kindOf(mine), kindOf(theirs)];
  if (kind === null || other === null) return score;
  // The market's price page or its definition answers every rewording of that one question, and only that one (ruling 110).
  return kind === other ? Math.max(score, KNOWN_CONTENT.COVERED_MIN) : 0;
}

const KINDS = [
  { kind: "price", words: /\b(?:prices?|pricing|priced|costs?|costing|how much)\b|[€$£]\s?\d|\d\s?(?:€|eur|usd|gbp)\b/ },
  { kind: "definition", words: /\bwhat\s+(?:is|are)\b|\bwhat\b.*\bmeans?\b|\bmeaning\b|\bdefinition\b/ },
] as const;

/** The question a text asks of its subject, where it is one every wording folds to: what it costs, or what it is. */
function kindOf(text: string): (typeof KINDS)[number]["kind"] | null {
  const lower = text.toLowerCase();
  return KINDS.find((k) => k.words.test(lower))?.kind ?? null;
}

/**
 * The closest page the site already has, or `null` where none is close at
 * all. Ties break on the page a reader can open, then on the newest — a
 * live page is the better answer to both questions this index is asked.
 */
export function closestKnown(topic: PlannedTopic, pages: readonly KnownPage[], market?: MarketWords | null): KnownMatch | null {
  let best: KnownMatch | null = null;
  for (const page of pages) {
    const score = pageScore(topic, page, market);
    if (score <= 0) continue;
    if (best === null || score > best.score || (score === best.score && better(page, best.page))) {
      best = { page, score };
    }
  }
  return best;
}

function better(page: KnownPage, than: KnownPage): boolean {
  if (page.live !== than.live) return page.live;
  return (page.publishedAt?.getTime() ?? 0) > (than.publishedAt?.getTime() ?? 0);
}

/**
 * Whether the site already covers this topic: a page close enough in words (the market's price or definition question
 * in any wording among them), or else a live page on the same products.
 *
 * One threshold, `KNOWN_CONTENT.COVERED_MIN`, read here and nowhere else:
 * the rule is "never write the same page twice", not a per-customer
 * setting, and there is no argument through which one could arrive.
 */
export function alreadyCovered(topic: PlannedTopic, pages: readonly KnownPage[], market?: MarketWords | null): KnownMatch | null {
  const closest = closestKnown(topic, pages, market);
  if (closest !== null && closest.score >= KNOWN_CONTENT.COVERED_MIN) return closest;
  const [same] = [...pages, ...(topic.products?.pages ?? [])].filter((page) => sameProducts(topic, page)).sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0));
  return same === undefined ? null : { page: same, score: pageScore(topic, same, market) };
}
