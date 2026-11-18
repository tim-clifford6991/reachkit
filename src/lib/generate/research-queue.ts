// SPEC §7 *Five stages* (owner, 2026-11-17, #2809) — a draft's research SERPs, asked in job steps before the write.
//
// DataForSEO's live and high-priority SERPs link only Google's `google.com/goto` redirects, which no read can follow;
// the normal standard queue returns the pages themselves, but in minutes, longer than one job step may wait. So the
// day asks for the reads research makes (`researchSerps`) in short steps: the first ask posts them, and a later ask
// for a search still on the queue reads its task at 0¢ (the vendor seam adopts it) until it is ready. The write
// step's research then makes the same reads from the cache. A read still not ready by then is no research, and the
// pack's own check writes no page: it never falls back to a live SERP.
import { RESEARCH } from "@/lib/config/constants";
import { readCache } from "@/lib/costs/cache";
import { languageOfText } from "@/lib/locale/read";
import { siteLocale } from "@/lib/locale/site";
import { isListingAddress, isMarketplaceHost, isOwnDomain, isPlatformDomain, googleWrapper, registrableDomain } from "@/lib/market/rivals/domains";
import { stemKey } from "@/lib/market/questions/select";
import { opportunityById } from "@/lib/opportunities";
import { contentTypeOf } from "@/lib/opportunities/content-type";
import type { OpportunityRow } from "@/lib/opportunities/store";
import { cachedSerp, serpOrganic } from "@/lib/vendors/dataforseo/serp";
import { DRAFT_POLICY_VERSION, openDayCost } from "./cost";
import { targetSearches } from "./pipeline";
import { builtFromOutside, type ResearchRead } from "./standard";
import { RESEARCH_READ_SOURCE, researchSerps } from "./pipeline/research";
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
export async function askDayResearch(a: { siteId: string; opportunityId: string; writeAs?: "qa" | "documentation"; now: Date; waitMs: number }): Promise<number> {
  const [o, report] = await Promise.all([opportunityById(a.opportunityId), generateStore().latestReport(a.siteId)]);
  const type = o === null ? null : (a.writeAs ?? o.writeAs ?? contentTypeOf(o));
  const target = o === null ? undefined : targetSearches(o)[0];
  if (report === null) return 0;
  const locale = await siteLocale(a.siteId);
  const reads = type === null || !TEMPLATES[type].research || target === undefined ? [] : researchSerps({ siteId: a.siteId, locale, target, guidance: builtFromOutside(type), ...(type === "insights" ? { recent: true } : {}) }, a.waitMs);
  const update = await (await import("./day-refresh")).updateSearch(a.siteId, a.now);
  const beside = update === null ? [] : researchSerps({ siteId: a.siteId, locale, target: update, study: false }, a.waitMs).filter((read) => !reads.some((own) => own.query === read.query));
  if (reads.length + beside.length === 0) return 0;
  return openDayCost({ scanId: report.scanId, siteId: a.siteId, since: a.now }, async (cost) => {
    let waiting = 0;
    // Together, since every read waits to the one `untilMs`; the update's read never holds the day's own write.
    await Promise.all([...reads.map((read) => serpOrganic(cost, { ...read, onFailure: (failed) => void (waiting += failed.taskId === undefined ? 0 : 1) })), ...beside.map((read) => serpOrganic(cost, read))]);
    return waiting;
  });
}

/** seo-master's test of a result: the first `results` organic rows are read, a readable one holds `words`, and a
 *  laid-out how-to has `steps` step headings. */
const READ = Object.freeze({ results: 8, words: 300, steps: 3 });
const YEAR_RE = /\b(?:19|20)\d{2}\b/g;
const STEP_RE = /^(?:\p{L}+\s+)?\d{1,2}\s*[.):\-–]\s*\S/u;
/** A page as research's ledger row stores it. */
type ReadPage = { url: string; title: string; text: string; headings?: string[] };

/** Each row's research as the cache holds it, at 0¢ and with no vendor call: the commit's row check (SPEC §7 *The week is
 *  committed on Monday*). A row whose target SERP, or any eligible result's read, is not cached reads `null`: not measured. */
export async function researchHeld(siteId: string, rows: readonly Pick<OpportunityRow, "id" | "target_query">[], now: Date): Promise<Map<string, ResearchRead | null>> {
  const [site, locale] = await Promise.all([generateStore().siteFacts(siteId), siteLocale(siteId)]);
  const others = new Set((site?.rivals ?? []).flatMap((rival) => registrableDomain(rival) ?? []));
  const foreign = (url: string) => (site === null || !isOwnDomain(url, site.domain)) && !others.has(registrableDomain(url) ?? "") && !isListingAddress(url) && !isMarketplaceHost(url) && !isPlatformDomain(url);
  const words = (text: string) => new Set(stemKey(text, locale.language).split(" ").filter((word) => word !== ""));
  // At least half of `topic`'s words are in `text`.
  const holds = (topic: Set<string>, text: string) => {
    const said = words(text);
    return topic.size > 0 && [...topic].filter((word) => said.has(word)).length * 2 >= topic.size;
  };
  const oldest = now.getUTCFullYear() - RESEARCH.statisticMaxAgeYears;
  const read = async (target: string): Promise<ResearchRead | null> => {
    const serp = await cachedSerp(researchSerps({ siteId, locale, target }, 0)[0]!, DRAFT_POLICY_VERSION);
    if (serp === null) return null;
    const urls = serp.organic.slice(0, READ.results).map((row) => row.url).filter((url) => googleWrapper(url) === null && foreign(url));
    const cached = await Promise.all(urls.map((url) => readCache({ source: RESEARCH_READ_SOURCE, cacheKey: url, policyVersion: DRAFT_POLICY_VERSION, freshnessDays: RESEARCH.freshnessDays })));
    if (urls.length > 0 && cached.some((hit) => hit === null)) return null;
    const topic = words(target);
    const pages = cached.flatMap((hit) => (hit === null ? [] : [hit.payload as ReadPage])).filter((page) => {
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
    };
  };
  const out = new Map<string, ResearchRead | null>();
  for (const row of rows) out.set(row.id, row.target_query === null ? null : await read(row.target_query));
  return out;
}
