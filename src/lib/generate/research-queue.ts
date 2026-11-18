// SPEC §7 *Five stages* (owner, 2026-11-17, #2809) — a draft's research SERPs, asked in job steps before the write.
//
// DataForSEO's live and high-priority SERPs link only Google's `google.com/goto` redirects, which no read can follow;
// the normal standard queue returns the pages themselves, but in minutes, longer than one job step may wait. So the
// day asks for the reads research makes (`researchSerps`) in short steps: the first ask posts them, and a later ask
// for a search still on the queue reads its task at 0¢ (the vendor seam adopts it) until it is ready. The write
// step's research then makes the same reads from the cache. A read still not ready by then is no research, and the
// pack's own check writes no page: it never falls back to a live SERP.
import { siteLocale } from "@/lib/locale/site";
import { opportunityById } from "@/lib/opportunities";
import { contentTypeOf } from "@/lib/opportunities/content-type";
import { serpOrganic } from "@/lib/vendors/dataforseo/serp";
import { openDayCost } from "./cost";
import { targetSearches } from "./pipeline";
import { builtFromOutside } from "./standard";
import { researchSerps } from "./pipeline/research";
import { generateStore } from "./store";
import { TEMPLATES } from "./templates";

/** The asking steps: the first waits `askMs` for a read that is ready at once, then each round its own invocation inside
 *  the job route's 300 s, about 45 minutes in all, the queue's own turnaround (`VENDOR.stdQueueDeadlineMin`). */
export const COLLECT = Object.freeze({ rounds: 11, stepMs: 240_000, askMs: 20_000 });

/** Asks for the day's research reads inside the day's draft cap, each waiting `waitMs`. Returns how many are still on
 *  the queue; a type that reads no research has none. */
export async function askDayResearch(a: { siteId: string; opportunityId: string; writeAs?: "qa" | "documentation"; now: Date; waitMs: number }): Promise<number> {
  const [o, report] = await Promise.all([opportunityById(a.opportunityId), generateStore().latestReport(a.siteId)]);
  const type = o === null ? null : (a.writeAs ?? o.writeAs ?? contentTypeOf(o));
  const target = o === null ? undefined : targetSearches(o)[0];
  if (type === null || !TEMPLATES[type].research || target === undefined || report === null) return 0;
  const locale = await siteLocale(a.siteId);
  const reads = researchSerps({ siteId: a.siteId, locale, target, guidance: builtFromOutside(type), ...(type === "insights" ? { recent: true } : {}) }, a.waitMs);
  return openDayCost({ scanId: report.scanId, siteId: a.siteId, since: a.now }, async (cost) => {
    let waiting = 0;
    // Together, since every read waits to the one `untilMs`.
    await Promise.all(reads.map((read) => serpOrganic(cost, { ...read, onFailure: (failed) => void (waiting += failed.taskId === undefined ? 0 : 1) })));
    return waiting;
  });
}
