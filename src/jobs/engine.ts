// src/jobs/engine.ts — BUILD §11
//
// The seam between the seven job definitions and the engine. Every
// function here is the interface a job calls. Most of the engines behind
// them are not built yet: those bodies throw `EngineNotBuilt`, and each
// unbuilt engine carries exactly one `TODO(engine)` naming it.
//
// **Nothing here fakes work.** A stub does not return a plausible empty
// list and it does not swallow the call: it throws, loudly and
// non-retriably in effect, so a deployment that triggers a job before its
// engine exists fails visibly instead of reporting a quiet success. The
// signatures are what the jobs are written against; when an engine lands,
// its module replaces the body here and the job files do not change.
//
// This module reaches no database and no vendor of its own: where an
// engine exists it is imported and called, and where one does not the stub
// throws. It is a declaration of what the engine exposes, never a second
// implementation of it — every body below is either one call into a module
// that owns the rule, or `notBuilt`.
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

/** What one call into the engine reports back. `degraded` names the step
 *  that ran out of budget, so a job can mark its subject degraded rather
 *  than throw (§6.5 — the spend ceiling outranks the verdict). */
export type EngineResult = { readonly done: true } | { readonly degraded: string };

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

function notBuilt(engine: string, fn: string): never {
  throw new EngineNotBuilt(engine, fn);
}

// ── The site list — BP-014
// TODO(engine): `draft/generate`'s own site list. `generateDraft()` (below)
// lands with it; until then the daily tick has nothing to tick over. It is
// not the weekly tick's list: `weeklyDueSites()` selects on four
// predicates this one does not carry (issue #41).

/** Every site with an active subscription, with its own time zone. Read by
 *  `draft/generate`'s fan-out. */
export async function activeSites(): Promise<readonly SiteClock[]> {
  return notBuilt("BP-014", "activeSites()");
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
// **Only the deep arm is wired, and the other two for different reasons.**
// `src/lib/scan/run.ts` is built (issue #100), but reaching it from
// `scan/run` on the free path also means admission's claimed slot, which
// is #24's to decide. The weekly path is built (issue #41) and does not
// come through here at all: `weekly/refresh` is its trigger, and its own
// claim on `(site_id, week_start)` is what makes the measurement once a
// week — a second door into the same pass, through an event this job's
// idempotency key does not cover, would be a way around that claim. So the
// deep arm calls the pipeline and the other two still throw: an unwired
// tier fails loudly rather than quietly reporting a pass nobody ran.
//
// A deep pass takes `runDeepPass` rather than `runScan` directly, because
// onboarding needs two things the other tiers do not: the founder's stage
// written where the waiting screen can read it, and the release latch.
// Both are that module's; it is still one `runScan` call underneath.

// TODO(engine): the free arm — BP-023's admission claim (#24). The weekly
// arm is not owed here; see above.

export async function runScan(a: {
  readonly scanId: string;
  readonly domain: string;
  readonly tier: ScanTier;
  readonly siteId?: string;
}): Promise<EngineResult> {
  if (a.tier === "deep" && a.siteId !== undefined) {
    const deep = await runDeepPass({ siteId: a.siteId, domain: a.domain });
    return deep.status === "degraded" ? { degraded: "deep-pass" } : { done: true };
  }
  return notBuilt("BP-012", `runScan(${a.scanId})`);
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

// ── Publishing — BP-015
// TODO(engine): BP-015's state machine — `publishApproved()`. The 24-hour
// check below is built (issue #50); the approve-and-deliver edge is not.

export async function publishApproved(a: {
  readonly draftId: string;
  readonly destinationId: string;
}): Promise<EngineResult> {
  return notBuilt("BP-015", `publishApproved(${a.draftId})`);
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
