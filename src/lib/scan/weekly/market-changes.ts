// SPEC §6 *Market changes* (owner ruling 90): the weekly pass asks Google News what happened this past week to the things
// that move the site's market, from the week's one sum, `CAPS.WEEK_C`, a job step of its own. A story is a market change only where two
// independent publishers reported it inside 30 days and the judgement holds it to be in the market; each is read
// for claims, so nothing is speculated. The week's row is inserted before any spend, so a second run of the week buys
// nothing; an owner's re-run takes the week over, reads the news again and keeps each change the week held.
import { CACHE_WINDOWS_D, RESEARCH } from "@/lib/config/constants";
import { withCostContext, type CostContext } from "@/lib/costs";
import { DRAFT_POLICY_VERSION } from "@/lib/generate/cost";
import { readClaims } from "@/lib/generate/pipeline/claims-read";
import { newsFit, type Weak } from "@/lib/generate/pipeline/news-fit";
import { fetchPage, type MarketFact, type ReadPage } from "@/lib/generate/pipeline/research";
import { similarity } from "@/lib/generate/rules/similarity";
import { siteWritingMarket, type WritingMarket } from "@/lib/generate/voice/market";
import type { Locale } from "@/lib/locale/locales";
import { siteLocale } from "@/lib/locale/site";
import { readSiteMarket } from "@/lib/market/infer/stored";
import type { StoredMarket } from "@/lib/market/infer/types";
import { googleWrapper, registrableDomain } from "@/lib/market/rivals/domains";
import { topicWords } from "@/lib/opportunities/intent";
import { replaceOpsEvent } from "@/lib/ops/events";
import { serpNews } from "@/lib/vendors/dataforseo";
import type { NewsRow } from "@/lib/vendors/dataforseo/types";
import { readScanReport } from "../report";
import { claimMarketWeek, readMarketChanges, storeMarketChanges } from "./store";

/** The owner's guards (rulings 90 and 91): two publishers inside 30 days, and no count; a copy 80% the same as another is that one. */
export const MARKET_CHANGES = Object.freeze({ sources: 2, days: 30, sameText: 0.8 });

/** The ops row, keyed by its scan, that holds what became of each story a pass read and of each event its hot step judged. */
export const MARKET_PASS = "market_changes_pass";

export interface MarketChange {
  title: string;
  /** The new product, model, version, rule or price it reports, and the day it was first reported; null where it names none. */
  names: string | null;
  /** Why it ranks lower, where the judge held it no dated event or naming nothing new. */
  weak?: Weak;
  reportedOn: string;
  words: string[];
  claims: { url: string; publisher: string; publishedAt: string; quote: string }[];
  /** The days the change was first and last read on. */
  firstSeen: string;
  lastSeen: string;
}

/** What became of one story the week's news read found: a stored change, or the step that dropped it. */
export interface StoryOutcome {
  title: string;
  publishers: string[];
  /** What the judge held it names; null where it named none or did not judge it. */
  names: string | null;
  weak?: Weak;
  outcome: "change" | "one_source" | "unjudged" | "cap" | "not_our_market";
}

type Report = ReadPage & { publisher: string; source: string; publishedAt: string };

/** Two wordings are one topic where they share at least half the words of the shorter. */
export function sameTopic(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  let shared = 0;
  for (const word of a) if (b.has(word)) shared++;
  return shared > 0 && shared * 2 >= Math.min(a.size, b.size);
}

const publisherOf = (row: Pick<NewsRow, "url" | "domain">): string => registrableDomain(row.url) ?? row.domain;

/** News results grouped into stories, each story led by its first result's title. Every result of a search carries
 *  the search's own words, so a story is the words its titles share beyond the search that found each. */
export function storiesOf(rows: readonly (NewsRow & { query: string })[]): NewsRow[][] {
  const stories: { words: Set<string>; rows: NewsRow[] }[] = [];
  for (const row of rows) {
    const searched = topicWords(row.query), words = new Set([...topicWords(row.title)].filter((word) => !searched.has(word)));
    if (words.size === 0) continue;
    const story = stories.find((held) => sameTopic(held.words, words));
    if (story === undefined) stories.push({ words, rows: [row] });
    else story.rows.push(row);
  }
  return stories.map((story) => story.rows).filter((story) => new Set(story.map(publisherOf)).size >= MARKET_CHANGES.sources);
}

/** What moves the market first, since coverage of a launch or an update never names the category; the category fills the rest.
 *  A market still pending holds the watch no pass has yet written onto the standing one. */
export function newsQueries(stored: Pick<StoredMarket, "current" | "pending">, category: string): string[] {
  const watch = stored.current?.watch ?? stored.pending?.watch ?? [];
  return [...new Set([...watch, category].map((term) => term.trim()).filter((term) => term !== ""))];
}

/** The week's market changes, bought under `c`, and what became of each story read; `[]` where the cap, the vendor or the judgement leaves none. */
export async function buyMarketChanges(
  c: CostContext,
  a: { siteId: string; locale: Locale; terms: readonly string[]; notOurs: ReadonlySet<string>; market: WritingMarket; today: Date; again?: true }
): Promise<{ changes: Omit<MarketChange, "firstSeen" | "lastSeen">[]; stories: StoryOutcome[] }> {
  const counts = { queries: a.terms.slice(0, RESEARCH.newsSearches), rows: 0, stories: 0, judged: 0, events: 0 };
  const said: StoryOutcome[] = [];
  const told = (changes: Omit<MarketChange, "firstSeen" | "lastSeen">[]) => {
    for (const story of said) console.log(JSON.stringify({ event: "market_changes_story", siteId: a.siteId, ...story }));
    console.log(JSON.stringify({ event: "market_changes_read", siteId: a.siteId, ...counts, claimed: changes.length }));
    return { changes, stories: said };
  };
  const today = a.today.toISOString().slice(0, 10);
  const since = new Date(a.today.getTime() - MARKET_CHANGES.days * 86_400_000).toISOString().slice(0, 10);
  const inWindow = (day: string): boolean => day >= since && day <= today;
  const rows: (NewsRow & { query: string })[] = [];
  // At once, since each waits on the vendor following Google's links; a link it could not follow names no publisher and is skipped alone.
  const reads = c.capHit() ? [] : await Promise.all(counts.queries.map((query) =>
    serpNews(c, { query, locale: a.locale, scope: { site: a.siteId }, freshnessDays: a.again ? 0 : CACHE_WINDOWS_D.news, resolveRedirects: true, pastWeek: true })));
  reads.forEach((news, at) => {
    if (news.kind === "unmeasured") return;
    for (const row of news.value) if (googleWrapper(row.url) === null && inWindow(row.publishedAt) && !a.notOurs.has(publisherOf(row)) && !rows.some((held) => held.url === row.url)) rows.push({ ...row, query: counts.queries[at]! });
  });

  // Each story's reports read and dated by their own page where it states one; a syndicated copy is the report it copies.
  const found = storiesOf(rows), stories: { held: Report[]; fate: StoryOutcome }[] = [];
  // Each story is the cap's until a step decides it.
  said.push(...found.map((story): StoryOutcome => ({ title: story[0]!.title, publishers: [...new Set(story.map(publisherOf))], names: null, outcome: "cap" })));
  for (const [n, story] of found.entries()) {
    if (c.capHit()) break;
    const reads = await Promise.all(story.map((row) => fetchPage(row.url, row.publishedAt)));
    const held: Report[] = [];
    reads.forEach((read, at) => {
      const row = story[at]!, publisher = publisherOf(row), publishedAt = read === null ? "" : (read.page.publishedAt ?? row.publishedAt);
      if (read === null || !inWindow(publishedAt) || held.some((h) => h.publisher === publisher || similarity(h.text, read.page.text) >= MARKET_CHANGES.sameText)) return;
      held.push({ ...read.page, publisher, source: row.source, publishedAt });
    });
    if (held.length >= MARKET_CHANGES.sources) stories.push({ held, fate: said[n]! });
    else said[n]!.outcome = "one_source";
  }
  Object.assign(counts, { rows: rows.length, stories: stories.length });
  if (stories.length === 0 || c.capHit()) return told([]);

  // Judged a batch at a time, and read for claims a call's pages at a time, while the cap leaves room: the cap is the only bound.
  const kept: { story: Report[]; names: string | null; weak?: Weak; fate: StoryOutcome }[] = [];
  for (let at = 0; at < stories.length && !c.capHit(); at += RESEARCH.recentJudged) {
    const batch = stories.slice(at, at + RESEARCH.recentJudged);
    const about = await newsFit(c, { locale: a.locale, market: a.market, fallback: a.terms.at(-1) ?? "", results: batch.map(({ held }) => held[0]!) });
    counts.judged += batch.length;
    batch.forEach(({ held, fate }, n) => {
      const verdict = about?.get(n);
      if (verdict === undefined) fate.outcome = about === null ? "unjudged" : "not_our_market";
      else if ("not" in verdict) fate.outcome = "not_our_market";
      else kept.push({ story: held, ...verdict, fate: Object.assign(fate, verdict) });
    });
  }
  counts.events = kept.length;
  const facts: MarketFact[] = [];
  // One call at a time, each holding whole pairs, so the first call the cap allows can already store a change.
  const perCall = RESEARCH.pagesPerCall - (RESEARCH.pagesPerCall % MARKET_CHANGES.sources);
  const pages = [...kept.flatMap(({ story }) => story.slice(0, MARKET_CHANGES.sources)), ...kept.flatMap(({ story }) => story.slice(MARKET_CHANGES.sources))];
  for (let at = 0; at < pages.length && !c.capHit(); at += perCall) {
    facts.push(...(await readClaims(c, pages.slice(at, at + perCall).map((page) => ({ ...page, kind: "recent" as const })), {
      locale: a.locale, search: a.market.category, rivals: [], today: a.today, siteId: a.siteId, calls: 1,
    })));
  }
  return told(kept.flatMap(({ story, names, weak, fate }) => {
    const claims = facts.flatMap((fact) => {
      const report = story.find((page) => page.url === fact.url);
      return report === undefined ? [] : [{ url: report.url, publisher: report.source, publishedAt: report.publishedAt, quote: fact.passage }];
    });
    // A change one publisher's claims carry is never stated.
    if (new Set(claims.map((claim) => publisherOf({ url: claim.url, domain: claim.publisher }))).size < MARKET_CHANGES.sources) {
      fate.outcome = c.capHit() ? "cap" : "one_source";
      return [];
    }
    fate.outcome = "change";
    const reportedOn = story.map((page) => page.publishedAt).sort()[0]!;
    return [{ title: story[0]!.title, names, ...(weak === undefined ? {} : { weak }), reportedOn, words: [...topicWords(story[0]!.title)], claims }];
  }));
}

/** The weekly pass's market changes, once per site and week: how many were stored, `null` where the week was already
 *  recorded or could not be. It never throws, so the week is still committed and told. */
export async function recordMarketChanges(a: { scanId: string; siteId: string; weekStart: string; now: Date; again?: true }): Promise<number | null> {
  try {
    return await recordWeek(a);
  } catch (error) {
    console.log(JSON.stringify({ event: "market_changes_failed", siteId: a.siteId, weekStart: a.weekStart, because: error instanceof Error ? error.message : String(error) }));
    return null;
  }
}

async function recordWeek(a: { scanId: string; siteId: string; weekStart: string; now: Date; again?: true }): Promise<number | null> {
  if (!(await claimMarketWeek(a))) return null;
  const [site, report, locale] = await Promise.all([readSiteMarket(a.siteId), readScanReport(a.scanId), siteLocale(a.siteId)]);
  if (site === null || report === null) return 0;
  const market = siteWritingMarket({ category: site.category, rivals: site.competitors, market: site.stored }, report);
  const notOurs = new Set([site.domain, ...site.competitors, ...market.concluded.map((rival) => rival.domain)].flatMap((host) => registrableDomain(host) ?? []));
  const found = await withCostContext({ scanId: a.scanId, cap: "WEEK", policyVersion: DRAFT_POLICY_VERSION, rollUp: "none", activity: "weekly" }, (c) =>
    buyMarketChanges(c, { siteId: a.siteId, locale, terms: newsQueries(site.stored, market.category), notOurs, market, today: a.now, ...(a.again ? { again: true as const } : {}) })
  );
  return storeWeek(a, found);
}

/** Stores a read as the week's: its changes, each change the week already held still inside the window, and what became of each story. */
export async function storeWeek(a: { scanId: string; siteId: string; weekStart: string; now: Date }, found: Awaited<ReturnType<typeof buyMarketChanges>>): Promise<number> {
  // A change seen in an earlier week keeps the week it was first seen.
  const weeks = await readMarketChanges({ siteIds: [a.siteId], from: new Date(Date.parse(`${a.weekStart}T00:00:00Z`) - 5 * 7 * 86_400_000).toISOString().slice(0, 10) });
  const stored = (week?: string) => weeks.filter((held) => week === undefined || held.weekStart === week).flatMap((held) => held.changes as Partial<MarketChange>[])
    .filter((change): change is MarketChange => Array.isArray(change.words) && typeof change.firstSeen === "string" && typeof change.reportedOn === "string");
  const earlier = stored(), day = a.now.toISOString().slice(0, 10), since = new Date(a.now.getTime() - MARKET_CHANGES.days * 86_400_000).toISOString().slice(0, 10);
  const changes: MarketChange[] = found.changes.map((change) => {
    const before = earlier.find((held) => sameTopic(new Set(held.words), new Set(change.words)));
    return { ...change, firstSeen: before?.firstSeen ?? day, lastSeen: day };
  });
  // A re-run adds to the week: each change it already holds inside the window stays, though the news no longer carries it.
  const kept = stored(a.weekStart).filter((held) => held.reportedOn >= since && !changes.some((change) => sameTopic(new Set(change.words), new Set(held.words))));
  await storeMarketChanges({ siteId: a.siteId, weekStart: a.weekStart, changes: [...changes, ...kept] });
  await replaceOpsEvent(MARKET_PASS, a.siteId, a.scanId, JSON.stringify({ stories: found.stories }));
  return changes.length + kept.length;
}
