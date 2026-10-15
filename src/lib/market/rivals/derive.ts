// src/lib/market/rivals/derive.ts — BUILD §6.6, zero extra cost
//
// The market decides who the rivals are; the customer's own rankings never
// enter. §6.6's cold-start law is held here by construction rather than by
// a branch: this function reads twelve SERPs and an own-domain string, and
// there is no argument through which a customer's ranked count, presence
// or history could reach it. The output is identical whether the customer
// ranks for 10,000 searches or for none — the property the cold-start test
// pins directly. The one exception is the bands a paid pass already holds
// (issue 858): right-sizing keeps a rival far beyond the site out of its
// rivals, and a pass that holds no band derives exactly as before.
//
// **This module buys nothing.** §6.6: "Zero extra cost — it counts over
// SERPs already bought." It resolves no import into `src/lib/vendors/`,
// `src/lib/costs/` or `src/lib/llm/` and takes no cost context, so there
// is no call here that could spend; `tests/market/rivals/derive.test.ts`
// asserts that over this file's source.
//
// Domain normalisation, the platform partition and the own-domain test are
// all `./domains`' — one implementation in the product, not two.
import { BATTERY, RIVAL_SCORE } from "@/lib/config/constants";
import type { MarketSerp } from "../views";
import { isAcademicDomain, isArticleRow, isArticleUrl, isMarketplaceHost, isOwnDomain, isPlatformDomain, registrableDomain } from "./domains";

/** `band.ts`'s `RivalSizeBand`, spelled out: the free card's modules name no
 *  sizing module, not even for a type (§6.4, `size.test.ts`). */
type SizeBand = "near" | "middle" | "far";

/** §6.6's suggested-rival row. Nothing about a rival's *size* — ranked
 *  count, revenue, traffic, funding, headcount — has a field here, and
 *  §6.4's never-pull list forbids the measurement that would make such a
 *  claim true on the free path. */
export interface RivalCandidate {
  domain: string;
  top10Appearances: number;
  aiCitations: number;
  /** `top10Appearances + 2 × aiCitations` — the weights are `RIVAL_SCORE`'s
   *  (BUILD §6.1's price-book row), the arithmetic is this file's. */
  score: number;
}

interface Tally {
  domain: string;
  top10Appearances: number;
  aiCitations: number;
  /** The searches it was found on, by their index: a top-ten place, a place
   *  in the local pack or an AI citation, once a search (issue 1449). */
  searches: Set<number>;
  /** How many searches showed it in the local pack. */
  localPack: number;
  /** Its organic top-ten rows, and how many of them are articles about
   *  others. */
  organicRows: number;
  articleRows: number;
}

function scoreOf(t: Tally): number {
  return t.top10Appearances * RIVAL_SCORE.top10Weight + t.aiCitations * RIVAL_SCORE.aiCitationWeight;
}

/**
 * The four-key total order: `score` desc, then `aiCitations` desc, then
 * `top10Appearances` desc, then `domain` ascending. The last key is what
 * makes it *total* — without it two domains with identical counts would
 * come back in whatever order the input happened to put them in, and the
 * same twelve SERPs would produce two different cards.
 */
function byScoreThenDomain(a: RivalCandidate, b: RivalCandidate): number {
  return (
    b.score - a.score ||
    b.aiCitations - a.aiCitations ||
    b.top10Appearances - a.top10Appearances ||
    (a.domain < b.domain ? -1 : a.domain > b.domain ? 1 : 0)
  );
}

/**
 * §6.6's derivation, step for step: every organic top-ten domain and every
 * AI Overview reference domain across the supplied SERPs, the customer's
 * own domain stripped, the rest partitioned against `PLATFORM_DOMAINS`,
 * scored, and the top `BATTERY.COMPETITORS_MAX` returned.
 *
 * Counting is **once per SERP per domain** on both halves: a domain
 * holding positions 3 and 7 of one SERP appears in it once, not twice, and
 * an AI Overview citing it twice cites it once. The unit §6.6 counts is
 * "appears in this search", not "occupies a row".
 *
 * Fewer than five rivals, and none at all, are legal results — a market
 * whose every result is a platform or the customer's own returns
 * `rivals: []` with a populated `sources`, and never throws. What the card
 * does with that is `buildPresenceCard`'s `framing`.
 *
 * `sources` is the de-duplicated list of platform domains hit, in
 * first-seen order. It is stored in the report blob and not rendered in
 * MVP (§6.6: "a v1.1 Standing module").
 */
export function deriveRivals(a: {
  serps: readonly MarketSerp[];
  ownDomain: string;
  /** The pass measured a local business in its town (D67, issue 1441):
   *  the businesses of its local pack lead, and a marketplace is a source
   *  (issue 1449). */
  local?: boolean;
  /** The bands a pass already holds for some of these domains (SPEC §6
   *  right-sizing, owner walk 2026-09-17, issue 858) — the tracked rivals a
   *  paid pass sized, never a new purchase. A domain banded `far` is not
   *  one of the site's rivals, and near ones come before middle ones before
   *  those nobody sized. Absent (the free path): the score order alone. */
  sizes?: ReadonlyMap<string, SizeBand>;
}): { rivals: RivalCandidate[]; sources: string[] } {
  const tallies = new Map<string, Tally>();
  const sources: string[] = [];
  const seenSources = new Set<string>();
  let productDomains = 0;

  const tally = (domain: string): Tally => {
    const existing = tallies.get(domain);
    if (existing) return existing;
    const fresh: Tally = { domain, top10Appearances: 0, aiCitations: 0, searches: new Set(), localPack: 0, organicRows: 0, articleRows: 0 };
    tallies.set(domain, fresh);
    productDomains += 1;
    return fresh;
  };

  /** The partition, applied identically to an organic host and to an AI
   *  reference host: not a domain at all, or the customer's own, and it
   *  counts nowhere; a platform, and it counts only into `sources`. */
  let platforms = 0;
  const toSources = (domain: string): void => {
    if (!seenSources.has(domain)) {
      platforms += 1;
      seenSources.add(domain);
      sources.push(domain);
    }
  };
  const classify = (host: string): string | null => {
    const domain = registrableDomain(host);
    if (domain === null) return null;
    if (isOwnDomain(domain, a.ownDomain)) return null;
    // A university teaches, and a marketplace lists the businesses a local
    // buyer goes to: neither is a local business's rival (issue 1449).
    if (isPlatformDomain(host) || isAcademicDomain(host) || (a.local === true && isMarketplaceHost(host))) {
      toSources(domain);
      return null;
    }
    return domain;
  };

  a.serps.forEach((serp, index) => {
    const countedTop10 = new Set<string>();
    // A business in the local pack appears in the search as one in the top
    // ten does (D67, issue 1441).
    for (const row of serp.organic) {
      const domain = classify(row.domain);
      if (domain === null) continue;
      const t = tally(domain);
      t.organicRows += 1;
      if (isArticleRow(row)) t.articleRows += 1;
      if (countedTop10.has(domain)) continue;
      countedTop10.add(domain);
      t.top10Appearances += 1;
      t.searches.add(index);
    }
    const countedPack = new Set<string>();
    for (const row of serp.localPack ?? []) {
      const domain = classify(row.domain);
      if (domain === null || countedPack.has(domain)) continue;
      countedPack.add(domain);
      const t = tally(domain);
      t.localPack += 1;
      t.searches.add(index);
      if (countedTop10.has(domain)) continue;
      countedTop10.add(domain);
      t.top10Appearances += 1;
    }

    const countedCitations = new Set<string>();
    // A domain the overview cites only for articles is cited as a
    // publisher, not recommended as a product (issue 1417).
    const urls = serp.aiOverview.referenceUrls ?? [];
    const onlyArticles = (domain: string): boolean => {
      const own = urls.filter((url) => registrableDomain(url) === domain);
      return own.length > 0 && own.every(isArticleUrl);
    };
    for (const host of serp.aiOverview.referenceDomains) {
      const domain = classify(host);
      if (domain === null || countedCitations.has(domain) || onlyArticles(domain)) continue;
      countedCitations.add(domain);
      const t = tally(domain);
      t.aiCitations += 1;
      t.searches.add(index);
    }
  });

  // Issue 1449: a rival is found on at least two of the searches, or in a
  // local pack; one search's top ten alone is not a market. A domain a paid
  // pass sized and found within the site's reach stands on one (issue 858:
  // a small rival holds one search where a giant holds them all). And a domain
  // whose every top-ten page is an article about others ("10 Best Cafés in
  // Leeds", a recipe, a guide) is a publisher, as one the AI overview cites
  // only for articles is (issue 1417).
  const sizes = a.sizes ?? new Map<string, SizeBand>();
  const kept: Tally[] = [];
  for (const t of tallies.values()) {
    const banded = sizes.has(t.domain) && sizes.get(t.domain) !== "far";
    const publisher = t.localPack === 0 && t.organicRows > 0 && t.articleRows === t.organicRows && t.aiCitations === 0;
    if (publisher) {
      if (!seenSources.has(t.domain)) platforms -= 1;
      toSources(t.domain);
    }
    else if (t.localPack > 0 || banded || t.searches.size >= RIVAL_SCORE.minSearches) kept.push(t);
  }
  const byDomain = new Map(kept.map((t) => [t.domain, t]));
  const scored: RivalCandidate[] = kept.map((t) => ({
    domain: t.domain,
    top10Appearances: t.top10Appearances,
    aiCitations: t.aiCitations,
    score: scoreOf(t),
  }));
  const reach = (domain: string): number => {
    const band = sizes.get(domain);
    return band === "near" ? 0 : band === "middle" ? 1 : 2;
  };
  // For a local business, the businesses its buyers are shown on the map
  // come first, the most often shown first.
  const pack = (domain: string): number => (a.local === true ? (byDomain.get(domain)?.localPack ?? 0) : 0);
  const ranked = (x: RivalCandidate, y: RivalCandidate): number =>
    reach(x.domain) - reach(y.domain) ||
    pack(y.domain) - pack(x.domain) ||
    y.score - x.score ||
    y.aiCitations - x.aiCitations ||
    y.top10Appearances - x.top10Appearances;
  const ordered = scored
    .filter((candidate) => sizes.get(candidate.domain) !== "far")
    .sort((x, y) => ranked(x, y) || byScoreThenDomain(x, y));
  // Never chosen by its name's letters (issue 1449): where the last places
  // fall inside a tie of businesses each found on one search only, the
  // whole tie is left out rather than broken alphabetically.
  let cut = Math.min(ordered.length, BATTERY.COMPETITORS_MAX);
  const last = ordered[cut - 1];
  const next = ordered[cut];
  if (last !== undefined && next !== undefined && ranked(last, next) === 0 && (byDomain.get(last.domain)?.searches.size ?? 0) <= 1) {
    while (cut > 0 && ranked(ordered[cut - 1]!, last) === 0) cut -= 1;
  }
  const rivals = ordered.slice(0, cut);

  // Before the partition: every distinct domain the SERPs named that was
  // neither the customer's own nor unparseable. After it: the product
  // domains alone — the platform hits went to `sources`.
  logDerivation(productDomains + platforms, productDomains, rivals.length);
  return { rivals, sources };
}

/** BP-026 `## NFR budget`: candidate count before and after the platform
 *  partition, and the rival count kept. Counts only — no domain reaches a
 *  log line from here. */
function logDerivation(before: number, after: number, kept: number): void {
  console.log(
    JSON.stringify({ event: "rival_derivation", candidatesBeforePartition: before, candidatesAfterPartition: after, rivalsKept: kept })
  );
}
