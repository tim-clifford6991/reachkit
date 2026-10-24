// BUILD §4.1, §6.2, §6.3, §6.5 — the one scan pipeline. Tier is a parameter.
//
// Six named stages in `STAGES` order, under the tier's spend cap and — on
// the free path — the ninety-second deadline, ending in exactly one stored
// report or in a failure that leaves the previous report untouched.
//
// **The pipeline never branches on tier; only its parameters change.** One
// frozen `Record<Tier, TierParameters>` holds the cap name, the SERP mode,
// whether the report deadline applies and whether the pass adopts an
// admission claim. No `if (tier === …)` selects a different stage, a
// different formula or a different battery anywhere below: the same six
// stages run over the same callees at every tier. Cold start branches
// nothing at all (§6.6) — a domain that ranks for nothing runs every stage
// and stores a report whose empty sections are `zero`, not `unmeasured`.
//
// **This file orders calls and nothing else.** Every figure in the stored
// blob is the value its callee returned; no arithmetic is applied to a
// measured value here, nothing is parsed here, and nothing under
// `src/lib/presentation/`, `src/ui/` or `src/app/` is imported.
//
// **A ceiling gives back what was measured.** Sections accumulate in one
// record that starts entirely `unmeasured / not_attempted`, and each stage
// fills its own members as it completes. A pass the ninety-second deadline
// cuts off mid-flight — where the ceiling wins the race and the body's own
// return value is discarded — still stores everything the stages before it
// measured, and everything outstanding stays `not_attempted`. Never a 0: a
// zero is a measurement about a customer's site, and nobody made it.
//
// **Degradation never throws.** A callee that raises — a vendor that
// answered with something unreadable, a model that did not answer — is
// caught at its own stage and becomes `undeterminable`, which is what is
// true of it; the pass continues and the report is stored. A pass reaches
// `failed` only where it produced no report at all: a domain that does not
// parse, or a free or onboarding call with no claimed row to adopt.
//
// **A free re-scan of the same domain within seven days serves the stored
// report** (§6.4) — no new spend and no vendor call, the stored report's
// own scan id returned. The adopted row is closed out at zero cents, so
// the next visitor is not refused for an in-flight scan that is not
// running. A correction is not a re-scan: it re-measures inside the scan
// it corrects and always runs.
import { FREE_RESCAN_WINDOW_D } from "@/lib/config/constants";
import { captureInBackground } from "@/lib/analytics";
import type { CostContext } from "@/lib/costs";
import { nextCorrectionState, type CorrectionState } from "@/lib/market/coherence/state";
import type { Locale } from "@/lib/locale/locales";
import { readStoredLocale } from "@/lib/locale/site";
import { withScanBounds, withStoredPassSpend } from "./ceilings";
import { advanceCorrectionState, readCorrectionFacts, registerCorrectionRunner } from "./correction";
import { parseDomain } from "./domain";
import { carrySpentCents, readSpentCents, registerRetryRunner, type RetryPart } from "./retry";
import { readCurrentReport, readScanReport, type StoppedReason, type StoredReport, type Tier } from "./report";
import { emitEnding, type StageName } from "./stages";
import { storeCurrentReport, type ScanStatus } from "./store";
import { finishingOf } from "./finish-reads";
import { TIER_PARAMETERS } from "./pass/tier";
import { freshSections } from "./pass/sections";
import { adoptClaimedRow, claimPassRow, closeWithoutSpending } from "./pass/row";
import { runStages } from "./pass/sequence";
import { awaitsMarketFromSearch } from "./pass/market";
import { composeReport, score } from "./pass/compose";
export { TIER_PARAMETERS } from "./pass/tier";
export { claimOnboardingPass } from "./pass/row";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function wholeDaysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

// ── runScan ─────────────────────────────────────────────────────────────

export interface RunScanArgs {
  domain: string;
  siteId?: string;
  tier: Tier;
  /** The row this pass writes to, where the caller already claimed one.
   *  The weekly measurement inserts its `(site_id, week_start)` row before
   *  any spend — the claim *is* the once-a-week guarantee (§11, ADR-060)
   *  — and hands the id here so the pass writes its report into that row
   *  rather than inserting a second one behind the index's back. Absent,
   *  a paid pass generates its own id, exactly as before. */
  scanId?: string;
  /** A market correction re-measures inside the scan it corrects: same
   *  spend ceiling, no second allowance consumed. */
  correctionOf?: string;
  /** SPEC §2's "Retry this part" (issue 715): the report this pass
   *  re-measures one part of, and which part. Like a correction it spends
   *  no second allowance and opens no second ceiling — the retried row's
   *  `cost_cents` becomes this pass's `priorCents`, so the 12¢ free cap
   *  covers the original pass and every retry of it together. Unlike a
   *  correction it changes no question: the market is read back off the
   *  stored report (`resumeMarket`) rather than measured again. */
  retryOf?: { scanId: string; part: RetryPart };
  /** The category the founder confirmed — `sites.category` on a paid pass,
   *  the corrected one on the free report's correction. Where present it is
   *  the market's seed ahead of the inferred category (SPEC §0: the category
   *  "fixes the twelve questions"), and its words join the relevance guard's
   *  support set. Absent, the pass seeds from the profile as before. */
  category?: string;
  /** The site's stored country and language (SPEC §6, owner D66, issue
   *  1311): the founder's answer at setup. Where present every vendor read
   *  of the pass is made in it. Absent — a free scan, or a site that has
   *  not answered — the pass reads it from the address and the home page. */
  locale?: Locale;
  /** SPEC §6 (owner D28, #1185): this pass re-checks the site's market
   *  before it seeds one, and measures the market that stands after — the
   *  deep and weekly passes. Needs `siteId`. A category the founder set
   *  stands; see `market-conclusion.ts`. */
  concludesMarket?: boolean;
  /** The founder's *Measure again now* (owner, 2026-10-03, #1162): this
   *  pass also asks the site's tracked buyer prompts, as a weekly pass
   *  does, so no founder waits for Monday to see a mention rate. */
  asksTrackedPrompts?: boolean;
  /** SPEC §6 (issue 1170): "Missing values omit the row, never repeat last
   *  week." The instant this pass's own period began — a weekly pass's
   *  site-local Monday. The site's own documents, its ranked rows and the
   *  twelve's SERPs are served from the cache only where they were read
   *  since; anything older is read again, so every factor is this pass's
   *  and carries this pass's date. Absent, the cache windows stand. */
  measuredSince?: Date;
  /**
   * Called as each stage is entered, before its work starts.
   *
   * `stages.ts`'s event bus already carries every transition, but it
   * carries them **in this process only** — a caller whose reader lives
   * somewhere else (the onboarding progress screen, served by the web
   * process while the pass runs in the job one) has no way to observe it.
   * This hook is how such a caller writes the transition somewhere
   * durable; it is awaited, so a stage is never reported out of order,
   * and it is optional, so no existing caller changes.
   *
   * It reports entry only. A hook that threw would stop the pass, which is
   * why the one caller in this repo swallows its own write failures.
   */
  onStage?: (stage: StageName) => void | Promise<void>;
  /**
   * Called once the pass's report is stored, with the report and a
   * `CostContext` on the pass's own money (`spendOnStoredReport`).
   *
   * §6.3 puts "Haiku ×~4 for opportunity typing" inside the deep and
   * weekly passes' own budgets, so the work this hook does spends the
   * pass's money and no other: the context handed here opens on what the
   * row already carries, under the pass's own cap, and its close adds what
   * the hook spent to the row's `cost_cents` (issue 798 — the typing used
   * to be ledgered in `fetches` and missing from the row's total).
   *
   * **After the store, and that ordering is a foreign key.**
   * `opportunities.scan_id references scans (id)`: an opportunity derived
   * before the row it belongs to exists cannot be written.
   *
   * It is awaited, and it never stops the pass: a derivation that throws
   * is logged and the stored report stands (§4.3 — "a degraded pass still
   * releases setup; zero proposals is legal, never faked").
   */
  afterReport?: (a: { report: StoredReport; cost: CostContext }) => Promise<void>;
  /** The report of a pass the vendor refused for credit is stored `failed`, in the one write, so no reader ever sees it measured. */
  failsWhenFundsRefused?: true;
}

export async function runScan(a: RunScanArgs): Promise<{ scanId: string; status: ScanStatus; fundsRefused?: true }> {
  const parameters = TIER_PARAMETERS[a.tier];
  const startedAt = new Date();

  const parsed = parseDomain(a.domain);
  if (!parsed.ok) {
    logPass({ scanId: "", tier: a.tier, stoppedReason: "failed", status: "failed", because: parsed.problem });
    return { scanId: "", status: "failed" };
  }
  const domain = parsed.domain;

  // 1. The row this pass writes to.
  let scanId: string;
  let fromIncompleteRescan = false;
  let priorCents = 0;
  // A correction never went through admission, so there is no claimed row
  // to adopt: its row is claimed by the correction seam below (#786).
  if (parameters.adoptsClaim && a.correctionOf === undefined && a.retryOf === undefined) {
    const claimed = await adoptClaimedRow({
      domain,
      tier: a.tier,
      ...(a.siteId === undefined ? {} : { siteId: a.siteId }),
    });
    if (claimed === null) {
      logPass({ scanId: "", tier: a.tier, stoppedReason: "failed", status: "failed", because: "no_claimed_slot" });
      return { scanId: "", status: "failed" };
    }
    scanId = claimed.id;
    fromIncompleteRescan = claimed.fromIncompleteRescan;
    const carried = Number(claimed.costCents ?? 0);
    priorCents = Number.isFinite(carried) ? carried : 0;
  } else if (a.scanId !== undefined) {
    scanId = a.scanId;
    // A weekly row taken back after a failure keeps the week's one budget; a fresh row reads 0.
    priorCents = await readSpentCents(scanId);
  } else {
    scanId = crypto.randomUUID();
    const { claimed } = await claimPassRow({
      scanId,
      domain,
      tier: a.tier,
      ...(a.siteId === undefined ? {} : { siteId: a.siteId }),
    });
    if (!claimed) throw new Error(`runScan: the scan row ${scanId} already exists`);
  }

  // Issue 336, owner 2026-09-16: one of the three product events, recorded
  // as the pass begins. Started and not awaited — the free pass runs under
  // a 50 s ceiling and an analytics vendor is never allowed a second of it —
  // and the subject is the domain, hashed inside the seam.
  captureInBackground("scan_started", { subject: domain, tier: a.tier });

  // 2. §6.4's seven-day window — the free path's, per `servesStoredReport`.
  if (a.correctionOf === undefined && a.retryOf === undefined && parameters.servesStoredReport) {
    const stored = await readCurrentReport(domain);
    if (
      stored !== null &&
      stored.complete &&
      !awaitsMarketFromSearch(stored, startedAt) &&
      wholeDaysBetween(stored.verdict.measuredAt, startedAt) < FREE_RESCAN_WINDOW_D
    ) {
      if (parameters.adoptsClaim) await closeWithoutSpending(scanId);
      logPass({
        scanId: stored.scanId,
        tier: a.tier,
        stoppedReason: "complete",
        status: "done",
        because: "served_stored_report",
      });
      return { scanId: stored.scanId, status: "done" };
    }
  }

  // 3. The correction's own bookkeeping, read before the pass so the state
  //    machine is fed the value the offer was decided against.
  const correctionBefore =
    a.correctionOf === undefined ? null : ((await readCorrectionFacts(domain))?.correctionState ?? null);

  // 3b. The report a retry starts from (issue 715). Read here, once, and
  //     handed to the stages, so the market is not bought again and every
  //     section this pass does not re-measure is carried forward rather
  //     than lost — a retry of one part may never leave the report with
  //     less on it than it had. A retried row whose report cannot be read
  //     is a retry with nothing to start from, and the pass says so rather
  //     than measuring the domain from scratch on somebody else's money.
  let retried: StoredReport | null = null;
  if (a.retryOf !== undefined) {
    // The retried row's spend is this pass's `priorCents`, which is what
    // "inside the same budget" is: one 12¢ purse across the original pass
    // and every retry of it, counted by the one cap every paid call reads.
    priorCents = await readSpentCents(a.retryOf.scanId);
    await carrySpentCents(scanId, priorCents);
    retried = await readScanReport(a.retryOf.scanId);
    if (retried === null) {
      logPass({ scanId, tier: a.tier, stoppedReason: "failed", status: "failed", because: "retry_report_unreadable" });
      return { scanId, status: "failed" };
    }
  }
  const retry = retried === null || a.retryOf === undefined ? undefined : { report: retried, part: a.retryOf.part };

  // 4. The pass. `sections` lives out here so a ceiling that discards the
  //    body's return value still gives back everything measured before it,
  //    and `spend` holds the one cost context so its roll-up can be read
  //    after it has closed.
  // D66: a paying site is measured in the country and language stored on
  // it. A site with none stored is read in stage one, and the reading is
  // stored there, so every later stage and pass reads the one answer.
  const storedLocale =
    a.locale ?? (a.siteId === undefined ? null : await readStoredLocale(a.siteId).catch(() => null));

  const sections = freshSections(startedAt);
  const spend = { cents: 0, degraded: false, fundsRefused: false };
  const { ending } = await withScanBounds(
    {
      scanId,
      startedAt,
      cap: parameters.cap,
      ceilingS: parameters.ceilingS,
      deadlineApplies: parameters.deadlineApplies,
      priorCents,
      holdBackCents: parameters.typingReserveC,
      ...(a.failsWhenFundsRefused === true ? { failsWhenFundsRefused: true } : {}),
    },
    async (bounds, cost) => {
      try {
        await runStages({
          scanId,
          bounds,
          cost,
          domain,
          tier: a.tier,
          parameters,
          correction: a.correctionOf !== undefined,
          sections,
          startedAt,
          ...(a.siteId === undefined ? {} : { siteId: a.siteId }),
          ...(a.onStage === undefined ? {} : { onStage: a.onStage }),
          ...(a.category === undefined ? {} : { category: a.category }),
          ...(storedLocale === null ? {} : { locale: storedLocale }),
          ...(a.concludesMarket === true ? { concludesMarket: true } : {}),
          ...(a.asksTrackedPrompts === true ? { asksTrackedPrompts: true } : {}),
          ...(a.measuredSince === undefined
            ? {}
            : { sinceDays: Math.max(0, (startedAt.getTime() - a.measuredSince.getTime()) / MS_PER_DAY) }),
          ...(retry === undefined ? {} : { retry }),
        });
      } finally {
        spend.cents = cost.spentCents();
        spend.degraded = cost.degraded();
        spend.fundsRefused = cost.fundsRefused?.() === true;
      }
    }
  );
  // 5. Assemble from whatever the stages reached, and store.
  const stoppedReason: StoppedReason = ending.stoppedReason;
  const correctionState = correctionStateAfter(correctionBefore, stoppedReason);
  // Issue 875: from here the report is being composed, so a stage still in
  // flight writes nothing more. Set immediately before the read, and after
  // the bounds have settled, so every answer that came back in time — the
  // late ones included — is in what follows.
  // Issue 1170: **the card and the score's AI input are one read.**
  // `composeReport` reads AI Presence off `sections.serps`; a pass that
  // stopped before its scoring stage held those SERPs and no card, so the
  // report said "Presence 0/10" beside "AI answers couldn't be measured".
  // Scoring buys nothing and reads only `sections`, so wherever a SERP was
  // read and nothing scored it, it is counted here.
  if (sections.aiAnswers === null && sections.serps.some((serp) => serp.kind !== "unmeasured")) {
    score({ domain, sections, parameters, correction: a.correctionOf !== undefined });
  }
  sections.sealed = true;
  const measuredUnder = sections.concludedCategory ?? a.category;
  const composed = composeReport({
    scanId,
    domain,
    tier: a.tier,
    ...(measuredUnder === undefined ? {} : { category: measuredUnder }),
    stoppedReason,
    fromIncompleteRescan,
    sections,
    startedAt,
    correctionState,
    ...(retry === undefined ? {} : { carried: retry.report }),
  });

  // **The ending is published after the row is stored, never before**
  // (issue #540). REQ-003 c3 is "the report replaces the progress view
  // without the visitor reloading", and the ending event is what makes the
  // browser ask the server to resolve the address again
  // (`_address/progress.tsx`). Published before the store, that ask races
  // the write it is waiting for and the visitor is re-shown a scan still
  // running. The `finally` is the other half of the promise: a store that
  // raises must still end the stream, or the visitor waits on a pass that
  // is over.
  // Issue 1440: searches this pass chose and did not read are read in the
  // background, inside the same cap, and the report says so meanwhile.
  const finishing = parameters.finishesReads ? finishingOf(composed.report, spend.cents, new Date()) : null;
  if (finishing !== null) composed.report.finishingReads = finishing;
  let stored: { scanId: string; status: ScanStatus };
  try {
    stored = await storeCurrentReport({
      report: composed.report,
      ...(a.siteId === undefined ? {} : { siteId: a.siteId }),
      ...(a.correctionOf === undefined ? {} : { supersedesScanId: a.correctionOf }),
      // A retry supersedes the report it retried a part of, exactly as a
      // correction supersedes the one it corrected: one current report per
      // domain, and the one before it kept at its own scan id (issue 715).
      ...(a.retryOf === undefined ? {} : { supersedesScanId: a.retryOf.scanId }),
      drivers: composed.drivers,
      degraded: spend.degraded || composed.sectionMissing,
      ...(a.failsWhenFundsRefused === true && spend.fundsRefused ? { failed: true } : {}),
      costCents: spend.cents,
    });
  } finally {
    await emitEnding(scanId, ending);
  }

  // 6. A correction that produced no report leaves the previous report
  //    current, so that row's own state has to move with it.
  if (a.correctionOf !== undefined && correctionBefore !== null && correctionState !== correctionBefore) {
    await advanceCorrectionState({ scanId: a.correctionOf, from: correctionBefore, to: correctionState });
  }

  // 7. What the pass measured, turned into supply — the deep and weekly
  //    passes' own step, supplied by their callers rather than decided
  //    here (this file branches on no tier). A hook that throws does not
  //    take the report down with it.
  if (a.afterReport !== undefined) {
    try {
      await spendOnStoredReport({ scanId, tier: a.tier, report: composed.report }, a.afterReport);
    } catch (error) {
      console.log(
        JSON.stringify({
          event: "after_report_failed",
          scanId,
          because: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  logPass({
    scanId,
    tier: a.tier,
    stoppedReason,
    status: stored.status,
    // Issue 865: how much of the battery this pass actually measured, so
    // "ten of twelve" is a fact in the log rather than one to be inferred
    // from the stored report.
    serpsMeasured: composed.report.serps.filter((serp) => serp.kind !== "unmeasured").length,
    serpsAsked: composed.report.serps.length,
    // Issue 865's field, and issue 898's fourth word for it: a pass whose
    // market was never read is not a pass that simply ended. `figma.com`
    // on 2026-09-18 ended `complete`/`degraded` with `pass_ended`, and
    // nothing in the line said that the profile call was what the whole
    // empty report hung on. `marketUnread` names the step it stopped at,
    // by the `ScanInput` the verdict already reads that step under.
    because:
      ending.stoppedReason === "site_unreadable"
        ? (ending.refusal ?? "stage_undeterminable")
        : composed.marketTooSmall
          ? "market_too_small"
          : composed.marketUnread !== null
            ? `${composed.marketUnread}_unmeasured`
            : "pass_ended",
  });

  // 8. Issue 1440: the searches this pass left unread are finished in the
  //    background. Sent after the report is stored, since the job reads it.
  if (finishing !== null && stored.status !== "failed") await sendFinishingReads(scanId);

  // 9. #770: a paid pass (one with a site) that found too little market
  //    tells the owner at once where its parameters say `immediate`; a
  //    `digest` pass waits for the owner's Monday digest (issue 796). Imported
  //    at the call, as `src/jobs/run.ts` does; `reportIncident` never throws.
  if (composed.marketTooSmall && a.siteId !== undefined && parameters.marketTooSmallAlert === "immediate") {
    const { reportIncident } = await import("@/lib/mail/ops");
    await reportIncident({ occasion: "market-too-small", scanId, tier: a.tier });
  }
  // A pass the vendor refused for credit measured nothing it can stand on; its caller decides what that leaves.
  return spend.fundsRefused ? { ...stored, fundsRefused: true } : stored;
}

/** Sends `scan/finish-reads` for a stored report that says it is still
 *  reading (issue 1440). Imported at the call, as `src/jobs/run.ts` is. A
 *  send that fails is logged: the report's line then lapses after its
 *  window and the report stands as stored. */
async function sendFinishingReads(scanId: string): Promise<void> {
  try {
    const { sendFinishReads } = await import("@/jobs/scan-finish-reads");
    await sendFinishReads(scanId);
  } catch (error) {
    console.log(
      JSON.stringify({
        event: "finish_reads_not_sent",
        scanId,
        because: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

/**
 * The work a paid pass does with its stored report, on the pass's own
 * money (issue 798): a context under the tier's cap that opens on the
 * row's `cost_cents` and adds its own spend to it at close.
 *
 * `runScan` calls it with the report it just stored. The onboarding pass
 * calls it as a step of its own, after the pass's step has ended, and the
 * report is read back from the row; a row that stored none has nothing to
 * derive from, and nothing is opened.
 */
export async function spendOnStoredReport(
  a: { scanId: string; tier: Tier; report?: StoredReport },
  body: (a: { report: StoredReport; cost: CostContext }) => Promise<void>
): Promise<void> {
  const report = a.report ?? (await readScanReport(a.scanId));
  if (report === null) return;
  await withStoredPassSpend({ scanId: a.scanId, cap: TIER_PARAMETERS[a.tier].cap }, (cost) =>
    body({ report, cost })
  );
}

/** The state machine's own answer, never a second table: a pass that
 *  produced a report moves the correction to `used`, one that produced
 *  none spends an attempt. */
function correctionStateAfter(before: CorrectionState | null, stoppedReason: StoppedReason): CorrectionState {
  if (before === null) return "none";
  const advanced = nextCorrectionState({
    current: before,
    event: stoppedReason === "failed" ? "produced_no_report" : "produced_report",
  });
  return "refused" in advanced ? before : advanced.next;
}

function logPass(fields: {
  scanId: string;
  tier: Tier;
  stoppedReason: StoppedReason;
  status: ScanStatus;
  /** Issue 865: how much of the battery this pass measured. Absent where
   *  a pass ended before the twelve were asked at all. */
  serpsMeasured?: number;
  serpsAsked?: number;
  because: string;
}): void {
  console.log(JSON.stringify({ event: "scan_pass", ...fields }));
}

// ── The correction seam ─────────────────────────────────────────────────
//
// Registered at module load, so the correction route's "scanning
// unavailable" refusal means what it says — no pipeline is reachable —
// rather than one that is reachable and was never introduced. The
// correction's own parameter (`loadAsyncAiOverview: false`, DECISIONS
// 2026-09-03) travels as `correctionOf`, never as a ceiling of its own.
//
// The row is claimed here, before the seam answers, and the pass is started
// and not awaited (#786): the report follows the rerun's stages by that
// row's id, and a stream opened on a row that does not exist yet is a 404.
// The free tier adopts an admission claim, and a correction has none — it
// spends no second allowance — so without this claim the pass found no row
// and ended `no_claimed_slot` before it measured anything.
// ── The retry seam (SPEC §2, issue 715) ─────────────────────────────────
//
// The same arrangement as the correction seam below, and for the same two
// reasons: the route's "scanning unavailable" must mean no pipeline is
// reachable, and the row has to exist before the seam answers so the report
// can open the stream on it.
//
// A retry claims a row of its own and spends no second allowance: the cap
// it runs under counts the retried row's spend as `priorCents`, so the
// original pass and every retry of it share one 12¢ purse.
registerRetryRunner(async (a) => {
  const parsed = parseDomain(a.domain);
  if (!parsed.ok) throw new Error(`retry: ${parsed.problem}`);
  const scanId = crypto.randomUUID();
  const { claimed } = await claimPassRow({ scanId, domain: parsed.domain, tier: a.tier });
  if (!claimed) throw new Error(`retry: the scan row ${scanId} already exists`);
  return {
    scanId,
    finished: runScan({
      scanId,
      domain: parsed.domain,
      tier: a.tier,
      retryOf: { scanId: a.retryOf, part: a.part },
    }),
  };
});

registerCorrectionRunner(async (a) => {
  const parsed = parseDomain(a.domain);
  if (!parsed.ok) throw new Error(`correction: ${parsed.problem}`);
  const scanId = crypto.randomUUID();
  const { claimed } = await claimPassRow({ scanId, domain: parsed.domain, tier: a.tier });
  if (!claimed) throw new Error(`correction: the scan row ${scanId} already exists`);
  return {
    scanId,
    finished: runScan({
      scanId,
      domain: parsed.domain,
      tier: a.tier,
      correctionOf: a.correctionOf,
      category: a.category,
    }),
  };
});
