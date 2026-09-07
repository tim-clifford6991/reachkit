// src/jobs/types.ts — BUILD §11, ARCHITECTURE `src/jobs/**`
//
// The job-id union, closed at exactly eight members, and the
// platform-neutral shapes the registry is built from. Adding an id is a
// change to this file and to `tests/jobs/registry.test.ts`, which asserts
// the set — a ninth id cannot arrive by accident.
//
// `BUILD.md` §11's table names six jobs. `account/maintenance` is the
// seventh: the clock-triggered obligations no read path can serve (a
// payment awaiting sign-in, a payment with no account, a hosting-end
// notice, a hosting stop, an account due for purge) have no other trigger,
// and each is owned by the module that holds its rule — this tick only
// hands the subject back.
//
// `publish/retry` is the eighth (issue #200). §9's "retry x3" needs a
// trigger of its own: a retry cannot be a chained event, because
// `publish/execute`'s idempotency key is `(draftId, destinationId)` and
// re-sending it for the same page is deduped rather than delayed. It could
// not ride an existing tick either — `draft/generate`'s is gated to the
// site's own evening, and `account/maintenance` is deliberately outside
// the kill switch, which a job that publishes may not be.
//
// Nothing here names the job platform. `client.ts` is the one file that
// does, so replacing the platform is that file plus one route.

/** Exactly eight, with their triggers. */
export type JobId =
  | "scan/run" // on demand; tier is a parameter (free | deep | weekly)
  | "draft/generate" // hourly tick, due at the site's own evening hour
  | "publish/execute" // on approval or on window expiry
  | "publish/verify" // +24h after a publish
  | "publish/retry" // hourly tick; the retries whose moment has come round
  | "weekly/refresh" // hourly tick, due per site-local Monday (ADR-060)
  | "lead/nurture" // event plus delay: 24h / 72h / 168h
  | "account/maintenance"; // every MAINTENANCE_TICK_MINUTES; five due-work queries

/** The same eight as a value, so the registry's closure is assertable. The
 *  `satisfies` pins it to the union: a member missing here or an id not in
 *  the union is a type error, not a test failure discovered later. */
export const JOB_IDS = Object.freeze([
  "scan/run",
  "draft/generate",
  "publish/execute",
  "publish/verify",
  "publish/retry",
  "weekly/refresh",
  "lead/nurture",
  "account/maintenance",
] as const) satisfies readonly JobId[];

/** The event names the product sends. One per event-triggered job; the
 *  four clock-triggered jobs have none. */
export type JobEvent = Extract<
  JobId,
  "scan/run" | "publish/execute" | "publish/verify" | "lead/nurture"
>;

/** A trigger, stated without the platform's vocabulary.
 *
 *  `afterHours` on an event trigger is the delay between the event and the
 *  run — `publish/verify`'s "+24h". The platform's own sleep implements
 *  it in `client.ts`; no job body sleeps. */
export type JobTrigger =
  | { readonly kind: "event"; readonly event: JobEvent; readonly afterHours?: number }
  | { readonly kind: "cron"; readonly cron: string };

/** The subject a run is about — a scan, a site, a draft, a lead. `null`
 *  where an invocation has no single subject (a tick that fans out). */
export type SubjectId = string | null;

/** Why a run did nothing. Never a silent skip: every arm is recorded. */
export type SkipReason =
  /** A clock tick that is not this subject's due hour. */
  | "not-due"
  /** A tick whose due-work query returned nothing. */
  | "no-subject";

export type Outcome =
  | { readonly outcome: "ran"; readonly subjectId: SubjectId }
  /** The kill switch stopped it before any spend and before any write.
   *  Recorded, so §14's "we stopped" line has a fact to read. */
  | { readonly outcome: "stopped"; readonly subjectId: SubjectId; readonly by: "kill-switch" }
  | { readonly outcome: "skipped"; readonly subjectId: SubjectId; readonly reason: SkipReason }
  /** The run exceeded its own budget and stopped. Carries which step
   *  degraded — never a vendor payload. */
  | { readonly outcome: "degraded"; readonly subjectId: SubjectId; readonly step: string };

/** What an invocation is handed. `data` is the event's payload for an
 *  event trigger and empty for a clock tick; `now` is the instant the run
 *  reads its clock from, injected so due-ness is testable without
 *  travelling in time. */
export interface JobInput {
  readonly data: Readonly<Record<string, unknown>>;
  readonly now: Date;
}

/** A job definition: a trigger, an idempotency key and one call into the
 *  engine. It holds no engine logic — `run` reads its subject out of
 *  `input`, calls `@/jobs/engine`, and maps the result to an `Outcome`. */
export interface JobDefinition {
  readonly id: JobId;
  readonly trigger: JobTrigger;
  /** The natural key an at-least-once delivery is deduplicated by, named
   *  as fields of `JobInput["data"]`. The platform expression is built
   *  from these in `client.ts`; a job file never writes one. Empty for a
   *  clock tick, whose idempotency is a database constraint owned by the
   *  engine, not by the trigger. */
  readonly idempotencyKey: readonly string[];
  readonly run: (input: JobInput) => Promise<Outcome>;
}
