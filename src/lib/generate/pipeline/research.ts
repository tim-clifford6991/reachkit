// SPEC §7 (2026-09-29, *Two pools of facts*; issue 1135) — the research
// step: the second pool.
//
// The business facts are the customer's own pages (`./grounding.ts`). The
// market facts are read here, at writing time, from public pages: the
// target's top results out of the stored top ten, each named rival's **own**
// pricing and feature pages, and at most two studies found by one search.
// *Current insights* (D48, issue 1259) buys a search of the news in place of
// the studies: what the market's category and its synonyms published inside
// 30 days, each result with the date the search gives it and its source.
// A news search matches words, so each result it returns is then judged
// against the site's market, and only one that is about it is kept (issue
// 1262).
// A Q&A (owner, D61; issue 1295) also buys the target's own SERP for
// Google's "People also ask" and its related searches, and one keyword
// overview that measures those searches' volume: its questions. Where that
// leaves the Q&A short of the questions its template asks, the same two lists
// are read beside the market's searched terms, one at a time, until it is not
// (owner, D62; issue 1297).
// Each claim is kept with the address it was read from and the date it was
// read, and is cited beside the sentence that uses it.
//
// **A claim is a quotation, checked in code.** The small tier is asked to
// copy claims out of the pages; a claim is kept only where its words occur
// on the page it names, so a model that paraphrased or invented yields
// nothing. A statistic whose data is older than three years is dropped.
//
// **A rival's page is read from the rival** (owner, 2026-10-02, round 1): a
// comparison's cells are sourced to the product's own pricing and feature
// pages, never to a listicle about it. **The rival says where those pages
// are** (owner, D56; issue 1282): its home page's links and its sitemap are
// read, and the pricing page and the product or features page they name are
// the ones read — no address is guessed. A rival that names neither is not
// offered to the table.
//
// **What a rival's claim is, is the claim's own** (D56): the claims call
// says of each whether it states the product's price, says what the product
// does, or neither. A rival's claim is kept as a pricing or a feature claim
// by that, whichever of its pages it was read from, and one that is neither
// — a customer count, a statistic about another product or the market — is
// not kept: it is no fact about the rival to set in a comparison.
//
// **Every read is ledgered and free**, like the crawl's: a page read through
// `safeFetch` lands in `fetches` at zero cents, and is not read again inside
// `RESEARCH.freshnessDays`. The network runs in parallel and the ledger is
// written one row at a time, which is the cost seam's own contract
// (`src/lib/site-profile/crawl.ts` states it). The claim calls and the one
// search are paid, inside `CAPS.DRAFT_C`; a ceiling reached mid-step ends the
// step with what it has. *Current insights* pays for one more small call, the
// judgement of its news results.
//
// **Research never stops a page.** A site whose market yields no readable
// page is written from its business facts alone, as before this step.
import { z } from "zod";
import { CACHE_WINDOWS_D, RESEARCH } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { safeFetch } from "@/lib/egress";
import { llm } from "@/lib/llm";
import { visibleText } from "@/lib/measure/parse";
import type { StoredReport } from "@/lib/scan/report";
import type { WritingMarket } from "../voice/market";
import { languagePack, pagePathAlternation } from "@/lib/locale/language";
import type { Locale } from "@/lib/locale/locales";
import type { NewsRow } from "@/lib/vendors/dataforseo/types";
import { keywordOverview, serpNews, serpOrganic } from "@/lib/vendors/dataforseo";

/** The `fetches.source` of every public page this step reads. */
export const RESEARCH_READ_SOURCE = "generate.research.read";

export type MarketPageKind = "top_result" | "rival_pricing" | "rival_features" | "study" | "recent";

/** One claim read off a public page, word for word. */
export interface MarketFact {
  url: string;
  /** The page's own title, which is what the sources list names it by. */
  title: string;
  readAt: Date;
  passage: string;
  kind: MarketPageKind;
  /** The rival whose own page this is, where it is one. */
  product?: string;
  /** The day a `recent` page was published (D42, *current insights*): the
   *  page's own markup where it states one, else the news search's date for
   *  it (D48). Never guessed. */
  publishedAt?: string;
  /** Who published a `recent` page, as the news search names it. */
  source?: string;
}

/** A product whose own pages were read: what a comparison table may name. */
export interface ResearchedProduct {
  domain: string;
  pages: string[];
}

/** One dated news result that was read, and whether it was judged to be
 *  about the site's market (issue 1262). */
export interface JudgedResult {
  url: string;
  title: string;
  publishedAt: string;
  source: string;
  onMarket: boolean;
}

/** What buyers ask about the target (owner, D61; issue 1295): Google's
 *  "People also ask" for it, and its related searches that have a measured
 *  monthly volume. */
export interface BuyersAsk {
  peopleAlsoAsk: string[];
  related: { search: string; volume: number }[];
}

/** What a pack built from this research holds for a Q&A (D62): the
 *  questions it keeps, and whether they are as many as its template asks.
 *  A page that is not written as a Q&A has `enough`. */
export interface QuestionsHeld {
  kept: number;
  enough: boolean;
}

export interface MarketResearch {
  facts: MarketFact[];
  products: ResearchedProduct[];
  /** A Q&A's question sources, where the step was asked for them. */
  asked?: BuyersAsk;
  /** D62: the market's searched terms whose SERPs were read because the
   *  target's own left the Q&A short, and the questions they added to the
   *  ones kept. Absent where the target's own SERP was enough. */
  borrowed?: { terms: string[]; added: number };
  /** *Current insights*: every news result the judgement was asked about. */
  news?: JudgedResult[];
  /** The target's top results as they were read (issue 1143): what a new
   *  page's claims are compared with. Absent is none read. */
  topResults?: { url: string; text: string }[];
}

export const NO_RESEARCH: MarketResearch = Object.freeze({ facts: [], products: [] });

interface ReadPage {
  url: string;
  title: string;
  text: string;
  readAt: string;
}

interface Wanted {
  url: string;
  kind: MarketPageKind;
  product?: string;
  publishedAt?: string;
  source?: string;
}

const PUBLISHED_RES: readonly RegExp[] = [
  /<meta\b[^>]*\b(?:property|name|itemprop)\s*=\s*["'](?:article:published_time|datePublished|date|pubdate|publish-date|og:published_time)["'][^>]*\bcontent\s*=\s*["']([^"']+)["']/i,
  /<meta\b[^>]*\bcontent\s*=\s*["']([^"']+)["'][^>]*\b(?:property|name|itemprop)\s*=\s*["'](?:article:published_time|datePublished)["']/i,
  /"datePublished"\s*:\s*"([^"]+)"/i,
  /<time\b[^>]*\bdatetime\s*=\s*["']([^"']+)["']/i,
];

/** The day a page says it was published, as its own markup states it —
 *  a meta tag, its structured data or a `<time>` — or `null` where it
 *  states none. Never read off the prose and never guessed. */
export function publishedOf(html: string): string | null {
  for (const pattern of PUBLISHED_RES) {
    const found = pattern.exec(html)?.[1];
    if (found === undefined) continue;
    const at = new Date(found);
    if (!Number.isNaN(at.getTime())) return at.toISOString().slice(0, 10);
  }
  return null;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

const sameSite = (host: string, domain: string): boolean => host === domain || host.endsWith(`.${domain}`);

function words(text: string, limit: number): string {
  return text.split(/\s+/).filter(Boolean).slice(0, limit).join(" ");
}

/** What an address answered with, or `null` where it did not answer.
 *  Nothing is thrown: a page that cannot be read is not a fact. */
async function fetchBody(url: string): Promise<{ url: string; html: string; readAt: Date } | null> {
  try {
    const outcome = await safeFetch(url, { userAgent: "reachkit-measure", timeoutMs: RESEARCH.readTimeoutMs });
    return outcome.ok ? { url: outcome.url, html: outcome.html, readAt: outcome.readAt } : null;
  } catch {
    return null;
  }
}

/** One page off the network, or `null` where it did not answer with enough
 *  to read. */
async function fetchPage(url: string): Promise<{ page: ReadPage; html: string } | null> {
  const body = await fetchBody(url);
  if (body === null) return null;
  const text = visibleText(body.html);
  if (text.split(/\s+/).length < RESEARCH.minWords) return null;
  const title = visibleText(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(body.html)?.[1] ?? "").trim();
  return {
    page: {
      url: body.url,
      title: title.length === 0 ? hostOf(body.url) : title,
      text: words(text, RESEARCH.readWords),
      readAt: body.readAt.toISOString(),
    },
    html: body.html,
  };
}

type RivalPageKind = "rival_pricing" | "rival_features";
const RIVAL_PAGE_KINDS: readonly RivalPageKind[] = ["rival_pricing", "rival_features"];
/** What the first segment of a rival's own address, or a link's whole
 *  label, has to say for the page to be its pricing page, or its product or
 *  features page. `/blog/pricing-update` is neither. */
const RIVAL_SEGMENT_RES = {
  rival_pricing: new RegExp(`^(?:pricing|prices?|plans?|${pagePathAlternation("pricing")})(?![a-z])`, "i"),
  rival_features: new RegExp(`^(?:features?|products?|platform|${pagePathAlternation("features", "product")})(?![a-z])`, "i"),
} as const;
const RIVAL_LABEL_RES = {
  rival_pricing: new RegExp(`^(?:pricing|plans|${pagePathAlternation("pricing")})$`, "i"),
  rival_features: new RegExp(`^(?:features|product|platform|${pagePathAlternation("features", "product")})$`, "i"),
} as const;
const ANCHOR_RE = /<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const LOC_RE = /<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/gi;
const FILE_RE = /\.(?!html?$)[a-z0-9]{2,5}$/i;

/**
 * The rival's own page of this kind, as the rival names it (D56): among the
 * links of its home page and then the addresses of its sitemap, the one on
 * its own host whose first path segment — or whose link's label — names the
 * kind. `/pricing` is taken before `/pricing-agencies`, a shallower address
 * before a deeper one, and a link before a sitemap entry. `null` where the
 * rival names none: no address is guessed.
 */
export function rivalPage(
  kind: RivalPageKind,
  domain: string,
  home: { html: string; url: string } | null,
  sitemap: readonly string[]
): string | null {
  const hosts = new Set([domain, ...(home === null ? [] : [hostOf(home.url)])]);
  const links: { href: string; label: string }[] = [];
  if (home !== null) {
    ANCHOR_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = ANCHOR_RE.exec(home.html)) !== null) links.push({ href: match[1]!.replace(/&amp;/g, "&"), label: visibleText(match[2] ?? "").trim() });
  }
  let best: { url: string; rank: number } | null = null;
  for (const link of [...links, ...sitemap.map((href) => ({ href, label: "" }))]) {
    let url: URL;
    try {
      url = new URL(link.href, home?.url ?? `https://${domain}/`);
    } catch {
      continue;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    const first = segments[0];
    if (first === undefined || !hosts.has(hostOf(url.href)) || FILE_RE.test(url.pathname)) continue;
    const named = RIVAL_SEGMENT_RES[kind].exec(first);
    if (named === null && !RIVAL_LABEL_RES[kind].test(link.label)) continue;
    const rank = (named !== null && named[0].length === first.length ? 0 : 100) + Math.min(segments.length, 99);
    if (best === null || rank < best.rank) best = { url: `${url.origin}${url.pathname}`, rank };
  }
  return best?.url ?? null;
}

/** The addresses a rival's sitemap lists: `/sitemap.xml`, else the one its
 *  `robots.txt` names; an index is followed into its first few sitemaps on
 *  the rival's own host. Empty where it publishes none. */
async function sitemapOf(domain: string): Promise<string[]> {
  const locs = (xml: string): string[] => [...xml.matchAll(LOC_RE)].map((match) => match[1]!.replace(/&amp;/g, "&"));
  let first = await fetchBody(`https://${domain}/sitemap.xml`);
  if (first === null || !/<(?:urlset|sitemapindex)\b/i.test(first.html)) {
    const robots = await fetchBody(`https://${domain}/robots.txt`);
    const named = robots === null ? undefined : /^\s*sitemap:\s*(\S+)/im.exec(robots.html)?.[1];
    first = named === undefined ? null : await fetchBody(named);
  }
  if (first === null) return [];
  if (!/<sitemapindex\b/i.test(first.html)) return locs(first.html).slice(0, RESEARCH.sitemapUrls);
  const host = hostOf(first.url);
  const children = locs(first.html).filter((url) => hostOf(url) === host).slice(0, RESEARCH.sitemaps);
  const read = await Promise.all(children.map(fetchBody));
  return read.flatMap((child) => (child === null ? [] : locs(child.html))).slice(0, RESEARCH.sitemapUrls);
}

/** The stored top ten of the search the page targets, where the pass that
 *  wrote this report bought one. */
export function storedTopTen(report: StoredReport, searches: readonly string[]): string[] {
  if (report.questions.kind === "unmeasured") return [];
  const wanted = new Set(searches.map((search) => search.trim().toLowerCase()));
  const at = report.questions.value.findIndex((question) => wanted.has(question.search.keyword.trim().toLowerCase()));
  const serp = at === -1 ? undefined : report.serps[at];
  return serp === undefined || serp.kind === "unmeasured" ? [] : serp.value.organic.map((row) => row.url);
}

const CLAIMS_SCHEMA = z.strictObject({
  claims: z.array(
    z.strictObject({
      page: z.number().int(),
      quote: z.string(),
      /** For a statistic, the year its data is from. */
      year: z.number().int().nullable(),
      /** What the claim states (D56): the price of the page's own product,
       *  what that product does, or neither. */
      about: z.enum(["price", "product", "other"]),
    })
  ),
});

/** Quotation marks and whitespace are not a different claim. */
const squash = (text: string): string =>
  text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

const YEAR_RE = /\b(?:19|20)\d{2}\b/g;

/** The year a statistic's data is from: the one the model read, else the
 *  latest year the quotation itself names. `null` for a claim with no figure
 *  besides a year — a date is not a statistic. */
export function statisticYear(quote: string, stated: number | null): number | null {
  if (!/\d/.test(quote.replace(YEAR_RE, ""))) return null;
  if (stated !== null) return stated;
  const years = [...quote.matchAll(YEAR_RE)].map((match) => Number(match[0]));
  return years.length === 0 ? null : Math.max(...years);
}

const RIVAL_KIND = { price: "rival_pricing", product: "rival_features" } as const;

/** The claims the model returned that are on their page word for word and
 *  not too old to use, at most `RESEARCH.claimsPerPage` a page. A claim off
 *  a rival's own page is kept as what it states — its price, or what the
 *  product does — and is not kept where it states neither (D56). */
export function admittedClaims(
  claims: readonly z.infer<typeof CLAIMS_SCHEMA>["claims"][number][],
  pages: readonly (ReadPage & Wanted)[],
  today: Date
): MarketFact[] {
  const floor = today.getUTCFullYear() - RESEARCH.statisticMaxAgeYears;
  const out: MarketFact[] = [];
  const perPage = new Map<string, number>();
  for (const claim of claims) {
    const page = pages[claim.page - 1];
    const passage = squash(claim.quote);
    if (page === undefined || passage.length < 20 || passage.length > 400) continue;
    if (!squash(page.text).includes(passage)) continue;
    const year = statisticYear(passage, claim.year);
    if (year !== null && year < floor) continue;
    if (out.some((fact) => fact.passage === passage)) continue;
    const kind = page.product === undefined ? page.kind : claim.about === "other" ? undefined : RIVAL_KIND[claim.about];
    if (kind === undefined) continue;
    const held = perPage.get(page.url) ?? 0;
    if (held >= RESEARCH.claimsPerPage) continue;
    perPage.set(page.url, held + 1);
    out.push({
      url: page.url,
      title: page.title,
      readAt: new Date(page.readAt),
      passage,
      kind,
      ...(page.product === undefined ? {} : { product: page.product }),
      ...(page.publishedAt === undefined ? {} : { publishedAt: page.publishedAt }),
      ...(page.source === undefined ? {} : { source: page.source }),
    });
  }
  return out;
}

/** One claim from each page in turn, so no page is the whole pool. */
function inTurn(facts: readonly MarketFact[], pages: readonly { url: string }[]): MarketFact[] {
  const queues = pages.map((page) => facts.filter((fact) => fact.url === page.url));
  const out: MarketFact[] = [];
  for (let round = 0; out.length < RESEARCH.briefFacts && queues.some((queue) => queue[round] !== undefined); round++) {
    for (const queue of queues) {
      const fact = queue[round];
      if (fact !== undefined && out.length < RESEARCH.briefFacts) out.push(fact);
    }
  }
  return out;
}

function logResearch(detail: Record<string, string | number | boolean | null>): void {
  console.log(JSON.stringify({ event: "draft_researched", ...detail }));
}

const NEWS_FIT_SCHEMA = z.strictObject({
  results: z.array(z.strictObject({ result: z.number().int(), about: z.boolean() })),
});

interface RecentRead extends ReadPage {
  kind: "recent";
  publishedAt: string;
  source: string;
}

/** *Current insights* (D48): what the news search dates inside the window,
 *  read. One search a term, each ledgered; the results are taken in turn so
 *  no term is the whole page, and read until `RESEARCH.recentJudged` are
 *  held. A page that states its own date is held to it.
 *
 *  The search matches words, so one small call then judges each read result
 *  against the market (issue 1262), and the first `RESEARCH.recentPages` it
 *  calls about the market are kept. A result it does not answer for is not
 *  kept, and where the call cannot be made or does not answer, none is. */
async function recentPages(
  c: CostContext,
  a: { siteId: string; locale: Locale; today: Date; recent: { searches: readonly string[]; days: number; market: Pick<WritingMarket, "category" | "synonyms" | "market"> } },
  notOurs: (url: string) => boolean,
  taken: ReadonlySet<string>
): Promise<{ pages: RecentRead[]; news: JudgedResult[] }> {
  const today = a.today.toISOString().slice(0, 10);
  const since = new Date(a.today.getTime() - a.recent.days * 86_400_000).toISOString().slice(0, 10);
  const inWindow = (day: string): boolean => day >= since && day <= today;
  const terms = [...new Set(a.recent.searches.map((term) => term.trim()).filter((term) => term !== ""))].slice(0, RESEARCH.newsSearches);
  const results: NewsRow[][] = [];
  for (const query of terms) {
    if (c.capHit()) break;
    const news = await serpNews(c, { query, locale: a.locale, scope: { site: a.siteId }, freshnessDays: CACHE_WINDOWS_D.news });
    if (news.kind === "unmeasured") continue;
    results.push(news.value.filter((row) => inWindow(row.publishedAt) && notOurs(row.url) && !taken.has(row.url)));
  }
  const dated: NewsRow[] = [];
  for (let round = 0; results.some((rows) => rows[round] !== undefined); round++) {
    for (const rows of results) {
      const row = rows[round];
      if (row !== undefined && !dated.some((held) => held.url === row.url)) dated.push(row);
    }
  }
  const pages: RecentRead[] = [];
  for (let at = 0; at < dated.length && pages.length < RESEARCH.recentJudged; at += RESEARCH.recentRead) {
    const batch = dated.slice(at, at + RESEARCH.recentRead);
    const reads = await Promise.all(batch.map((row) => fetchPage(row.url)));
    reads.forEach((read, index) => {
      if (read === null) return;
      const row = batch[index]!;
      const publishedAt = publishedOf(read.html) ?? row.publishedAt;
      if (inWindow(publishedAt)) pages.push({ ...read.page, kind: "recent", publishedAt, source: row.source });
    });
  }
  const read = pages.slice(0, RESEARCH.recentJudged);
  if (read.length === 0 || c.capHit()) return { pages: [], news: [] };

  const market = a.recent.market;
  const job = market.market?.job ?? null;
  const answer = await llm(c, {
    site: "generate.news_fit",
    tier: "haiku",
    locale: a.locale,
    schema: NEWS_FIT_SCHEMA,
    input: {
      task:
        "Each of `results` is a news story a search returned for `market.category`. Say for each whether it " +
        "is about that market: the one named `market.category`, also called `market.synonyms`" +
        (job === null ? "" : ", where a product is hired for `market.job`") +
        ". A story is about the market when it reports something in it — a change, a product, a finding, a " +
        "figure — that someone buying or selling in this market would read as news of their own market. A " +
        "story that only shares words with the category, or is about one of `market.notOurMarket` or another " +
        "neighbouring market, is not. Answer for every result by its number; where you cannot tell, answer false.",
      market: {
        category: market.category.trim() === "" ? (terms[0] ?? "") : market.category,
        synonyms: market.synonyms,
        ...(job === null ? {} : { job }),
        notOurMarket: market.market?.notOurMarket ?? [],
      },
      results: read.map((page, index) => ({
        result: index + 1,
        title: page.title,
        source: page.source,
        text: words(page.text, RESEARCH.judgedWords),
      })),
    },
  });
  if (answer.kind === "unmeasured") return { pages: [], news: [] };
  const about = new Set(answer.value.results.filter((row) => row.about).map((row) => row.result));
  return {
    pages: read.filter((_, index) => about.has(index + 1)).slice(0, RESEARCH.recentPages),
    news: read.map((page, index) => ({
      url: page.url,
      title: page.title,
      publishedAt: page.publishedAt,
      source: page.source,
      onMarket: about.has(index + 1),
    })),
  };
}

/** One SERP, read for its "People also ask" and its related searches
 *  (D61). Ledgered; `null` where the call fails. */
async function askedBeside(c: CostContext, a: { siteId: string; locale: Locale; query: string }): Promise<{ peopleAlsoAsk: string[]; searches: string[] } | null> {
  const serp = await serpOrganic(c, {
    query: a.query,
    locale: a.locale,
    mode: "live",
    loadAsyncAiOverview: false,
    scope: { site: a.siteId },
    freshnessDays: CACHE_WINDOWS_D.serp,
    questions: true,
  });
  if (serp.kind === "unmeasured") return null;
  return {
    peopleAlsoAsk: [...(serp.value.peopleAlsoAsk ?? [])],
    searches: [...new Set((serp.value.relatedSearches ?? []).map((search) => search.trim().toLowerCase()))],
  };
}

/** The related searches that have a measured volume: one keyword-overview
 *  call for at most `RESEARCH.relatedSearches` of them. Ledgered; none where
 *  the call fails or the ceiling is met. */
async function withVolume(c: CostContext, locale: Locale, searches: readonly string[]): Promise<BuyersAsk["related"]> {
  const asked = searches.slice(0, RESEARCH.relatedSearches);
  if (asked.length === 0 || c.capHit()) return [];
  const volumes = await keywordOverview(c, { keywords: asked, locale });
  if (volumes.kind === "unmeasured") return [];
  const volumeOf = new Map(volumes.value.map((row) => [row.keyword, row.searchVolume]));
  return asked.map((search) => ({ search, volume: volumeOf.get(search) ?? 0 })).filter((row) => row.volume > 0);
}

/** What buyers ask about the target (D61): one SERP of the target itself,
 *  read for its "People also ask" and its related searches, and one
 *  keyword-overview call that keeps the related searches with a measured
 *  volume. A call that fails or meets the ceiling leaves its half empty. */
async function buyersAsk(c: CostContext, a: { siteId: string; locale: Locale; target: string }): Promise<BuyersAsk> {
  const beside = await askedBeside(c, { siteId: a.siteId, locale: a.locale, query: a.target });
  if (beside === null) return { peopleAlsoAsk: [], related: [] };
  return { peopleAlsoAsk: beside.peopleAlsoAsk, related: await withVolume(c, a.locale, beside.searches) };
}

const sameWords = (text: string): string => text.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * A thin SERP borrows from the market's searched terms (owner, D62; issue
 * 1297). Where the target's own SERP leaves the pack short of a Q&A's
 * questions, the SERP of each of `terms` is read in turn — the market's
 * search term, then its other searched terms, most searched first — for its
 * "People also ask", and the reading stops as soon as the pack keeps enough
 * or the terms run out. Each is one SERP, about 0.2¢.
 *
 * The terms' related searches are measured only where their questions were
 * not enough, in one keyword-overview call for all of them: a call a term
 * would cost five times the SERP it follows.
 *
 * Nothing is kept here. `held` is the pack's own count, so a borrowed
 * question passes the market filter, the template limit and the heading
 * measure a question of the target's own SERP does.
 */
async function borrowedAsk(
  c: CostContext,
  a: { siteId: string; locale: Locale; target: string; terms: readonly string[]; asked: BuyersAsk; held: (asked: BuyersAsk) => QuestionsHeld }
): Promise<{ asked: BuyersAsk; borrowed: { terms: string[]; added: number } } | null> {
  const first = a.held(a.asked);
  if (first.enough) return null;
  let asked = a.asked;
  const read: string[] = [];
  const unmeasured: string[] = [];
  // Each term once, and never the target, whose SERP is already read.
  const terms = a.terms
    .map((term) => term.trim())
    .filter((term, at, all) => term !== "" && sameWords(term) !== sameWords(a.target) && all.findIndex((other) => sameWords(other) === sameWords(term)) === at);
  for (const term of terms) {
    if (c.capHit() || a.held(asked).enough) break;
    const beside = await askedBeside(c, { siteId: a.siteId, locale: a.locale, query: term });
    if (beside === null) continue;
    read.push(term);
    const known = new Set(asked.peopleAlsoAsk.map(sameWords));
    asked = { ...asked, peopleAlsoAsk: [...asked.peopleAlsoAsk, ...beside.peopleAlsoAsk.filter((question) => !known.has(sameWords(question)))] };
    for (const search of beside.searches) {
      if (!unmeasured.includes(search) && !asked.related.some((row) => row.search === search)) unmeasured.push(search);
    }
  }
  if (!a.held(asked).enough) asked = { ...asked, related: [...asked.related, ...(await withVolume(c, a.locale, unmeasured))] };
  return { asked, borrowed: { terms: read, added: a.held(asked).kept - first.kept } };
}

export async function researchMarket(
  c: CostContext,
  a: {
    siteId: string;
    /** The site's country and language (D66): every search this step buys
     *  is made in it. */
    locale: Locale;
    domain: string;
    /** The target search and every search the row absorbed. */
    searches: readonly string[];
    report: StoredReport;
    /** The rival domains and names recorded for the site. */
    rivals: readonly string[];
    today: Date;
    /** *Current insights* (D42, D48): in place of the studies, the news is
     *  searched for each of `searches` — the market's category, then its
     *  synonyms — and a result is kept where it is dated inside `days` and
     *  is about `market` (issue 1262). */
    recent?: { searches: readonly string[]; days: number; market: Pick<WritingMarket, "category" | "synonyms" | "market"> };
    /** A Q&A, or a comparison that may be written as one (D47): what buyers
     *  ask about the target is read too (D61). */
    questions?: boolean;
    /** D62: where the target's own SERP leaves the Q&A short, the market's
     *  searched terms are read for more — `terms` in the order they are
     *  read, and `held`, what a pack built from this research holds. */
    borrow?: { terms: readonly string[]; held: (research: MarketResearch) => QuestionsHeld };
  }
): Promise<MarketResearch> {
  const target = a.searches[0];
  if (target === undefined || c.capHit()) return NO_RESEARCH;
  const own = a.domain.replace(/^www\./, "").toLowerCase();
  const rivalDomains = [...new Set(a.rivals.map((rival) => rival.trim().toLowerCase()).filter((rival) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(rival)))]
    .filter((rival) => !sameSite(rival, own))
    .slice(0, RESEARCH.rivals);
  const notOurs = (url: string): boolean => {
    const host = hostOf(url);
    return host.length > 0 && !sameSite(host, own);
  };

  // 1. The network, in parallel: the top results in order until enough are
  //    readable, and each rival's two pages.
  const topTen = storedTopTen(a.report, a.searches).filter(notOurs);
  const topReads = await Promise.all(topTen.slice(0, RESEARCH.topResults * 2).map(fetchPage));
  const rivalReads = (
    await Promise.all(
      rivalDomains.map(async (domain) => {
        // D56: the rival's own links and sitemap say where its pages are.
        const [home, sitemap] = await Promise.all([fetchBody(`https://${domain}/`), sitemapOf(domain)]);
        const named = RIVAL_PAGE_KINDS.map((kind) => ({ kind, url: rivalPage(kind, domain, home, sitemap) }));
        // One page that is both is read once.
        const wanted = named.filter((page, index) => page.url !== null && named.findIndex((other) => other.url === page.url) === index);
        return Promise.all(wanted.map(async (page) => ({ domain, kind: page.kind, read: await fetchPage(page.url!) })));
      })
    )
  ).flat();

  // 2. The one search for studies, and the two it finds that are nobody's
  //    sales page.
  const taken = new Set(topTen);
  const recent = a.recent === undefined ? null : await recentPages(c, { ...a, recent: a.recent }, notOurs, taken);
  const found: (ReadPage & Wanted)[] = recent === null ? [] : [...recent.pages];
  if (a.recent === undefined && !c.capHit()) {
    const studyUrls: string[] = [];
    const serp = await serpOrganic(c, {
      query: languagePack(a.locale.language).studySearch(target),
      locale: a.locale,
      mode: "live",
      loadAsyncAiOverview: false,
      scope: { site: a.siteId },
      freshnessDays: CACHE_WINDOWS_D.serp,
    });
    if (serp.kind !== "unmeasured") {
      for (const row of serp.value.organic) {
        const host = hostOf(row.url);
        if (!notOurs(row.url) || taken.has(row.url) || rivalDomains.some((rival) => sameSite(host, rival))) continue;
        studyUrls.push(row.url);
      }
    }
    const studyReads = await Promise.all(studyUrls.slice(0, RESEARCH.studies * 2).map(fetchPage));
    found.push(...studyReads.filter((read) => read !== null).slice(0, RESEARCH.studies).map((read) => ({ ...read.page, kind: "study" as const })));
  }

  // 2b. A Q&A's questions (D61), bought before the claim calls so a ceiling
  //     met there does not cost the page its questions.
  const asked = a.questions === true && !c.capHit() ? await buyersAsk(c, { siteId: a.siteId, locale: a.locale, target }) : null;

  // The recent pages lead on a *current insights* page: they are what it is
  // written from, and the claim calls read the first pages only.
  const prefetched: (ReadPage & Wanted)[] = [
    ...(a.recent === undefined ? [] : found),
    ...topReads.filter((read) => read !== null).slice(0, RESEARCH.topResults).map((read) => ({ ...read.page, kind: "top_result" as const })),
    ...rivalReads.flatMap((row) => (row.read === null ? [] : [{ ...row.read.page, kind: row.kind, product: row.domain }])),
    ...(a.recent === undefined ? found : []),
  ];

  // 3. The ledger, one row at a time. A page already read inside the window
  //    is served as it was read then, with that read's date.
  const pages: (ReadPage & Wanted)[] = [];
  for (const page of prefetched) {
    const row = await c.recordFetch<ReadPage>({
      source: RESEARCH_READ_SOURCE,
      cacheKey: page.url,
      freshnessDays: RESEARCH.freshnessDays,
      costCents: 0,
      run: async () => ({ url: page.url, title: page.title, text: page.text, readAt: page.readAt }),
    });
    if ("skipped" in row) break;
    pages.push({ ...page, ...row.payload });
  }

  // 4. The claims, a few pages a call, each kept only where its page says it.
  //    At most `RESEARCH.calls` calls (SPEC §7, D41: "two for research").
  const facts: MarketFact[] = [];
  const perCall = Math.max(1, Math.ceil(Math.min(pages.length, RESEARCH.pagesPerCall * RESEARCH.calls) / RESEARCH.calls));
  for (let at = 0, call = 0; at < pages.length && call < RESEARCH.calls; at += perCall, call++) {
    if (c.capHit()) break;
    const batch = pages.slice(at, at + perCall);
    const answer = await llm(c, {
      site: "generate.research",
      tier: "haiku",
      locale: a.locale,
      schema: CLAIMS_SCHEMA,
      input: {
        task:
          "Copy out the claims a writer answering `search` could cite from these pages: prices and what " +
          "each plan includes, features, limits, statistics, dates, named findings, definitions. At most " +
          `${RESEARCH.claimsPerPage} a page, each one or two sentences copied exactly, character for ` +
          "character — never paraphrase, never join text from two places. On a pricing page copy each " +
          "plan's name with its price. Skip menus, cookie notices, author biographies and calls to action. " +
          "For a statistic give the year its data is from; otherwise null. Say what each claim is `about`: " +
          "`price` where it states what the product whose page it is on costs, or how it is priced; `product` " +
          "where it says what that product does, includes or limits; `other` for anything else — a customer " +
          "count, a slogan, a statistic about the market or about another company's product.",
        search: target,
        today: a.today.toISOString().slice(0, 10),
        pages: batch.map((page, index) => ({ page: index + 1, url: page.url, text: page.text })),
      },
    });
    if (answer.kind === "unmeasured") continue;
    facts.push(...admittedClaims(answer.value.claims, batch, a.today));
  }

  const ordered = inTurn(facts, pages);
  const products = rivalDomains
    .map((domain) => ({
      domain,
      pages: [...new Set(ordered.filter((fact) => fact.product === domain).map((fact) => fact.url))],
    }))
    .filter((product) => product.pages.length > 0);
  const research: MarketResearch = {
    facts: ordered,
    products,
    topResults: pages.filter((page) => page.kind === "top_result").map((page) => ({ url: page.url, text: page.text })),
    ...(recent === null ? {} : { news: recent.news }),
  };
  // 5. A Q&A the target's own SERP leaves short borrows from the market's
  //    searched terms (D62). It follows the claim calls because a question
  //    is kept only where a fact answers it.
  const borrow = a.borrow;
  const more =
    asked === null || borrow === undefined
      ? null
      : await borrowedAsk(c, { siteId: a.siteId, locale: a.locale, target, terms: borrow.terms, asked, held: (each) => borrow.held({ ...research, asked: each }) });
  const questions = more?.asked ?? asked;
  logResearch({
    siteId: a.siteId,
    pagesRead: pages.length,
    topResults: pages.filter((page) => page.kind === "top_result").length,
    rivalPages: pages.filter((page) => page.kind === "rival_pricing" || page.kind === "rival_features").length,
    studies: pages.filter((page) => page.kind === "study").length,
    recent: pages.filter((page) => page.kind === "recent").length,
    newsOffMarket: recent === null ? null : recent.news.filter((result) => !result.onMarket).length,
    facts: ordered.length,
    products: products.length,
    peopleAlsoAsk: questions === null ? null : questions.peopleAlsoAsk.length,
    relatedSearches: questions === null ? null : questions.related.length,
    borrowedTerms: more === null ? null : more.borrowed.terms.length,
    borrowedQuestions: more === null ? null : more.borrowed.added,
  });
  return {
    ...research,
    ...(questions === null ? {} : { asked: questions }),
    ...(more === null ? {} : { borrowed: more.borrowed }),
  };
}
