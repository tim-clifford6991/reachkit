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
import { TIMING, WEEK_RESEARCH } from "@/lib/config/constants";
import { dueSites, refreshWeeklyKnowledge, runWeekly, type DueSite, type WeeklyOutcome } from "@/lib/scan/weekly";
import type { StepRunner } from "./types";

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
import type { Actor } from "@/lib/publish/types";
import type { DayPageOutcome } from "@/lib/generate";
export type { DailySelection };

/** What one call into the engine reports back. `degraded` names the step
 *  that ran out of budget, so a job can mark its subject degraded rather
 *  than throw (§6.5 — the spend ceiling outranks the verdict). */
export type EngineResult = { readonly done: true; readonly instead?: string } | { readonly degraded: string };

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
// active access through the gate the weekly tick asks
// (ADR-050 — one rule, one reader).
// It is not the weekly tick's list — `weeklyDueSites()` selects on four
// predicates this one does not carry (issue #41) — and it is not the hour
// either: ADR-060's gate is `isDraftDue(tick, site)` in
// `src/jobs/site-clock.ts`, applied by `draft/generate` to every row this
// returns, where the tick's own `now` lives.
//
// Imported at the call, on the same footing as the hosting and erasure
// wrappers below: the module reaches `@/lib/db`, which parses the
// environment the moment it is imported, and a static import here would
// put a database client in every module graph this seam appears in.

/** What one draft tick found: every site ReachKit is still working for
 *  that a page could actually reach and whose owner is paying, with its
 *  own time zone, publish time and veto window — and, where the access
 *  gate could not be read, no site and the reason. Read by
 *  `draft/generate`'s fan-out, which gates each row on the site's own due
 *  hour. */
export async function activeSites(): Promise<DailySelection> {
  const { sitesForDailyTick } = await import("@/lib/publish/daily");
  return sitesForDailyTick();
}

/** Keeps how one site's due hour ended, under the date its page was for
 *  (issue 1455). Never throws. */
export async function recordDraftDay(a: {
  readonly siteId: string;
  readonly publishDate: string;
  readonly outcome: "drafted" | "no_page" | "failed";
  readonly reason: string | null;
  readonly at: Date;
}): Promise<void> {
  const { recordDraftDay: record } = await import("@/lib/publish/daily");
  await record({ ...a });
}

/** At the end of a site's run, tells the owner at most once when nothing
 *  of the site's is going out: a publish time passed with no page, or a
 *  stall. Never throws. */
export async function alertSiteDay(a: {
  readonly site: DailySelection["sites"][number];
  readonly hour: Date;
}): Promise<number> {
  const { alertSiteDay: alert } = await import("@/lib/publish/daily");
  return alert(a);
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
 *  `weekStart` is the site-local Monday the run belongs to; the `unique (site_id, week_start)
 *  where tier = 'weekly'` constraint makes a second delivery of the same key start nothing.
 *
 *  **Each obligation is a step of its own** (#181, #1160): the pass records what it measured, its late answers are read
 *  in up to `TIMING.weeklyCollectRounds` steps, the week is judged, its best rows researched and committed, and the
 *  digest is sent last. The judgement is once per `(publication_id, week_start)`, the week's record once per site and
 *  week, and the digest once per `scans.digest_sent_at`, so a re-delivery measures, judges and sends nothing further.
 *
 *  **A degraded pass still tells.** A week that reached only some of its
 *  sections is REQ-064 c4's case — measured, with the sections it missed
 *  named — and it is precisely the week a customer most needs an account
 *  of. Only a week with no measurement at all sends nothing, and that
 *  decision is `sendWeeklyDigest`'s, read from `accountForWeek`. */
export async function startWeeklyScan(
  a: DueSite & { readonly now: Date; readonly step?: StepRunner; readonly early?: boolean }
): Promise<EngineResult> {
  const step: StepRunner = a.step ?? ((_name, body) => body());
  const outcome = await step(`measure-${a.siteId}`, () =>
    runWeekly({
      siteId: a.siteId,
      domain: a.domain,
      zone: a.zone,
      now: a.now,
      ...(a.early === true ? { early: true, weekStart: a.weekStart } : {}),
    })
  );

  if (outcome.ran && outcome.status !== "failed") {
    const scanId = outcome.scanId;
    // The knowledge read keeps its own clock, so it never shares the pass's invocation.
    await step(`knowledge-${a.siteId}`, () => refreshWeeklyKnowledge({ scanId, siteId: a.siteId, domain: a.domain }));
    for (let round = 1; round <= TIMING.weeklyCollectRounds; round += 1) {
      const { left } = await step(`late-answers-${a.siteId}-${round}`, async () => {
        const { collectLateAnswers } = await import("@/lib/scan/weekly/collect");
        const untilMs = Date.now() + TIMING.paidPassCeilingS * 1000;
        return collectLateAnswers({ scanId, siteId: a.siteId, domain: a.domain, untilMs });
      });
      if (left === 0) break;
    }
  }

  // Issue 1553: Search Console and the stored rows, per page, before
  // the week is judged — #1538's `seen` reads URL Inspection. Never throws.
  await step(`search-${a.siteId}`, async () => {
    const { readSearchEngines } = await import("@/lib/publish/destinations/hosted/search-engines");
    await readSearchEngines({ siteId: a.siteId, now: a.now });
  });

  // SPEC §7: the week judged, its best rows' own SERPs bought and their research checked, then committed before it is told.
  if (outcome.ran && outcome.status !== "failed") {
    const [{ askWeekResearch, checkWeekResearch, COLLECT }, { commitWeek, judgeWeekRows }] = await Promise.all([import("@/lib/generate/research-queue"), import("@/lib/scan/weekly/commit")]);
    const week = { siteId: a.siteId, scanId: outcome.scanId, weekStart: a.weekStart, now: a.now };
    const rows = await step(`judge-${a.siteId}`, () => judgeWeekRows(week)), at = (n: number) => rows.slice(n * WEEK_RESEARCH.batch, (n + 1) * WEEK_RESEARCH.batch);
    let left = await step(`research-post-${a.siteId}`, () => askWeekResearch({ ...week, rows, waitMs: COLLECT.askMs }));
    for (let n = 1; left > 0 && n <= TIMING.weeklyCollectRounds; n++) left = await step(`research-collect-${a.siteId}-${n}`, () => askWeekResearch({ ...week, rows, waitMs: COLLECT.stepMs }));
    const checks: Awaited<ReturnType<typeof checkWeekResearch>> = [];
    for (let n = 0; at(n).length > 0; n++) checks.push(...(await step(`research-check-${a.siteId}-${n}`, () => checkWeekResearch({ ...week, rows: at(n) }))));
    await step(`commit-${a.siteId}`, () => commitWeek({ ...week, rows, checks }));
  }
  return step(`tell-${a.siteId}`, () => tellWeek(a, outcome));
}

/** The week told, after it is judged and committed. A failed pass stored no report, so its week judges nothing. */
async function tellWeek(a: DueSite & { readonly now: Date }, outcome: WeeklyOutcome): Promise<EngineResult> {
  // A week the vendor refused for credit is still due: nothing is judged, planned or told until a pass measures it.
  if (outcome.ran && outcome.status === "failed" && outcome.because === "vendor_funds") return { degraded: "vendor_funds" };
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
  /** The job's durable steps, where it has them (issue 798). */
  readonly step?: StepRunner;
  /** A pass measured again now, on the row its request claimed (issue 837). */
  readonly remeasure?: boolean;
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
  const siteId = a.siteId;
  const deep = await runDeepPass({
    siteId,
    domain: a.domain,
    ...(a.step === undefined ? {} : { step: a.step }),
    ...(a.remeasure === true ? { remeasure: true } : {}),
    // SPEC §5: "Finishing setup reaches `/app` with a first draft" (issue
    // 737). The first page is started here rather than waiting for the
    // site's evening tick, and before the release (issue #782): the founder
    // is already in the app, and its side panel stays on until this ends.
    // Its outcome is logged, not returned: this job's result is the pass's,
    // and a site the tick would not draft for yet (a destination still
    // waiting for DNS) is not a degraded onboarding pass.
    beforeRelease: async () => {
      const first = await kickOffFirstDraft({ siteId, now: new Date() });
      console.log(JSON.stringify({ event: "first_draft", siteId, outcome: first }));
    },
  });
  return deep.status === "degraded" ? { degraded: "deep-pass" } : { done: true };
}

/**
 * The first draft, started when onboarding's pass ends (issue 737).
 *
 * The draft tick's own selection, for one site, without waiting for the
 * site's due hour: a site the tick would not draft for (no zone, not
 * paying, no destination a page could reach) is not drafted for here
 * either. The draft is for the first date whose publish time is at least
 * the veto window away (issue 1337), and `generateDayPage` refuses a date
 * that already has one, so this and a later tick never write two.
 *
 * Never a throw: the onboarding pass already ran and released its founder,
 * and a job that re-ran it because a first page could not be written would
 * spend a second deep pass.
 */
export async function kickOffFirstDraft(a: { readonly siteId: string; readonly now: Date }): Promise<EngineResult> {
  try {
    const selection = await activeSites();
    if (selection.held !== null) return { degraded: `first-draft:held:${selection.held}` };
    const site = selection.sites.find((row) => row.siteId === a.siteId);
    if (site === undefined) return { degraded: "first-draft:not-selected" };
    const { nextPublishDate } = await import("./site-clock");
    const outcome = await generateDraft({
      siteId: a.siteId,
      publishDate: nextPublishDate(a.now, site),
      now: a.now,
    });
    return "degraded" in outcome ? { degraded: `first-draft:${outcome.degraded}` } : outcome;
  } catch (error) {
    console.log(JSON.stringify({ event: "first_draft_not_started", siteId: a.siteId, detail: String(error) }));
    return { degraded: "first-draft:error" };
  }
}

// ── The free passes nobody is coming back for — issue #438. Built.
//
// The free tier runs inline on `POST /api/scan` (see the block above), so
// the pass lives inside a request whose invocation the platform bounds by
// `maxDuration`. A pass frozen at that bound emits no ending and stores no
// report, and the row admission claimed stays `running` — which is not a
// dead row but a live refusal: §6.4's in-flight bound reads exactly that
// column, so the next visitor from that network is turned away for a scan
// that will never finish.
//
// Two calls into `src/lib/scan/stuck.ts`, which owns the threshold, the
// bound on the query and the guard that makes the write safe against a
// pass finishing underneath it. This seam holds no predicate over a
// timestamp; `now` is read here for the same reason the other due-work
// queries read it here — the tick's own signature supplies none.
//
// Imported at the call, like every other wrapper below that reaches
// `@/lib/db`: a static import would put a database client in every module
// graph this seam appears in.

/** Every free scan left `running` past the ceiling a free pass bounds
 *  itself by. */
export async function scansLeftRunning(): Promise<readonly string[]> {
  const { scansLeftRunning: due } = await import("@/lib/scan/stuck");
  return due(new Date());
}

/** Finishes one of them. Never a degradation: a row the sweep found and
 *  finished is the sweep doing its whole job, and a row that finished
 *  itself between the query and the write is the guard doing its — the
 *  module's own log line records which of the two it was. */
export async function finishScanLeftRunning(scanId: string): Promise<EngineResult> {
  const { finishScanLeftRunning: finish } = await import("@/lib/scan/stuck");
  await finish(scanId);
  return { done: true };
}

/** Issue 796: the Monday whose owner market digest is due, once that
 *  Monday has ended in every zone and a weekly pass of it is unread. */
export async function marketDigestsDue(): Promise<readonly string[]> {
  const { marketDigestsDue: due } = await import("@/lib/scan/weekly/market-digest");
  return due(new Date());
}

/** Sends that week's digest. A mail the seam did not accept is a
 *  degradation, and the week is offered again at the next tick. */
export async function sendMarketDigest(weekStart: string): Promise<EngineResult> {
  const { sendMarketDigest: send } = await import("@/lib/scan/weekly/market-digest");
  return (await send(weekStart, new Date())) ? { done: true } : { degraded: "market-digest-not-sent" };
}

// ── The re-score — issues 1433 and 1481, built.
//
// A `rescore_runs` row asks for one, or production's tick asks itself at a new
// derivation; `src/lib/scan/rescore-run.ts` answers it. Imported at the call: it reaches `@/lib/db`.

import type { RescoreRequest } from "@/lib/scan/rescore-run";
export type { RescoreRequest };
const rescoreModules = () => Promise.all([import("@/lib/scan/rescore-run"), import("@/lib/scan/derivation")]);

/** Read-only: whether a re-score waits. */
export async function rescoreDue(): Promise<boolean> {
  const [{ databaseRescore }, { deployedDerivation, rescoreWaits }] = await rescoreModules();
  return rescoreWaits(await databaseRescore().runs(), deployedDerivation());
}

/** The oldest re-score asked for, now marked started, or the tick's own; `held` where the guard stopped it. */
export async function claimRescore(now: Date): Promise<RescoreRequest | { held: string } | null> {
  const [{ claimRequest }, { deployedDerivation }] = await rescoreModules();
  return claimRequest(now, deployedDerivation());
}

/** Answers it with the deployed code: `rescoredBy` is the deployed commit,
 *  and the run records the deployed derivation. */
export async function answerRescore(a: { readonly request: RescoreRequest; readonly now: Date }): Promise<EngineResult> {
  const [{ answerRequest }, { deployedDerivation }] = await rescoreModules();
  await answerRequest(a.request, {
    version: (process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown").slice(0, 7),
    derivation: deployedDerivation(),
    at: a.now,
  });
  return { done: true };
}

// ── The free scan's unread searches — issue 1440. A free pass that left searches unread sends `scan/finish-reads`;
// `src/lib/scan/finish-reads.ts` reads them once and rewrites the report. Imported at the call: it reaches `@/lib/db`.

import type { FinishResult } from "@/lib/scan/finish-reads";
export type { FinishResult };

export async function finishReads(a: { readonly scanId: string; readonly now: Date }): Promise<FinishResult> {
  const { finishReads: finish } = await import("@/lib/scan/finish-reads");
  return finish({ scanId: a.scanId, now: a.now, version: (process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown").slice(0, 7) });
}

// ── Generation — BUILD §8. `src/lib/generate/` owns the pipeline; a day with no page is `degraded`, never a throw (§7), and a
// passing page enters review in the same call (`publish/attempt/window.ts`); a telling that could not leave holds it there.
export async function generateDraft(a: {
  readonly siteId: string;
  readonly publishDate: string;
  readonly now: Date;
  /** The per-site run's durable steps: decide, write (in one cost context) and review, then refresh where the day's own page did not pass. */
  readonly step?: StepRunner;
  readonly again?: boolean; // decided again against a newer week: a page the system stopped gives up the date first
}): Promise<EngineResult> {
  const step: StepRunner = a.step ?? ((_name, body) => body());
  const [{ decideDayPage, generateDayPage, refreshForDay }, { setAside }] = await Promise.all([import("@/lib/generate"), import("@/lib/generate/day-refresh")]);
  const day = { siteId: a.siteId, publishDate: a.publishDate, now: a.now };
  // Before the plan is read: deciding a day's page writes the week's plan.
  const { dayHold } = await import("@/lib/publish/daily");
  const held = await step("hold", () => dayHold(a.siteId, a.publishDate));
  if (held !== null) return { degraded: held };
  // A stopped page that passes today's rules takes the date at 0¢, so the day's write answers `already_drafted`.
  const { recheckStopped, releaseStoppedDate } = await import("@/lib/generate/recheck");
  if (a.again === true) await step("release", () => releaseStoppedDate(day));
  await step("recheck", async () => { const rescued = await recheckStopped(day); if (rescued !== null) await schedulePublish({ draftId: rescued }); return rescued; });
  const decided = await step("select", () => decideDayPage(day));
  const instead = async (trigger: string, from: "select" | "write", stopped: string | null): Promise<EngineResult> => {
    const taken = trigger === "generate:no_site" || trigger === "generate:no_scan" ? null : await step("refresh", () => refreshForDay({ siteId: a.siteId, publishDate: a.publishDate, trigger, from, stopped, now: a.now }));
    if (taken === null || (!taken.ok && taken.because === "already_drafted")) return taken === null ? { degraded: trigger } : { done: true };
    if (!taken.ok && taken.because === "passed") return { degraded: `${trigger};${taken.why}` };
    const reviewed = await step("refresh-review", () => reviewWritten(taken, a.now));
    return "done" in reviewed ? { done: true, instead: `refresh:${trigger}` } : reviewed;
  };
  if (!decided.ok) return decided.because === "already_drafted" ? { done: true } : instead(`generate:${decided.because}`, "select", null);
  // Research SERPs are queued before the write, which reads them at 0¢; run inline (the first draft), no step waits.
  const { askDayResearch, COLLECT } = await import("@/lib/generate/research-queue");
  const research = { siteId: a.siteId, opportunityId: decided.opportunityId, now: a.now };
  let left = await step("research-post", () => askDayResearch({ ...research, waitMs: COLLECT.askMs }));
  for (let round = 1; a.step !== undefined && left > 0 && round <= COLLECT.rounds; round++) left = await step(`research-collect-${round}`, () => askDayResearch({ ...research, waitMs: COLLECT.stepMs }));
  // The write never waits on the queue: research still out is no page today and no rest, and the next tick asks again.
  if (left > 0) return instead("generate:research_pending", "select", null);
  let outcome = await step("write", () => generateDayPage({ ...day, opportunityId: decided.opportunityId }));
  // A committed cosmetic page never keeps the day: it is set aside undated, and the day takes a spare as after a stop.
  const aside = outcome.ok ? outcome.draftId : null;
  if (aside !== null && (await step("cosmetic", () => setAside(aside)))) outcome = await step("spare", () => generateDayPage({ ...day, updatesTried: true }));
  if (!outcome.ok && outcome.because === "already_drafted") return { done: true };
  const reviewed = await step("review", () => reviewWritten(outcome, a.now));
  return !("degraded" in reviewed) || !reviewed.degraded.startsWith("generate:") ? reviewed : instead(reviewed.degraded, "write", !outcome.ok && "draftId" in outcome ? outcome.draftId : null);
}

/** Of these site days, the ones owed and no due hour recorded an ending for, and those to decide `again`. */
export async function missedDays<T extends { readonly siteId: string; readonly publishDate: string }>(
  days: readonly T[]
): Promise<readonly (T & { again?: true; rewrite?: string })[]> {
  const { missedDays: missed } = await import("@/lib/publish/daily");
  return missed(days);
}

/** Drafts in `generating` on these sites that no run is still writing: the customer's restart, or an interrupted run's row — one a site. */
export async function restartedDrafts(
  siteIds: readonly string[],
  now: Date
): Promise<readonly { readonly draftId: string; readonly siteId: string }[]> {
  const { restartedDrafts: restarted } = await import("@/lib/generate");
  return restarted(siteIds, now);
}

/** Pages the interrupted rewrite put after their plan's date, moved back first so the tick may write the date they free. */
export async function returnToPlannedDates(siteIds: readonly string[], now: Date): Promise<number> {
  return (await import("@/lib/publish/attempt/own-date")).returnToPlannedDate(siteIds, now);
}
/** The customer's Regenerate, carried out by the draft tick (#788): the page is written again for its own date, and a
 *  passing one enters review exactly as the evening's does. */
export async function regenerateDraft(a: { readonly siteId: string; readonly draftId: string; readonly now: Date }): Promise<EngineResult> {
  const { regenerateRestarted } = await import("@/lib/generate");
  return reviewWritten(await regenerateRestarted({ siteId: a.siteId, draftId: a.draftId, now: a.now }), a.now);
}

async function reviewWritten(outcome: DayPageOutcome, now: Date): Promise<EngineResult> {
  // A page its write step had no room to fix takes its one fix call here, in this step's own time, before review.
  if (!outcome.ok && outcome.because === "fix_owed") return reviewWritten(await (await import("@/lib/generate/fix-step")).fixOwedPage({ draftId: outcome.draftId, now }), now);
  // Issue 1536: a step names itself, and a short pack what it lacked, so the day's kept reason says which stage left it without a page.
  if (!outcome.ok) return { degraded: outcome.because === "step_failed" || outcome.because === "no_own_facts" ? `generate:${outcome.because}:${outcome.step}` : `generate:${(outcome.because === "rules" ? outcome.stop : undefined) ?? outcome.because}` };
  const { enterReview } = await import("@/lib/publish/attempt/window");
  const entry = await enterReview({ draftId: outcome.draftId, at: now });
  if (entry.kind === "not_entered") return { degraded: `review:${entry.reason}` };
  await schedulePublish({ draftId: outcome.draftId });
  return { done: true };
}

// ── Publishing — BP-015, built (issue #173)
//
// One call into `src/lib/publish/attempt/deliver.ts`, which owns the edge,
// and one obligation the leaf cannot discharge itself, since `src/lib/**`
// may not import `src/jobs/**`: asking for the +24h check. It is asked on
// every delivery that has an address, the fact `verify_due_at` is written
// from (BP-049), and again by `requestDueChecks` each hour, since this send
// can fail after the page is `published` and no attempt returns to it. The
// job's `publicationId` key and the recorded outcome keep it to one check.
//
// **Neither a hold nor a failure throws.** A held page is §9 working —
// the switch is off, a ceiling is reached, the claim needs re-checking —
// and the page keeps its state and resumes in the order it was held. A
// failure has already been written as it happened and passed through the retry policy inside the leaf. Both
// are reported as the step they stopped at, so an operator sees a page that did not go out rather than a run
// that claims it did.
//
// Imported at the call, for the same reason as `activeSites()` above.

export async function publishApproved(a: { readonly draftId: string; readonly destinationId: string; readonly by?: Actor }): Promise<EngineResult> {
  const { deliverApproved } = await import("@/lib/publish/attempt/deliver");
  const outcome = await deliverApproved({ draftId: a.draftId, destinationId: a.destinationId, ...(a.by === undefined ? {} : { by: a.by }) });

  if (outcome.kind === "held") return { degraded: `held:${outcome.heldBy}` };
  if (outcome.kind === "failed") return { degraded: `publish:${outcome.reason}` };

  if (outcome.verifyDue) {
    const { sendJobEvent } = await import("./client");
    await sendJobEvent("publish/verify", { publicationId: outcome.publicationId });
  }
  return { done: true };
}

// ── The attempt, sent for its moment — issue #790.
//
// An approval (the customer's, or the window's end) used to wait for the
// hourly publish tick. `schedulePublish` asks the publishing engine when the
// page first becomes publishable and due and sends one `publish/execute`
// stamped for that moment; `publishDue` is what that event runs — the
// one-page form of the tick's read (approving at window end) and then
// `publishApproved()`, so the event and the tick are one attempt with the
// same guards. The tick stays: an event that was lost, held or sent before
// a setting changed is picked up there.
//
// **A send that fails never fails what occasioned it.** The approval has
// happened and the tick will deliver the page; the miss is logged.

export async function schedulePublish(a: { readonly draftId: string }): Promise<{ readonly scheduled: boolean }> {
  try {
    const { publishDueAt } = await import("@/lib/publish/attempt/window");
    const due = await publishDueAt(a.draftId);
    if (due === null) return { scheduled: false };
    const { sendJobEvent } = await import("./client");
    await sendJobEvent(
      "publish/execute",
      { draftId: due.draftId, destinationId: due.destinationId, dueAt: due.at.toISOString() },
      { at: due.at }
    );
    return { scheduled: true };
  } catch (error) {
    console.log(
      JSON.stringify({
        event: "publish_schedule_failed",
        error: error instanceof Error ? error.name : "unknown",
      })
    );
    return { scheduled: false };
  }
}

export async function publishDue(a: {
  readonly draftId: string;
  readonly now: Date;
}): Promise<EngineResult | { readonly notDue: true }> {
  const { dueApproval } = await import("@/lib/publish/attempt/window");
  const page = await dueApproval(a.draftId, a.now);
  if (page === null) return { notDue: true };
  return publishApproved(page);
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

// ── The live pages, re-checked against the rival rules — SPEC §7, issue 1485.
//
// Each hour, before any page is attempted, a live page written before the
// rival rules is read again from its own row at 0¢, and one that fails is
// withdrawn through `unpublish()`. A read that fails withdraws nothing and
// stops nothing: the next tick reads again. Then (issue 1507) each live page
// of ours that breaks a consistency rule is planned a refresh, 0¢.
//
// Issue 1506: in the same tick, each live page the customer has not edited
// is read against the topic rules — a "vs" needs measured demand, and a top
// ten of another kind of business is not the business's market. One that
// fails is retargeted to a ready topic in its cluster, kept and refreshed
// where it already earns anything or its host is unmeasured, or withdrawn.
// Each part reads and fails on its own.

export async function recheckLivePages(now: Date): Promise<{ readonly withdrawn: number }> {
  let withdrawn = 0;
  try {
    const { withdrawFailingPages } = await import("@/lib/generate/live-recheck");
    const outcome = await withdrawFailingPages({ now });
    withdrawn += outcome.withdrawn.length;
  } catch (error) {
    console.log(JSON.stringify({ event: "live_rival_recheck_failed", error: error instanceof Error ? error.message : "unknown" }));
  }
  try {
    // Issue 1507: a live page that breaks a consistency rule is planned a
    // refresh, written from its text with what code can repair repaired.
    const { planStructureRefreshesEverywhere } = await import("@/lib/opportunities/refresh");
    const planned = await planStructureRefreshesEverywhere({ at: now });
    console.log(JSON.stringify({ event: "live_structure_recheck", planned }));
  } catch (error) {
    console.log(JSON.stringify({ event: "live_structure_recheck_failed", error: error instanceof Error ? error.message : "unknown" }));
  }
  try {
    const { retireOffTopicPages } = await import("@/lib/opportunities/live-topics");
    const outcome = await retireOffTopicPages({ now });
    withdrawn += outcome.withdrawn.length + outcome.retargeted.length;
  } catch (error) {
    console.log(JSON.stringify({ event: "live_topic_recheck_failed", error: error instanceof Error ? error.message : "unknown" }));
  }
  return { withdrawn };
}

// ── A retargeted page's move, finished — SPEC §7, issue 1487.
//
// Each hour, a live hosted retarget still at its old address is recorded at
// the address its new search names, the versions left at the old address
// leave through the state machine, and the pages that link it are planned
// a link refresh. 0¢. A read that fails moves nothing: the next tick reads
// again.

export async function repairMovedPages(now: Date): Promise<{ readonly moved: number }> {
  try {
    const { repairMoves } = await import("@/lib/publish/attempt/move");
    return await repairMoves({ now });
  } catch (error) {
    console.log(JSON.stringify({ event: "hosted_move_repair_failed", error: error instanceof Error ? error.message : "unknown" }));
    return { moved: 0 };
  }
}

/** Asks again for each check that is due and unrecorded; a failure here never stops the hour's publishing. */
export async function requestDueChecks(now: Date): Promise<void> {
  try {
    const [{ dueNow }, { sendJobEvent }] = await Promise.all([import("@/lib/publish/verify/due"), import("./client")]);
    for (const publicationId of await dueNow(100, now)) await sendJobEvent("publish/verify", { publicationId });
  } catch (error) {
    console.log(JSON.stringify({ event: "verify_request_failed", error: error instanceof Error ? error.name : "unknown" }));
  }
}

export async function duePublishRetries(now: Date): Promise<readonly { readonly draftId: string; readonly destinationId: string }[]> {
  const { dueRetries } = await import("@/lib/publish/attempt/due");
  return dueRetries(now);
}

// ── The windows that have run out — SPEC §7, issue 709. Built.
//
// One call into `src/lib/publish/attempt/window.ts`, which owns the rule:
// a page in review whose window has run out, told on the pair in force and
// publishable and due, is approved there, and every approved page that is
// due comes back addressed for `publishApproved()` — the same seam a retry
// and a customer's approval come through. The hourly publish tick reads
// it beside the retries; it writes (the approval), so it is only ever
// called from inside the kill switch's scope.

export async function duePublishApprovals(now: Date): Promise<readonly { readonly draftId: string; readonly destinationId: string }[]> {
  const { dueApprovals } = await import("@/lib/publish/attempt/window");
  return dueApprovals(now);
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
  // A later page is told on Monday, so not telling it here is not a gap.
  return told.sent || told.reason === "not-first-page" ? { done: true } : { degraded: `published-mail:${told.reason}` };
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

/**
 * The free first pages owed to captured leads (SPEC §2, issue 787), on the same
 * hourly tick. `dueFirstPageDeliveries` decides which leads are due against
 * their stored attempts; each is delivered once through `deliverFirstPage`,
 * which writes the page, mails it and starts the nurture sequence. Returns
 * how many it attempted.
 *
 * Writing a page spends on a model, so the kill switch holds it (§11 stops
 * generation) while the tick's touches still run. A held lead has made no
 * attempt, so its retry window has not started.
 */
export async function deliverDueFirstPages(now: Date): Promise<number> {
  const { killSwitchEngaged } = await import("@/jobs/kill-switch");
  if (killSwitchEngaged()) return 0;
  const { dueFirstPageDeliveries, deliverFirstPage } = await import("@/lib/mail/leads");
  const due = await dueFirstPageDeliveries(now);
  for (const leadId of due) await deliverFirstPage(leadId, now);
  return due.length;
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

// ── Retention / win-back — SPEC §8 (issue #569), built and wired here
//
// Three obligations on `account/maintenance`'s tick, one per retention mail
// the tick owns (the fourth kind, the hosting-end notice, is the pair above).
// Every rule is `src/lib/mail/retention/`'s, imported at the call because it
// reaches `@/lib/db`. Not sending is a decided, logged outcome, never a
// degraded run.

export async function accountsDuePaymentFailed(): Promise<readonly string[]> {
  const { accountsDuePaymentFailed: due } = await import("@/lib/mail/retention");
  return due();
}

export async function noticePaymentFailed(userId: string): Promise<EngineResult> {
  const { sendPaymentFailed } = await import("@/lib/mail/retention");
  await sendPaymentFailed(userId);
  return { done: true };
}

export async function accountsDueCancellation(): Promise<readonly string[]> {
  const { accountsDueCancellation: due } = await import("@/lib/mail/retention");
  return due();
}

export async function noticeCancellation(userId: string): Promise<EngineResult> {
  const { sendCancellation } = await import("@/lib/mail/retention");
  await sendCancellation(userId);
  return { done: true };
}

export async function accountsDueWinback(): Promise<readonly string[]> {
  const { accountsDueWinback: due } = await import("@/lib/mail/retention");
  return due(new Date());
}

export async function winBack(userId: string): Promise<EngineResult> {
  const { sendWinback } = await import("@/lib/mail/retention");
  await sendWinback(userId);
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

// ── Hosted health — issue #791.
//
// `account/maintenance` refreshes the health of a hosted destination whose
// last check is older than its window, so a founder whose record has come
// good gets `ok` — and their pages — without opening Settings. The windows
// are `health/due.ts`'s and the check is `checkHealth`'s; this wrapper holds
// neither.

export async function hostedDestinationsDueHealth(): Promise<readonly string[]> {
  const { hostedDestinationsDueHealth: due } = await import("@/lib/publish/destinations/health");
  return due(new Date());
}

export async function refreshDestinationHealth(destinationId: string): Promise<EngineResult> {
  const { checkHealth } = await import("@/lib/publish/destinations/health");
  // Whatever state it finds is an answer and is recorded; a broken
  // destination is the founder's to fix, not a degraded tick.
  await checkHealth(destinationId);
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
