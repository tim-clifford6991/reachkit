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
import {
  CACHE_WINDOWS_D,
  FREE_RESCAN_WINDOW_D,
  PRICE_BOOK,
  SELECTION,
  SERP_RIVAL_SIZING,
  TIMING,
  VENDOR,
} from "@/lib/config/constants";
import { captureInBackground } from "@/lib/analytics";
import type { CapName, CostContext } from "@/lib/costs";
import { dbAdmin } from "@/lib/db";
import type { RobotsPolicy } from "@/lib/egress/types";
import { checkCoherence, type CoherenceVerdict } from "@/lib/market/coherence/check";
import { nextCorrectionState, type CorrectionState } from "@/lib/market/coherence/state";
import { buildAiAnswersCard, type BatteryAnswers } from "@/lib/market/questions/matrix";
import {
  deriveMarketSet,
  joinMarketSets,
  marketSetOf,
  type MarketSet,
  type SuggestionRow,
} from "@/lib/market/questions/market-set";
import { phraseQuestions, type Question } from "@/lib/market/questions/phrase";
import { deriveProfile, type Profile } from "@/lib/market/questions/profile";
import { selectTwelve, type SelectedSearch } from "@/lib/market/questions/select";
import { isShort, poolFrom, seedLadder, selectWidened, type PoolRow } from "@/lib/market/questions/widen";
import { serpRivalCandidates } from "@/lib/market/rivals/candidates";
import { deriveRivals, type RivalCandidate } from "@/lib/market/rivals/derive";
import { buildPresenceCard, type PresenceCard } from "@/lib/market/rivals/presence";
import { sizeRivals, type RivalSize } from "@/lib/market/rivals/size";
import type { RivalSizeBand } from "@/lib/market/rivals/band";
import { trackedRivals } from "@/lib/market/rivals/tracked";
import type { MarketSerp } from "@/lib/market/views";
import { freePageOf } from "@/lib/opportunities/free-page";
import { aiPresenceOf, measureDomain, type DomainMeasurement } from "@/lib/measure";
import { measured, measuredZero, unmeasured, type Measured } from "@/lib/measure/measured";
import type { InputOutcome, ScanInput } from "@/lib/measure/partition";
import type { OnPageFacts } from "@/lib/measure/parse";
import type { Drivers } from "@/lib/measure/score";
import { verdictOf, type Verdict } from "@/lib/measure/verdict";
import { aiMode, llmScraper, serpOrganic } from "@/lib/vendors/dataforseo";
// By file, not through the barrel: ARCHITECTURE fixes that barrel's
// exported set at BP-008's six functions and `tests/vendors/never-list.test.ts`
// asserts it, so a predicate about vendor failures is imported the way the
// vendor types already are (issue 865).
import { worthAskingAgain } from "@/lib/vendors/dataforseo/envelope";
import type { VendorFailure } from "@/lib/costs";
import type { AiAnswer, CacheScope, RankedRow, SerpResult } from "@/lib/vendors/dataforseo/types";
import {
  MARKET_PURSE_CENTS,
  PAID_SERP_FANOUT,
  SERP_FANOUT,
  STAGE_BUDGETS,
  affordsSeed,
  questionsAffordable,
  twelveCentsAfter,
  withStageBudget,
  type StageOutcome,
} from "./budgets";
import { withScanBounds, withStoredPassSpend, type Bounds } from "./ceilings";
import { advanceCorrectionState, readCorrectionFacts, registerCorrectionRunner } from "./correction";
import { parseDomain, type CanonicalDomain } from "./domain";
import { marketTooSmall, stoppedOnCeiling } from "./market-floor";
import { readCurrentReport, readScanReport } from "./report";
import type { AiAnswersSection, StoppedReason, StoredReport, SupplySection, Tier } from "./report";
import { answersSectionOf, blockedAgentsOf } from "./sections";
import { checkSite, type CrawlReading } from "@/lib/site-issues/checks";
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
  /** Whether the ceiling below is raced — the free report's, which a
   *  visitor is waiting on. A paid pass reads its ceiling between calls, as
   *  it reads the cap. */
  deadlineApplies: boolean;
  /** The pass's time ceiling, in seconds (issue 855). The free report's
   *  `reportCeilingS`; a paid pass's `paidPassCeilingS`, which fits inside
   *  the job invocation it runs in. The free 50 s used to bound every tier,
   *  and a deep pass stopped asking its twelve after three SERPs. */
  ceilingS: number;
  /** How many of the twelve are bought at once: the free path's waves
   *  (`SERP_FANOUT`, for its stage budget), a paid pass's one wave
   *  (`PAID_SERP_FANOUT`, issue 855). */
  serpFanout: number;
  /** A free scan is never started outside admission control: it adopts the
   *  row the claim already inserted and never inserts a second. The deep
   *  pass is the same (owner ruling, 2026-09-16): setup claims its row when
   *  it accepts the founder's address — `claimOnboardingPass` — so the
   *  rival suggestion it spends has a row to be ledgered against, and the
   *  pass adopts that row rather than inserting its own. */
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
  /** Whether each stage runs inside its own time-and-spend budget
   *  (`STAGE_BUDGETS`, `src/lib/scan/budgets.ts`) — issue #539.
   *
   *  The free path's, and only the free path's, because the two sums those
   *  budgets fit inside are the free path's: `TIMING.reportTargetS` and
   *  `CAPS.FREE_C`. The deep pass is released at ten minutes rather than
   *  stopped and the weekly pass runs on the standard queue, so for both
   *  the cap re-checked between stages is the whole of the bound and a
   *  per-stage clock would only cut short work nobody is waiting on.
   *
   *  A row here rather than a tier test at the seam, for the same reason
   *  every other parameter is one: the pipeline below branches on no tier. */
  stageBudgets: boolean;
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
  /** SPEC §6 thin markets (2026-09-16): how many `keyword_suggestions`
   *  beyond the first seed a pass short of twelve may buy — at most
   *  `SELECTION.maxExtraSeeds`, inside the pass's own cap. The free path's
   *  too (owner ruling 2026-09-17, issue 835): a new site's category seed
   *  can answer nothing, and a free report with no questions is nothing a
   *  visitor can value. There the purchases are paid from the purse the
   *  market shares with the twelve (`budgets.ts`), and a seed is bought only
   *  while that purse still holds it and the SERPs of every question
   *  already selected (`affordsSeed`). */
  extraSeeds: number;
  /** When the seed ladder has read enough to stop buying seeds. `twelve`:
   *  SPEC §6's own rule, twelve questions at the first volume step.
   *  `questions`: the free path's (owner ruling 2026-09-17, issue 835) —
   *  "stopping as soon as it has questions", at any step: its 12¢ is
   *  spent on the report a visitor reads, not on a fuller twelve. */
  ladderStopsAt: "twelve" | "questions";
  /** Issues 770 and 796: how the owner hears of a pass that found too little
   *  market. `immediate` mails at once (a site's first, deep pass);
   *  `digest` is folded into the owner's Monday digest
   *  (`./weekly/market-digest`); `none` has no site to speak of. */
  marketTooSmallAlert: "immediate" | "digest" | "none";
  /** Issue 873: whether the number of questions is decided by the money
   *  left to ask them with. True on the free path, whose market ladder and
   *  twelve share one purse (issue 835) — a pass that widened its market
   *  has less left for the SERPs, and a question it cannot buy a SERP for is
   *  a row with no answer in the product's shop window. False on the paid
   *  tiers: they buy all twelve, and issue 855's ceiling is what bounds
   *  them. */
  questionsFitThePurse: boolean;
  /** The wall clock one question's SERP request may hold (issue 875, and
   *  its value reverted by issue 877).
   *
   *  Issue 875 gave the free path five seconds on the owner's ruling; the
   *  first free scan after it shipped aborted five of its seven calls and
   *  paid for all of them, because these calls take longer than that. Every
   *  tier is back on `VENDOR.requestAbortMs`. The parameter stays, and the
   *  transport still carries the bound per call: that shape is what lets a
   *  tier be given its own figure once the recorded durations say what one
   *  should be. */
  serpAbortMs: number;
}

export const TIER_PARAMETERS: Readonly<Record<Tier, TierParameters>> = Object.freeze({
  free: Object.freeze({
    cap: "FREE",
    serpMode: "live",
    asyncAiOverview: true,
    deadlineApplies: true,
    ceilingS: TIMING.reportCeilingS,
    serpFanout: SERP_FANOUT,
    adoptsClaim: true,
    servesStoredReport: true,
    sizesRivals: false,
    battery: false,
    stageBudgets: true,
    serpWindowDays: CACHE_WINDOWS_D.serp,
    extraSeeds: SELECTION.maxExtraSeeds,
    ladderStopsAt: "questions",
    marketTooSmallAlert: "none",
    questionsFitThePurse: true,
    serpAbortMs: VENDOR.requestAbortMs,
  }),
  deep: Object.freeze({
    cap: "DEEP",
    serpMode: "live",
    asyncAiOverview: false,
    deadlineApplies: false,
    ceilingS: TIMING.paidPassCeilingS,
    serpFanout: PAID_SERP_FANOUT,
    adoptsClaim: true,
    servesStoredReport: false,
    sizesRivals: true,
    battery: true,
    stageBudgets: false,
    serpWindowDays: CACHE_WINDOWS_D.serp,
    extraSeeds: SELECTION.maxExtraSeeds,
    ladderStopsAt: "twelve",
    marketTooSmallAlert: "immediate",
    questionsFitThePurse: false,
    serpAbortMs: VENDOR.requestAbortMs,
  }),
  weekly: Object.freeze({
    cap: "WEEKLY",
    serpMode: "std",
    asyncAiOverview: false,
    deadlineApplies: false,
    ceilingS: TIMING.paidPassCeilingS,
    serpFanout: PAID_SERP_FANOUT,
    adoptsClaim: false,
    servesStoredReport: false,
    sizesRivals: true,
    battery: true,
    stageBudgets: false,
    serpWindowDays: CACHE_WINDOWS_D.serpWeeklyRecheck,
    extraSeeds: SELECTION.maxExtraSeeds,
    ladderStopsAt: "twelve",
    marketTooSmallAlert: "digest",
    questionsFitThePurse: false,
    serpAbortMs: VENDOR.requestAbortMs,
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
  /** §6.6's sizing, at the two tiers whose parameters say so. Two halves,
   *  in this order: the rivals the customer chose, sized by
   *  `checking_your_presence`, then the domains this pass's own twelve top
   *  tens hold, sized in `scoring` once those SERPs exist (issue 901).
   *  A pass that could read neither leaves the arm `freshSections` gave
   *  it — never a zero, which would satisfy every winnability bar.
   *
   *  One entry per domain: a SERP candidate the customer also tracks is
   *  not a second element, and a fresh measurement replaces one this pass
   *  carried forward from an earlier one rather than sitting beside it. */
  rivalSizes: Measured<RivalSize[]>;
  /** The rows sizing read, by rival (#778) — SPEC §6's thin-market pool
   *  selects over them. `null` until sizing has been attempted, which is
   *  also what stops a pass that sized early from sizing twice. */
  rivalRows: Map<string, readonly RankedRow[]> | null;
  sources: readonly string[];
  aiAnswers: AiAnswersSection | null;
  presence: PresenceCard | null;
  coherence: CoherenceVerdict;
  /** The site profile's one crawl, as SPEC §9's checks read it. `null` until
   *  the crawl has run — and after a crawl that raised, which the checks
   *  report as not run rather than as a site with no issues. */
  siteCrawl: CrawlReading | null;
  /**
   * **True from the moment the report is being composed** (issue 875).
   *
   * A stage the clock cut off cannot cancel a call already in flight, so an
   * answer can arrive after the stage was abandoned — and it used to be
   * dropped, although it had been bought and paid for: on the free scans of
   * 2026-09-17 two SERPs answered and were thrown away. The money is spent
   * either way, so the honest thing is to keep what came back while there
   * is still a report to keep it in. This is the line where there stops
   * being one: `composeReport` reads `sections` from here on, and a write
   * after it would be a mutation of a report already composed — which is
   * the defect issue #539's own guard exists to prevent.
   */
  sealed: boolean;
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
    sealed: false,
    questions: unmeasured("not_attempted", at),
    serps: [],
    battery: [],
    rivals: unmeasured("not_attempted", at),
    rivalSizes: unmeasured("not_attempted", at),
    rivalRows: null,
    sources: [],
    aiAnswers: null,
    presence: null,
    coherence: { verdict: "unjudgeable", measuredCount: 0 },
    siteCrawl: null,
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
  error: { message: string; code?: string } | null;
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
  /** What the row already carries — setup's rival suggestion, on the
   *  onboarding row (issue 798). Counted into the pass's own context. */
  costCents?: number | string | null;
}

/** The running row already claimed for this pass, or `null`: for a free
 *  scan the one admission inserted for the domain, and for a pass that
 *  belongs to a site the one setup claimed for that site. */
async function adoptClaimedRow(a: {
  domain: CanonicalDomain;
  tier: Tier;
  siteId?: string;
}): Promise<RunningScanRow | null> {
  const running = untyped(dbAdmin())
    .from<RunningScanRow>("scans")
    .select("id, fromIncompleteRescan:from_incomplete_rescan, costCents:cost_cents")
    .eq("tier", a.tier)
    .eq("status", "running");
  const { data, error } = await (a.siteId === undefined
    ? running.eq("domain", a.domain)
    : running.eq("site_id", a.siteId)
  )
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
 * the row admission already claimed, the deep pass adopts the one
 * `claimOnboardingPass` claimed, and the weekly pass claims its own (that
 * claim is also the once-a-week guarantee and carries `week_start`, which
 * is why it stays `runWeekly`'s); every other pass claims here, and
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
}): Promise<{ claimed: boolean }> {
  const { error } = await untyped(dbAdmin())
    .from<{ id: string }>("scans")
    .insert({
      id: a.scanId,
      domain: a.domain,
      tier: a.tier,
      status: "running",
      ...(a.siteId === undefined ? {} : { site_id: a.siteId }),
    });
  // The row already exists: a claim made earlier under the same id.
  if (error?.code === UNIQUE_VIOLATION) return { claimed: false };
  if (error) throw new Error(`runScan: could not claim the scan row: ${error.message}`);
  return { claimed: true };
}

const UNIQUE_VIOLATION = "23505";

/**
 * Claims the onboarding pass's row for one site, before anything is spent
 * against it, and answers its id (owner ruling, 2026-09-16).
 *
 * Setup calls this when it accepts the founder's address, so the rival
 * suggestion a stated market needs — `competitors_domain`, a vendor call —
 * is ledgered against a row that exists (`fetches.scan_id` is `not null`).
 * The deep pass calls it again as it starts, then adopts the row
 * (`adoptsClaim`), so a founder whose address was never sought through
 * setup still gets exactly one.
 *
 * **One row per site, held by the primary key.** The id is derived from
 * the site id, so a second claim — the same founder's next address, a
 * request racing another, the pass itself — conflicts on insert rather
 * than adding a row, and only moves the address the row is for, while it
 * is still running. Setup completes once, so a site has one onboarding
 * pass, and a pass that has already ended is not re-opened: the pass
 * started for it adopts nothing and stops.
 *
 * **A founder who abandons setup leaves the row `running`**, with no
 * report, no `is_current`, no network hash and no cost beyond the ledgered
 * suggestion. No guard is held by it: admission's in-flight bound and the
 * stuck-row sweep are both the free tier's, the account's own screens open
 * only once setup is complete, and account deletion takes it with the site.
 */
export async function claimOnboardingPass(a: { siteId: string; domain: string }): Promise<string> {
  const parsed = parseDomain(a.domain);
  if (!parsed.ok) throw new Error(`claimOnboardingPass: ${parsed.problem}`);
  const scanId = await onboardingPassId(a.siteId);
  const { claimed } = await claimPassRow({
    scanId,
    domain: parsed.domain,
    tier: "deep",
    siteId: a.siteId,
  });
  if (!claimed) {
    const { error } = await untyped(dbAdmin())
      .from<{ id: string }>("scans")
      .update({ domain: parsed.domain, created_at: new Date().toISOString() })
      .eq("id", scanId)
      .eq("status", "running");
    if (error) throw new Error(`claimOnboardingPass: could not re-claim ${scanId}: ${error.message}`);
  }
  return scanId;
}

/** A UUID named by the site (the version-5 layout over SHA-1): the same
 *  site always names the same row, and no two sites name one. */
async function onboardingPassId(siteId: string): Promise<string> {
  const name = new TextEncoder().encode(`reachkit/onboarding-pass/${siteId}`);
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-1", name)).slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
  /** The category the founder confirmed — `sites.category` on a paid pass,
   *  the corrected one on the free report's correction. Where present it is
   *  the market's seed ahead of the inferred category (SPEC §0: the category
   *  "fixes the twelve questions"), and its words join the relevance guard's
   *  support set. Absent, the pass seeds from the profile as before. */
  category?: string;
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
  let priorCents = 0;
  // A correction never went through admission, so there is no claimed row
  // to adopt: its row is claimed by the correction seam below (#786).
  if (parameters.adoptsClaim && a.correctionOf === undefined) {
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
  const { ending } = await withScanBounds(
    {
      scanId,
      startedAt,
      cap: parameters.cap,
      ceilingS: parameters.ceilingS,
      deadlineApplies: parameters.deadlineApplies,
      priorCents,
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
        });
      } finally {
        spend.cents = cost.spentCents();
        spend.degraded = cost.degraded();
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
  sections.sealed = true;
  const composed = composeReport({
    scanId,
    domain,
    tier: a.tier,
    ...(a.category === undefined ? {} : { category: a.category }),
    stoppedReason,
    fromIncompleteRescan,
    sections,
    startedAt,
    correctionState,
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
  let stored: { scanId: string; status: ScanStatus };
  try {
    stored = await storeCurrentReport({
      report: composed.report,
      ...(a.siteId === undefined ? {} : { siteId: a.siteId }),
      ...(a.correctionOf === undefined ? {} : { supersedesScanId: a.correctionOf }),
      drivers: composed.drivers,
      degraded: spend.degraded || composed.sectionMissing,
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

  // 8. #770: a paid pass (one with a site) that found too little market
  //    tells the owner at once where its parameters say `immediate`; a
  //    `digest` pass waits for the owner's Monday digest (issue 796). Imported
  //    at the call, as `src/jobs/run.ts` does; `reportIncident` never throws.
  if (composed.marketTooSmall && a.siteId !== undefined && parameters.marketTooSmallAlert === "immediate") {
    const { reportIncident } = await import("@/lib/mail/ops");
    await reportIncident({ occasion: "market-too-small", scanId, tier: a.tier });
  }
  return stored;
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
  /** `RunScanArgs.category`, carried to the market stage. */
  category?: string;
}

/**
 * The six stages in `STAGES` order, each inside its own budget, with both
 * of the pass's ceilings re-checked between every one.
 *
 * Stages two and four report reads that arrive with stage one's own call:
 * `measureDomain` is one call and produces the access rules and the
 * customer's own ranked rows alongside the site's own documents. `STAGES`
 * order is preserved exactly; what differs is when a completed stage is
 * reported, not what it reports. The alternative is splitting
 * `measureDomain` into a read half and a presence half, which changes that
 * module's declared signature — which is why it is not taken here.
 *
 * **Each stage is bounded by its own budget, not only by the pass's**
 * (issue #539). Before this, one overall ceiling was the only bound, so
 * whichever stage was slow consumed all of it and every later stage read
 * `not_attempted` — which is why no production free scan had ever reached
 * `complete`. A stage that spends its own budget now ends *there*: it emits
 * no exit event (`stages.ts`: "a stage the ceilings cut off emits no
 * `done: true`"), its sections keep the `not_attempted` arm they were
 * initialised with, and the pass goes on to the next stage and keeps
 * buying. The pass's own ceilings are unchanged and still end it.
 */
async function runStages(a: StageArgs): Promise<void> {
  const { scanId, bounds, cost, domain, sections } = a;

  /** Entry, recorded on the scan's own log and reported to the optional
   *  durable hook, in that order and never one without the other. */
  const enter = async (stage: StageName): Promise<void> => {
    await enterStage(scanId, stage);
    await a.onStage?.(stage);
  };

  /** One stage's work, inside that stage's own budget. The `Bounds` handed
   *  down answers for the stage's ceilings as well as the pass's, so every
   *  multi-call step that already re-reads `stopNow()` between calls starts
   *  respecting its stage's budget with no line of its own changing. */
  const inBudget = <T>(
    stage: StageName,
    work: (b: Bounds, abandoned: () => boolean) => Promise<T>,
    cents?: number
  ): Promise<StageOutcome<T>> =>
    withStageBudget(
      { stage, bounds, cost, applies: a.parameters.stageBudgets, ...(cents === undefined ? {} : { cents }) },
      work
    );

  if (bounds.stopNow() !== null) return;
  await enter("reading_your_site");
  const read = await inBudget("reading_your_site", () =>
    attempt("reading_your_site", () => measureDomain(cost, { domain, tier: a.tier }))
  );
  // **A pass whose deadline fired writes nothing more** (issue 607). The
  // report is composed from `sections` the moment the deadline wins, and
  // nothing in flight can be cancelled — so every write below an `await`
  // in this function reads `bounds.abandoned()` first.
  if (bounds.abandoned()) return;
  // Stage one's budget ends the pass, not just the stage: nothing after it
  // measures anything without the site's own documents. It ends by the
  // column that ran out — never `complete`, never §479's refusal, which
  // would blame the customer's domain for a budget of our own (#539).
  if (read.spent) {
    bounds.stageExhausted(read.reason);
    return;
  }
  const measurement = read.value;
  if (!failed(measurement)) sections.measurement = measurement;
  await exitStage(scanId, "reading_your_site");

  // A site whose own home document could not be read — refused by the
  // fetcher, or a read that raised — is not measured by anything after it,
  // and the pass does not pretend otherwise: it stops here, and the ending
  // is `site_unreadable` with the refusal, never `complete` (issue #479).
  if (failed(measurement) || measurement.homeRefusal !== null) {
    bounds.siteUnreadable(failed(measurement) ? null : measurement.homeRefusal);
    return;
  }

  // SPEC.md §2: "The scan builds the site profile" — up to 100 pages from
  // the sitemap and internal links, one run per scan, inside the existing
  // caps (§12 ruling 8, 2026-09-12). It belongs to this stage because this
  // is the stage that reads the customer's own site, and it runs at every
  // tier for the same reason every other stage does: the weekly pass is
  // this pipeline, so §5's "the weekly pass refreshes the profile" is this
  // call under the weekly cap rather than a second scheduler.
  //
  // **What this call does at which tier.** Every tier crawls, classifies
  // and stores the inventory, the page count and the site name — the site
  // name off the home document itself, with no model call. The voice
  // summary, the products and the claims are the profile's inference half
  // and derive at the paid tiers only: `tests/llm/budget.test.ts` pins the
  // free pass at two nano calls, which is 30 s of the 60 the platform
  // allows this invocation, and a third would not fit. The deep pass runs
  // in the background once setup is submitted and seeds the founder's
  // voice from it (issue 839); the weekly pass refreshes it after that.
  //
  // **Its failure is not this stage's verdict.** `attempt` exists to turn a
  // raised stage into `stage_undeterminable` — a statement about what the
  // *measurement* could not determine, which the report then carries. The
  // profile contributes nothing to the report, so a profile that could not
  // be built says nothing about the measurement and must not wear that
  // word: `tests/scan/free/vendor-failure.test.ts` reads exactly this, and
  // a pass whose ranked-keywords call failed at the vendor would otherwise
  // report a second, unrelated undeterminable stage. Its own event says
  // what actually happened, and the pass continues either way.
  if (bounds.stopNow() === null) {
    try {
      const { buildSiteProfileWithCrawl } = await import("@/lib/site-profile");
      const { readingOf } = await import("@/lib/site-issues");
      const { crawl } = await buildSiteProfileWithCrawl(cost, {
        domain,
        // `CanonicalDomain` is the branded string itself, and the home
        // address the measurement read is `https://<domain>/` — the same
        // one `measureDomain` builds, whose own helper is private to that
        // module. The crawl re-reads nothing: this address is row one of
        // the inventory and is already in the `fetches` cache.
        homeUrl: `https://${domain}/`,
        homeHtml: null,
        sitemaps: measurement.robots.kind === "unmeasured" ? [] : measurement.robots.value.sitemaps,
        tier: a.tier,
      });
      // SPEC §9: the technical-issue checks run over exactly this crawl —
      // the one run, nothing fetched beyond its set (2026-09-12).
      if (!bounds.abandoned()) sections.siteCrawl = readingOf(crawl);
    } catch (error) {
      console.log(
        JSON.stringify({
          event: "site_profile_undeterminable",
          because: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  // Reports the access rules stage one already read: it buys nothing and
  // waits for nothing, so it has nothing to spend its budget on.
  if (bounds.stopNow() !== null) return;
  await enter("reading_access_rules");
  await exitStage(scanId, "reading_access_rules");

  if (bounds.stopNow() !== null) return;
  await enter("reading_your_market");
  // The market spends from the purse it shares with the twelve, and the
  // twelve get what it left (issue 835): an extra seed is only ever bought
  // with the SERPs of questions the pass does not have.
  const marketFromCents = cost.spentCents();
  const market = await inBudget(
    "reading_your_market",
    (b, abandoned) => readMarket({ ...a, bounds: b }, abandoned),
    MARKET_PURSE_CENTS
  );
  const twelveCents = twelveCentsAfter(cost.spentCents() - marketFromCents);
  // An abandoned pass reports no exit either: a stage the ceilings cut off
  // emits no `done: true` (`stages.ts`), and the ending is already out.
  if (bounds.abandoned()) return;
  if (!market.spent) await exitStage(scanId, "reading_your_market");

  // No stage-abandonment guard is threaded here, and none is owed:
  // `sizesRivals` is false on the free path and the budget applies on no
  // other, so on every pass this stage can be abandoned on, it returns
  // before it awaits anything at all. Its one write still reads the pass's
  // own `abandoned()`, which costs nothing.
  if (bounds.stopNow() !== null) return;
  await enter("checking_your_presence");
  const presence = await inBudget("checking_your_presence", (b) => sizeTrackedRivals({ ...a, bounds: b }));
  if (bounds.abandoned()) return;
  if (!presence.spent) await exitStage(scanId, "checking_your_presence");

  if (bounds.stopNow() !== null) return;
  await enter("asking_the_twelve");
  const twelve = await inBudget(
    "asking_the_twelve",
    (b, abandoned) => askTheTwelve({ ...a, bounds: b }, abandoned),
    twelveCents
  );
  if (bounds.abandoned()) return;
  if (!twelve.spent) await exitStage(scanId, "asking_the_twelve");

  // Scoring itself buys nothing and is synchronous — it counts over SERPs
  // already paid for (§6.6's "zero extra cost"). Its budget row is the CPU
  // the count is allowed, and there is no await inside `score` for a race
  // to preempt, so it is not wrapped: a synchronous call cannot be cut off.
  //
  // The one purchase in this stage is `sizeSerpRivals` (issue 901), and it
  // is here because this is the first moment the twelve's own top tens
  // exist: the stage that asks them is the stage before. It runs at the
  // tiers whose `sizesRivals` says so and buys nothing at any other, so
  // the free path's 0¢ budget row for this stage still describes it.
  if (bounds.stopNow() !== null) return;
  await enter("scoring");
  await sizeSerpRivals(a);
  if (bounds.abandoned()) return;
  score(a);
  await exitStage(scanId, "scoring");
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
  // A thin market sized the rivals already, inside `reading_your_market`
  // (SPEC §6 thin markets): the same rows are never bought twice.
  if (a.sections.rivalRows !== null) return;
  const rivalRows = new Map<string, readonly RankedRow[]>();
  a.sections.rivalRows = rivalRows;

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
      onRows: (domain, rows) => {
        rivalRows.set(domain, rows);
      },
    })
  );
  if (!failed(sized) && !a.bounds.abandoned()) a.sections.rivalSizes = sized;
}

/**
 * **The rivals of the questions this pass actually asked** (issue 901).
 *
 * `sizeTrackedRivals` above sizes the set the customer chose, and nothing
 * fed it the pass's own market: a pass that selected twelve right-sized
 * questions banded every one of them against domains that never appeared
 * in their SERPs. Winnability reads a top-ten domain's ranked count
 * (`rankedCountsFromSizes` → `rankedCountsFor`), so a domain nobody sized
 * is `undeterminable` and cannot satisfy a bar; and the report's rivals
 * are ordered and filtered by the bands this pass holds (issue 858), so
 * an unsized giant outranked the reachable competitor in the site's own
 * top ten. Both read `sections.rivalSizes`, so both are fixed by putting
 * the right domains in it.
 *
 * **The candidates are the pass's own twelve top tens**, ranked and
 * selected by `serpRivalCandidates`. Nothing stale reaches them: no
 * `previous` is supplied, so a domain this call could not measure says
 * `budget_reached` rather than borrowing a sizing from a pass whose
 * questions these are not.
 *
 * **Reusing what is already bought.** A domain this pass has already
 * sized as a tracked rival is skipped outright, and a domain sized by an
 * earlier pass inside §6.4's 30-day rival window is served from the
 * cache, which is free and does not touch the cap. The rows are not
 * pooled: SPEC §6's thin-market pool is what *selection* chose over, and
 * selection is two stages behind by the time this runs.
 *
 * **Inside the existing budgets, and it says when it ran out.** The pass's
 * own cap and ceilings are unchanged and no cap is raised: the sizing
 * spends from a purse of its own (`withPurse`), bounded by
 * `SERP_RIVAL_SIZING` and by what the pass has left after the reserve the
 * opportunity typing still needs. A candidate the purse could not reach is
 * stored `unsized` with `budget_reached` — said in the report, never
 * silently replaced by an unrelated set.
 *
 * Every failure is a leave-alone, exactly as the tracked sizing's are:
 * nothing here throws and nothing downstream is synthesised.
 */
async function sizeSerpRivals(a: StageArgs): Promise<void> {
  const { bounds, cost, sections } = a;
  if (!a.parameters.sizesRivals) return;
  // The one purchase below an `await enter(...)` in this pipeline, so it
  // reads both ceilings itself: a pass the deadline has already ended does
  // not buy, and `score` still runs over what it has.
  if (bounds.stopNow() !== null || bounds.abandoned()) return;

  const serps: MarketSerp[] = [];
  for (const serp of sections.serps as readonly Measured<MarketSerp>[]) {
    if (serp.kind !== "unmeasured") serps.push(serp.value);
  }
  if (serps.length === 0) return;

  // Already measured **in this pass**: a tracked rival sized a moment ago
  // is not bought twice. One carried forward from an earlier pass is not
  // in this set, and is re-measured rather than left to band a question
  // this pass introduced.
  const current = new Set<string>();
  if (sections.rivalSizes.kind !== "unmeasured") {
    for (const size of sections.rivalSizes.value) {
      if (size.state === "sized" && size.current) current.add(size.domain);
    }
  }

  const candidates = serpRivalCandidates({
    serps,
    ownDomain: a.domain,
    max: SERP_RIVAL_SIZING.candidatesMax,
  }).filter((domain) => !current.has(domain));
  logSerpCandidates(candidates.length, current.size);
  if (candidates.length === 0) return;

  const measurement = sections.measurement;
  const at = measurement === null ? a.startedAt : measurement.drivers.foundations.at;
  const ownRanked = measurement === null ? 0 : ownRankedValue(measurement.ownRanked);
  const purse = Math.min(
    SERP_RIVAL_SIZING.candidatesMax * PRICE_BOOK.RANKED_RIVAL_COST_C,
    Math.max(0, bounds.remainingCents() - SERP_RIVAL_SIZING.reserveCents)
  );

  const sized = await attempt("scoring", () =>
    sizeRivals(withPurse(cost, purse), {
      rivals: candidates,
      ownRanked,
      at,
      neverSizedBecause: "budget_reached",
    })
  );
  if (failed(sized) || sized.kind === "unmeasured" || bounds.abandoned()) return;
  sections.rivalSizes = joinSizes(sections.rivalSizes, sized.value, at);
}

/** The two halves of `rivalSizes`, as one entry per domain.
 *
 *  A domain the held value already carries keeps its place. It is replaced
 *  only by a **measurement this pass took** — never by an `unsized` entry,
 *  which would demote a rival carried forward with its earlier date into
 *  "we have never measured this" (REQ-096 c4). */
function joinSizes(
  held: Measured<RivalSize[]>,
  fresh: readonly RivalSize[],
  at: Date
): Measured<RivalSize[]> {
  const entries: RivalSize[] = held.kind === "unmeasured" ? [] : [...held.value];
  for (const entry of fresh) {
    const index = entries.findIndex((existing) => existing.domain === entry.domain);
    if (index === -1) {
      entries.push(entry);
      continue;
    }
    if (entry.state === "sized") entries[index] = entry;
  }
  return entries.length === 0 ? measuredZero<RivalSize[]>(entries, at) : measured(entries, at);
}

/** One pass's cost context, narrowed to a purse — the same arrangement
 *  `stageBounds` makes for a stage's `Bounds`, and for the same reason: a
 *  multi-call step that already re-reads `capHit()` between calls starts
 *  respecting a tighter bound with no line of its own changing.
 *
 *  It never widens anything: the pass's own cap, the product's daily one
 *  and the site's daily one are all still read through the context it
 *  wraps, and spend is still ledgered by that context. A cache hit costs
 *  nothing and so consumes none of the purse, which is what lets a later
 *  pass re-read every candidate inside §6.4's rival window for free. */
function withPurse(cost: CostContext, cents: number): CostContext {
  const spentAtEntry = cost.spentCents();
  return {
    cap: cost.cap,
    recordFetch: (call) => cost.recordFetch(call),
    capHit: () => cost.capHit() || cost.spentCents() - spentAtEntry >= cents,
    spentCents: () => cost.spentCents(),
    degraded: () => cost.degraded(),
  };
}

/** Issue 901's observability line: how many of its own SERPs' domains a
 *  pass took as candidates and how many it already held a fresh size for.
 *  Counts only — no domain reaches a log line from here, the same
 *  discipline `size.ts` and `derive.ts` keep. */
function logSerpCandidates(candidates: number, alreadySized: number): void {
  console.log(JSON.stringify({ event: "serp_rival_candidates", candidates, alreadySized }));
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
async function readMarket(a: StageArgs, abandoned: () => boolean): Promise<void> {
  const { bounds, cost, sections } = a;
  const measurement = sections.measurement;
  if (measurement === null || measurement.text.home === null) return;

  const profile = await attempt("reading_your_market", () =>
    deriveProfile(cost, {
      home: measurement.text.home as string,
      ...(measurement.text.pricing === null ? {} : { pricing: measurement.text.pricing }),
    })
  );
  if (failed(profile) || abandoned()) return;
  sections.profile = profile;
  if (profile.kind === "unmeasured") return;

  // SPEC §6 thin markets (#778): the first seed is the one every pass buys.
  // The rest of the ladder is bought one seed at a time, only while short.
  const seeds = seedLadder(profile.value, a.category);
  // The site's own footprint, the same number derivation bands by, read
  // before any market is bought: every suggestions purchase asks only for
  // rows inside its window (issue 846), and selection never takes a search
  // outsized for it (SPEC §6 right-sizing, issue 830).
  const ownRanked = ownRankedValue(measurement.ownRanked);
  if (bounds.stopNow() !== null) return;
  const market = await attempt("reading_your_market", () =>
    deriveMarketSet(cost, { seeds: seeds.slice(0, 1), ownRanked })
  );
  if (failed(market) || abandoned()) return;
  sections.marketRows = market;
  if (market.kind === "unmeasured") return;

  const category = a.category === undefined ? {} : { category: a.category };
  sections.selected = selectTwelve({ profile: profile.value, market: [...market.value], ownRanked, ...category });
  if (!isShort(sections.selected)) return phrase(a, abandoned);

  // Short. Widen in SPEC §6's order, stopping as soon as twelve survive:
  // the ranked rows the pass already buys join the pool (the rivals' are
  // read now rather than in `checking_your_presence`, which then sizes
  // nothing), then further seeds at the first step, then the lower steps.
  if (a.parameters.sizesRivals && bounds.stopNow() === null) await sizeTrackedRivals(a);
  if (abandoned()) return;
  const widen = (floors?: readonly number[]): SelectedSearch[] => {
    const rows = sections.marketRows;
    return selectWidened({
      profile: profile.value,
      suggestions: rows.kind === "unmeasured" ? [] : rows.value,
      pool: poolOf(sections),
      ownRanked,
      ...category,
      ...(floors === undefined ? {} : { floors }),
    });
  };
  sections.selected = widen([SELECTION.volumeFloorPerMonth]);
  const readEnough = (): boolean =>
    a.parameters.ladderStopsAt === "questions" ? widen().length > 0 : !isShort(sections.selected);

  for (const seed of seeds.slice(1, 1 + a.parameters.extraSeeds)) {
    if (readEnough() || bounds.stopNow() !== null) break;
    // Widening never spends what the questions already selected are asked
    // with (issue 835).
    if (!affordsSeed({ remainingCents: bounds.remainingCents(), selected: sections.selected.length })) break;
    const more = await attempt("reading_your_market", () => deriveMarketSet(cost, { seeds: [seed], ownRanked }));
    if (abandoned()) return;
    if (failed(more)) break;
    sections.marketRows = joinMarketSets(sections.marketRows, more);
    sections.selected = widen([SELECTION.volumeFloorPerMonth]);
  }

  if (isShort(sections.selected)) sections.selected = widen();
  return phrase(a, abandoned);
}

/** §6.7 step 4: the selected searches, worded — as many of them as the
 *  pass can pay to ask (issue 873). */
async function phrase(a: StageArgs, abandoned: () => boolean): Promise<void> {
  const { bounds, cost, sections } = a;
  if (bounds.stopNow() !== null) return;
  if (a.parameters.questionsFitThePurse) sections.selected = whatThePurseCanAsk(a);
  const questions = await attempt("reading_your_market", () =>
    phraseQuestions(cost, { selected: sections.selected })
  );
  if (!failed(questions) && !abandoned()) sections.questions = questions;
}

/**
 * **The questions the money left can actually ask** (issue 873).
 *
 * The free path's market ladder and its twelve spend one purse (issue 835),
 * so a pass that widened its market twice has less left for the SERPs. It
 * still selected twelve, phrased twelve and showed twelve — and the ones at
 * the end of the list were dropped unasked, which is a free report with
 * gaps in it where a visitor is deciding whether this product measures
 * anything. Fewer questions, each with an answer, is the trade this makes.
 *
 * It runs before the phrasing, so no model call words a question nobody
 * will see. The purse is read the same way `asking_the_twelve` will read
 * it — its own row, or whatever the market left of the shared purse
 * (`twelveCentsAfter`), whichever is smaller, and never more than the pass
 * itself has left.
 *
 * Nothing here is a floor of its own: too few questions to plan a page from
 * is `MARKET_QUESTION_FLOOR`'s reading (`market-floor.ts`), reached through
 * the same `zero` arm a market that was simply too small reaches.
 */
function whatThePurseCanAsk(a: StageArgs): SelectedSearch[] {
  const purse = Math.min(STAGE_BUDGETS.asking_the_twelve.cents, a.bounds.remainingCents());
  const afforded = questionsAffordable(purse);
  const selected = a.sections.selected;
  if (afforded >= selected.length) return selected;
  console.log(
    JSON.stringify({
      event: "questions_afforded",
      selected: selected.length,
      afforded,
      purseCents: Number(purse.toFixed(4)),
    })
  );
  return selected.slice(0, afforded);
}

/** SPEC §6 thin markets: the ranked rows this pass already bought. */
function poolOf(sections: Sections): PoolRow[] {
  return poolFrom({ own: sections.measurement?.ownRankedRows ?? [], rivals: sections.rivalRows ?? new Map() });
}

/** §6.2's free battery: the twelve question-SERPs, live, reading each
 *  SERP's own AI Overview at no extra cost — and, at the tiers whose
 *  parameters say so, §6.2's paid battery beside each of them. The
 *  ceilings are re-checked before every one — this is the multi-call step
 *  §6.5 names, and it is now three calls per question rather than one — and
 *  a question the ceiling stopped us reaching carries `not_attempted`,
 *  which lowers the cards' denominator rather than reading as a miss.
 *
 *  **The twelve are bought concurrently** (issue #539). They are twelve
 *  independent queries — no call reads another's answer — and bought one
 *  after another they were most of the pass's whole time target on their
 *  own, which is the serialised shape that stopped every free scan
 *  finishing. The tier's `serpFanout` of them are in flight at a time; the cap is
 *  still checked against every reservation in flight, because
 *  `recordFetch` sums them (`src/lib/costs/index.ts`), and `stopNow()` is
 *  still read before each question is taken, so a ceiling reached
 *  mid-stage leaves every question it did not reach `not_attempted`.
 *
 *  The two records stay the same length as each other and as the twelve:
 *  `serps[i]` and `battery[i]` are the same question's, whatever any of
 *  the three calls did, so the card can pair them by position. Both are
 *  filled with the arm that says nobody got there and then written *by
 *  index* — never pushed — so neither the fan-out's completion order nor a
 *  stage that ended early can pair a question with another's answer, and a
 *  pass the overall ceiling discards mid-stage still gives back every
 *  answer already written. */
/**
 * Whose purchase this pass's vendor calls are (#75).
 *
 * A paid pass has a site and buys for that site; the free path has no
 * account and buys for the domain — "the same shape, since a free scan has
 * no account". The two are never shared: `DATA-COSTS.md` §5's roll-up is
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

/**
 * The instant this pass's ceiling runs out, for a call that waits inside
 * itself (issue 902).
 *
 * A paid pass reads its ceiling cooperatively — `bounds.stopNow()` between
 * calls, as it reads its cap — and that is enough only while no single
 * call can outlast the ceiling on its own. Two of the pass's can. The
 * ChatGPT scraper has no live surface, so every battery ask of it is a
 * `task_post` and then a poll; the weekly pass buys its question SERPs and
 * its AI Mode answers the same way. That poll runs to
 * `VENDOR.stdQueueDeadlineMin` — forty-five minutes, against a
 * `TIMING.paidPassCeilingS` of four and a `/api/jobs` invocation of five,
 * and the wait is *inside* the call, where no between-calls check reaches
 * it. A pass held there is frozen by the platform mid-write: no report
 * stored, the claimed row still `running`, and the step retried — which is
 * how twelve questions come to buy more than twelve questions' worth.
 *
 * So the deadline goes in with the call, and the queue stops at whichever
 * of the two comes first. Read at the call and never carried: an ask that
 * waited its turn asks with what is left now, not with what was left when
 * its question was taken.
 */
function untilCeiling(bounds: Bounds): number {
  return Date.now() + bounds.remainingMs();
}

async function askTheTwelve(a: StageArgs, abandoned: () => boolean): Promise<void> {
  const { bounds, cost, parameters, sections } = a;
  const questions = sections.questions;
  const asked = questions.kind === "unmeasured" ? [] : questions.value;
  // Entered while the deadline fired: the slots below would be pushed into
  // the very array the composed report already holds.
  if (abandoned()) return;

  // Every question's slot, on the arm that says we did not get to it.
  // Written by index below; a question nobody reached keeps this.
  for (let i = 0; i < asked.length; i += 1) {
    sections.serps.push(unmeasured("not_attempted", questions.at));
    sections.battery.push(noBattery(questions.at));
  }

  /** Issue 877: how long each ask took, so the tail is visible in the log
   *  without a query — and so the next abort value is chosen from what
   *  these calls take rather than from a guess (issue 875's was wrong). */
  const tookMs: number[] = [];

  /** One question's live SERP, with the vendor's own failure kind where
   *  there was one (issue 865). The cell is what this returns; nothing
   *  here writes to `sections`. */
  const askOne = async (
    keyword: string
  ): Promise<{ serp: Measured<SerpResult> | StageFailure; failure: VendorFailure | null }> => {
    const heard: { failure: VendorFailure | null } = { failure: null };
    const startedMs = Date.now();
    const serp = await attempt("asking_the_twelve", () =>
      serpOrganic(cost, {
        query: keyword,
        mode: parameters.serpMode,
        loadAsyncAiOverview: parameters.asyncAiOverview && !a.correction,
        scope: cacheScope(a),
        freshnessDays: parameters.serpWindowDays,
        abortMs: parameters.serpAbortMs,
        untilMs: untilCeiling(bounds),
        onFailure: (failure) => {
          heard.failure = failure;
        },
      })
    );
    tookMs.push(Date.now() - startedMs);
    return { serp, failure: heard.failure };
  };

  /** The cell, carrying the vendor's own kind where the call failed (issue
   *  865): `undeterminable` says a cell could not be measured, `because`
   *  says what the pass was told — a vendor that timed out and a request it
   *  refused are not the same fact, and the second is not worth re-asking. */
  const cellFor = (
    got: { serp: Measured<SerpResult> | StageFailure; failure: VendorFailure | null },
    at: Date
  ): Measured<SerpResult> => {
    if (failed(got.serp)) return unmeasured("undeterminable", at);
    if (got.serp.kind === "unmeasured" && got.failure !== null) {
      return unmeasured<SerpResult>(got.serp.reason, got.serp.at, got.failure.vendorFailure);
    }
    return got.serp;
  };

  // One shared cursor over the twelve, taken by `serpFanout` workers. A
  // worker re-reads the ceilings before taking a question, so the stage
  // stops asking on the first refusal rather than asking eleven more times
  // and being refused eleven more times.
  let next = 0;
  /** Issue 869: how the battery's two engines are answering this pass, so
   *  one that is refusing stops being bought. One watch per pass, shared by
   *  every worker. */
  const engines = newEngineWatch();
  /** Issue 865: the questions whose first ask failed in a way that is worth
   *  one more, asked again only once every question has been asked once. */
  const worthOneMore: { readonly index: number; readonly keyword: string; readonly because: string }[] = [];
  const buyOne = async (): Promise<void> => {
    for (;;) {
      const i = next;
      next += 1;
      const question = asked[i];
      if (question === undefined) return;
      if (bounds.stopNow() !== null) continue;
      const got = await askOne(question.search.keyword);
      const battery = await askTheBattery(a, question.search.keyword, questions.at, engines);
      // **A late answer is kept, and a sealed report is never written to**
      // (#539 review, re-cut by issue 875). The budget stops the pass
      // *waiting* for this stage; it cannot cancel a call already in
      // flight. The old guard read the stage's abandonment and dropped
      // whatever arrived after it — money spent, and an answer thrown away
      // (two of them on the free scans of 2026-09-17). What #539 was
      // actually protecting against is a write into a report that has
      // already been composed, and `sections.sealed` is exactly that line:
      // before it, an answer that arrives is still worth having and
      // `rescore` below counts it; after it, there is no report left to put
      // it in. Both writes happen together after the last await, so a
      // question's SERP and its battery are never half a pair.
      if (sections.sealed) return;
      sections.serps[i] = cellFor(got, questions.at);
      sections.battery[i] = battery;
      if (abandoned()) rescore(a);
      if (got.failure !== null && worthAskingAgain(got.failure.vendorFailure)) {
        worthOneMore.push({ index: i, keyword: question.search.keyword, because: got.failure.vendorFailure });
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(parameters.serpFanout, asked.length) }, () => buyOne()));

  // **One more ask, and only one, and only after every question has had
  // its first** (issue 865).
  //
  // Production 2026-09-17: about an eighth of live SERP calls came back
  // `timeout` — our own request abort inside the vendor's latency tail,
  // which DataForSEO bills either way — and the cell was dropped and never
  // asked again. That is where "a fifth of the battery is unmeasured" came
  // from; the `not_attempted` tail on the same passes is the same call,
  // seen from the stage's clock, since a request that runs to the abort
  // holds one of `serpFanout` workers for all of it.
  //
  // **After the sweep, never inside it**: a question that has never been
  // asked outranks one that is being asked twice, so the retries take
  // whatever time and money the first sweep left and nothing that was owed
  // to a question still waiting.
  //
  // **It spends nothing the pass had not already set aside**: the retry is
  // an ordinary purchase through the same `CostContext`, so the cap is
  // checked against it exactly as it was against the first ask, and a
  // purse with no room refuses it rather than raising anything. A question
  // reserves the async-AI-Overview surcharge and a failed call settles the
  // base price, which is the room this ask is made in.
  let nextRetry = 0;
  const askAgain = async (): Promise<void> => {
    for (;;) {
      const owed = worthOneMore[nextRetry];
      nextRetry += 1;
      if (owed === undefined) return;
      if (bounds.stopNow() !== null || abandoned()) return;
      const got = await askOne(owed.keyword);
      if (abandoned()) return;
      const cell = cellFor(got, questions.at);
      logSerpRetry({ because: owed.because, outcome: cell.kind === "unmeasured" ? "unmeasured" : "measured" });
      sections.serps[owed.index] = cell;
    }
  };

  if (worthOneMore.length > 0 && !abandoned() && bounds.stopNow() === null) {
    await Promise.all(
      Array.from({ length: Math.min(parameters.serpFanout, worthOneMore.length) }, () => askAgain())
    );
  }

  logSerpLatency({
    asked: tookMs.length,
    measured: sections.serps.filter((serp) => serp.kind !== "unmeasured").length,
    slowestMs: tookMs.length === 0 ? 0 : Math.max(...tookMs),
    medianMs: medianOf(tookMs),
    abortMs: parameters.serpAbortMs,
  });
}

/** The middle of what the asks took, the lower of the two in an even set —
 *  a figure, not a statistic: the p50 the next abort value is chosen from
 *  is the owner's, over a week of the rows these calls now carry (issue
 *  877). */
function medianOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}

/** One line per pass over the twelve (issue 877): how many were asked, how
 *  many came back, and what the asking took. No query, no customer, no
 *  query text — the tail of a pass, readable from the deployment log. */
function logSerpLatency(fields: {
  asked: number;
  measured: number;
  slowestMs: number;
  medianMs: number;
  abortMs: number;
}): void {
  console.log(JSON.stringify({ event: "serp_latency", ...fields }));
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
async function askTheBattery(
  a: StageArgs,
  query: string,
  at: Date,
  watch: EngineWatch
): Promise<BatteryAnswers> {
  const { bounds, cost, parameters } = a;
  if (!parameters.battery) return noBattery(at);

  const chatgpt =
    bounds.stopNow() !== null
      ? unmeasured<AiAnswer>("not_attempted", at)
      : await engineAnswer(at, "chatgpt", watch, bounds, (onFailure) =>
          llmScraper(cost, { query, mode: "std", scope: cacheScope(a), onFailure, untilMs: untilCeiling(bounds) })
        );

  const mode =
    bounds.stopNow() !== null
      ? unmeasured<AiAnswer>("not_attempted", at)
      : await engineAnswer(at, "ai_mode", watch, bounds, (onFailure) =>
          aiMode(cost, { query, mode: parameters.serpMode, scope: cacheScope(a), onFailure, untilMs: untilCeiling(bounds) })
        );

  return { chatgpt, aiMode: mode };
}

/** The two engines the battery buys, as this pass watches them. */
type BatteryEngine = "chatgpt" | "ai_mode";

/**
 * **An engine that is refusing is not bought for the rest of the pass**
 * (issue 869).
 *
 * One engine failing says nothing; the same engine failing twice running
 * is a vendor that is not going to answer this pass, and every further
 * question would buy the same refusal. The cells it would have filled are
 * `unmeasured`, carrying what the engine last said — which is a different
 * claim from "there was no answer", and the readers keep them apart.
 *
 * A zero is not a failure and never counts here: a question Google serves
 * no AI Mode block for is measured (`TASK_NO_RESULTS`, issue 869), and an
 * engine answering "nothing here" for every question is answering.
 *
 * It bites where a pass asks more questions than its fan-out, and on the
 * ceiling-stopped waves after the first: at `PAID_SERP_FANOUT` the twelve
 * batteries are in flight at once, so the first wave is bought before any
 * refusal is known. That is a bound on what this can save, not a reason
 * not to have it.
 */
interface EngineWatch {
  readonly failures: Map<BatteryEngine, number>;
  readonly because: Map<BatteryEngine, string>;
  /** Engines that have answered at least once this pass. Until an engine is
   *  in here its asks take turns; afterwards they run with the rest of the
   *  fan-out. */
  readonly proven: Set<BatteryEngine>;
  /** The tail of the queue of asks waiting their turn, per engine. */
  readonly queue: Map<BatteryEngine, Promise<void>>;
}

/** Two in a row, counted per pass. */
const ENGINE_GIVE_UP_AFTER = 2;

function newEngineWatch(): EngineWatch {
  return { failures: new Map(), because: new Map(), proven: new Set(), queue: new Map() };
}

/**
 * **An engine that has not answered yet is asked one question at a time**
 * (issue 869).
 *
 * The give-up rule below can only give up on something it has seen fail,
 * and at `PAID_SERP_FANOUT` every question's battery is in flight at once —
 * so a dead engine was bought twelve times before the first failure was
 * known, which is exactly what production did on 2026-09-17. Until an
 * engine has answered once this pass, its asks queue: the first question
 * pays for finding out, and what it finds out is true of the other eleven.
 * The moment an engine answers — with an answer or with a zero — the gate
 * opens and the rest run at the fan-out's own width.
 *
 * The cost is one engine call's latency on the first question of a pass,
 * and what it buys is that an outage costs `ENGINE_GIVE_UP_AFTER` calls
 * instead of one per question.
 */
async function inEngineTurn<T>(engine: BatteryEngine, watch: EngineWatch, body: () => Promise<T>): Promise<T> {
  if (watch.proven.has(engine)) return body();

  const ahead = watch.queue.get(engine) ?? Promise.resolve();
  let release = (): void => {};
  const mine = new Promise<void>((resolve) => {
    release = resolve;
  });
  watch.queue.set(engine, ahead.then(() => mine));
  await ahead;
  try {
    return await body();
  } finally {
    release();
  }
}

/** One engine's answer, with a raise turned into the arm that is true of
 *  it. The vendor's own refusals — a `FREE` context, a cap already hit —
 *  come back as `Measured` arms and pass through untouched.
 *
 *  Issue 869: the vendor's own failure kind is heard here, so a refusing
 *  engine stops being bought and the cell says what it was told. */
async function engineAnswer(
  at: Date,
  engine: BatteryEngine,
  watch: EngineWatch,
  bounds: Bounds,
  work: (onFailure: (failure: VendorFailure) => void) => Promise<Measured<AiAnswer>>
): Promise<Measured<AiAnswer>> {
  const alreadyFailed = watch.failures.get(engine) ?? 0;
  if (alreadyFailed >= ENGINE_GIVE_UP_AFTER) {
    return unmeasured<AiAnswer>("not_attempted", at, watch.because.get(engine));
  }

  const heard: { failure: VendorFailure | null } = { failure: null };
  const answer = await inEngineTurn(engine, watch, async () => {
    // Re-read inside the turn: the asks ahead of this one may have been
    // what gave the engine up.
    if ((watch.failures.get(engine) ?? 0) >= ENGINE_GIVE_UP_AFTER) return GAVE_UP;
    // **And re-read the ceilings, for the same reason** (issue 902). The
    // caller read `stopNow()` before handing this ask over, and an
    // unproven engine's asks take their turns one at a time — so the
    // decision "the pass still has room for this" was made before a wait
    // that is as long as every ask ahead of it. On the engine this matters
    // for that is minutes: the ChatGPT scraper is standard-queue only.
    // Nothing is bought against a ceiling that has fired since.
    if (bounds.stopNow() !== null) return STOPPED;
    return attempt("asking_the_twelve", () =>
      work((failure) => {
        heard.failure = failure;
      })
    );
  });

  if (answer === GAVE_UP) {
    return unmeasured<AiAnswer>("not_attempted", at, watch.because.get(engine));
  }
  if (answer === STOPPED) return unmeasured<AiAnswer>("not_attempted", at);

  if (heard.failure !== null) {
    const failures = (watch.failures.get(engine) ?? 0) + 1;
    watch.failures.set(engine, failures);
    watch.because.set(engine, heard.failure.vendorFailure);
    if (failures === ENGINE_GIVE_UP_AFTER) {
      logEngineDropped({ engine, because: heard.failure.vendorFailure, after: failures });
    }
  } else if (!failed(answer) && answer.kind !== "unmeasured") {
    // An answer of any kind, a zero included: the engine is answering, so
    // the count clears and the rest of the pass asks it at the fan-out's
    // own width.
    watch.failures.set(engine, 0);
    watch.proven.add(engine);
  }

  if (failed(answer)) return unmeasured<AiAnswer>("undeterminable", at);
  if (answer.kind === "unmeasured" && heard.failure !== null) {
    return unmeasured<AiAnswer>(answer.reason, answer.at, heard.failure.vendorFailure);
  }
  return answer;
}

/** The arm an ask takes when the engine was given up while it waited its
 *  turn (issue 869): nothing was bought and nothing was heard. */
const GAVE_UP = Symbol("battery-engine-gave-up");

/** The arm an ask takes when the pass's own ceiling fired while it waited
 *  its turn (issue 902): nothing was bought, and the cell says nobody got
 *  to it rather than naming an engine that never refused. */
const STOPPED = Symbol("battery-ask-past-the-ceiling");

/** One line the first time a pass gives up on an engine (issue 869),
 *  carrying the engine and what it last said — never the query. */
function logEngineDropped(fields: { engine: BatteryEngine; because: string; after: number }): void {
  console.log(JSON.stringify({ event: "battery_engine_dropped", ...fields }));
}

/** The last stage buys nothing: the rivals, both cards and the coherence
 *  verdict are all counted over SERPs the pass has already paid for
 *  (§6.6's "zero extra cost"). */
/**
 * The scoring, run again over a section that arrived late (issue 875).
 *
 * `score` buys nothing and reads nothing but `sections` — §6.6's "zero
 * extra cost" — so deriving again from a set one SERP larger is the cheap
 * way to keep the cards, the rivals and the coherence verdict agreeing with
 * the SERPs the report carries. It is skipped where the stage has not
 * scored yet: the scoring stage will read the late answer on its own.
 */
function rescore(a: StageArgs): void {
  if (a.sections.sealed || a.sections.presence === null) return;
  score(a);
}

function score(a: StageArgs): void {
  const { domain, sections } = a;
  const serps = sections.serps as readonly Measured<MarketSerp>[];
  const readSerps: MarketSerp[] = [];
  for (const serp of serps) if (serp.kind !== "unmeasured") readSerps.push(serp.value);

  // The bands this pass already holds (issue 858): a far domain is never
  // one of the report's rivals, and the nearest lead.
  const sizes = new Map<string, RivalSizeBand>();
  if (sections.rivalSizes.kind !== "unmeasured") {
    for (const size of sections.rivalSizes.value) if (size.state === "sized") sizes.set(size.domain, size.band);
  }
  const derivation = deriveRivals({ serps: readSerps, ownDomain: domain, sizes });
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
 *  customer's site that nobody has made. */
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
  /** `RunScanArgs.category` — the category this pass measured under, kept on
   *  the record (issue 866). */
  category?: string;
  domain: CanonicalDomain;
  tier: Tier;
  stoppedReason: StoppedReason;
  fromIncompleteRescan: boolean;
  sections: Sections;
  startedAt: Date;
  correctionState: CorrectionState;
}): {
  report: StoredReport;
  drivers: Drivers;
  sectionMissing: boolean;
  marketTooSmall: boolean;
  /** Which step of §6.7 left this pass with no market to read (issue 898),
   *  or `null` where the market was read. Named by the `ScanInput` that
   *  step feeds, so the pass's log line and the verdict's own record of
   *  what went unread say one word between them. */
  marketUnread: MarketUnread;
} {
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

  // Issue 898: which step left the pass with no market — the profile call
  // that did not answer, or the suggestions that did not. It is the same
  // branch the `market` section takes below, read once so the log and the
  // report cannot disagree.
  const marketUnread: MarketUnread =
    s.profile.kind === "unmeasured"
      ? "business_profile"
      : s.marketRows.kind === "unmeasured"
        ? "market_suggestions"
        : null;

  const market: Measured<MarketSet> =
    s.profile.kind === "unmeasured"
      ? unmeasured(s.profile.reason, measuredAt)
      : s.marketRows.kind === "unmeasured"
        ? unmeasured(s.marketRows.reason, measuredAt)
        : {
            kind: s.marketRows.kind,
            value: marketSetOf({ profile: s.profile.value, suggestions: s.marketRows.value, pool: poolOf(s) }),
            at: measuredAt,
          };

  const assembled = assembleReport({
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
    ownRankedRows: m === null ? [] : m.ownRankedRows,
    sources: s.sources,
    onPage,
    robots,
    siteIssues: checkSite({ crawl: s.siteCrawl, robots, blockedAgents: blockedAgentsOf(robots) }),
    coherence: s.coherence,
    correctionState: a.correctionState,
    // Issue 866: the category the pass was handed, so REQ-071's comparison
    // can see a category change and see it cleared. `null` where the pass
    // seeded from the profile — the inferred category is not this fact.
    measuredCategory: a.category ?? null,
  });
  // SPEC §2 (issue 787): the one first-page proposal is the best right-sized
  // Write target this pass measured — derived, never padded.
  const report: StoredReport = { ...assembled, freePage: freePageOf(assembled) };

  // #770: a market read and found too small buys no SERP, so AI presence
  // has nothing to be read from. That is the market's answer and not a
  // missing section: presence missing for that reason alone does not
  // degrade the pass. A search-presence read that failed still does.
  // Never for a pass a ceiling stopped (issue 855): it did not finish.
  const tooSmall = marketTooSmall(s.questions) && !stoppedOnCeiling(a.stoppedReason);
  const missingFactors = verdict.missing.filter(
    (f) => !(tooSmall && f.factor === "presence" && drivers.searchPresence.kind !== "unmeasured")
  );

  // Issue 865: **the twelve are a battery, not a section.** One question
  // whose SERP the vendor dropped used to mark the whole pass `degraded` —
  // ten of twelve measured, inside its budget, ending `complete`, carried
  // the same word as a pass that lost its market or was cut off by a
  // ceiling, and the app's states read that word. A battery says what it
  // measured and what it did not: every cell carries its own arm and its
  // `because`, and the pass is only missing this section when *no*
  // question was measured at all. Everything else here is unchanged — a
  // section that is wholly absent still degrades the pass, and so does a
  // ceiling or a cap (`spend.degraded`, `stoppedReason`).
  const noQuestionMeasured = s.serps.length > 0 && s.serps.every((serp) => serp.kind === "unmeasured");

  const sectionMissing =
    s.aiAnswers === null ||
    s.presence === null ||
    missingFactors.length > 0 ||
    market.kind === "unmeasured" ||
    s.questions.kind === "unmeasured" ||
    noQuestionMeasured;

  return { report, drivers, sectionMissing, marketTooSmall: tooSmall, marketUnread };
}

/** Issue 898 — the two §6.7 steps that can leave a pass with no market at
 *  all, under the `ScanInput` names the verdict already reads them under. */
type MarketUnread = Extract<ScanInput, "business_profile" | "market_suggestions"> | null;

/** The twelve SERPs as the one input the verdict reads them as: measured
 *  where any of them was, and carrying the reason where none was. */
function foldSerps(serps: readonly Measured<SerpResult>[], at: Date): Measured<null> {
  for (const serp of serps) {
    if (serp.kind !== "unmeasured") return measured(null, at);
  }
  const first = serps[0];
  return unmeasured(first !== undefined && first.kind === "unmeasured" ? first.reason : "not_attempted", at);
}

/** One line per re-asked question (issue 865), carrying the failure that
 *  bought the second ask and what it came back as — never the query. */
function logSerpRetry(fields: { because: string; outcome: "measured" | "unmeasured" }): void {
  console.log(JSON.stringify({ event: "serp_retry", ...fields }));
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
