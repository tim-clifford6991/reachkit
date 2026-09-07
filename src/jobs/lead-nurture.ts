// src/jobs/lead-nurture.ts — BUILD §11
//
// "`lead/nurture` · event + delays · Draft email, then ≤3 touches, stops on
// convert."
//
// **It is a clock job, and §11's "event + delays" is what could not be
// built** (issue #182, owner's ruling 2026-09-07). The delays are
// `NURTURE_H` — 24h, 72h, 168h *from the moment the sequence begins* — so
// chaining them needs a delay **per event**, and `JobTrigger`'s `afterHours`
// is per *job*: `client.ts` reads it once at `defineJob`. The trigger model
// is the thing that is short, not the sequence. So nothing ever sent the
// event, and a released lead sat in `running` with a `next_touch_at` nobody
// read.
//
// The tick is the other shape, and the ruling took it: an hour is finer than
// any offset the schedule names, `advanceSequences` already reads
// `next_touch_at`, and **a lost tick cannot lose a touch** — the next one
// re-reads the same row and the touch is still due. A declined event is
// never re-delivered, which is the property the chained shape could not
// offer. No eighth id: this one keeps its name and its place in `JOB_IDS`.
//
// **This file holds no sequence logic and no clock arithmetic.** Which rows
// are dropped, which address is released next, and which touch has come
// round are `src/lib/mail/leads/sequence.ts`'s, reached through one engine
// call. The bound on touches (`NURTURE_MAX_TOUCHES`) and the offsets
// (`NURTURE_H`) are read there too — a tick that re-checked either would be
// the second copy, and the two would disagree the day one was corrected.
//
// **Idempotency is the row, not the payload.** A clock tick carries no
// `data`, so there is no natural key to dedupe on and `idempotencyKey` is
// empty, exactly as `types.ts` describes for a tick: "whose idempotency is a
// database constraint owned by the engine, not by the trigger". Two ticks in
// one hour would send nothing twice — `advanceLead`'s position check is what
// makes a re-run exact, and it reads `touch_count` from the row.
//
// Not in the kill switch's scope: §11 stops scan, generate and publish.
import { advanceDueSequences } from "@/jobs/engine";
import type { JobDefinition, Outcome } from "./types";

/** Hourly, on the hour — the same tick `weekly/refresh` and `draft/generate`
 *  run on, and for the same reason: due-ness is decided per row inside the
 *  run, against `next_touch_at`, rather than by the schedule. An hour is
 *  finer than the smallest offset `NURTURE_H` names (24h), so no touch can
 *  be late by more than one tick. */
export const NURTURE_TICK_CRON = "0 * * * *";

export const leadNurture: JobDefinition = {
  id: "lead/nurture",
  trigger: { kind: "cron", cron: NURTURE_TICK_CRON },
  idempotencyKey: [],
  async run(input): Promise<Outcome> {
    const swept = await advanceDueSequences(input.now);
    const moved = swept.dropped + swept.released + swept.sent;
    // An hour with nothing due is the ordinary case and is recorded as
    // such — never as a run, which would make the observability line say
    // work happened on every hour of every day.
    if (moved === 0) return { outcome: "skipped", subjectId: null, reason: "not-due" };
    return { outcome: "ran", subjectId: null };
  },
};
