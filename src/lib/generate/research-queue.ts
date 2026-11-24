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
import type { Locale } from "@/lib/locale/locales";
import type { StoredReport } from "@/lib/scan/report";
import { cachedSerp, serpOrganic } from "@/lib/vendors/dataforseo/serp";
import { DRAFT_POLICY_VERSION, openDayCost } from "./cost";
import { competitorOf, targetSearches } from "./pipeline";
import { builtFromOutside, fellTo, ownTypeOf, researchedAs, typeTheResearchFills, type ResearchRead } from "./standard";
import { credibleAt, credibleHosts, credibleSearch, officialOf, studySubject } from "./pipeline/source-tier";
import { NO_RESEARCH, RESEARCH_READ_SOURCE, fetchBody, readFresh, researchMarket, researchSerps, rivalPage, sitemapOf, storedAsk, type MarketResearch } from "./pipeline/research";
import { knowledgeTexts, shares, topicWords } from "./pipeline/pack";
import { alikeHeadings } from "./rules/headings";
import { namedRivals } from "./rules/rivals";
import { isQuestionShaped } from "./rules/text";
import { generateStore, type SiteFacts } from "./store";
import { sourcesNeed, TEMPLATES } from "./templates";
import { siteWritingMarket, type WritingMarket } from "./voice/market";

/** The asking steps: the first waits `askMs` for a read that is ready at once, then each round its own invocation inside
 *  the job route's 300 s, about 45 minutes in all, the queue's own turnaround (`VENDOR.stdQueueDeadlineMin`). */
export const COLLECT = Object.freeze({ rounds: 11, stepMs: 240_000, askMs: 20_000 });

/** Asks for the day's research reads inside the day's draft cap, each waiting `waitMs`, and the first update candidate's
 *  one SERP beside them, so a fallback update writes from the cache. Returns how many of the topic's own are still on
 *  the queue; a type that reads no research has none. */
export async function askDayResearch(a: { siteId: string; opportunityId: string; writeAs?: PlanWriteAs; now: Date; since?: Date; waitMs: number }): Promise<number> {
  const [o, report, site] = await Promise.all([opportunityById(a.opportunityId), generateStore().latestReport(a.siteId), generateStore().siteFacts(a.siteId)]);
  const { type, own } = o === null ? { type: null } : await dayTypes(a.siteId, { ...o, writeAs: a.writeAs ?? o.writeAs }, a.now);
  const target = o === null ? undefined : targetSearches(o)[0];
  if (report === null) return 0;
  const locale = await siteLocale(a.siteId);
  const as = type === null ? null : researchedAs(type, own);
  const asked = { siteId: a.siteId, locale, target: target ?? "", market: site === null ? "" : siteWritingMarket(site, report).category, guidance: as !== null && builtFromOutside(as), options: as === "listicle" };
  const reads = as === null || !TEMPLATES[as].research || target === undefined ? [] : researchSerps({ ...asked, ...(as === "insights" ? { recent: true } : {}) }, a.waitMs);
  const update = await (await import("./day-refresh")).updateSearch(a.siteId, a.now);
  const beside = update === null ? [] : researchSerps({ siteId: a.siteId, locale, target: update, study: false }, a.waitMs).filter((read) => !reads.some((own) => own.query === read.query));
  if (reads.length + beside.length === 0) return 0;
  return openDayCost({ scanId: report.scanId, siteId: a.siteId, since: a.since ?? a.now }, async (cost) => {
    let waiting = 0;
    // Together, since every read waits to the one `untilMs`; the update's read never holds the day's own write.
    await Promise.all([...reads.map((read) => serpOrganic(cost, { ...read, onFailure: (failed) => void (waiting += failed.taskId === undefined ? 0 : 1) })), ...beside.map((read) => serpOrganic(cost, read))]);
    // A study search with no credible host among its results posts the credible one beside it, for the write to read; never waited on.
    const study = reads[1] === undefined ? null : await cachedSerp(reads[1], DRAFT_POLICY_VERSION).catch(() => null), hosts = study === null ? [] : await credibleHosts(a.siteId, locale.language, a.now);
    const credible = study === null || study.organic.some((row) => credibleAt(row.url, hosts, [], officialOf(locale.language))) ? undefined : credibleSearch(reads[1]!, studySubject(asked), hosts);
    if (credible !== undefined && !cost.capHit()) await serpOrganic(cost, credible);
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

/** A topic's research for its date, ledgered at 0¢ beside its own calls, so a row's owed fix step reads only what the run
 *  already bought and never buys a topic's research again.
 *  Research bought logs its own `draft_researched`; any other outcome logs one saying why, so a skip reads as one. */
export async function heldResearch(cost: CostContext, a: { key: string; reuse: boolean; researched: boolean; line: { site: string; draft: string | null; opportunity: string; type: ContentType } }, stored: () => MarketResearch, buy: () => Promise<MarketResearch>): Promise<MarketResearch> {
  const skipped = (reason: "type" | "held" | "cap", research: MarketResearch) => (console.log(JSON.stringify({ event: "draft_researched", skipped: reason, ...a.line })), research);
  if (!a.researched) return skipped("type", stored());
  // A 0¢ reservation passes at the cap, where research itself would stop at once without a line.
  const held = await cost.recordFetch({ source: "generate.research.held", cacheKey: a.key, freshnessDays: a.reuse ? 1 : 0, costCents: 0, unusable: (payload) => (payload as MarketResearch).pending === true, run: () => (a.reuse ? Promise.resolve(NO_RESEARCH) : cost.capHit() ? Promise.resolve(skipped("cap", NO_RESEARCH)) : buy()) });
  if ("skipped" in held) return skipped("cap", NO_RESEARCH);
  // A held row is jsonb, which keeps a date as its string.
  const research = { ...held.payload, facts: held.payload.facts.map((fact) => ({ ...fact, readAt: new Date(fact.readAt) })) };
  return a.reuse || !held.fresh ? skipped("held", research) : research;
}

/** Research, for the types that read public pages (SPEC §7, *Two pools of facts*; issue 1135): at most two model calls,
 *  and for *current insights* one more that holds its news to the market (issue 1262). A read that fails leaves the page
 *  to its business facts and never stops it. A Q&A its target's own SERP leaves short of questions is read beside the
 *  market's searched terms too (owner, D62; issue 1297): the pack says when it holds enough. */
export async function researchFor(
  cost: CostContext,
  a: { siteId: string; site: SiteFacts; report: StoredReport; draftId?: string; publishDate: string | null; fixStep?: "owe" | "owed"; o: Opportunity; type: ContentType; as: ContentType; own?: ContentType; locale: Locale; writingFor: WritingMarket }
): Promise<MarketResearch> {
  const { site, report, o, type, as, locale, writingFor } = a;
  const category = writingFor.category;
  const { versusRivals } = await import("./day-refresh");
  const line = { site: a.siteId, draft: a.draftId ?? null, opportunity: o.id, type };
  return heldResearch(cost, { key: `${a.siteId}:${o.id}:${type}:${a.publishDate}`, reuse: a.fixStep === "owed", researched: TEMPLATES[as].research, line }, () => storedAsk(report, targetSearches(o)), () => researchMarket(cost, {
          siteId: a.siteId, page: `${o.id}:${a.publishDate}`,
          locale,
          domain: site.domain,
          searches: targetSearches(o),
          urls: o.planReason?.research?.urls, sources: sourcesNeed(type, a.own),
          report,
          rivals: [...versusRivals(site, report, o), ...(competitorOf(o) ?? []), ...site.rivals],
          // Issue 1508: a listicle counts its top results' options, and an alternatives search's product is its baseline.
          rivalNames: namedRivals(site.rivals, writingFor.market),
          options: as === "listicle",
          marketWords: [category, ...writingFor.synonyms],
          today: new Date(),
          // Issue 1390: every page that is researched reads what buyers
          // ask beside its target, for its headings.
          questions: true,
          // Issue 1486: a how-to or a Q&A is built from cited outside facts,
          // so its one search reads the target's own guidance.
          guidance: builtFromOutside(as), study: as !== "update",
          ...(as === "insights"
            ? { recent: { searches: [category === "" ? (targetSearches(o)[0] ?? "") : category, ...writingFor.synonyms], days: RESEARCH.recentDays, market: writingFor } }
            : {}),
        }).catch((error: unknown) => {
          console.warn(JSON.stringify({ event: "draft_research_failed", siteId: a.siteId, error: String(error).slice(0, 200) }));
          return NO_RESEARCH;
        }));
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
