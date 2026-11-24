// BUILD §4.1, §6.2, §6.3, §6.5: the one scan pipeline, tier a parameter. Six stages in `STAGES` order under the tier's cap (and the free deadline),
// ending in one stored report or a failure that leaves the previous report untouched.
// It never branches on tier: `TierParameters` changes what it does, never which stages or formulas run. Cold start branches nothing:
// a domain that ranks for nothing stores `zero` sections, not `unmeasured`.
// This file orders calls only: no arithmetic on a measured value, no parsing, no presentation, UI or app import.
// A ceiling gives back what was measured: sections start `unmeasured / not_attempted` and fill as stages complete, never a 0 nobody measured.
// Degradation never throws: a callee that raises becomes `undeterminable` at its stage. A pass `failed` only where it produced no report.
// A free re-scan within seven days serves the stored report (§6.4) at no spend, closing the adopted row at 0¢; a correction always runs.
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
import { passParameters, type PassTier } from "./pass/tier";
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
  tier: PassTier;
  /** A site's first weekly pass (`passParameters` names its differences): setup's, and each *Measure again*. */
  first?: boolean;
  /** The row this pass writes to, where the caller claimed one: the weekly `(site_id, week_start)` row is the once-a-week guarantee,
   *  so the report goes into it rather than a second row. Absent, a paid pass generates its own id. */
  scanId?: string;
  /** A market correction re-measures inside the scan it corrects: same
   *  spend ceiling, no second allowance consumed. */
  correctionOf?: string;
  /** The report this pass re-measures one part of, and which part. It spends no second allowance: the retried row's `cost_cents` becomes
   *  `priorCents`, so the 12¢ free cap covers every retry. It changes no question: the market is read back (`resumeMarket`). */
  retryOf?: { scanId: string; part: RetryPart };
  /** The category the founder confirmed (`sites.category`, or a correction's): the market's seed ahead of the inferred one, its words joining
   *  the relevance guard's support set. Absent, the pass seeds from the profile. */
  category?: string;
  /** The site's stored country and language from setup: every vendor read is made in it. Absent, the pass reads it from the address and home page. */
  locale?: Locale;
  /** The deep and weekly passes re-check the site's market before seeding and measure the one that stands (needs `siteId`); a founder's category stands. */
  concludesMarket?: boolean;
  /** The founder's *Measure again now* also asks the tracked buyer prompts, so no founder waits for Monday to see a mention rate. */
  asksTrackedPrompts?: boolean;
  /** "Missing values omit the row, never repeat last week": the start of this pass's period (a weekly pass's site-local Monday).
   *  The site's documents, ranked rows and SERPs are served from cache only where read since, so every factor carries this pass's date. */
  measuredSince?: Date;
  /** Called as each stage is entered: `stages.ts`'s bus is in-process only, so a reader in another process (the onboarding progress screen)
   *  needs this durable write. Awaited, so stages are never reported out of order; a throw would stop the pass, so the caller swallows its own failures. */
  onStage?: (stage: StageName) => void | Promise<void>;
  /** Called once the report is stored, with a `CostContext` on the pass's own money (`spendOnStoredReport`): §6.3 puts opportunity typing
   *  inside the pass's budget, so the hook's spend is added to the row's `cost_cents`. After the store, since `opportunities.scan_id` references the row.
   *  Awaited but never stops the pass: a throw is logged, and zero proposals is legal, never faked. */
  afterReport?: (a: { report: StoredReport; cost: CostContext }) => Promise<void>;
  /** The report of a pass the vendor refused for credit is stored `failed`, in the one write, so no reader ever sees it measured. */
  failsWhenFundsRefused?: true;
}

export async function runScan(a: RunScanArgs): Promise<{ scanId: string; status: ScanStatus; fundsRefused?: true; supplyFailed?: true }> {
  const parameters = passParameters(a.tier, a.first === true);
  // A first pass keeps the stored `deep` label on its row, report and reads, so new rows and stored ones read alike.
  const tier: Tier = a.first === true ? "deep" : a.tier;
  const startedAt = new Date();

  const parsed = parseDomain(a.domain);
  if (!parsed.ok) {
    logPass({ scanId: "", tier, stoppedReason: "failed", status: "failed", because: parsed.problem });
    return { scanId: "", status: "failed" };
  }
  const domain = parsed.domain;

  // 1. The row this pass writes to.
  let scanId: string;
  let fromIncompleteRescan = false;
  let priorCents = 0;
  // A correction never went through admission, so there is no claimed row to adopt: the correction seam claims it.
  if (parameters.adoptsClaim && a.correctionOf === undefined && a.retryOf === undefined) {
    const claimed = await adoptClaimedRow({
      domain,
      tier,
      ...(a.siteId === undefined ? {} : { siteId: a.siteId }),
    });
    if (claimed === null) {
      logPass({ scanId: "", tier, stoppedReason: "failed", status: "failed", because: "no_claimed_slot" });
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
      tier,
      ...(a.siteId === undefined ? {} : { siteId: a.siteId }),
    });
    if (!claimed) throw new Error(`runScan: the scan row ${scanId} already exists`);
  }

  // One of the product events, as the pass begins: not awaited, since no analytics vendor gets a second of the free ceiling. The subject is hashed in the seam.
  captureInBackground("scan_started", { subject: domain, tier });

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
        tier,
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

  // 3b. The report a retry starts from, read once so the market is not re-bought and every section not re-measured is carried forward.
  // A retried row whose report cannot be read stops the pass rather than measuring from scratch.
  let retried: StoredReport | null = null;
  if (a.retryOf !== undefined) {
    // The retried row's spend is this pass's `priorCents`: one 12¢ purse across the pass and every retry.
    priorCents = await readSpentCents(a.retryOf.scanId);
    await carrySpentCents(scanId, priorCents);
    retried = await readScanReport(a.retryOf.scanId);
    if (retried === null) {
      logPass({ scanId, tier, stoppedReason: "failed", status: "failed", because: "retry_report_unreadable" });
      return { scanId, status: "failed" };
    }
  }
  const retry = retried === null || a.retryOf === undefined ? undefined : { report: retried, part: a.retryOf.part };

  // 4. The pass. `sections` lives out here so a ceiling that discards the body's return still gives back what was measured; `spend` holds the context.
  // A paying site is measured in its stored country and language; one with none is read in stage one and stored there.
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
      holdBackCents: parameters.typingReserveC + parameters.afterC,
      ...(a.failsWhenFundsRefused === true ? { failsWhenFundsRefused: true } : {}),
    },
    async (bounds, cost) => {
      try {
        await runStages({
          scanId,
          bounds,
          cost,
          domain,
          tier,
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
  // From here the report is being composed, so a stage still in flight writes nothing more; set after the bounds settle so late answers are in.
  // The card and the score's AI input are one read: a SERP read that nothing scored is counted here, since scoring buys nothing.
  if (sections.aiAnswers === null && sections.serps.some((serp) => serp.kind !== "unmeasured")) {
    score({ domain, sections, parameters, correction: a.correctionOf !== undefined });
  }
  sections.sealed = true;
  const measuredUnder = sections.concludedCategory ?? a.category;
  const composed = composeReport({
    scanId,
    domain,
    tier,
    ...(measuredUnder === undefined ? {} : { category: measuredUnder }),
    stoppedReason,
    fromIncompleteRescan,
    sections,
    startedAt,
    correctionState,
    ...(retry === undefined ? {} : { carried: retry.report }),
  });

  // The ending is published after the row is stored, never before: it makes the browser resolve the address again, and before the store
  // that races the write. The `finally` ends the stream even when the store raises.
  // Searches this pass chose and did not read are read in the background, inside the same cap, and the report says so meanwhile.
  const finishing = parameters.finishesReads ? finishingOf(composed.report, spend.cents, new Date()) : null;
  if (finishing !== null) composed.report.finishingReads = finishing;
  let stored: { scanId: string; status: ScanStatus };
  try {
    stored = await storeCurrentReport({
      report: composed.report,
      ...(a.siteId === undefined ? {} : { siteId: a.siteId }),
      ...(a.correctionOf === undefined ? {} : { supersedesScanId: a.correctionOf }),
      // A retry supersedes the report it retried a part of, as a correction does: one current report per domain, the old one kept at its scan id.
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

  // 7. What the pass measured, turned into supply — the paid
  //    passes' own step, supplied by their callers rather than decided
  //    here (this file branches on no tier). A hook that throws does not
  //    take the report down with it.
  let supplyFailed = false;
  if (a.afterReport !== undefined) {
    try {
      await spendOnStoredReport({ scanId, tier: a.tier, first: a.first === true, report: composed.report }, a.afterReport);
    } catch (error) {
      supplyFailed = true;
      await reportSupplyFailed({ scanId, ...(a.siteId === undefined ? {} : { siteId: a.siteId }) }, error);
    }
  }

  logPass({
    scanId,
    tier,
    stoppedReason,
    status: stored.status,
    // How much of the battery this pass measured, so "ten of twelve" is a fact in the log.
    serpsMeasured: composed.report.serps.filter((serp) => serp.kind !== "unmeasured").length,
    serpsAsked: composed.report.serps.length,
    // A pass whose market was never read did not simply end: `marketUnread` names the step it stopped at, by its `ScanInput`.
    because:
      ending.stoppedReason === "site_unreadable"
        ? (ending.refusal ?? "stage_undeterminable")
        : composed.marketTooSmall
          ? "market_too_small"
          : composed.marketUnread !== null
            ? `${composed.marketUnread}_unmeasured`
            : "pass_ended",
  });

  // 8. The searches this pass left unread are finished in the background, sent after the report is stored since the job reads it.
  if (finishing !== null && stored.status !== "failed") await sendFinishingReads(scanId);

  // 9. A paid pass that found too little market tells the owner at once where its parameters say `immediate`; `digest` waits for Monday.
  // Imported at the call; `reportIncident` never throws.
  if (composed.marketTooSmall && a.siteId !== undefined && parameters.marketTooSmallAlert === "immediate") {
    const { reportIncident } = await import("@/lib/mail/ops");
    await reportIncident({ occasion: "market-too-small", scanId, tier });
  }
  // A pass the vendor refused for credit measured nothing it can stand on; its caller decides what that leaves.
  return { ...stored, ...(spend.fundsRefused ? { fundsRefused: true as const } : {}), ...(supplyFailed ? { supplyFailed: true as const } : {}) };
}

/** A pass whose supply step threw: an error line the runtime errors show, and one ops event the daily check reads. Never throws. */
export async function reportSupplyFailed(a: { scanId: string; siteId?: string }, error: unknown): Promise<void> {
  console.error(JSON.stringify({ event: "after_report_failed", scanId: a.scanId, because: error instanceof Error ? error.message : String(error) }));
  const { failureCode, recordOpsEvent } = await import("@/lib/ops/events");
  await recordOpsEvent("after_report_failed", a.scanId, failureCode(error), a.siteId ?? null);
}

/** Sends `scan/finish-reads` for a report still reading. A failed send is logged: the line lapses after its window and the report stands. */
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

/** The work a paid pass does with its stored report, on its own money: a context under the tier's cap opening on the row's `cost_cents`.
 *  The onboarding pass calls it as its own step and reads the report back; a row with none opens nothing. */
export async function spendOnStoredReport(
  a: { scanId: string; tier: PassTier; first?: boolean; report?: StoredReport },
  body: (a: { report: StoredReport; cost: CostContext }) => Promise<void>
): Promise<void> {
  const report = a.report ?? (await readScanReport(a.scanId));
  if (report === null) return;
  const { cap, afterC } = passParameters(a.tier, a.first === true);
  await withStoredPassSpend({ scanId: a.scanId, cap, holdBackCents: afterC }, (cost) =>
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
  /** How much of the battery this pass measured; absent where it ended before the twelve were asked. */
  serpsMeasured?: number;
  serpsAsked?: number;
  because: string;
}): void {
  console.log(JSON.stringify({ event: "scan_pass", ...fields }));
}

// ── The retry and correction seams ───────────────────────────────────────
// Registered at module load, so a route's "scanning unavailable" means no pipeline is reachable. Each claims its row before answering,
// since the report opens its stream on it, and starts the pass without awaiting. A correction claims under the visitor's network so it counts as a scan;
// its `loadAsyncAiOverview: false` travels as `correctionOf`. A retry spends no second allowance: `priorCents` shares the 12¢ purse.
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
  const { claimed } = await claimPassRow({ scanId, domain: parsed.domain, tier: a.tier, network: a.network });
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
