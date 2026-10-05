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
// pages, never to a listicle about it. `/pricing` and `/features` are tried
// first; where one does not answer, the rival's home page is read once for a
// link that does. A rival neither read reaches is not offered to the table.
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
import type { NewsRow } from "@/lib/vendors/dataforseo/types";
import { serpNews, serpOrganic } from "@/lib/vendors/dataforseo";

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

export interface MarketResearch {
  facts: MarketFact[];
  products: ResearchedProduct[];
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

/** One page off the network, or `null` where it did not answer with enough
 *  to read. Nothing is thrown: a page that cannot be read is not a fact. */
async function fetchPage(url: string): Promise<{ page: ReadPage; html: string } | null> {
  try {
    const outcome = await safeFetch(url, { userAgent: "reachkit-measure", timeoutMs: RESEARCH.readTimeoutMs });
    if (!outcome.ok) return null;
    const text = visibleText(outcome.html);
    if (text.split(/\s+/).length < RESEARCH.minWords) return null;
    const title = visibleText(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(outcome.html)?.[1] ?? "").trim();
    return {
      page: {
        url: outcome.url,
        title: title.length === 0 ? hostOf(outcome.url) : title,
        text: words(text, RESEARCH.readWords),
        readAt: outcome.readAt.toISOString(),
      },
      html: outcome.html,
    };
  } catch {
    return null;
  }
}

const RIVAL_PATHS = { rival_pricing: "/pricing", rival_features: "/features" } as const;
const RIVAL_LINK_RES = {
  rival_pricing: /pric|plans/i,
  rival_features: /feature|product|platform/i,
} as const;
const ANCHOR_RE = /<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;

/** The rival's own page of this kind, as its home page links it. */
export function linkedPage(homeHtml: string, homeUrl: string, kind: keyof typeof RIVAL_PATHS): string | null {
  const domain = hostOf(homeUrl);
  ANCHOR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ANCHOR_RE.exec(homeHtml)) !== null) {
    let href: URL;
    try {
      href = new URL(match[1]!, homeUrl);
    } catch {
      continue;
    }
    if (!sameSite(hostOf(href.href), domain) || href.pathname === "/" || href.pathname === RIVAL_PATHS[kind]) continue;
    if (RIVAL_LINK_RES[kind].test(href.pathname) || RIVAL_LINK_RES[kind].test(visibleText(match[2] ?? ""))) {
      return href.href;
    }
  }
  return null;
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

/** The claims the model returned that are on their page word for word and
 *  not too old to use, at most `RESEARCH.claimsPerPage` a page. */
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
    const held = perPage.get(page.url) ?? 0;
    if (held >= RESEARCH.claimsPerPage) continue;
    perPage.set(page.url, held + 1);
    out.push({
      url: page.url,
      title: page.title,
      readAt: new Date(page.readAt),
      passage,
      kind: page.kind,
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
  a: { siteId: string; today: Date; recent: { searches: readonly string[]; days: number; market: WritingMarket } },
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
    const news = await serpNews(c, { query, scope: { site: a.siteId }, freshnessDays: CACHE_WINDOWS_D.news });
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

export async function researchMarket(
  c: CostContext,
  a: {
    siteId: string;
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
    recent?: { searches: readonly string[]; days: number; market: WritingMarket };
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
  const rivalReads = await Promise.all(
    rivalDomains.flatMap((domain) =>
      (Object.keys(RIVAL_PATHS) as (keyof typeof RIVAL_PATHS)[]).map(async (kind) => {
        const first = await fetchPage(`https://${domain}${RIVAL_PATHS[kind]}`);
        if (first !== null) return { domain, kind, read: first };
        // Retry once, through the rival's own home page.
        const home = await fetchPage(`https://${domain}/`);
        const linked = home === null ? null : linkedPage(home.html, home.page.url, kind);
        return { domain, kind, read: linked === null ? null : await fetchPage(linked) };
      })
    )
  );

  // 2. The one search for studies, and the two it finds that are nobody's
  //    sales page.
  const taken = new Set(topTen);
  const recent = a.recent === undefined ? null : await recentPages(c, { ...a, recent: a.recent }, notOurs, taken);
  const found: (ReadPage & Wanted)[] = recent === null ? [] : [...recent.pages];
  if (a.recent === undefined && !c.capHit()) {
    const studyUrls: string[] = [];
    const serp = await serpOrganic(c, {
      query: `${target} statistics study`,
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
      schema: CLAIMS_SCHEMA,
      input: {
        task:
          "Copy out the claims a writer answering `search` could cite from these pages: prices and what " +
          "each plan includes, features, limits, statistics, dates, named findings, definitions. At most " +
          `${RESEARCH.claimsPerPage} a page, each one or two sentences copied exactly, character for ` +
          "character — never paraphrase, never join text from two places. On a pricing page copy each " +
          "plan's name with its price. Skip menus, cookie notices, author biographies and calls to action. " +
          "For a statistic give the year its data is from; otherwise null.",
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
  });
  return {
    facts: ordered,
    products,
    topResults: pages.filter((page) => page.kind === "top_result").map((page) => ({ url: page.url, text: page.text })),
    ...(recent === null ? {} : { news: recent.news }),
  };
}
