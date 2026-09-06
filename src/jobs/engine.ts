// src/jobs/engine.ts — BUILD §11
//
// The seam between the seven job definitions and the engine. Every
// function here is the interface a job calls; none of the engines behind
// them is built yet, so every body throws `EngineNotBuilt` and each
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

// ── The site list — BP-050
// TODO(engine): BP-050's weekly re-measurement. `activeSites()` and
// `startWeeklyScan()` land with it; until then `weekly/refresh` and
// `draft/generate` have no site list to tick over.

/** Every site with an active subscription, with its own time zone. Read by
 *  both clock-triggered fan-outs. */
export async function activeSites(): Promise<readonly SiteClock[]> {
  return notBuilt("BP-050", "activeSites()");
}

/** Starts one site's weekly pass. `weekStart` is the site-local Monday the
 *  run belongs to; the `unique (site_id, week_start) where tier = 'weekly'`
 *  constraint behind this call is the engine's, so a second delivery of the
 *  same key starts nothing. */
export async function startWeeklyScan(a: {
  readonly siteId: string;
  readonly weekStart: string;
}): Promise<EngineResult> {
  return notBuilt("BP-050", `startWeeklyScan(${a.siteId})`);
}

// ── The scan pipeline — BP-012, and the deep tier wired here (issue #36)
//
// The one pipeline, tier a parameter. `scanId` is the delivery's own
// idempotency handle, not an instruction to the pipeline: a free pass
// adopts the row admission already claimed and a paid one mints its own,
// both inside `runScan` itself. Nothing about a tier is decided here.
//
// **Only the deep arm is wired.** `src/lib/scan/run.ts` is built (issue
// #100), but reaching it from `scan/run` on the free path also means
// admission's claimed slot and on the weekly path the site list — both
// other issues' (#24, BP-050), and neither this one's to decide. So the
// deep arm calls the pipeline and the other two still throw: an unwired
// tier fails loudly rather than quietly reporting a pass nobody ran.
//
// A deep pass takes `runDeepPass` rather than `runScan` directly, because
// onboarding needs two things the other tiers do not: the founder's stage
// written where the waiting screen can read it, and the release latch.
// Both are that module's; it is still one `runScan` call underneath.

// TODO(engine): the free and weekly arms — BP-023's admission claim (#24)
// and BP-050's site list.

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

// ── Generation — BP-014
// TODO(engine): BP-014's `generateDraft()` — next opportunity to a draft in
// review, with the veto clock started.

export async function generateDraft(a: {
  readonly siteId: string;
  readonly publishDate: string;
}): Promise<EngineResult> {
  return notBuilt("BP-014", `generateDraft(${a.siteId})`);
}

// ── Publishing — BP-015
// TODO(engine): BP-015's state machine — `publishApproved()` and
// `verifyLive()`.

export async function publishApproved(a: {
  readonly draftId: string;
  readonly destinationId: string;
}): Promise<EngineResult> {
  return notBuilt("BP-015", `publishApproved(${a.draftId})`);
}

export async function verifyLive(a: {
  readonly publicationId: string;
}): Promise<EngineResult> {
  return notBuilt("BP-015", `verifyLive(${a.publicationId})`);
}

// ── Lead sequences — BP-029
// TODO(engine): BP-029's nurture sequence — `advanceSequence()`, and the
// `(lower(email), domain)` partial unique index that is the sequence key.

/** Advances one lead's sequence by one touch. `(leadId, touchIndex)` is
 *  per-touch dedupe inside a sequence — never the sequence key itself,
 *  which stays the engine's index and is not re-implemented here. */
export async function advanceSequence(a: {
  readonly leadId: string;
  readonly touchIndex: number;
}): Promise<EngineResult> {
  return notBuilt("BP-029", `advanceSequence(${a.leadId})`);
}

// ── Payments and provisioning — BUILD §13 (issue #33)
// Built. The four functions below are the only ones on this seam that call
// a real engine: `src/lib/account/provisioning/**` owns the rules, and the
// four wrappers here do nothing but pass a clock in and map the result to
// an `EngineResult`.
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

// ── Hosted pages — BP-060
// TODO(engine): BP-060's hosting lifecycle — the end notice and the stop.

export async function sitesDueHostingEndNotice(): Promise<readonly string[]> {
  return notBuilt("BP-060", "sitesDueHostingEndNotice()");
}

export async function noticeHostingEnd(siteId: string): Promise<EngineResult> {
  return notBuilt("BP-060", `noticeHostingEnd(${siteId})`);
}

export async function sitesDueHostingStop(): Promise<readonly string[]> {
  return notBuilt("BP-060", "sitesDueHostingStop()");
}

export async function stopHosting(siteId: string): Promise<EngineResult> {
  return notBuilt("BP-060", `stopHosting(${siteId})`);
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

// ── Erasure — BP-063
// TODO(engine): BP-063's purge — a tombstone's 30-day sweep.

export async function accountsDueForPurge(): Promise<readonly string[]> {
  return notBuilt("BP-063", "accountsDueForPurge()");
}

export async function purgeAccount(accountId: string): Promise<EngineResult> {
  return notBuilt("BP-063", `purgeAccount(${accountId})`);
}
