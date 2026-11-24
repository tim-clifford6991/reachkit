// src/jobs/weekly-refresh.ts — BUILD §11
//
// "`weekly/refresh` · Mon 06:00 UTC" as ADR-060 rules it: the tick is
// hourly and due-ness is each site's own local Monday at its own local
// hour. `Mon 06:00 UTC` is not the trigger, and this file schedules on no
// UTC hour at all.
//
// One tick asks the engine which sites are due — the site's own local
// Monday at its own due hour, active access, a stated zone, and no
// measurement stamped for the week it is in — and sends each on as an
// event keyed `weekly:{site}:{week}` to a run of its own, one at a time per
// site and five in all, so a slow site never starves the rest of Monday and
// no zone-hour is one invocation's step budget. The selection is the engine's and not this file's: three of its
// four predicates are database questions, and a job body reaches no
// database. The `(site_id, week_start)` key is likewise computed and
// enforced behind that call; this file never writes one.
//
// The due list is a step of its own (#1160), and each site's pass, its
// late answers and its telling are steps of that site's run.
//
// Not in the kill switch's scope directly; the scan each due site starts
// is stopped at its own door, inside `runWeekly`, before any spend.
//
// A site's first pass is a subject event too, sent once by setup with `first: true` under `first:{site}`: it measures as onboarding needs,
// plans the first week and releases the founder, and sends no Monday mail. *Measure again* sends it once more with `again: true`.
import { startFirstPass, startWeeklyScan, weeklyDueSites } from "@/jobs/engine";
import { JOB_SUBJECT_CONCURRENCY, LLM_RUN_THROTTLE } from "@/lib/config/constants";
import { parseDomain } from "@/lib/scan/domain";
import { killSwitchEngaged } from "./kill-switch";
import { sendSubjects, settle } from "./fan-out";
import type { JobDefinition, JobInput, Outcome } from "./types";

/** The hourly tick ADR-060 requires — every hour, in every zone at once, at
 *  :41 so it shares no minute with another job. Due-ness is decided per site
 *  inside the run. */
export const WEEKLY_TICK_CRON = "41 * * * *";

/** One site's week, measured and told, in its own steps. */
async function weeklySite(input: JobInput): Promise<Outcome> {
  const { siteId, domain, zone, weekStart, at } = input.data;
  if (input.data.first === true) return firstPass(input);
  if ([siteId, domain, zone, weekStart, at].some((field) => typeof field !== "string")) {
    throw new TypeError("weekly/refresh: a site run needs siteId, domain, zone, weekStart and at");
  }
  // A re-run is one run per key the owner sends, so it needs its own.
  if (input.data.rerun === true && typeof input.data.key !== "string") throw new TypeError("weekly/refresh: a re-run needs its own key");
  const result = await startWeeklyScan({
    siteId: siteId as string,
    domain: domain as string,
    zone: zone as string,
    weekStart: weekStart as string,
    now: new Date(at as string),
    early: input.data.early === true,
    ...(input.data.rerun === true && typeof input.data.key === "string" ? { rerun: { key: input.data.key, mail: input.data.mail === true } } : {}),
    ...(input.step === undefined ? {} : { step: input.step }),
  });
  return "degraded" in result ? { outcome: "degraded", subjectId: siteId as string, step: result.degraded } : { outcome: "ran", subjectId: siteId as string };
}

/** A site's first pass. This run is outside the kill switch's scope, so the switch is read here before any spend. */
async function firstPass(input: JobInput): Promise<Outcome> {
  const { siteId, domain } = input.data;
  if (typeof siteId !== "string" || typeof domain !== "string") throw new TypeError("weekly/refresh: a first pass needs siteId and domain");
  if (killSwitchEngaged()) return { outcome: "stopped", subjectId: siteId, by: "kill-switch" };
  // A retry reads the same public-suffix list, so an unlisted domain stops here once instead of dead-lettering.
  if (!parseDomain(domain).ok) return { outcome: "stopped", subjectId: siteId, by: "domain_unlisted" };
  const result = await startFirstPass({ siteId, domain, remeasure: input.data.again === true, ...(input.step === undefined ? {} : { step: input.step }) });
  return "degraded" in result ? { outcome: "degraded", subjectId: siteId, step: result.degraded } : { outcome: "ran", subjectId: siteId };
}

/** Setup's send of a site's first pass, keyed on the site: a second send inside the platform's window is dropped, and one after it finds the pass ended. */
export async function sendFirstPass(a: { siteId: string; domain: string }): Promise<void> {
  const { sendSubjectEvents } = await import("./client");
  await sendSubjectEvents("weekly/refresh", [{ key: `first:${a.siteId}`, data: { siteId: a.siteId, domain: a.domain, first: true } }]);
}

/** *Measure again*: the first pass once more, on the row its request claimed, under that row's key, so each allowed press starts exactly one pass. */
export async function sendAgain(a: { scanId: string; siteId: string; domain: string; at?: Date }): Promise<void> {
  const { sendSubjectEvents } = await import("./client");
  await sendSubjectEvents("weekly/refresh", [{ key: `again:${a.siteId}:${a.scanId}`, data: { siteId: a.siteId, domain: a.domain, first: true, again: true }, ...(a.at === undefined ? {} : { at: a.at }) }]);
}

export const weeklyRefresh: JobDefinition = {
  id: "weekly/refresh",
  trigger: { kind: "cron", cron: WEEKLY_TICK_CRON },
  idempotencyKey: [],
  perSubject: weeklySite,
  concurrency: [{ key: "siteId", shared: true, limit: 1 }, { limit: JOB_SUBJECT_CONCURRENCY }],
  throttle: LLM_RUN_THROTTLE,
  // A founder waits on the first pass, so it never queues behind a Monday.
  ahead: "first",
  async run(input): Promise<Outcome> {
    const step = input.step;
    // Read once outside any step, so an hour with no site due costs one invocation.
    const found = await weeklyDueSites(input.now);
    const due = step === undefined || found.length === 0 ? found : await step("due", () => weeklyDueSites(input.now));
    if (due.length === 0) return { outcome: "skipped", subjectId: null, reason: "not-due" };

    const results = await sendSubjects(
      input,
      due.map((site) => ({ key: `weekly:${site.siteId}:${site.weekStart}`, data: { ...site, at: input.now.toISOString() } })),
      weeklySite
    );
    return settle(results, null);
  },
};
