// SPEC §7 *Five stages* (owner, 2026-11-17, #2809) — a draft's research SERPs, bought in two job steps.
//
// DataForSEO's live and high-priority SERPs link only Google's `google.com/goto` redirects, which no read can follow;
// the normal standard queue returns the pages themselves, but in minutes, longer than one job step may wait. So an
// earlier step posts the target's SERP and its study or guidance search (`researchSerps`, the reads research makes),
// and later steps read them until they are ready, each storing its rows on the ledger row the post wrote. The write
// step's research then makes the same reads and is served those rows at 0¢. A read still not ready by then is no
// research, and the pack's own check writes no page: it never falls back to a live SERP.
import { dbAdmin } from "@/lib/db";
import { siteLocale } from "@/lib/locale/site";
import { opportunityById } from "@/lib/opportunities";
import { contentTypeOf } from "@/lib/opportunities/content-type";
import { collectSerp, serpCacheKey, serpOrganic } from "@/lib/vendors/dataforseo/serp";
import { openDayCost } from "./cost";
import { targetSearches } from "./pipeline";
import { builtFromOutside } from "./pipeline/pack";
import { researchSerps } from "./pipeline/research";
import { generateStore } from "./store";
import { TEMPLATES } from "./templates";

/** How long the post step waits for a read that is ready at once; the rest is collected. */
const POST_WAIT_MS = 20_000;
/** The collecting steps: each its own invocation inside the job route's 300 s, about 45 minutes in all, the queue's
 *  own turnaround (`VENDOR.stdQueueDeadlineMin`). */
export const COLLECT = Object.freeze({ rounds: 11, stepMs: 240_000 });
const SOURCE = "serp/google/organic";

/** The day's research reads and the scan they are ledgered to; `null` for a type that reads no research. */
async function dayReads(a: { siteId: string; opportunityId: string }) {
  const [o, report] = await Promise.all([opportunityById(a.opportunityId), generateStore().latestReport(a.siteId)]);
  const type = o === null ? null : (o.writeAs ?? contentTypeOf(o));
  const target = o === null ? undefined : targetSearches(o)[0];
  if (type === null || !TEMPLATES[type].research || target === undefined || report === null) return null;
  const locale = await siteLocale(a.siteId);
  const reads = researchSerps({ siteId: a.siteId, locale, target, guidance: builtFromOutside(type), ...(type === "insights" ? { recent: true } : {}) }, POST_WAIT_MS);
  return { reads, scanId: report.scanId };
}

/** Posts the day's research reads on the normal queue, inside the day's draft cap. */
export async function postDayResearch(a: { siteId: string; opportunityId: string; now: Date }): Promise<number> {
  const day = await dayReads(a);
  if (day === null) return 0;
  return openDayCost({ scanId: day.scanId, siteId: a.siteId, since: a.now }, async (cost) => {
    let waiting = 0;
    for (const read of day.reads) if ((await serpOrganic(cost, read)).kind === "unmeasured") waiting += 1;
    return waiting;
  });
}

interface Row {
  id: string;
  payload: unknown;
}
interface Query extends PromiseLike<{ data: Row[] | null; error: { message: string } | null }> {
  select(columns: string): Query;
  update(values: Record<string, unknown>): Query;
  eq(column: string, value: string): Query;
  in(column: string, values: readonly string[]): Query;
  gte(column: string, value: string): Query;
  not(column: string, operator: string, value: null): Query;
}
const fetches = (): Query => (dbAdmin() as unknown as { from(table: string): Query }).from("fetches");

/** Reads the posted research reads until `untilMs` and stores each ready one on its ledger row. Free: a `task_get`
 *  posts nothing. Returns how many are still queued. */
export async function collectDayResearch(a: { siteId: string; opportunityId: string; now: Date; untilMs: number }): Promise<number> {
  const day = await dayReads(a);
  if (day === null) return 0;
  const { data, error } = await fetches()
    .select("id, payload")
    .eq("source", SOURCE)
    .in("cache_key", day.reads.map(serpCacheKey))
    .gte("created_at", new Date(a.now.getTime() - 86_400_000).toISOString())
    .not("payload->>taskId", "is", null);
  if (error !== null) throw new Error(error.message);
  let left = 0;
  for (const row of data ?? []) {
    const taskId = (row.payload as { taskId?: unknown }).taskId;
    if (typeof taskId !== "string") continue;
    const got = await collectSerp(taskId, a.untilMs);
    if (got === "pending") left += 1;
    else {
      // A task that came to nothing keeps a failure and loses its id, so it is not read again.
      const payload = got === "failed" ? { vendorFailure: "unparseable", endpoint: SOURCE, billed: true } : got;
      const { error: failed } = await fetches().update({ payload }).eq("id", row.id);
      if (failed !== null) throw new Error(failed.message);
    }
  }
  console.log(JSON.stringify({ event: "draft_research_collected", siteId: a.siteId, rows: data?.length ?? 0, left }));
  return left;
}
