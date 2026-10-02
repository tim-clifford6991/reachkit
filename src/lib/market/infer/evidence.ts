// src/lib/market/infer/evidence.ts — what the market is concluded from
// (#1185): the site's own words, how AI answers in its market read, and the
// searches it and its market's top tens are found for.
//
// Pure and bounded: the caller hands over what a pass already holds, and
// this trims it to one prompt's worth. Nothing here buys anything.

/** One page of the site, as the crawl read it. */
export interface EvidencePage {
  url: string;
  title: string;
  text: string;
}

/** One measured question and the domains its AI answers cited. */
export interface EvidenceAnswer {
  question: string;
  citedDomains: readonly string[];
  namesSite: boolean;
}

/** One search the site ranks for. */
export interface EvidenceSearch {
  keyword: string;
  position: number;
}

/** One domain of the measured top tens, with how often it appeared and the
 *  title of one of its results. */
export interface EvidenceTopTen {
  domain: string;
  appearances: number;
  title: string;
}

export interface MarketEvidence {
  domain: string;
  siteName: string | null;
  /** The home page's title and first heading — what the site leads with. */
  headline: string | null;
  /** The category the answers, top tens and searches below were measured
   *  under — the guess they were bought for, which may be the wrong one.
   *  `null` where nothing says. */
  measuredUnder: string | null;
  pages: readonly EvidencePage[];
  products: readonly string[];
  claims: readonly string[];
  answers: readonly EvidenceAnswer[];
  ownSearches: readonly EvidenceSearch[];
  topTens: readonly EvidenceTopTen[];
}

/** How much of each kind one prompt carries. */
export const EVIDENCE_BOUNDS = Object.freeze({
  pages: 12,
  pageChars: 900,
  allPageChars: 7000,
  answers: 24,
  domainsPerAnswer: 10,
  ownSearches: 25,
  topTens: 25,
  listItems: 8,
  itemChars: 160,
});

/** Pages that say nothing about what the business sells. */
const QUIET_PAGE = /\/(privacy|terms|imprint|legal|cookies?|signin|sign-in|login|signup|register|careers|jobs)(\/|$|\?)/i;

/** The order a page earns its place in the prompt: the home page, then the
 *  pages that say what is sold, then the rest. */
function pageRank(url: string): number {
  let path = "/";
  try {
    path = new URL(url).pathname;
  } catch {
    return 5;
  }
  if (path === "/" || path === "") return 0;
  if (/pricing|plans/i.test(path)) return 1;
  if (/features?|product|platform|solutions?|how-it-works|use-cases?|customers?|about|why/i.test(path)) return 2;
  if (/docs?|guide|changelog|compare|vs|alternatives?/i.test(path)) return 3;
  return 4;
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return space > max * 0.6 ? cut.slice(0, space) : cut;
}

/** The evidence as one prompt carries it. */
export function boundEvidence(e: MarketEvidence): MarketEvidence {
  const seen = new Set<string>();
  const candidates = e.pages
    .filter((p) => !QUIET_PAGE.test(p.url))
    .filter((p) => {
      // One page per address without its query: a listing's sort orders
      // are the same page.
      const key = p.url.split("?")[0]?.replace(/\/$/, "") ?? p.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => pageRank(a.url) - pageRank(b.url));

  const pages: EvidencePage[] = [];
  let budget = EVIDENCE_BOUNDS.allPageChars;
  for (const page of candidates) {
    if (pages.length >= EVIDENCE_BOUNDS.pages || budget <= 0) break;
    const text = clip(page.text, Math.min(EVIDENCE_BOUNDS.pageChars, budget));
    budget -= text.length;
    pages.push({ url: page.url, title: clip(page.title, EVIDENCE_BOUNDS.itemChars), text });
  }

  const items = (list: readonly string[]): string[] =>
    list.slice(0, EVIDENCE_BOUNDS.listItems).map((item) => clip(item, EVIDENCE_BOUNDS.itemChars));

  return {
    domain: e.domain,
    siteName: e.siteName,
    headline: e.headline === null ? null : clip(e.headline, EVIDENCE_BOUNDS.itemChars * 2),
    measuredUnder: e.measuredUnder,
    pages,
    products: items(e.products),
    claims: items(e.claims),
    answers: e.answers.slice(0, EVIDENCE_BOUNDS.answers).map((a) => ({
      question: clip(a.question, EVIDENCE_BOUNDS.itemChars),
      citedDomains: a.citedDomains.slice(0, EVIDENCE_BOUNDS.domainsPerAnswer),
      namesSite: a.namesSite,
    })),
    ownSearches: [...e.ownSearches]
      .sort((a, b) => a.position - b.position)
      .slice(0, EVIDENCE_BOUNDS.ownSearches),
    topTens: [...e.topTens]
      .sort((a, b) => b.appearances - a.appearances)
      .slice(0, EVIDENCE_BOUNDS.topTens)
      .map((t) => ({ ...t, title: clip(t.title, EVIDENCE_BOUNDS.itemChars) })),
  };
}

/** Every domain the evidence itself names — a rival on one of these was
 *  seen in the market, not only recalled. */
export function evidenceDomains(e: MarketEvidence): Set<string> {
  const out = new Set<string>();
  for (const a of e.answers) for (const d of a.citedDomains) out.add(d.replace(/^www\./, ""));
  for (const t of e.topTens) out.add(t.domain.replace(/^www\./, ""));
  return out;
}
