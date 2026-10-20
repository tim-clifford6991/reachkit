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
import { startWeeklyScan, weeklyDueSites } from "@/jobs/engine";
import { JOB_SUBJECT_CONCURRENCY, LLM_RUN_THROTTLE } from "@/lib/config/constants";
import { sendSubjects, settle } from "./fan-out";
import type { JobDefinition, JobInput, Outcome } from "./types";

/** The hourly tick ADR-060 requires — every hour, on the hour, in every
 *  zone at once. Due-ness is decided per site inside the run. */
export const WEEKLY_TICK_CRON = "0 * * * *";

/** One site's week, measured and told, in its own steps. */
async function weeklySite(input: JobInput): Promise<Outcome> {
  const { siteId, domain, zone, weekStart, at } = input.data;
  if ([siteId, domain, zone, weekStart, at].some((field) => typeof field !== "string")) {
    throw new TypeError("weekly/refresh: a site run needs siteId, domain, zone, weekStart and at");
  }
  const result = await startWeeklyScan({
    siteId: siteId as string,
    domain: domain as string,
    zone: zone as string,
    weekStart: weekStart as string,
    now: new Date(at as string),
    ...(input.step === undefined ? {} : { step: input.step }),
  });
  return "degraded" in result ? { outcome: "degraded", subjectId: siteId as string, step: result.degraded } : { outcome: "ran", subjectId: siteId as string };
}

export const weeklyRefresh: JobDefinition = {
  id: "weekly/refresh",
  trigger: { kind: "cron", cron: WEEKLY_TICK_CRON },
  idempotencyKey: [],
  perSubject: weeklySite,
  concurrency: [{ key: "siteId", shared: true, limit: 1 }, { limit: JOB_SUBJECT_CONCURRENCY }],
  throttle: LLM_RUN_THROTTLE,
  async run(input): Promise<Outcome> {
    const step = input.step;
    const due = step === undefined ? await weeklyDueSites(input.now) : await step("due", () => weeklyDueSites(input.now));
    if (due.length === 0) return { outcome: "skipped", subjectId: null, reason: "not-due" };

    const results = await sendSubjects(
      input,
      due.map((site) => ({ key: `weekly:${site.siteId}:${site.weekStart}`, data: { ...site, at: input.now.toISOString() } })),
      weeklySite
    );
    return settle(results, null);
  },
};
