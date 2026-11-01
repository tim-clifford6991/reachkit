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
import { isArticleRow, isArticleUrl, isExplainerTitle, isHomeUrl, isJobRow, isJobSearch, isOccupationTitle, isOthersPage, isOwnContentUrl, isOwnDomain, isPlaceTitle, isRoundupPage, isSourceDomain, pageClass, pageKey, registrableDomain, resolvedRows, servesJobSeekers } from "./domains";

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
  /** The searches it was found on other than as an explanation an AI
   *  overview cited on a search that asks what something is (issue 1468). */
  offered: Set<number>;
  /** How many searches showed it in the local pack. */
  localPack: number;
  /** Its organic top-ten rows, and how many of them are roundups of
   *  others (`isRoundup`). */
  organicRows: number;
  roundupRows: number;
  /** Its organic rows that are for job seekers or explain a subject (`isGuide`). */
  guideRows: number;
  /** Its best place in an organic top ten, and among an AI overview's
   *  citations; `NO_POSITION` where it holds none. */
  bestPosition: number;
  bestCitation: number;
}

function scoreOf(t: Tally): number {
  return t.top10Appearances * RIVAL_SCORE.top10Weight + t.aiCitations * RIVAL_SCORE.aiCitationWeight;
}

/** The place a domain without an organic top-ten row sorts at. */
const NO_POSITION = 1000;

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

/** The words of a host's labels, its public suffix left out:
 *  `myworkspace-sg-1.jpmchase.com` -> myworkspace, sg, jpmchase. */
function hostWords(host: string): string[] {
  const domain = registrableDomain(host);
  if (domain === null) return [];
  const suffix = domain.slice(domain.indexOf(".") + 1);
  const name = host.toLowerCase().replace(/^www\./, "").slice(0, -suffix.length - 1);
  return name.split(/[.\-_\d]+/).filter((word) => word.length >= 4);
}

/**
 * Whether a search finds a name rather than a market (issue 1468): at least
 * half its top ten sits on hosts that carry one word, held by at least
 * three different businesses — `workspace.google.com`, `my.workspace.cc`,
 * `workspace-tok-jp.jpmchase.com`. A word one business holds on many
 * pages is that business's own search, and stays.
 */
function isNamesakeSearch(serp: MarketSerp): boolean {
  const owners = new Map<string, Set<string>>();
  const rows = new Map<string, number>();
  for (const row of serp.organic) {
    const domain = registrableDomain(row.domain);
    if (domain === null) continue;
    for (const word of new Set(hostWords(row.domain))) {
      owners.set(word, (owners.get(word) ?? new Set()).add(domain));
      rows.set(word, (rows.get(word) ?? 0) + 1);
    }
  }
  for (const [word, held] of owners) if (held.size >= 3 && (rows.get(word) ?? 0) * 2 >= serp.organic.length) return true;
  return false;
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
  /** The market is a local business's (`readsLocal`, issue 1468): the
   *  businesses of its local pack lead, and a marketplace is a source
   *  (issue 1449). Absent is a national market. */
  local?: boolean;
  /** The bands a pass already holds for some of these domains (SPEC §6
   *  right-sizing, owner walk 2026-09-17, issue 858) — the tracked rivals a
   *  paid pass sized, never a new purchase. A domain banded `far` is not
   *  one of the site's rivals, and near ones come before middle ones before
   *  those nobody sized. Absent (the free path): the score order alone. */
  sizes?: ReadonlyMap<string, SizeBand>;
  /** The business's own category: one that recruits, staffs or trains keeps
   *  the searches of job seekers. Absent reads as none. */
  category?: string | null;
}): { rivals: RivalCandidate[]; sources: string[] } {
  // Whether the market is local is the site's own reach (`readsLocal`),
  // never the map alone: a national bookkeeping or forms company is shown a
  // map on some of its searches too (issue 1468).
  const local = a.local === true;
  // A top-ten page that is an article about others (issue 1449), or one
  // that explains a subject (issue 1468). Outside a local market, not one
  // in the domain's own blog or resources (issue 1465): a software maker's
  // "15 best email platforms" in its blog is that business writing about
  // its market, while a review site's roundup is the site.
  // In a local market any page about others is a publisher's; outside one
  // a directory's page is, and an article outside the domain's own blog.
  const isRoundup = (row: { domain: string; url?: string; title?: string }): boolean =>
    local
      ? isOthersPage(row, true)
      : pageClass(row) === "third_party" ||
        ((isArticleRow(row) || (row.title !== undefined && isExplainerTitle(row.title))) && (row.url === undefined || !isOwnContentUrl(row.url)));
  // A page for job seekers, unless they are this business's buyers, or in a local market one that explains a subject or an occupation:
  // outside one a software maker explains its own market ("What does a CRM do"). A home page offers its business whatever its tagline says.
  const isGuide = (row: { domain: string; url?: string; title?: string }): boolean => {
    if (row.url !== undefined && isHomeUrl(row.url)) return !servesJobSeekers(a.category) && isJobRow({ domain: row.domain });
    const ownPost = !local && row.url !== undefined && isOwnContentUrl(row.url);
    return (!servesJobSeekers(a.category) && !ownPost && isJobRow(row)) || (local && row.title !== undefined && (isExplainerTitle(row.title) || isOccupationTitle(row.title)));
  };
  // The share of a search's titled top ten that `test` holds, at least half.
  const mostly = (serp: MarketSerp, test: (title: string) => boolean): boolean => {
    const titles = serp.organic.flatMap((row) => (row.title === undefined ? [] : [row.title]));
    return titles.length > 0 && titles.filter(test).length * 2 >= titles.length;
  };
  const tallies = new Map<string, Tally>();
  const sources: string[] = [];
  const seenSources = new Set<string>();
  let productDomains = 0;

  const tally = (domain: string): Tally => {
    const existing = tallies.get(domain);
    if (existing) return existing;
    const fresh: Tally = { domain, top10Appearances: 0, aiCitations: 0, searches: new Set(), offered: new Set(), localPack: 0, organicRows: 0, roundupRows: 0, guideRows: 0, bestPosition: NO_POSITION, bestCitation: NO_POSITION };
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
  const classify = (host: string, url?: string): string | null => {
    const domain = registrableDomain(host);
    if (domain === null) return null;
    if (isOwnDomain(domain, a.ownDomain)) return null;
    // A public body or a university informs, and a marketplace lists the
    // businesses a local buyer goes to: none is a local business's rival
    // (issue 1449). A marketplace's page of one product is a listing
    // wherever it ranks (issue 1465).
    if (isSourceDomain(host, url, { local })) {
      toSources(domain);
      return null;
    }
    return domain;
  };

  // The addresses some top ten shows as a page that ranks or weighs others
  // (issue 1476): an AI overview citing one cites a list, whatever its
  // address says ("Best Free Accounting Software … 2026" at
  // `/co/run/finance/free-accounting-tools-…`).
  const roundupPages = new Set<string>();
  for (const serp of a.serps) {
    for (const row of serp.organic) {
      const key = row.url === undefined ? null : pageKey(row.url);
      if (key !== null && isRoundupPage(row)) roundupPages.add(key);
    }
  }
  const isRoundupAddress = (url: string): boolean => {
    const key = pageKey(url);
    return (key !== null && roundupPages.has(key)) || isRoundupPage({ url });
  };

  a.serps.forEach((stored, index) => {
    // Rows behind a Google redirect name nobody; too many of them and the search is not read.
    const organic = resolvedRows(stored.organic);
    if (organic === null) return;
    const serp = { ...stored, organic };
    // Issue 1468: in a national market, a search whose top ten is mostly
    // pages of one place each ("Office Space in Merced, CA") looks for
    // another town's businesses, and none of them is this one's rival.
    if (!local && mostly(serp, isPlaceTitle)) return;
    // A search whose top ten is mostly businesses that share one word of
    // their name ("workspace": a bank's portal, a coworking chain, a
    // collaboration suite) finds what is called that, not what this market
    // buys (issue 1468).
    if (isNamesakeSearch(serp)) return;
    // A search whose top ten is mostly job pages ("baker") is a job
    // seeker's, and its employers and agencies are no bakery's rivals.
    if (isJobSearch(serp.organic, a.category)) return;
    // A search whose top ten mostly explains a subject ("What is a PEO?",
    // "11 types of web pages") asks what something is (issue 1468).
    const informational = mostly(serp, isExplainerTitle);
    // The overview of such a search cites what explains the subject: a
    // domain cited there for a page other than its home is found as a
    // publisher of that explanation, unless it is found otherwise too, or
    // explains on two searches (issue 1468).
    const countedTop10 = new Set<string>();
    for (const row of serp.organic) {
      const domain = classify(row.domain, row.url);
      if (domain === null) continue;
      const t = tally(domain);
      t.organicRows += 1;
      t.bestPosition = Math.min(t.bestPosition, row.position);
      if (isRoundup(row)) t.roundupRows += 1;
      if (isGuide(row)) t.guideRows += 1;
      if (countedTop10.has(domain)) continue;
      countedTop10.add(domain);
      t.top10Appearances += 1;
      t.searches.add(index);
      t.offered.add(index);
    }
    // A business in the local pack appears in the search as one in the top
    // ten does (D67, issue 1441). In a national market the map shows the
    // businesses of whatever town the search was read in (issue 1468).
    const countedPack = new Set<string>();
    for (const row of local ? (serp.localPack ?? []) : []) {
      const domain = classify(row.domain);
      if (domain === null || countedPack.has(domain)) continue;
      countedPack.add(domain);
      const t = tally(domain);
      t.localPack += 1;
      t.searches.add(index);
      t.offered.add(index);
      if (countedTop10.has(domain)) continue;
      countedTop10.add(domain);
      t.top10Appearances += 1;
    }

    const countedCitations = new Set<string>();
    // A domain the overview cites only for pages about others — articles,
    // lists, a directory's profiles — is cited as a publisher, not
    // recommended as a product (issue 1417), as is an address a top ten
    // shows as a list of others (issue 1476).
    const urls = serp.aiOverview.referenceUrls ?? [];
    const onlyArticles = (domain: string): boolean => {
      const own = urls.filter((url) => registrableDomain(url) === domain);
      return own.length > 0 && own.every((url) => isArticleUrl(url) || isRoundupAddress(url) || isRoundup({ domain: url, url }));
    };
    // The address it cited on this host, where the read kept one: a
    // marketplace's listing is no rival (issue 1465).
    const citedAt = (host: string): string | undefined =>
      urls.find((url) => {
        try {
          return new URL(url).hostname === host;
        } catch {
          return false;
        }
      });
    serp.aiOverview.referenceDomains.forEach((host, cited) => {
      const at = citedAt(host);
      const domain = classify(host, at);
      if (domain === null || countedCitations.has(domain) || onlyArticles(domain)) return;
      countedCitations.add(domain);
      const t = tally(domain);
      t.aiCitations += 1;
      t.searches.add(index);
      if (!informational || (at !== undefined && isHomeUrl(at))) t.offered.add(index);
      t.bestCitation = Math.min(t.bestCitation, cited + 1);
    });
  });

  // Issue 1449: for a local business, a rival is found on at least two of
  // the searches, or in a local pack; one search's top ten alone is not a
  // local market. A domain a paid pass sized and found within the site's
  // reach stands on one (issue 858: a small rival holds one search where a
  // giant holds them all). And a domain whose every top-ten page is an
  // article about others ("10 Best Cafés in Leeds", a recipe, a guide) is a
  // publisher, as one the AI overview cites only for articles is (issue
  // 1417).
  //
  // Issue 1465: a business measured in no town is often found on one of the
  // few searches its pass read, and a software maker writes the "best"
  // lists of its own market in its own blog. There one search is enough,
  // and only articles outside the domain's own blog or resources (a review
  // site's roundup, a magazine's list) make it a publisher.
  const sizes = a.sizes ?? new Map<string, SizeBand>();
  const minSearches = local ? RIVAL_SCORE.minSearches : 1;
  const kept: Tally[] = [];
  for (const t of tallies.values()) {
    const banded = sizes.has(t.domain) && sizes.get(t.domain) !== "far";
    const publisher =
      (t.localPack === 0 && t.organicRows > 0 && t.roundupRows === t.organicRows && t.aiCitations === 0) ||
      (t.localPack === 0 && t.organicRows > 0 && t.guideRows === t.organicRows) ||
      (t.offered.size === 0 && t.searches.size < 2);
    if (publisher) {
      if (!seenSources.has(t.domain)) platforms -= 1;
      toSources(t.domain);
    }
    else if (t.localPack > 0 || banded || t.searches.size >= minSearches) kept.push(t);
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
  const pack = (domain: string): number => (local ? (byDomain.get(domain)?.localPack ?? 0) : 0);
  const position = (domain: string): number => (local ? 0 : (byDomain.get(domain)?.bestPosition ?? NO_POSITION));
  const citation = (domain: string): number => (local ? 0 : (byDomain.get(domain)?.bestCitation ?? NO_POSITION));
  const ranked = (x: RivalCandidate, y: RivalCandidate): number =>
    reach(x.domain) - reach(y.domain) ||
    pack(y.domain) - pack(x.domain) ||
    y.score - x.score ||
    y.aiCitations - x.aiCitations ||
    y.top10Appearances - x.top10Appearances ||
    // Then, outside a local market, the higher place in Google's own order
    // (issue 1465), never the name's letters. A local market's tie of
    // one-search businesses is left out below, as issue 1449 rules.
    position(x.domain) - position(y.domain) ||
    citation(x.domain) - citation(y.domain);
  const ordered = scored
    .filter((candidate) => sizes.get(candidate.domain) !== "far")
    .sort((x, y) => ranked(x, y) || byScoreThenDomain(x, y));
  // Never chosen by its name's letters (issue 1449): where the last places
  // fall inside a tie of businesses each found on one search only, the
  // whole tie is left out rather than broken alphabetically. Outside a local
  // market the places it leaves go to the businesses ranked after it (issue
  // 1465); in one, they stay empty, as a local market's tail is the
  // directories and guides issue 1449 left out.
  let pool = ordered;
  let cut = Math.min(pool.length, BATTERY.COMPETITORS_MAX);
  for (;;) {
    const last = pool[cut - 1];
    const next = pool[cut];
    if (last === undefined || next === undefined || ranked(last, next) !== 0 || (byDomain.get(last.domain)?.searches.size ?? 0) > 1) break;
    if (local) {
      while (cut > 0 && ranked(pool[cut - 1]!, last) === 0) cut -= 1;
      break;
    }
    pool = pool.filter((candidate) => ranked(candidate, last) !== 0);
    cut = Math.min(pool.length, BATTERY.COMPETITORS_MAX);
  }
  const rivals = pool.slice(0, cut);

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
