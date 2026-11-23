// SPEC §6 *Market changes* (owner ruling 90): the weekly pass asks Google News what changed in the site's market, under
// `CAPS.WEEK_NEWS_C`, a job step of its own. A story is a market change only where two independent publishers reported
// it inside 30 days and the market judgement holds it to the market; each is read for claims, so nothing is speculated.
// The week's row is inserted before any spend, so a second run of the week buys nothing.
import { CACHE_WINDOWS_D, RESEARCH } from "@/lib/config/constants";
import { withCostContext, type CostContext } from "@/lib/costs";
import { DRAFT_POLICY_VERSION } from "@/lib/generate/cost";
import { readClaims } from "@/lib/generate/pipeline/claims-read";
import { newsFit } from "@/lib/generate/pipeline/news-fit";
import { datedOf } from "@/lib/generate/pipeline/dated";
import { fetchPage, type MarketFact, type ReadPage } from "@/lib/generate/pipeline/research";
import { similarity } from "@/lib/generate/rules/similarity";
import { siteWritingMarket, type WritingMarket } from "@/lib/generate/voice/market";
import type { Locale } from "@/lib/locale/locales";
import { siteLocale } from "@/lib/locale/site";
import { readSiteMarket } from "@/lib/market/infer/stored";
import { registrableDomain } from "@/lib/market/rivals/domains";
import { topicWords } from "@/lib/opportunities/intent";
import { serpNews } from "@/lib/vendors/dataforseo";
import type { NewsRow } from "@/lib/vendors/dataforseo/types";
import { readScanReport } from "../report";
import { claimMarketWeek, readMarketChanges, storeMarketChanges } from "./store";

/** The owner's guards (rulings 90 and 91): two publishers inside 30 days, and no count; a copy 80% the same as another is that one. */
export const MARKET_CHANGES = Object.freeze({ sources: 2, days: 30, sameText: 0.8 });

export interface MarketChange {
  title: string;
  /** The new product, model, version, rule or price it reports, and the day it was first reported; null where it names none. */
  names: string | null;
  reportedOn: string;
  words: string[];
  claims: { url: string; publisher: string; publishedAt: string; quote: string }[];
  /** The site-local Mondays the change was first and last recorded on. */
  firstSeen: string;
  lastSeen: string;
}

type Report = ReadPage & { publisher: string; source: string; publishedAt: string };

/** Two wordings are one topic where they share at least half the words of the shorter. */
export function sameTopic(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  let shared = 0;
  for (const word of a) if (b.has(word)) shared++;
  return shared > 0 && shared * 2 >= Math.min(a.size, b.size);
}

const publisherOf = (row: Pick<NewsRow, "url" | "domain">): string => registrableDomain(row.url) ?? row.domain;

/** News results grouped into stories, each story led by its first result's title. */
export function storiesOf(rows: readonly NewsRow[]): NewsRow[][] {
  const stories: { words: Set<string>; rows: NewsRow[] }[] = [];
  for (const row of rows) {
    const words = topicWords(row.title);
    if (words.size === 0) continue;
    const story = stories.find((held) => sameTopic(held.words, words));
    if (story === undefined) stories.push({ words, rows: [row] });
    else story.rows.push(row);
  }
  return stories.map((story) => story.rows).filter((story) => new Set(story.map(publisherOf)).size >= MARKET_CHANGES.sources);
}

/** The week's market changes, bought under `c`; `[]` where the cap, the vendor or the judgement leaves none. */
export async function buyMarketChanges(
  c: CostContext,
  a: { siteId: string; locale: Locale; terms: readonly string[]; notOurs: ReadonlySet<string>; market: WritingMarket; today: Date }
): Promise<Omit<MarketChange, "firstSeen" | "lastSeen">[]> {
  const today = a.today.toISOString().slice(0, 10);
  const since = new Date(a.today.getTime() - MARKET_CHANGES.days * 86_400_000).toISOString().slice(0, 10);
  const inWindow = (day: string): boolean => day >= since && day <= today;
  const rows: NewsRow[] = [];
  for (const query of a.terms.slice(0, RESEARCH.newsSearches)) {
    if (c.capHit()) break;
    const news = await serpNews(c, { query, locale: a.locale, scope: { site: a.siteId }, freshnessDays: CACHE_WINDOWS_D.news });
    if (news.kind === "unmeasured") continue;
    for (const row of news.value) if (inWindow(row.publishedAt) && !a.notOurs.has(publisherOf(row)) && !rows.some((held) => held.url === row.url)) rows.push(row);
  }

  // Each story's reports read and dated by their own page where it states one; a syndicated copy is the report it copies.
  const stories: Report[][] = [];
  for (const story of storiesOf(rows)) {
    if (c.capHit()) break;
    const reads = await Promise.all(story.map((row) => fetchPage(row.url)));
    const held: Report[] = [];
    reads.forEach((read, at) => {
      const row = story[at]!, publisher = publisherOf(row), publishedAt = read === null ? "" : (datedOf(read.html, { url: row.url, readAt: new Date() }).publishedAt ?? row.publishedAt);
      if (read === null || !inWindow(publishedAt) || held.some((h) => h.publisher === publisher || similarity(h.text, read.page.text) >= MARKET_CHANGES.sameText)) return;
      held.push({ ...read.page, publisher, source: row.source, publishedAt });
    });
    if (held.length >= MARKET_CHANGES.sources) stories.push(held);
  }
  if (stories.length === 0 || c.capHit()) return [];

  // Judged a batch at a time, and read for claims a call's pages at a time, while the cap leaves room: the cap is the only bound.
  const kept: { story: Report[]; names: string | null }[] = [];
  for (let at = 0; at < stories.length && !c.capHit(); at += RESEARCH.recentJudged) {
    const batch = stories.slice(at, at + RESEARCH.recentJudged);
    const about = await newsFit(c, { locale: a.locale, market: a.market, fallback: a.terms[0] ?? "", results: batch.map((story) => story[0]!) });
    batch.forEach((story, n) => {
      if (about?.has(n) === true) kept.push({ story, names: about.get(n) ?? null });
    });
  }
  const facts: MarketFact[] = [];
  // One call at a time, each holding whole pairs, so the first call the cap allows can already store a change.
  const perCall = RESEARCH.pagesPerCall - (RESEARCH.pagesPerCall % MARKET_CHANGES.sources);
  const pages = [...kept.flatMap(({ story }) => story.slice(0, MARKET_CHANGES.sources)), ...kept.flatMap(({ story }) => story.slice(MARKET_CHANGES.sources))];
  for (let at = 0; at < pages.length && !c.capHit(); at += perCall) {
    facts.push(...(await readClaims(c, pages.slice(at, at + perCall).map((page) => ({ ...page, kind: "recent" as const })), {
      locale: a.locale, search: a.terms[0] ?? "", rivals: [], today: a.today, siteId: a.siteId, calls: 1,
    })));
  }
  return kept.flatMap(({ story, names }) => {
    const claims = facts.flatMap((fact) => {
      const report = story.find((page) => page.url === fact.url);
      return report === undefined ? [] : [{ url: report.url, publisher: report.source, publishedAt: report.publishedAt, quote: fact.passage }];
    });
    // A change one publisher's claims carry is never stated.
    if (new Set(claims.map((claim) => publisherOf({ url: claim.url, domain: claim.publisher }))).size < MARKET_CHANGES.sources) return [];
    const reportedOn = story.map((page) => page.publishedAt).sort()[0]!;
    return [{ title: story[0]!.title, names, reportedOn, words: [...topicWords(story[0]!.title)], claims }];
  });
}

/** The weekly pass's market changes, once per site and week: how many were stored, `null` where the week was already
 *  recorded or could not be. It never throws, so the week is still committed and told. */
export async function recordMarketChanges(a: { scanId: string; siteId: string; weekStart: string; now: Date }): Promise<number | null> {
  try {
    return await recordWeek(a);
  } catch (error) {
    console.log(JSON.stringify({ event: "market_changes_failed", siteId: a.siteId, weekStart: a.weekStart, because: error instanceof Error ? error.message : String(error) }));
    return null;
  }
}

async function recordWeek(a: { scanId: string; siteId: string; weekStart: string; now: Date }): Promise<number | null> {
  if (!(await claimMarketWeek(a))) return null;
  const [site, report, locale] = await Promise.all([readSiteMarket(a.siteId), readScanReport(a.scanId), siteLocale(a.siteId)]);
  if (site === null || report === null) return 0;
  const market = siteWritingMarket({ category: site.category, rivals: site.competitors, market: site.stored }, report);
  const terms = [market.category, ...market.synonyms].map((term) => term.trim()).filter((term) => term !== "");
  const notOurs = new Set([site.domain, ...site.competitors, ...market.concluded.map((rival) => rival.domain)].flatMap((host) => registrableDomain(host) ?? []));
  const found = await withCostContext({ scanId: a.scanId, cap: "WEEK_NEWS", policyVersion: DRAFT_POLICY_VERSION, rollUp: "none", activity: "weekly" }, (c) =>
    buyMarketChanges(c, { siteId: a.siteId, locale, terms: [...new Set(terms)], notOurs, market, today: a.now })
  );
  // A change seen in an earlier week keeps the week it was first seen.
  const earlier = (await readMarketChanges({ siteIds: [a.siteId], from: new Date(Date.parse(`${a.weekStart}T00:00:00Z`) - 5 * 7 * 86_400_000).toISOString().slice(0, 10) }))
    .flatMap((week) => week.changes as Partial<MarketChange>[])
    .filter((change) => Array.isArray(change.words) && typeof change.firstSeen === "string");
  const changes: MarketChange[] = found.map((change) => {
    const before = earlier.find((held) => sameTopic(new Set(held.words), new Set(change.words)));
    return { ...change, firstSeen: before?.firstSeen ?? a.weekStart, lastSeen: a.weekStart };
  });
  await storeMarketChanges({ siteId: a.siteId, weekStart: a.weekStart, changes });
  return changes.length;
}
