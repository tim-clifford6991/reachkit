// src/jobs/engine.ts — BUILD §11
//
// The seam between the seven job definitions and the engine. Every
// function here is the interface a job calls.
//
// **Every engine behind them is built** as of issue #229 — the last
// `TODO(engine)` was `scan/run`'s free arm, and it went not because an
// engine landed but because it was never an engine: the free tier does not
// come through this job at all (see `runScan` below). `EngineNotBuilt` and
// its `TODO(engine)` convention stay for the next engine that is genuinely
// owed; `tests/jobs/definitions.test.ts` asserts the list of unbuilt ids is
// empty, so one regressing to a stub puts its id back there and fails.
//
// **Nothing here fakes work.** A stub does not return a plausible empty
// list and it does not swallow the call: it throws, loudly and
// non-retriably in effect, so a deployment that triggers a job before its
// engine exists fails visibly instead of reporting a quiet success. The
// same rule covers a delivery that should not exist — see `NotAJobPath`,
// which is a different failure with a different name, because "this engine
// is missing" and "this event should never have been sent" are different
// things for whoever reads the dead-letter.
//
// This module reaches no database and no vendor of its own: where an
// engine exists it is imported and called. It is a declaration of what the
// engine exposes, never a second implementation of it — every body below is
// one call into a module that owns the rule, or a named refusal.
import { runDeepPass } from "@/lib/scan/deep/run";
import { sendSetupReminder, sitesDueSetupReminder as sitesDueSetupReminderRows } from "@/lib/mail/setup/reminders";
import { dueSites, runWeekly, type DueSite } from "@/lib/scan/weekly";

/** A site and the zone its own clock runs in. Due-ness is computed from
 *  this — never from UTC (ADR-060). */
export interface SiteClock {
  readonly siteId: string;
  readonly timeZone: string;
}

export type ScanTier = "free" | "deep" | "weekly";

/** `draft/generate`'s selection, as the engine hands it over. The type is
 *  the daily module's own — a second copy here would be one more place the
 *  hold could be forgotten. A **type** import, so it is erased and drags
 *  no database client onto this seam's graph. */
import type { DailySelection } from "@/lib/publish/daily";
export type { DailySelection };

/** What one call into the engine reports back. `degraded` names the step
 *  that ran out of budget, so a job can mark its subject degraded rather
 *  than throw (§6.5 — the spend ceiling outranks the verdict). */
export type EngineResult = { readonly done: true } | { readonly degraded: string };

/** An engine a job calls that has not been written yet. No body in this
 *  file throws one today (#229); it is kept — and exported — because
 *  `account/maintenance` catches it to skip an unbuilt obligation rather
 *  than dying on it (#36), and because the next owed engine is written
 *  against it. */
export class EngineNotBuilt extends Error {
  readonly engine: string;
  constructor(engine: string, fn: string) {
    super(
      `src/jobs/engine.ts: ${fn} is not built yet (${engine}). The job that ` +
        "called it is a thin adapter and has nothing of its own to run."
    );
    this.name = "EngineNotBuilt";
    this.engine = engine;
  }
}

// ── The site list — BP-014, built (issue #173), gated on access (#201)
//
// One call into `src/lib/publish/daily/`, which owns the four predicates:
// a zone, `publishing_enabled`, a live destination that can publish, and
// active access through the same registered gate the weekly tick asks
// (ADR-050 — one rule, one reader).
// It is not the weekly tick's list — `weeklyDueSites()` selects on four
// predicates this one does not carry (issue #41) — and it is not the hour
// either: ADR-060's gate is `isDraftDue(now, zone)` in
// `src/jobs/site-clock.ts`, applied by `draft/generate` to every row this
// returns, where the tick's own `now` lives.
//
// Imported at the call, on the same footing as the hosting and erasure
// wrappers below: the module reaches `@/lib/db`, which parses the
// environment the moment it is imported, and a static import here would
// put a database client in every module graph this seam appears in.

/** What one evening tick found: every site ReachKit is still working for
 *  that a page could actually reach and whose owner is paying, with its
 *  own time zone — and, where the access gate could not be read, no site
 *  and the reason. Read by `draft/generate`'s fan-out, which gates each
 *  row on the site's own evening. */
export async function activeSites(): Promise<DailySelection> {
  const { sitesForDailyTick } = await import("@/lib/publish/daily");
  return sitesForDailyTick();
}

// ── The weekly measurement — issue #41, built.
//
// Two calls into `src/lib/scan/weekly/`, and no logic of their own. The
// selection is one engine call rather than "every active site, filtered
// here", because three of its four predicates — active access, a stated
// zone, and no row for `(site_id, week_start)` — are database questions,
// and a job body reaches no database.

export type { DueSite } from "@/lib/scan/weekly";

/** Every site whose own local Monday and due hour have arrived, that has
 *  active access, and that carries no measurement for the week it is in
 *  (ADR-060). */
export async function weeklyDueSites(now: Date): Promise<readonly DueSite[]> {
  return dueSites(now);
}

/** Starts one site's weekly pass, and tells the customer what it found.
 *
 *  `weekStart` is the site-local Monday the run belongs to; the
 *  `unique (site_id, week_start) where tier = 'weekly'` constraint behind
 *  the measurement is the engine's, so a second delivery of the same key
 *  starts nothing.
 *
 *  **Two obligations of one tick, visible here rather than hidden inside
 *  the pass** (issue #181, and the same shape the 24-hour check takes):
 *  the pass records what it measured and stops, and the digest is sent
 *  after it. The digest carries its own once-ness on the same site-week
 *  row (`scans.digest_sent_at`), so a re-delivery of this tick measures
 *  nothing and sends nothing.
 *
 *  **A degraded pass still tells.** A week that reached only some of its
 *  sections is REQ-064 c4's case — measured, with the sections it missed
 *  named — and it is precisely the week a customer most needs an account
 *  of. Only a week with no measurement at all sends nothing, and that
 *  decision is `sendWeeklyDigest`'s, read from `accountForWeek`. */
export async function startWeeklyScan(a: DueSite & { readonly now: Date }): Promise<EngineResult> {
  const outcome = await runWeekly({
    siteId: a.siteId,
    domain: a.domain,
    zone: a.zone,
    now: a.now,
  });

  const { sendWeeklyDigest } = await import("@/lib/mail/weekly");
  const told = await sendWeeklyDigest({
    siteId: a.siteId,
    weekStart: a.weekStart,
    now: a.now,
  });

  if (outcome.ran && outcome.status === "degraded") return { degraded: outcome.unmeasured.join(",") };
  // A measured week whose telling could not be composed is a degraded
  // tick, not a done one: the measurement is filed and the customer has
  // not been told, which is a state an operator has to be able to see.
  if (!told.sent && told.reason === "not-composable") return { degraded: "digest:not-composable" };
  if (!told.sent && told.reason === "mail") return { degraded: "digest:mail" };
  return { done: true };
}

// ── The scan pipeline — BP-012, and the deep tier wired here (issue #36)
//
// The one pipeline, tier a parameter. `scanId` is the delivery's own
// idempotency handle, not an instruction to the pipeline: a free pass
// adopts the row admission already claimed and a paid one mints its own,
// both inside `runScan` itself. Nothing about a tier is decided here.
//
// **`scan/run` is the deep tier's job and no other's** (issue #229). This
// used to read as two unbuilt arms waiting on an engine; neither is. Both
// other tiers reach the same pipeline, and neither reaches it through here:
//
//   - **Free runs inline, on the request.** `POST /api/scan` imports
//     `@/lib/scan/run` and calls `runScan({ domain, tier: 'free' })`
//     directly, because §6.4 puts the free report at "≈60s live" with a
//     human waiting for it — an event queued for a worker is the one shape
//     that cannot keep that promise. Nothing anywhere sends a `scan/run`
//     event for a free tier, and `tests/jobs/definitions.test.ts` sweeps
//     `src/**` to keep it that way.
//
//   - **Weekly has its own trigger.** `weekly/refresh` is an hourly tick
//     gated on each site's own local Monday (ADR-060), and its claim on
//     `(site_id, week_start)` is what makes the measurement happen once a
//     week. A second door into the same pass — through an event keyed on
//     `scanId`, which that claim does not cover — would be a way around it.
//
// So the two arms are not unbuilt and never will be: they are **not job
// paths**, and they say so. `notAJobPath` throws rather than returning a
// degraded result, for the reason every stub in this file throws: a
// delivery that should not exist must fail visibly, not report a pass
// nobody ran. It is a different failure from `EngineNotBuilt` and carries
// a different name, so an operator reading a dead-letter can tell "this
// engine is missing" from "this event should never have been sent".
//
// (What was here before pointed the free arm at "#24's admission claim".
// #24 is closed and was the `llm()` seam; no admission issue exists, and
// admission is not what stands between the free tier and this job — the
// route is.)
//
// A deep pass takes `runDeepPass` rather than `runScan` directly, because
// onboarding needs two things the other tiers do not: the founder's stage
// written where the waiting screen can read it, and the release latch.
// Both are that module's; it is still one `runScan` call underneath.

/** The tier this job runs, and the only one. */
export const SCAN_RUN_TIER = "deep" as const satisfies ScanTier;

/** A delivery for a tier that does not come through this job. Named apart
 *  from `EngineNotBuilt` because it is not a missing engine and no future
 *  issue closes it — see the block above for where each other tier runs. */
export class NotAJobPath extends Error {
  readonly tier: ScanTier;
  constructor(tier: ScanTier, where: string) {
    super(
      `src/jobs/engine.ts: not_a_job_path — the ${tier} tier does not run through ` +
        `the scan/run job (${where}). Free runs inline on POST /api/scan; weekly ` +
        "runs on the weekly/refresh tick, whose own claim makes it once a week."
    );
    this.name = "NotAJobPath";
    this.tier = tier;
  }
}

export async function runScan(a: {
  readonly scanId: string;
  readonly domain: string;
  readonly tier: ScanTier;
  readonly siteId?: string;
}): Promise<EngineResult> {
  if (a.tier !== SCAN_RUN_TIER) throw new NotAJobPath(a.tier, `runScan(${a.scanId})`);
  if (a.siteId === undefined) {
    // A deep event with no site is a malformed delivery, not an unbuilt
    // engine: the onboarding pass is a pass *for a site*, and the only
    // sender (`setup/_setup/store.ts`) always names one.
    throw new Error(
      `src/jobs/engine.ts: runScan(${a.scanId}) is a deep pass with no siteId — ` +
        "the onboarding pass belongs to a site and the event must name it."
    );
  }
  const deep = await runDeepPass({ siteId: a.siteId, domain: a.domain });
  return deep.status === "degraded" ? { degraded: "deep-pass" } : { done: true };
}

// ── Generation — BUILD §8 (issue #44)
// Built. `src/lib/generate/` owns the pipeline, the hard rules and the
// recovery decision; the wrapper below passes the job's own `publishDate`
// in and maps the outcome to an `EngineResult`.
//
// Every arm that is not a page is `degraded`, not a throw: a day with no
// page is a state the calendar renders (§7 — "supply is the cap: never
// invent an opportunity to fill a day"), not a job that failed. The edge
// into `in_review` — and the veto clock it starts — is the publishing
// engine's (#45); this call writes the page and stops.

export async function generateDraft(a: {
  readonly siteId: string;
  readonly publishDate: string;
}): Promise<EngineResult> {
  const { generateDayPage } = await import("@/lib/generate");
  const outcome = await generateDayPage({ siteId: a.siteId, publishDate: a.publishDate });
  return outcome.ok ? { done: true } : { degraded: `generate:${outcome.because}` };
}

// ── Publishing — BP-015, built (issue #173)
//
// One call into `src/lib/publish/attempt/deliver.ts`, which orchestrates
// the edge — the claim and its nine guards, the delivery, `made_live_by_us`
// as the adapter declared it, and the retry policy — and **one obligation
// of this tick that the leaf cannot discharge itself**: enqueuing the
// +24h check. `src/lib/**` may not import `src/jobs/**` (ARCHITECTURE rule
// 2), so the leaf reports that an address came back and the event is sent
// from here, which is the same shape `verifyLive` below uses for the
// `published` mail — two obligations of one tick, both visible in the one
// place the tick is described.
//
// The check is enqueued on a delivery that produced an address and on no
// other: that is the same fact `verify_due_at` is written from (BP-049 —
// the address decides, never the destination kind), so a page the check
// could not look at is never queued for it. A re-delivery that found the
// row already delivered enqueues nothing: its check was queued when it
// first went out, and `publish/verify`'s `publicationId` key would refuse
// the second delivery anyway.
//
// **Neither a hold nor a failure throws.** A held page is §9 working —
// the switch is off, a ceiling is reached, the claim needs re-checking —
// and the page keeps its state and resumes in the order it was held. A
// failure has already been written as it happened and passed through the
// retry policy inside the leaf. Both are reported as the step they stopped
// at, so an operator sees a page that did not go out rather than a run
// that claims it did.
//
// Imported at the call, for the same reason as `activeSites()` above.

export async function publishApproved(a: {
  readonly draftId: string;
  readonly destinationId: string;
}): Promise<EngineResult> {
  const { deliverApproved } = await import("@/lib/publish/attempt/deliver");
  const outcome = await deliverApproved({
    draftId: a.draftId,
    destinationId: a.destinationId,
  });

  if (outcome.kind === "held") return { degraded: `held:${outcome.heldBy}` };
  if (outcome.kind === "failed") return { degraded: `publish:${outcome.reason}` };

  if (outcome.verifyDue && !outcome.alreadyPublished) {
    const { sendJobEvent } = await import("./client");
    await sendJobEvent("publish/verify", { publicationId: outcome.publicationId });
  }
  return { done: true };
}

// ── The retries that have come round — BUILD §9, issue #200. Built.
//
// One call into `src/lib/publish/attempt/due.ts`, which owns the rule. The
// tick that reads this re-enters every page it returns through
// `publishApproved()` above — the same seam an approval comes through, so
// an attempt occasioned by a retry and one occasioned by a customer are
// the same attempt, with the same nine guards re-asked at the moment it is
// made.
//
// `now` comes from the tick, which is what makes due-ness testable without
// a scheduler.

export async function duePublishRetries(now: Date): Promise<readonly { readonly draftId: string; readonly destinationId: string }[]> {
  const { dueRetries } = await import("@/lib/publish/attempt/due");
  return dueRetries(now);
}

// ── The 24-hour check — BUILD §9, issue #50. Built.
//
// **Two calls, and the second is the point.** The check records what
// ReachKit saw and stops; the `published` mail (§12) is a separate
// obligation of the same tick, and it is sent **on the same occasion in
// all three arms** — a failed check, an absent page and an unconfirmed
// check are none of them a reason to send nothing (REQ-062 c5). Putting
// the send inside `verifyLive` would hide that behind the check and would
// make the publishing subsystem import the mail seam; keeping it here
// leaves both obligations visible in the one place the tick is described.
//
// A run that recorded nothing — the check is not due, has already run, or
// never will — sends nothing and is not a degradation: those are the
// dispositions doing their job, and `dueNow` will not offer the row again
// once an outcome is recorded, whichever of the three it was.

export async function verifyLive(a: {
  readonly publicationId: string;
}): Promise<EngineResult> {
  const { verifyLive: runCheck } = await import("@/lib/publish/verify");
  const run = await runCheck(a.publicationId);
  if (!run.recorded) return { done: true };

  const { sendPublishedMail } = await import("@/lib/mail/published");
  const told = await sendPublishedMail(a.publicationId);
  // The outcome the check recorded is never a degradation — all three are
  // recorded facts about the page. A telling that could not go out is: the
  // customer was not told about a page ReachKit did look at.
  return told.sent ? { done: true } : { degraded: `published-mail:${told.reason}` };
}

// ── Lead sequences — BP-029
// Built (issue #176): one call into `src/lib/mail/leads/sequence`, which
// owns the rule. The sequence key stays the `(lower(email), domain)`
// partial unique index and is not re-derived here or in the job.

/** Advances one lead's sequence by one touch. `(leadId, touchIndex)` is
 *  per-touch dedupe inside a sequence — never the sequence key itself,
 *  which stays the engine's index and is not re-implemented here.
 *
 *  **Only a refused send degrades.** A lead that converted, opted out,
 *  subscribed, finished its three touches or has already recorded this
 *  touch did exactly what it should have: nothing. The run is `done`, and
 *  the sequence module's own log line records which of those it was. A
 *  mail the send seam refused is different — the touch is still owed, and
 *  an unwritten line (DECISIONS 2026-09-05: "a mail never ships a
 *  placeholder") is the owner's debt made visible on the run rather than
 *  reported as a success. */
export async function advanceSequence(a: {
  readonly leadId: string;
  readonly touchIndex: number;
}): Promise<EngineResult> {
  const { advanceOneTouch } = await import("@/lib/mail/leads/sequence");
  const outcome = await advanceOneTouch({ leadId: a.leadId, touchIndex: a.touchIndex, now: new Date() });
  if (!outcome.advanced && outcome.reason === "not-sent") {
    return { degraded: "lead-nurture:touch-not-sent" };
  }
  return { done: true };
}

/**
 * The whole sweep, for the hourly `lead/nurture` tick (#182).
 *
 * The owner's ruling on that issue chose a due-work tick over chained
 * events: `advanceSequences` already drops what missed its start deadline,
 * releases the next waiting sequence per address, and sends every touch
 * that has come round by `next_touch_at` — the three steps in that order,
 * decided in `src/lib/mail/leads/sequence.ts` and not re-derived here.
 *
 * **A tick reports what it moved, never what it looked at.** Zero of all
 * three is a legitimate hour and is `done` — a sweep that found nothing due
 * did its whole job. There is no `degraded` arm: a touch the send seam
 * refused is still owed, and the next tick re-reads the row and tries
 * again, which is the property that made the clock the safer shape. The
 * per-touch path above cannot do that, because a declined event is never
 * re-delivered.
 */
export async function advanceDueSequences(now: Date): Promise<{
  readonly dropped: number;
  readonly released: number;
  readonly sent: number;
}> {
  const { advanceSequences } = await import("@/lib/mail/leads/sequence");
  return advanceSequences(now);
}

// ── Payments and provisioning — BUILD §13 (issue #33)
// Built, like the weekly measurement above: `src/lib/account/provisioning/**`
// owns the rules, and the four wrappers here do nothing but pass a clock
// in and map the result to an `EngineResult`.
//
// The two due-work queries take `now` from the tick, which is what makes
// due-ness testable without a scheduler. The tick's own signature supplies
// none, so `new Date()` is read here — the one place in this file that
// reads a clock, and the boundary the engine's own `now` parameter exists
// to keep out of the rules.

export async function paymentsAwaitingSignIn(): Promise<readonly string[]> {
  const { paymentsAwaitingSignIn: due } = await import("@/lib/account/provisioning/due-work");
  return due(new Date());
}

export async function chaseSignIn(paymentId: string): Promise<EngineResult> {
  const { chaseSignIn: chase } = await import("@/lib/account/provisioning/chase");
  // A chase that did not send is not a degraded run: every `chased: false`
  // arm is a subject that turned out not to need one (signed in since,
  // already chased) or a transient the next tick asks again about. The job
  // reports what it handed off, never a second copy of this rule.
  await chase(paymentId);
  return { done: true };
}

export async function paymentsWithoutAccounts(): Promise<readonly string[]> {
  const { paymentsWithoutAccounts: due } = await import("@/lib/account/provisioning/due-work");
  return due(new Date());
}

export async function backstopProvision(paymentId: string): Promise<EngineResult> {
  const { backstopProvision: backstop } = await import("@/lib/account/provisioning/backstop");
  const outcome = await backstop(paymentId);
  return outcome.provisioned ? { done: true } : { degraded: `backstop:${outcome.because}` };
}

// ── Hosted pages — BUILD §13, §9 (issue #34)
// Built. `src/lib/account/billing/**` owns the rules; the four wrappers
// here pass a clock in and map the result to an `EngineResult`. Imported
// from the module's bare entry point and never from a file under it —
// `eslint.config.mjs`'s `no-billing-internal-import` fence (ADR-050).
//
// The two due-work queries take `now` from the tick, which is what makes
// due-ness testable without a scheduler; the tick's own signature supplies
// none, so `new Date()` is read here, on the same footing as the
// provisioning pair above.

export async function sitesDueHostingEndNotice(): Promise<readonly string[]> {
  const { sitesDueHostingEndNotice: due } = await import("@/lib/account/billing");
  return due(new Date());
}

export async function noticeHostingEnd(siteId: string): Promise<EngineResult> {
  const { sendHostingEndNotice } = await import("@/lib/account/billing");
  // A notice that did not send is not a degraded run: every `sent: false`
  // arm is either a subject that turned out not to need one (already sent,
  // deleted, resumed) or a transient the next tick asks again about — and
  // the stop queue goes on excluding the site until a notice has actually
  // gone (REQ-076 c11). The job reports what it handed off, never a second
  // copy of that rule.
  await sendHostingEndNotice(siteId);
  return { done: true };
}

export async function sitesDueHostingStop(): Promise<readonly string[]> {
  const { sitesDueHostingStop: due } = await import("@/lib/account/billing");
  return due(new Date());
}

export async function stopHosting(siteId: string): Promise<EngineResult> {
  // **There is nothing to do here, and that is the design.** Serving is
  // computed from `sites.hosted_serving_ends_at` by `hostedServingState`,
  // never from a boolean this function could flip (BP-060; REQ-076 c10).
  // The window was stamped when access ended, both notices have been sent —
  // `sitesDueHostingStop` returns no site for which they have not — and the
  // hosted edge has been answering 410 for this site since the moment the
  // column's instant passed, whether or not this tick ever ran.
  //
  // It is kept as a hand-off rather than removed so the queue has somewhere
  // to report to and the stop is visible in the tick's log. A write here
  // would be a second source of truth for a fact one timestamp already
  // holds.
  console.log(JSON.stringify({ event: "hosting_stopped", siteId }));
  return { done: true };
}

// ── Setup reminders — BP-033, built (issue #36) and wired here
//
// The sixth obligation on `account/maintenance`'s tick: a founder who paid
// and has not answered §4.3's three questions. Both halves are
// `src/lib/mail/setup/reminders.ts`'s — this file holds no offset, no
// threshold and no predicate over a timestamp.

export async function sitesDueSetupReminder(): Promise<readonly string[]> {
  return sitesDueSetupReminderRows();
}

export async function remindSetup(siteId: string): Promise<EngineResult> {
  // Not sending is a decided outcome, never a degradation: a founder who
  // finished between the tick and the send is exactly what the send-time
  // check exists to catch, and a link that cannot be issued yet is
  // REQ-025 c6's own rule doing its job. The reason is the sender's to log
  // and this tick's to carry on past.
  await sendSetupReminder(siteId);
  return { done: true };
}

// ── Destinations — BUILD §9 (issue #48), built and wired here
//
// The seventh obligation on `draft/generate`'s daily per-site tick: a
// destination that has needed reconnecting for 24 hours whose customer has
// not signed in since it broke. It rides this job because the occasion is
// one where the customer has *not* come to a screen, so no read path can
// supply it — and because this is the same per-site loop that would
// otherwise be preparing the page that is now being held.
//
// The predicate, the once-per-breakage guard and the send are all
// `src/lib/publish/destinations/health/`'s; this wrapper holds no
// threshold and no condition of its own.

export async function noticeBrokenDestination(a: {
  readonly siteId: string;
  readonly now: Date;
}): Promise<EngineResult> {
  const { sendBreakageMail } = await import("@/lib/publish/destinations/health");
  // Not sending is a decided outcome, never a degradation: `not-due` is
  // the ordinary answer for a site whose destination is working, has
  // already been written about, or whose customer has been back since.
  await sendBreakageMail(a.siteId, a.now);
  return { done: true };
}

// ── Erasure — issue #52, built.
//
// Two calls into `src/lib/account/lifecycle/`, and no logic of their own.
// Imported at the call, on the same footing as the hosting four above: the
// module reaches `@/lib/db`, which parses the environment the moment it is
// imported, and a static import here would put a database client in every
// module graph this seam appears in.
//
// The due-work predicate is a stored date on an indexed column and the
// sweep is the one code path in this product that deletes a customer's
// rows; neither is a job's to hold. The tick's cadence
// (`MAINTENANCE_TICK_MINUTES`) is tighter than the promise
// (`ERASURE_DAYS`), so the boundary a customer was told about is decided
// by `purge_due_at` and never by when a tick happened to fire.

export async function accountsDueForPurge(): Promise<readonly string[]> {
  const { accountsDueForPurge: due } = await import("@/lib/account/lifecycle");
  return due(new Date());
}

export async function purgeAccount(accountId: string): Promise<EngineResult> {
  const { purgeAccount: purge } = await import("@/lib/account/lifecycle");
  // A purge that cannot clear a row throws, and the tick lets it: it means
  // data promised gone at thirty days is still present, which is not a
  // degraded run to record and carry on from.
  await purge(accountId);
  return { done: true };
}
