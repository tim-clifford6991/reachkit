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
// parse, or a free call with no claimed slot to adopt.
//
// **A free re-scan of the same domain within seven days serves the stored
// report** (§6.4) — no new spend and no vendor call, the stored report's
// own scan id returned. The adopted row is closed out at zero cents, so
// the next visitor is not refused for an in-flight scan that is not
// running. A correction is not a re-scan: it re-measures inside the scan
// it corrects and always runs.
import { CACHE_WINDOWS_D, FREE_RESCAN_WINDOW_D } from "@/lib/config/constants";
import type { CapName, CostContext } from "@/lib/costs";
import { dbAdmin } from "@/lib/db";
import type { RobotsPolicy } from "@/lib/egress/types";
import { checkCoherence, type CoherenceVerdict } from "@/lib/market/coherence/check";
import { nextCorrectionState, type CorrectionState } from "@/lib/market/coherence/state";
import { buildAiAnswersCard, type BatteryAnswers } from "@/lib/market/questions/matrix";
import {
  deriveMarketSet,
  marketSetOf,
  type MarketSet,
  type SuggestionRow,
} from "@/lib/market/questions/market-set";
import { phraseQuestions, type Question } from "@/lib/market/questions/phrase";
import { deriveProfile, type Profile } from "@/lib/market/questions/profile";
import { selectTwelve, type SelectedSearch } from "@/lib/market/questions/select";
import { deriveRivals, type RivalCandidate } from "@/lib/market/rivals/derive";
import { buildPresenceCard, type PresenceCard } from "@/lib/market/rivals/presence";
import { sizeRivals, type RivalSize } from "@/lib/market/rivals/size";
import { trackedRivals } from "@/lib/market/rivals/tracked";
import type { MarketSerp } from "@/lib/market/views";
import { aiPresenceOf, measureDomain, type DomainMeasurement } from "@/lib/measure";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import type { InputOutcome, ScanInput } from "@/lib/measure/partition";
import type { OnPageFacts } from "@/lib/measure/parse";
import type { Drivers } from "@/lib/measure/score";
import { verdictOf, type Verdict } from "@/lib/measure/verdict";
import { aiMode, llmScraper, serpOrganic } from "@/lib/vendors/dataforseo";
import type { AiAnswer, CacheScope, SerpResult } from "@/lib/vendors/dataforseo/types";
import { withScanBounds, type Bounds } from "./ceilings";
import { advanceCorrectionState, readCorrectionFacts, registerCorrectionRunner } from "./correction";
import { parseDomain, type CanonicalDomain } from "./domain";
import { readCurrentReport } from "./report";
import type { AiAnswersSection, StoppedReason, StoredReport, SupplySection, Tier } from "./report";
import { answersSectionOf, blockedAgentsOf } from "./sections";
import { emitEnding, enterStage, exitStage } from "./stages";
import type { StageName } from "./stages";
import { assembleReport, storeCurrentReport, type ScanStatus } from "./store";

// ── Tier as a parameter ─────────────────────────────────────────────────

interface TierParameters {
  /** Which of the four caps the pass spends against (§6.1). */
  cap: CapName;
  /** §6.4: live mode only where a human is waiting; everything scheduled
   *  runs on the standard queue. */
  serpMode: "live" | "std";
  /** §6.2 as amended (DECISIONS 2026-09-03): the free report's own twelve
   *  question-SERPs count Google's actual AI answers. A correction's
   *  re-run switches it off whatever the tier says — that is the
   *  correction's parameter, not this table's. */
  asyncAiOverview: boolean;
  /** The ninety-second report ceiling. The deep pass is released at ten
   *  minutes rather than stopped and the weekly pass runs on the standard
   *  queue; for both, the cap re-checked between stages is the whole of
   *  the bound. */
  deadlineApplies: boolean;
  /** A free scan is never started outside admission control: it adopts the
   *  row the claim already inserted and never inserts a second. */
  adoptsClaim: boolean;
  /** §6.4, verbatim: "**A free re-scan of the same domain within 7 days
   *  serves the stored report**". A *free* re-scan — the clause is the
   *  lead magnet's, and the two paid tiers are the two things it cannot
   *  hold for. The weekly pass exists to produce this week's measurement
   *  (REQ-065 c1/c2), so a report five days old is exactly what it must
   *  replace rather than serve; the paid deep pass reuses a fresh free
   *  scan through the *cache* windows §6.4 names for it, which spends
   *  nothing either and still measures. */
  servesStoredReport: boolean;
  /** §6.4's never-pull list, verbatim: "Never: … per-rival
   *  `ranked_keywords` on the free path". §6.3's paid list adds it —
   *  "`ranked_keywords`@100 ×rivals (**monthly**)" — so the two paid tiers
   *  size the customer's tracked rivals and the free tier does not. The
   *  monthly cadence is the cache window's (`CACHE_WINDOWS_D.rival`, applied
   *  inside `rankedKeywords`) and not a second schedule here: a weekly pass
   *  inside the window re-reads the same rows and spends nothing. */
  sizesRivals: boolean;
  /** §6.2's paid weekly battery — "ChatGPT std + AI Mode std +
   *  AI-Overview piggyback = 2.2¢/week" — bought per question inside
   *  `asking_the_twelve`, beside the SERP whose own AI Overview is the
   *  third column and costs nothing extra.
   *
   *  `false` on the free path and no other value is defensible there:
   *  §6.2 rules "The free path makes **zero** AI Optimization API calls"
   *  and §6.1 prices `CHATGPT_SCRAPE_STD` "(paid battery only — never on
   *  the free path)". It is a parameter and not a branch for the same
   *  reason `sizesRivals` is: the stage runs at every tier and asks the
   *  same callees; what a tier changes is what its row here says.
   *
   *  **Belt and braces, on purpose.** `aiMode` and `llmScraper` refuse
   *  under a `FREE` cost context themselves (`src/lib/vendors/dataforseo/
   *  ai.ts`), so the free path is held twice: once by this row, which
   *  stops the call being made, and once at the vendor, which would
   *  refuse it if it were. Two independent guards for a rule whose breach
   *  is money spent against a promise. */
  battery: boolean;
  /** §6.4's SERP window for this tier's target SERPs, verbatim: "SERPs 30d
   *  (**except the weekly target re-check**)". The exception is a *tier's*
   *  fact and not the vendor module's, so it is a row here and passed down
   *  — `serpOrganic` knows nothing about tiers (#75).
   *
   *  The weekly pass exists to produce this week's measurement (REQ-065
   *  c1/c2). At the 30-day window three weeks in four it would be served a
   *  cached SERP wearing this week's date, and "measured once a week"
   *  would be met by a monthly measurement — the defect
   *  `CACHE_WINDOWS_D.serpWeeklyRecheck` exists to close. The two passes a
   *  human waits for buy at the pinned 30. */
  serpWindowDays: number;
}

export const TIER_PARAMETERS: Readonly<Record<Tier, TierParameters>> = Object.freeze({
  free: Object.freeze({
    cap: "FREE",
    serpMode: "live",
    asyncAiOverview: true,
    deadlineApplies: true,
    adoptsClaim: true,
    servesStoredReport: true,
    sizesRivals: false,
    battery: false,
    serpWindowDays: CACHE_WINDOWS_D.serp,
  }),
  deep: Object.freeze({
    cap: "DEEP",
    serpMode: "live",
    asyncAiOverview: false,
    deadlineApplies: false,
    adoptsClaim: false,
    servesStoredReport: false,
    sizesRivals: true,
    battery: true,
    serpWindowDays: CACHE_WINDOWS_D.serp,
  }),
  weekly: Object.freeze({
    cap: "WEEKLY",
    serpMode: "std",
    asyncAiOverview: false,
    deadlineApplies: false,
    adoptsClaim: false,
    servesStoredReport: false,
    sizesRivals: true,
    battery: true,
    serpWindowDays: CACHE_WINDOWS_D.serpWeeklyRecheck,
  }),
} as const);

// ── The sections a pass accumulates ─────────────────────────────────────

interface Sections {
  measurement: DomainMeasurement | null;
  profile: Measured<Profile>;
  marketRows: Measured<readonly SuggestionRow[]>;
  selected: SelectedSearch[];
  questions: Measured<Question[]>;
  serps: Measured<SerpResult>[];
  /** §6.2's battery, one entry per question in question order — the same
   *  parallel record `serps` is, and filled by the same stage. It reaches
   *  the blob as the AI-answers card's engine columns and nowhere else:
   *  the engines' own prose is generated text and has no member here to
   *  travel in (`MarketAiAnswer`, `src/lib/market/views.ts`). */
  battery: BatteryAnswers[];
  rivals: Measured<RivalCandidate[]>;
  /** §6.6's sizing, filled by `checking_your_presence` at the two tiers
   *  whose parameters say so. A pass that could not read the site's
   *  tracked rivals leaves the arm `freshSections` gave it — never a
   *  zero, which would satisfy every winnability bar. */
  rivalSizes: Measured<RivalSize[]>;
  sources: readonly string[];
  aiAnswers: AiAnswersSection | null;
  presence: PresenceCard | null;
  coherence: CoherenceVerdict;
}

/** Everything outstanding, before any stage has run. `not_attempted` is
 *  the honest arm for work a ceiling may yet stop: it says we did not get
 *  to it, which no 0 and no empty list can say. */
function freshSections(at: Date): Sections {
  return {
    measurement: null,
    profile: unmeasured("not_attempted", at),
    marketRows: unmeasured("not_attempted", at),
    selected: [],
    questions: unmeasured("not_attempted", at),
    serps: [],
    battery: [],
    rivals: unmeasured("not_attempted", at),
    rivalSizes: unmeasured("not_attempted", at),
    sources: [],
    aiAnswers: null,
    presence: null,
    coherence: { verdict: "unjudgeable", measuredCount: 0 },
  };
}

// ── Failure inside one stage ────────────────────────────────────────────

interface StageFailure {
  readonly stageFailed: true;
}

const STAGE_FAILED: StageFailure = Object.freeze({ stageFailed: true });

function failed(value: unknown): value is StageFailure {
  return typeof value === "object" && value !== null && "stageFailed" in value;
}

/** Runs one unit of a stage's work and turns a raised error into the arm
 *  that is true of it — the source did not answer. The ceilings' own arms
 *  are never reached this way: a ceiling is read from `Bounds` *before*
 *  the work runs and yields `not_attempted`, which is a different claim. */
async function attempt<T>(stage: string, work: () => Promise<T>): Promise<T | StageFailure> {
  try {
    return await work();
  } catch (error) {
    console.log(
      JSON.stringify({
        event: "stage_undeterminable",
        stage,
        because: error instanceof Error ? error.message : String(error),
      })
    );
    return STAGE_FAILED;
  }
}

// ── The row a pass writes to ────────────────────────────────────────────
//
// `scans.stopped_reason` and `scans.finished_at` are on disk and not yet in
// the generated `Database` type — the same worked-around gap
// `admission.ts`, `report.ts` and `correction.ts` already carry. Nothing
// else in this file bypasses the generated client.

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  insert(values: Record<string, unknown>): MinimalQueryBuilder<T>;
  update(values: Record<string, unknown>): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  order(column: string, opts: { ascending: boolean }): MinimalQueryBuilder<T>;
  limit(n: number): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

function untyped(client: ReturnType<typeof dbAdmin>): MinimalClient {
  return client as unknown as MinimalClient;
}

interface RunningScanRow {
  id: string;
  /** Read under an alias, so the column name appears in this file only
   *  inside the select string. `admission.ts` is the one place the column
   *  is ever *written*, and its own suite asserts that by pattern over
   *  `src/`; a read shape that spelled the column as a property would read
   *  to that check as a second writer. */
  fromIncompleteRescan: boolean;
}

/** The running row admission already inserted for this domain, or `null`. */
async function adoptClaimedRow(domain: CanonicalDomain): Promise<RunningScanRow | null> {
  const { data, error } = await untyped(dbAdmin())
    .from<RunningScanRow>("scans")
    .select("id, fromIncompleteRescan:from_incomplete_rescan")
    .eq("domain", domain)
    .eq("tier", "free")
    .eq("status", "running")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`runScan: could not read the claimed scan row: ${error.message}`);
  return data?.[0] ?? null;
}

/** Closes a row out without spending anything — the seven-day window's
 *  arm, where the stored report is served and no pass runs. */
async function closeWithoutSpending(scanId: string): Promise<void> {
  const { error } = await untyped(dbAdmin())
    .from<{ id: string }>("scans")
    .update({
      status: "done",
      cost_cents: 0,
      stopped_reason: "complete",
      finished_at: new Date().toISOString(),
    })
    .eq("id", scanId);
  if (error) throw new Error(`runScan: could not close the adopted row: ${error.message}`);
}

/**
 * Inserts the `running` row a paid pass writes to, before any spend.
 *
 * `fetches.scan_id` and `opportunities.scan_id` both reference `scans
 * (id)`, so a pass whose row does not exist yet can neither ledger a
 * vendor call nor persist an opportunity against it. The free path adopts
 * the row admission already claimed and the weekly pass claims its own
 * (that claim is also the once-a-week guarantee and carries `week_start`,
 * which is why it stays `runWeekly`'s); every other pass claims here, and
 * `store_current_report` then updates this row rather than inserting one.
 *
 * No `week_start`, no `is_current`, no cost: this is the row, not the
 * report. Nothing about the pass is decided by it.
 */
async function claimPassRow(a: {
  scanId: string;
  domain: CanonicalDomain;
  tier: Tier;
  siteId?: string;
}): Promise<void> {
  const { error } = await untyped(dbAdmin())
    .from<{ id: string }>("scans")
    .insert({
      id: a.scanId,
      domain: a.domain,
      tier: a.tier,
      status: "running",
      ...(a.siteId === undefined ? {} : { site_id: a.siteId }),
    });
  if (error) throw new Error(`runScan: could not claim the scan row: ${error.message}`);
}

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
   * Called once the pass's report is stored, with the report and the
   * pass's own `CostContext`.
   *
   * §6.3 puts "Haiku ×~4 for opportunity typing" inside the deep and
   * weekly passes' own budgets, so the work this hook does spends the
   * pass's money and no other: the context handed here is the one the
   * stages spent, its cap still applies, and a second `withCostContext`
   * would be a second budget *and* a second roll-up over the same
   * `scans` row.
   *
   * **After the store, and that ordering is a foreign key.**
   * `opportunities.scan_id references scans (id)`: an opportunity derived
   * before the row it belongs to exists cannot be written. The pass's own
   * roll-up was written when the bounds closed and `store_current_report`
   * overwrote it a moment ago, so what this hook spends is ledgered in
   * `fetches` — which BP-007 states is the source of truth — and is not
   * added to the row's cached `cost_cents`. Stated rather than hidden: it
   * is a summary that under-reports by the typing calls, not a figure the
   * ledger disagrees with.
   *
   * It is awaited, and it never stops the pass: a derivation that throws
   * is logged and the stored report stands (§4.3 — "a degraded pass still
   * releases setup; zero proposals is legal, never faked").
   */
  afterReport?: (a: { report: StoredReport; cost: CostContext }) => Promise<void>;
}

export async function runScan(a: RunScanArgs): Promise<{ scanId: string; status: ScanStatus }> {
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
  if (parameters.adoptsClaim) {
    const claimed = await adoptClaimedRow(domain);
    if (claimed === null) {
      logPass({ scanId: "", tier: a.tier, stoppedReason: "failed", status: "failed", because: "no_claimed_slot" });
      return { scanId: "", status: "failed" };
    }
    scanId = claimed.id;
    fromIncompleteRescan = claimed.fromIncompleteRescan;
  } else if (a.scanId !== undefined) {
    scanId = a.scanId;
  } else {
    scanId = crypto.randomUUID();
    await claimPassRow({
      scanId,
      domain,
      tier: a.tier,
      ...(a.siteId === undefined ? {} : { siteId: a.siteId }),
    });
  }

  // 2. §6.4's seven-day window — the free path's, per `servesStoredReport`.
  if (a.correctionOf === undefined && parameters.servesStoredReport) {
    const stored = await readCurrentReport(domain);
    if (stored !== null && stored.complete && wholeDaysBetween(stored.verdict.measuredAt, startedAt) < FREE_RESCAN_WINDOW_D) {
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

  // 4. The pass. `sections` lives out here so a ceiling that discards the
  //    body's return value still gives back everything measured before it,
  //    and `spend` holds the one cost context so its roll-up can be read
  //    after it has closed.
  const sections = freshSections(startedAt);
  const spend: { cents: number; degraded: boolean } = { cents: 0, degraded: false };
  // The pass's own context, held past the block that opened it so
  // `afterReport` can spend inside the same cap. See `RunScanArgs.afterReport`
  // for why the work it does cannot run before the row is stored.
  let passCost: CostContext | null = null;
  const { ending } = await withScanBounds(
    { scanId, startedAt, cap: parameters.cap, deadlineApplies: parameters.deadlineApplies },
    async (bounds, cost) => {
      passCost = cost;
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
        });
      } finally {
        spend.cents = cost.spentCents();
        spend.degraded = cost.degraded();
      }
    }
  );
  emitEnding(scanId, ending);

  // 5. Assemble from whatever the stages reached, and store.
  const stoppedReason: StoppedReason = ending.stoppedReason;
  const correctionState = correctionStateAfter(correctionBefore, stoppedReason);
  const composed = composeReport({
    scanId,
    domain,
    tier: a.tier,
    stoppedReason,
    fromIncompleteRescan,
    sections,
    startedAt,
    correctionState,
  });

  const stored = await storeCurrentReport({
    report: composed.report,
    ...(a.siteId === undefined ? {} : { siteId: a.siteId }),
    ...(a.correctionOf === undefined ? {} : { supersedesScanId: a.correctionOf }),
    drivers: composed.drivers,
    degraded: spend.degraded || composed.sectionMissing,
    costCents: spend.cents,
  });

  // 6. A correction that produced no report leaves the previous report
  //    current, so that row's own state has to move with it.
  if (a.correctionOf !== undefined && correctionBefore !== null && correctionState !== correctionBefore) {
    await advanceCorrectionState({ scanId: a.correctionOf, from: correctionBefore, to: correctionState });
  }

  // 7. What the pass measured, turned into supply — the deep and weekly
  //    passes' own step, supplied by their callers rather than decided
  //    here (this file branches on no tier). A hook that throws does not
  //    take the report down with it.
  if (a.afterReport !== undefined && passCost !== null) {
    try {
      await a.afterReport({ report: composed.report, cost: passCost });
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
    because:
      ending.stoppedReason === "site_unreadable" ? (ending.refusal ?? "stage_undeterminable") : "pass_ended",
  });
  return stored;
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

// ── The six stages ──────────────────────────────────────────────────────

interface StageArgs {
  scanId: string;
  bounds: Bounds;
  cost: CostContext;
  domain: CanonicalDomain;
  tier: Tier;
  parameters: TierParameters;
  correction: boolean;
  sections: Sections;
  /** Whose site this pass measures. Absent on the free path, which has no
   *  site and therefore no tracked rivals to size. */
  siteId?: string;
  /** The pass's own start, so a stage that needs a date before the home
   *  document has been read has one that is not `new Date()`. */
  startedAt: Date;
  onStage?: (stage: StageName) => void | Promise<void>;
}

/**
 * The six stages in `STAGES` order, with both ceilings re-checked between
 * every one.
 *
 * Stages two and four report reads that arrive with stage one's own call:
 * `measureDomain` is one call and produces the access rules and the
 * customer's own ranked rows alongside the site's own documents. `STAGES`
 * order is preserved exactly; what differs is when a completed stage is
 * reported, not what it reports. The alternative is splitting
 * `measureDomain` into a read half and a presence half, which changes that
 * module's declared signature — which is why it is not taken here.
 */
async function runStages(a: StageArgs): Promise<void> {
  const { scanId, bounds, cost, domain, sections } = a;

  /** Entry, reported to the in-process bus and to the optional durable
   *  hook, in that order and never one without the other. */
  const enter = async (stage: StageName): Promise<void> => {
    enterStage(scanId, stage);
    await a.onStage?.(stage);
  };

  if (bounds.stopNow() !== null) return;
  await enter("reading_your_site");
  const measurement = await attempt("reading_your_site", () => measureDomain(cost, { domain, tier: a.tier }));
  if (!failed(measurement)) sections.measurement = measurement;
  exitStage(scanId, "reading_your_site");

  // A site whose own home document could not be read — refused by the
  // fetcher, or a read that raised — is not measured by anything after it,
  // and the pass does not pretend otherwise: it stops here, and the ending
  // is `site_unreadable` with the refusal, never `complete` (issue #479).
  if (failed(measurement) || measurement.homeRefusal !== null) {
    bounds.siteUnreadable(failed(measurement) ? null : measurement.homeRefusal);
    return;
  }

  if (bounds.stopNow() !== null) return;
  await enter("reading_access_rules");
  exitStage(scanId, "reading_access_rules");

  if (bounds.stopNow() !== null) return;
  await enter("reading_your_market");
  await readMarket(a);
  exitStage(scanId, "reading_your_market");

  if (bounds.stopNow() !== null) return;
  await enter("checking_your_presence");
  await sizeTrackedRivals(a);
  exitStage(scanId, "checking_your_presence");

  if (bounds.stopNow() !== null) return;
  await enter("asking_the_twelve");
  await askTheTwelve(a);
  exitStage(scanId, "asking_the_twelve");

  if (bounds.stopNow() !== null) return;
  await enter("scoring");
  score(a);
  exitStage(scanId, "scoring");
}

/**
 * §6.6's sizing, over the rivals the customer chose.
 *
 * It runs in the presence stage because that is the stage about presence:
 * stage one already bought the customer's own ranked rows, and this buys
 * the rivals' — §6.3's paid list, "`ranked_keywords`@100 ×rivals". It runs
 * at the tiers whose parameters say so and at no other, which is how
 * §6.4's "never per-rival `ranked_keywords` on the free path" is kept: the
 * free tier's `sizesRivals` is `false` and there is no other door.
 *
 * **Three inputs, and each is read rather than invented.** The rivals are
 * the site's own, in the order the customer chose them. `ownRanked` is the
 * count stage one measured — its `unmeasured` arm reads as the cold-start
 * 0, which `sizeRivals` documents as an ordinary input and which bands
 * every rival against the floors. `previous` is the last stored report's
 * sizing, so a rival this pass could not measure is carried forward with
 * its **earlier** date and `current: false` rather than falling back to
 * "we have never measured this" (REQ-096 c4) — and its absence, where no
 * pass has ever sized, is what makes a rival `awaiting_deep_pass`.
 *
 * Every failure is a leave-alone: a site whose rivals cannot be read, a
 * report that cannot be re-read, a sizing that raised — each leaves
 * `sections.rivalSizes` on the arm that says the pass did not get to it,
 * and the pass carries on. Nothing here throws.
 */
async function sizeTrackedRivals(a: StageArgs): Promise<void> {
  const siteId = a.siteId;
  if (!a.parameters.sizesRivals || siteId === undefined) return;

  // `null` is a site that is not there, which is not "tracks none": the
  // sizing then stays on the arm that says the pass did not get to it,
  // rather than storing a measured zero about a customer nobody read.
  const rivals = await attempt("checking_your_presence", () => trackedRivals(siteId));
  if (failed(rivals) || rivals === null) return;

  const measurement = a.sections.measurement;
  const at = measurement === null ? a.startedAt : measurement.drivers.foundations.at;
  const ownRanked = measurement === null ? 0 : ownRankedValue(measurement.ownRanked);

  const previous = await attempt("checking_your_presence", () => previousSizes(a.domain));
  const sized = await attempt("checking_your_presence", () =>
    sizeRivals(a.cost, {
      rivals,
      ownRanked,
      at,
      // Absent, never `[]`: an empty array says "the last pass sized these
      // and found none", which would make every rival here
      // `added_since_last_sizing` instead of `awaiting_deep_pass`.
      ...(failed(previous) || previous === undefined ? {} : { previous }),
    })
  );
  if (!failed(sized)) a.sections.rivalSizes = sized;
}

/** The customer's own count as a number for the banding. `unmeasured` is
 *  the cold-start 0 — the honest reading and the conservative one: at 0
 *  the winnability bars are 500 and 100, the tightest they go. */
function ownRankedValue(ownRanked: Measured<number>): number {
  return ownRanked.kind === "unmeasured" ? 0 : ownRanked.value;
}

/** The sizing the last stored report carries, or `undefined` where no pass
 *  has sized this domain's rivals yet. */
async function previousSizes(domain: CanonicalDomain): Promise<readonly RivalSize[] | undefined> {
  const stored = await readCurrentReport(domain);
  if (stored === null || stored.rivalSizes.kind === "unmeasured") return undefined;
  return stored.rivalSizes.value;
}

/** §6.7 steps 1–4: profile → measured market → the twelve → their wording.
 *  Each step's failure stops the chain at that step and leaves everything
 *  after it on the arm it was initialised with; nothing downstream is
 *  synthesised from a step that did not answer. */
async function readMarket(a: StageArgs): Promise<void> {
  const { bounds, cost, sections } = a;
  const measurement = sections.measurement;
  if (measurement === null || measurement.text.home === null) return;

  const profile = await attempt("reading_your_market", () =>
    deriveProfile(cost, {
      home: measurement.text.home as string,
      ...(measurement.text.pricing === null ? {} : { pricing: measurement.text.pricing }),
    })
  );
  if (failed(profile)) return;
  sections.profile = profile;
  if (profile.kind === "unmeasured") return;

  if (bounds.stopNow() !== null) return;
  const market = await attempt("reading_your_market", () =>
    deriveMarketSet(cost, { seeds: seedsOf(profile.value) })
  );
  if (failed(market)) return;
  sections.marketRows = market;
  if (market.kind === "unmeasured") return;

  sections.selected = selectTwelve({ profile: profile.value, market: [...market.value] });

  if (bounds.stopNow() !== null) return;
  const questions = await attempt("reading_your_market", () =>
    phraseQuestions(cost, { selected: sections.selected })
  );
  if (!failed(questions)) sections.questions = questions;
}

/** §6.7 step 2 buys suggestions "on the primary seed" — the profile's own
 *  category phrase, in buyer vocabulary. Where the model returned an empty
 *  category the first vocabulary term stands in for it; where it returned
 *  neither there is no seed and the vendor is not called. */
function seedsOf(profile: Profile): string[] {
  for (const candidate of [profile.category, ...profile.vocabulary]) {
    const seed = candidate.trim();
    if (seed !== "") return [seed];
  }
  return [];
}

/** §6.2's free battery: the twelve question-SERPs, live, reading each
 *  SERP's own AI Overview at no extra cost — and, at the tiers whose
 *  parameters say so, §6.2's paid battery beside each of them. The
 *  ceilings are re-checked between every one — this is the multi-call step
 *  §6.5 names, and it is now three calls per question rather than one — and
 *  a question the ceiling stopped us reaching carries `not_attempted`,
 *  which lowers the cards' denominator rather than reading as a miss.
 *
 *  The two records stay the same length as each other and as the twelve:
 *  `serps[i]` and `battery[i]` are the same question's, whatever any of
 *  the three calls did, so the card can pair them by position. */
/**
 * Whose purchase this pass's vendor calls are (#75).
 *
 * A paid pass has a site and buys for that site; the free path has no
 * account and buys for the domain — "the same shape, since a free scan has
 * no account". The two are never shared: `SPEC.md` §6.8 §5's roll-up is
 * stated per customer, and a key without this segment bought a market's
 * SERPs once however many customers tracked it, which made the published
 * cost model wrong in the product's favour.
 *
 * Derived from the pass rather than passed in: `siteId` is already on
 * `StageArgs` and already means exactly this, so a second parameter would
 * be a second chance to disagree with it.
 */
function cacheScope(a: StageArgs): CacheScope {
  return a.siteId === undefined ? { domain: a.domain } : { site: a.siteId };
}

async function askTheTwelve(a: StageArgs): Promise<void> {
  const { bounds, cost, parameters, sections } = a;
  const questions = sections.questions;
  const asked = questions.kind === "unmeasured" ? [] : questions.value;

  for (const question of asked) {
    if (bounds.stopNow() !== null) {
      sections.serps.push(unmeasured("not_attempted", questions.at));
      sections.battery.push(noBattery(questions.at));
      continue;
    }
    const serp = await attempt("asking_the_twelve", () =>
      serpOrganic(cost, {
        query: question.search.keyword,
        mode: parameters.serpMode,
        loadAsyncAiOverview: parameters.asyncAiOverview && !a.correction,
        scope: cacheScope(a),
        freshnessDays: parameters.serpWindowDays,
      })
    );
    sections.serps.push(failed(serp) ? unmeasured("undeterminable", questions.at) : serp);
    sections.battery.push(await askTheBattery(a, question.search.keyword, questions.at));
  }
}

/** The battery nobody bought: both engines on the arm that says we did not
 *  get to them. It is what the free path stores for every question, and
 *  what a ceiling leaves behind — never a `zero`, which would claim the
 *  engines were asked and said nothing. */
function noBattery(at: Date): BatteryAnswers {
  return { aiMode: unmeasured("not_attempted", at), chatgpt: unmeasured("not_attempted", at) };
}

/**
 * §6.2's paid battery for one question: engine 1 (ChatGPT, LLM Scraper)
 * and engine 2 (Google AI Mode). The third column, the AI Overview, was
 * already bought by the SERP above at "0¢ extra" and is not asked for
 * again.
 *
 * **Two calls, and the ceilings are re-checked before each** — §6.5:
 * "`capHit()` is re-checked between calls in any multi-call step", and
 * `bounds.stopNow()` is that check plus the report deadline, exactly as
 * the SERP loop above uses it. An engine the ceiling arrives before is
 * `not_attempted`; the pass keeps going and stores what it has.
 *
 * **An engine that did not answer degrades rather than throwing** (§6.5:
 * "Caps degrade … never throw"). A vendor that raised is `undeterminable`
 * — we asked and could not determine it — which is a different claim from
 * `no_answer`, the engine's own zero, and from `not_attempted`. Nothing
 * here can take the pass down: `attempt` catches, and the ChatGPT engine
 * failing does not stop AI Mode being asked.
 *
 * **AI Mode follows the pass's own SERP mode.** It is a SERP endpoint
 * priced at the SERP rows, and §6.4 rules "Live mode only where a human is
 * waiting" — so the onboarding deep pass buys it live and the scheduled
 * weekly pass buys it standard, which is §6.2's "AI Mode std" for the
 * weekly battery. The LLM Scraper has no live variant to choose: its own
 * type admits `"std"` alone.
 */
async function askTheBattery(a: StageArgs, query: string, at: Date): Promise<BatteryAnswers> {
  const { bounds, cost, parameters } = a;
  if (!parameters.battery) return noBattery(at);

  const chatgpt =
    bounds.stopNow() !== null
      ? unmeasured<AiAnswer>("not_attempted", at)
      : await engineAnswer(at, () => llmScraper(cost, { query, mode: "std", scope: cacheScope(a) }));

  const mode =
    bounds.stopNow() !== null
      ? unmeasured<AiAnswer>("not_attempted", at)
      : await engineAnswer(at, () => aiMode(cost, { query, mode: parameters.serpMode, scope: cacheScope(a) }));

  return { chatgpt, aiMode: mode };
}

/** One engine's answer, with a raise turned into the arm that is true of
 *  it. The vendor's own refusals — a `FREE` context, a cap already hit —
 *  come back as `Measured` arms and pass through untouched. */
async function engineAnswer(
  at: Date,
  work: () => Promise<Measured<AiAnswer>>
): Promise<Measured<AiAnswer>> {
  const answer = await attempt("asking_the_twelve", work);
  return failed(answer) ? unmeasured<AiAnswer>("undeterminable", at) : answer;
}

/** The last stage buys nothing: the rivals, both cards and the coherence
 *  verdict are all counted over SERPs the pass has already paid for
 *  (§6.6's "zero extra cost"). */
function score(a: StageArgs): void {
  const { domain, sections } = a;
  const serps = sections.serps as readonly Measured<MarketSerp>[];
  const readSerps: MarketSerp[] = [];
  for (const serp of serps) if (serp.kind !== "unmeasured") readSerps.push(serp.value);

  const derivation = deriveRivals({ serps: readSerps, ownDomain: domain });
  sections.rivals = measured(derivation.rivals, sections.questions.at);
  sections.sources = derivation.sources;

  sections.presence = buildPresenceCard({
    serps,
    selected: sections.selected,
    ownDomain: domain,
    rivals: derivation.rivals,
  });

  const card = buildAiAnswersCard({
    questions: sections.questions.kind === "unmeasured" ? [] : sections.questions.value,
    serps,
    battery: sections.battery,
    ownDomain: domain,
    coverage: a.parameters.asyncAiOverview && !a.correction ? "async_included" : "cached_only",
  });
  sections.aiAnswers = answersSectionOf({
    card,
    questions: sections.questions,
    rivals: derivation.rivals,
    ownDomain: domain,
    measuredAt: sections.questions.at,
  });

  sections.coherence = checkCoherence({ serps: readSerps, measuredCount: readSerps.length });
}

// ── Composition ─────────────────────────────────────────────────────────

/** BUILD §4.1 module 3's two counts. The opportunities engine (issue #40)
 *  derives them and is not built, so they are `not_attempted` — the arm
 *  that says we did not get to it. A 0 would be a claim about the
 *  customer's site that nobody has made, and the free page card (module 5)
 *  is the same engine's, so it is `null`: a named absent section, never an
 *  empty card. */
function UNMEASURED_SUPPLY(at: Date): SupplySection {
  return { missingPages: unmeasured("not_attempted", at), unquotablePages: unmeasured("not_attempted", at) };
}

function outcomeOf(m: Measured<unknown>): InputOutcome {
  if (m.kind === "unmeasured") return { read: false, because: m.reason };
  return { read: true, empty: m.kind === "zero" };
}

/** A read that found nothing to read: a home document that links to no
 *  pricing page is a fact about the home document, not a failed fetch. */
const READ_AND_EMPTY: InputOutcome = { read: true, empty: true };

function composeReport(a: {
  scanId: string;
  domain: CanonicalDomain;
  tier: Tier;
  stoppedReason: StoppedReason;
  fromIncompleteRescan: boolean;
  sections: Sections;
  startedAt: Date;
  correctionState: CorrectionState;
}): { report: StoredReport; drivers: Drivers; sectionMissing: boolean } {
  const s = a.sections;
  const m = s.measurement;

  // One date: the home document's own read, or — where the pass never got
  // that far — the moment it started. Every `Measured` under the verdict
  // carries it, which `verdictOf` asserts.
  const measuredAt = m === null ? a.startedAt : m.drivers.foundations.at;

  const onPage: Measured<OnPageFacts> = m === null ? unmeasured("not_attempted", measuredAt) : m.onPage;
  const robots: Measured<RobotsPolicy> = m === null ? unmeasured("not_attempted", measuredAt) : m.robots;

  const drivers: Drivers =
    m === null
      ? {
          foundations: unmeasured("not_attempted", measuredAt),
          answerability: unmeasured("not_attempted", measuredAt),
          searchPresence: unmeasured("not_attempted", measuredAt),
          aiPresence: unmeasured("not_attempted", measuredAt),
        }
      : { ...m.drivers, aiPresence: aiPresenceOf({ serps: s.serps, ownDomain: a.domain, at: measuredAt }) };

  const inputs: Readonly<Record<ScanInput, InputOutcome>> = {
    home_document: outcomeOf(onPage),
    pricing_document:
      m === null
        ? { read: false, because: "not_attempted" }
        : m.pricing === null
          ? READ_AND_EMPTY
          : outcomeOf(m.pricing.facts),
    access_rules: outcomeOf(robots),
    business_profile: outcomeOf(s.profile),
    market_suggestions: outcomeOf(s.marketRows),
    own_ranked_rows: outcomeOf(drivers.searchPresence),
    question_serps: outcomeOf(foldSerps(s.serps, measuredAt)),
  };

  const verdict: Verdict = verdictOf({ domain: a.domain, measuredAt, drivers, inputs, robots });

  const market: Measured<MarketSet> =
    s.profile.kind === "unmeasured"
      ? unmeasured(s.profile.reason, measuredAt)
      : s.marketRows.kind === "unmeasured"
        ? unmeasured(s.marketRows.reason, measuredAt)
        : {
            kind: s.marketRows.kind,
            value: marketSetOf({ profile: s.profile.value, suggestions: s.marketRows.value }),
            at: measuredAt,
          };

  const report = assembleReport({
    scanId: a.scanId,
    domain: a.domain,
    tier: a.tier,
    stoppedReason: a.stoppedReason,
    fromIncompleteRescan: a.fromIncompleteRescan,
    verdict,
    blockedAgents: blockedAgentsOf(robots),
    aiAnswers: s.aiAnswers,
    // A pass that never bought a SERP has no card to show, and an empty
    // one would read as "we looked and nobody is there". `null` is the
    // screen's own named-absent arm.
    presence: s.presence,
    supply: UNMEASURED_SUPPLY(measuredAt),
    freePage: null,
    market,
    questions: s.questions,
    serps: s.serps,
    rivals: s.rivals,
    rivalSizes: s.rivalSizes,
    ownRanked: m === null ? unmeasured("not_attempted", measuredAt) : m.ownRanked,
    sources: s.sources,
    onPage,
    robots,
    coherence: s.coherence,
    correctionState: a.correctionState,
  });

  const sectionMissing =
    s.aiAnswers === null ||
    s.presence === null ||
    verdict.missing.length > 0 ||
    market.kind === "unmeasured" ||
    s.questions.kind === "unmeasured" ||
    s.serps.some((serp) => serp.kind === "unmeasured");

  return { report, drivers, sectionMissing };
}

/** The twelve SERPs as the one input the verdict reads them as: measured
 *  where any of them was, and carrying the reason where none was. */
function foldSerps(serps: readonly Measured<SerpResult>[], at: Date): Measured<null> {
  for (const serp of serps) {
    if (serp.kind !== "unmeasured") return measured(null, at);
  }
  const first = serps[0];
  return unmeasured(first !== undefined && first.kind === "unmeasured" ? first.reason : "not_attempted", at);
}

function logPass(fields: {
  scanId: string;
  tier: Tier;
  stoppedReason: StoppedReason;
  status: ScanStatus;
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
registerCorrectionRunner((a) =>
  runScan({ domain: a.domain, tier: a.tier, correctionOf: a.correctionOf })
);
