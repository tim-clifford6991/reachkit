// src/jobs/weekly-refresh.ts — BUILD §11
//
// "`weekly/refresh` · Mon 06:00 UTC" as ADR-060 rules it: the tick is
// hourly and due-ness is each site's own local Monday at its own local
// hour. `Mon 06:00 UTC` is not the trigger, and this file schedules on no
// UTC hour at all.
//
// One tick asks the engine which sites are due — the site's own local
// Monday at its own due hour, active access, a stated zone, and no
// measurement stamped for the week it is in — and fans those out under
// `JOB_FAN_OUT_CONCURRENCY` so a slow site never starves the rest of
// Monday. The selection is the engine's and not this file's: three of its
// four predicates are database questions, and a job body reaches no
// database. The `(site_id, week_start)` key is likewise computed and
// enforced behind that call; this file never writes one.
//
// Not in the kill switch's scope directly; the scan each due site starts
// is stopped at its own door, inside `runWeekly`, before any spend.
import { startWeeklyScan, weeklyDueSites } from "@/jobs/engine";
import { fanOut, settle } from "./fan-out";
import type { JobDefinition, Outcome } from "./types";

/** The hourly tick ADR-060 requires — every hour, on the hour, in every
 *  zone at once. Due-ness is decided per site inside the run. */
export const WEEKLY_TICK_CRON = "0 * * * *";

export const weeklyRefresh: JobDefinition = {
  id: "weekly/refresh",
  trigger: { kind: "cron", cron: WEEKLY_TICK_CRON },
  idempotencyKey: [],
  async run(input): Promise<Outcome> {
    const due = await weeklyDueSites(input.now);
    if (due.length === 0) return { outcome: "skipped", subjectId: null, reason: "not-due" };

    const results = await fanOut(due, (site) => startWeeklyScan({ ...site, now: input.now }));
    return settle(results, null);
  },
};
