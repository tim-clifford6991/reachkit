// SPEC §7 *Five stages* (owner, 2026-11-17, #2809) — a draft's research SERPs, asked in job steps before the write.
//
// DataForSEO's live and high-priority SERPs link only Google's `google.com/goto` redirects, which no read can follow;
// the normal standard queue returns the pages themselves, but in minutes, longer than one job step may wait. So the
// day asks for the reads research makes (`researchSerps`) in short steps: the first ask posts them, and a later ask
// for a search still on the queue reads its task at 0¢ (the vendor seam adopts it) until it is ready. The write
// step's research then makes the same reads from the cache. A read still not ready by then is no research, and the
// pack's own check writes no page: it never falls back to a live SERP.
import { RESEARCH } from "@/lib/config/constants";
import { withCostContext, type CostContext } from "@/lib/costs";
import { readCache } from "@/lib/costs/cache";
import { languageOfText } from "@/lib/locale/read";
import { siteLocale } from "@/lib/locale/site";
import { isListingAddress, isMarketplaceHost, isOwnDomain, isPlatformDomain, googleWrapper, registrableDomain } from "@/lib/market/rivals/domains";
import { stemKey } from "@/lib/market/questions/select";
import { opportunityById } from "@/lib/opportunities";
import type { OpportunityRow } from "@/lib/opportunities/store";
import { contentTypeOf, type ContentType } from "@/lib/opportunities/content-type";
import type { Opportunity, PlanWriteAs } from "@/lib/opportunities/types";
import { cachedSerp, serpOrganic } from "@/lib/vendors/dataforseo/serp";
import { DRAFT_POLICY_VERSION, openDayCost } from "./cost";
import { targetSearches } from "./pipeline";
import { builtFromOutside, fellTo, ownTypeOf, researchedAs, typeTheResearchFills, type ResearchRead } from "./standard";
import { NO_RESEARCH, RESEARCH_READ_SOURCE, fetchBody, readFresh, researchSerps, rivalPage, sitemapOf, type MarketResearch } from "./pipeline/research";
import { knowledgeTexts, shares, topicWords } from "./pipeline/pack";
import { alikeHeadings } from "./rules/headings";
import { isQuestionShaped } from "./rules/text";
import { generateStore } from "./store";
import { TEMPLATES } from "./templates";

/** The asking steps: the first waits `askMs` for a read that is ready at once, then each round its own invocation inside
 *  the job route's 300 s, about 45 minutes in all, the queue's own turnaround (`VENDOR.stdQueueDeadlineMin`). */
export const COLLECT = Object.freeze({ rounds: 11, stepMs: 240_000, askMs: 20_000 });

/** Asks for the day's research reads inside the day's draft cap, each waiting `waitMs`, and the first update candidate's
 *  one SERP beside them, so a fallback update writes from the cache. Returns how many of the topic's own are still on
 *  the queue; a type that reads no research has none. */
export async function askDayResearch(a: { siteId: string; opportunityId: string; writeAs?: PlanWriteAs; now: Date; since?: Date; waitMs: number }): Promise<number> {
  const [o, report] = await Promise.all([opportunityById(a.opportunityId), generateStore().latestReport(a.siteId)]);
  const { type, own } = o === null ? { type: null } : await dayTypes(a.siteId, { ...o, writeAs: a.writeAs ?? o.writeAs }, a.now);
  const target = o === null ? undefined : targetSearches(o)[0];
  if (report === null) return 0;
  const locale = await siteLocale(a.siteId);
  const as = type === null ? null : researchedAs(type, own);
  const reads = as === null || !TEMPLATES[as].research || target === undefined ? [] : researchSerps({ siteId: a.siteId, locale, target, guidance: builtFromOutside(as), ...(as === "insights" ? { recent: true } : {}) }, a.waitMs);
  const update = await (await import("./day-refresh")).updateSearch(a.siteId, a.now);
  const beside = update === null ? [] : researchSerps({ siteId: a.siteId, locale, target: update, study: false }, a.waitMs).filter((read) => !reads.some((own) => own.query === read.query));
  if (reads.length + beside.length === 0) return 0;
  return openDayCost({ scanId: report.scanId, siteId: a.siteId, since: a.since ?? a.now }, async (cost) => {
    let waiting = 0;
    // Together, since every read waits to the one `untilMs`; the update's read never holds the day's own write.
    await Promise.all([...reads.map((read) => serpOrganic(cost, { ...read, onFailure: (failed) => void (waiting += failed.taskId === undefined ? 0 : 1) })), ...beside.map((read) => serpOrganic(cost, read))]);
    return waiting;
  });
}

/** A day's page type, its stored one else the one its cached research fills, and its query's own type where the ladder
 *  fell from it, read at 0¢; a stored type that is its shape's own reads nothing, and nothing cached keeps the shape's.
 *  An offering is never fallen to, so one whose cached results page is not held keeps no other type's needs. */
export async function dayTypes(siteId: string, o: Opportunity, now: Date, cost?: CostContext): Promise<{ type: ContentType | null; own?: ContentType }> {
  const read = o.writeAs !== undefined && o.writeAs === contentTypeOf(o) ? null : ((await researchHeld(siteId, [{ id: o.id, target_query: o.targetQuery }], now, o.writeAs === undefined ? cost : undefined)).get(o.id) ?? null);
  const type = o.writeAs ?? typeTheResearchFills(o, read), own = ownTypeOf(o, read);
  return { type, ...(type !== null && fellTo(type, own) ? { own } : {}) };
}

/** A topic's research for its date, ledgered at 0¢ beside its own calls, so the day's last step counts its minimum from
 *  what the run already bought (SPEC §7): that step reads only what is held, and never buys a topic's research again. */
export async function heldResearch(cost: CostContext, a: { key: string; reuse: boolean }, buy: () => Promise<MarketResearch>): Promise<MarketResearch> {
  const held = await cost.recordFetch({ source: "generate.research.held", cacheKey: a.key, freshnessDays: a.reuse ? 1 : 0, costCents: 0, unusable: (payload) => (payload as MarketResearch).pending === true, run: () => (a.reuse ? Promise.resolve(NO_RESEARCH) : buy()) });
  // A held row is jsonb, which keeps a date as its string.
  return "skipped" in held ? NO_RESEARCH : { ...held.payload, facts: held.payload.facts.map((fact) => ({ ...fact, readAt: new Date(fact.readAt) })) };
}

/** seo-master's test of a result: the first `results` organic rows are read, a readable one holds `words`, and a
 *  laid-out how-to has `steps` step headings. */
const READ = Object.freeze({ results: 8, words: 300, steps: 3 });
const YEAR_RE = /\b(?:19|20)\d{2}\b/g;
const STEP_RE = /^(?:\p{L}+\s+)?\d{1,2}\s*[.):\-–]\s*\S/u;
/** A page as research's ledger row stores it. */
type ReadPage = { url: string; title: string; text: string; headings?: string[] };

/** Each row's research as the cache holds it, at 0¢ and with no vendor call: the commit's row check (SPEC §7 *The week is
 *  committed on Monday*). A row whose target SERP, or any eligible result's read, is not cached reads `null`: not measured.
 *  Given `cost`, a result not yet held is read off the network, together, and ledgered at 0¢; one that does not read is no result.
 *  A rival-only `vs` row (R31) is read only given `cost`: each rival it names, its own pricing or features page as research finds it. */
export async function researchHeld(siteId: string, rows: readonly WeekRow[], now: Date, cost?: CostContext): Promise<Map<string, ResearchRead | null>> {
  const [site, locale, report, { versusRivals }] = await Promise.all([generateStore().siteFacts(siteId), siteLocale(siteId), generateStore().latestReport(siteId), import("./day-refresh")]);
  // The site's own facts, which documentation and an offering are written from; unreadable, they are not measured.
  const own = report === null ? null : await (await import("./voice/confirmed")).listicleHeldOf({ siteId, scanId: report.scanId }).catch(() => null);
  const facts = own === null ? null : [...own.passages, ...knowledgeTexts(own.profile?.knowledge)];
  const others = new Set((site?.rivals ?? []).flatMap((rival) => registrableDomain(rival) ?? []));
  const foreign = (url: string) => (site === null || !isOwnDomain(url, site.domain)) && !others.has(registrableDomain(url) ?? "") && !isListingAddress(url) && !isMarketplaceHost(url) && !isPlatformDomain(url);
  const words = (text: string) => new Set(stemKey(text, locale.language).split(" ").filter((word) => word !== ""));
  // At least half of `topic`'s words are in `text`.
  const holds = (topic: Set<string>, text: string) => {
    const said = words(text);
    return topic.size > 0 && [...topic].filter((word) => said.has(word)).length * 2 >= topic.size;
  };
  const oldest = now.getUTCFullYear() - RESEARCH.statisticMaxAgeYears;
  const cached = async (url: string) => ((await readCache({ source: RESEARCH_READ_SOURCE, cacheKey: url, policyVersion: DRAFT_POLICY_VERSION, freshnessDays: RESEARCH.freshnessDays }))?.payload as ReadPage | undefined) ?? (cost === undefined ? undefined : readFresh(cost, url));
  // Whether a rival has an own page that reads, found as research finds it (D56): its home page's links, then its sitemap.
  const ownPageRead = async (domain: string): Promise<boolean> => {
    const [home, sitemap] = await Promise.all([fetchBody(`https://${domain}/`), sitemapOf(domain)]);
    const urls = new Set((["rival_pricing", "rival_features"] as const).flatMap((kind) => rivalPage(kind, domain, home, sitemap) ?? []));
    return (await Promise.all([...urls].map(cached))).some((page) => page != null);
  };
  const read = async (target: string): Promise<ResearchRead | null> => {
    const serp = await cachedSerp(researchSerps({ siteId, locale, target }, 0)[0]!, DRAFT_POLICY_VERSION);
    if (serp === null) return null;
    const urls = serp.organic.slice(0, READ.results).map((row) => row.url).filter((url) => googleWrapper(url) === null && foreign(url));
    const held = await Promise.all(urls.map(cached));
    if (held.some((page) => page === undefined)) return null;
    const rivals = site === null || report === null ? [] : versusRivals(site, report, { targetQuery: target, absorbedQueries: [], title: null });
    if (rivals.length > 0 && cost === undefined) return null;
    const firstHand = await Promise.all(rivals.map(ownPageRead));
    const topic = words(target);
    const pages = held.flatMap((page) => (page == null ? [] : [page])).filter((page) => {
      const language = languageOfText(page.text);
      return page.text.split(/\s+/).length >= READ.words && (language === null || language === locale.language) && holds(topic, page.title);
    });
    const questions: string[] = [];
    for (const asked of [...(serp.peopleAlsoAsk ?? []), ...pages.flatMap((page) => (page.headings ?? []).filter(isQuestionShaped))]) {
      if (!questions.some((held) => stemKey(held, locale.language) === stemKey(asked, locale.language) || alikeHeadings(held, asked))) questions.push(asked);
    }
    const answered = (question: string) => pages.some((page) => [...(page.headings ?? []), page.text].some((text) => holds(words(question), text)));
    const figured = (sentence: string) => {
      const years = [...sentence.matchAll(YEAR_RE)].map((match) => Number(match[0]));
      return /\d/.test(sentence.replace(YEAR_RE, "")) && years.every((year) => year >= oldest) && [...words(sentence)].some((word) => topic.has(word));
    };
    return {
      R: pages.length,
      Q: questions.filter(answered).length,
      F: pages.filter((page) => page.text.split(/(?<=[.!?])\s+/).some(figured)).length,
      stepPages: pages.filter((page) => (page.headings ?? []).filter((heading) => STEP_RE.test(heading)).length >= READ.steps).length,
      asked: serp.peopleAlsoAsk?.length ?? 0,
      urls: pages.map((page) => page.url),
      ...(rivals.length === 0 ? {} : { rivals: { need: rivals.length, have: firstHand.filter(Boolean).length } }),
      top: serp.organic.slice(0, 10).map(({ domain, url, title }) => ({ domain, url, title })),
      ...(facts === null ? {} : { facts: facts.some((text) => shares(topicWords(target), text)) ? facts.length : 0 }),
    };
  };
  const out = new Map<string, ResearchRead | null>();
  for (const row of rows) out.set(row.id, row.target_query === null ? null : await read(row.target_query));
  return out;
}

// The Monday commit's research (SPEC §7 *The week is committed on Monday*), a job step each: each of the week's best rows'
// own target SERP on the normal queue under `CAPS.WEEK_RESEARCH_C`, then the rows checked a batch a step from free reads.
export type WeekRow = Pick<OpportunityRow, "id" | "target_query"> & { topUp?: boolean };
export type Checks = [string, ResearchRead | null][];
const weekCost = <T>(scanId: string, body: (cost: CostContext) => Promise<T>): Promise<T> =>
  withCostContext({ scanId, cap: "WEEK_RESEARCH", policyVersion: DRAFT_POLICY_VERSION, rollUp: "none", activity: "weekly" }, body);

/** Asks each row's own target SERP, never its study search, each waiting `waitMs`; how many are still on the queue. A
 *  read the cap refuses is not asked, and its row is committed queued. */
export async function askWeekResearch(a: { siteId: string; scanId: string; rows: readonly WeekRow[]; waitMs: number }): Promise<number> {
  const targets = a.rows.flatMap((row) => (row.target_query === null ? [] : [row.target_query]));
  if (targets.length === 0) return 0;
  const locale = await siteLocale(a.siteId);
  return weekCost(a.scanId, async (cost) => {
    let waiting = 0;
    const onFailure = (failed: { taskId?: string }) => void (waiting += failed.taskId === undefined ? 0 : 1);
    await Promise.all(targets.map((target) => serpOrganic(cost, { ...researchSerps({ siteId: a.siteId, locale, target }, a.waitMs)[0]!, onFailure })));
    return waiting;
  });
}

/** One batch's row checks, from the cached SERPs and the free reads of their results. */
export async function checkWeekResearch(a: { siteId: string; scanId: string; rows: readonly WeekRow[]; now: Date }): Promise<Checks> {
  return [...(await weekCost(a.scanId, (cost) => researchHeld(a.siteId, a.rows, a.now, cost)))];
}
