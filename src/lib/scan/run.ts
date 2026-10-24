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
  BATTERY,
  CACHE_WINDOWS_D,
  FREE_RESCAN_WINDOW_D,
  MARKET_REMEASURE_H,
  PAGE_QUESTION_RETIRE_WEEKS,
  PRICE_BOOK,
  SELECTION,
  SERP_RIVAL_SIZING,
  WEEKLY_RIVAL_RESIZES,
  TIMING,
  TRACKED_PROMPTS,
  TYPING_RESERVE_C,
  VENDOR,
} from "@/lib/config/constants";
import { captureInBackground } from "@/lib/analytics";
import type { CapName, CostContext } from "@/lib/costs";
import { dbAdmin } from "@/lib/db";
import type { RobotsPolicy } from "@/lib/egress/types";
import type { CoherenceVerdict } from "@/lib/market/coherence/check";
import { nextCorrectionState, type CorrectionState } from "@/lib/market/coherence/state";
import { EVIDENCE_BOUNDS } from "@/lib/market/infer/evidence";
import { searchedName, spokenMarket } from "@/lib/market/infer/terms";
import type { MarketConclusion } from "@/lib/market/infer/types";
import { buyerPrompts } from "@/lib/market/questions/buyer-prompts";
import { readPromptAnswer } from "@/lib/market/prompts/answer";
import { generatePrompts, promptSiteName } from "@/lib/market/prompts/generate";
import { nextPromptSet, settlePrechecks, type TrackedPrompt } from "@/lib/market/prompts/set";
import type { BatteryAnswers } from "@/lib/market/questions/matrix";
import {
  slotDepth,
  trackedQuestions,
  type PageQuestionCandidate,
} from "@/lib/market/questions/tracked";
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
import { offeringSeeds, offeringsOf, spreadAcrossOfferings } from "@/lib/market/questions/offerings";
import { marketSeeds, measuredMarketOf, unjudged } from "@/lib/market/questions/measured";
import { serpDomainsToSize } from "@/lib/market/rivals/candidates";
import type { RivalCandidate } from "@/lib/market/rivals/derive";
import type { PresenceCard } from "@/lib/market/rivals/presence";
import { townHolds } from "@/lib/market/rivals/reach";
import { sizeRivals, type RivalSize } from "@/lib/market/rivals/size";
import { trackedRivals } from "@/lib/market/rivals/tracked";
import type { MarketSerp } from "@/lib/market/views";
import { freePageOf } from "@/lib/opportunities/free-page";
import { DEFAULT_LOCALE, type Locale, type Place } from "@/lib/locale/locales";
import { listingLocaleOf } from "@/lib/locale/listing";
import { askedIn, localSearch, placeCandidates, placeOf, statedPlace as statedPlaceOf, type PlaceFrom } from "@/lib/locale/place";
import { readStoredLocale, writeSiteLocale } from "@/lib/locale/site";
import { aiPresenceOf, aiSampleOf, BOT_PROTECTION, classifyReferences, measureDomain, searchPresenceOf, withMeasuredPages, type DomainMeasurement } from "@/lib/measure";
import { aiPresenceRangeOf, searchPresenceRangeOf } from "@/lib/measure/drivers";
import { measured, measuredZero, unmeasured, type Measured } from "@/lib/measure/measured";
import { foldSerps, outcomeOf, type InputOutcome, type ScanInput } from "@/lib/measure/partition";
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
  STAGE_BUDGETS,
  affordsSeed,
  questionsAffordable,
  twelveCentsAfter,
  withStageBudget,
  type StageOutcome,
} from "./budgets";
import { cardsOf } from "./cards";
import { withScanBounds, withStoredPassSpend, type Bounds } from "./ceilings";
import { advanceCorrectionState, readCorrectionFacts, registerCorrectionRunner } from "./correction";
import { parseDomain, type CanonicalDomain } from "./domain";
import { marketTooSmall, stoppedOnCeiling } from "./market-floor";
import { pageQuestionCandidates, pageQuestionMisses } from "./page-questions";
import { RETRY_STAGE, carrySpentCents, readSpentCents, registerRetryRunner, type RetryPart } from "./retry";
import { searchFootprintOf, type ThinFootprint } from "./search-footprint";
import {
  PROMPT_ENGINES,
  readCurrentReport,
  readScanReport,
  type PageQuestionsSection,
  type ReportLocale,
  type RetiredPageQuestion,
} from "./report";
import type {
  AiAnswersSection,
  MarketPromptAnswer,
  PromptAnswer,
  PromptEngine,
  PromptsSection,
  StoppedReason,
  StoredReport,
  SupplySection,
  Tier,
} from "./report";
import { answersSectionOf, blockedAgentsOf, pageQuestionsSectionOf } from "./sections";
import { checkSite, type CrawlReading } from "@/lib/site-issues/checks";
import { emitEnding, enterStage, exitStage } from "./stages";
import type { StageName } from "./stages";
import { assembleReport, storeCurrentReport, type ScanStatus } from "./store";
import { finishingOf } from "./finish-reads";

// ── Tier as a parameter ─────────────────────────────────────────────────

interface TierParameters {
  /** Which of the four caps the pass spends against (§6.1). */
  cap: CapName;
  /** §6.4: live mode only where a human is waiting; everything scheduled
   *  runs on the standard queue. AI Mode's surface since issue 1352: every
   *  tier's Google organic reads are queued (`serpPriority`). */
  serpMode: "live" | "std";
  /** The queue priority of this tier's Google organic reads (SPEC §6,
   *  2026-10-08, issue 1352). The live surface answered `50000 Internal
   *  Server Error` after 16 s on 12 of 15 calls that day while queued tasks
   *  came back in seconds, so no tier reads Google live. `high` where
   *  somebody is waiting: the free scan and a site's first pass. */
  serpPriority: "high" | "normal";
  /** How often this tier asks the queue whether a Google read is ready. */
  serpPollMs: number;
  /** §6.2 as amended (DECISIONS 2026-09-03): the free report's own twelve
   *  question-SERPs count Google's actual AI answers. The two paid tiers'
   *  too (SPEC §6, 2026-10-09, issue 1357): without it most of their AI
   *  Overviews came back with no sources. A correction's re-run switches
   *  it off whatever the tier says — that is the correction's parameter,
   *  not this table's. */
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
  /** How many of the twelve are bought at once: one wave at every tier
   *  (`PAID_SERP_FANOUT`, issue 855). The free path asked in waves of four
   *  while its reads were live; a queued read costs its wait whether one
   *  task is posted or twelve (issue 1352). */
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
  /** How many tracked rivals one pass of this tier sizes again when their
   *  30 days are up (D64, issue 1301); `null` sizes every one that is due. */
  rivalResizes: number | null;
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
   *  it stops once it has `SELECTION.freeLadderMinQuestions` at any step
   *  (issue 1235; one was enough before, and a report of one question is
   *  one timed-out SERP from having no score): its 12¢ is spent on the
   *  report a visitor reads, not on a fuller twelve. */
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
   *  should be.
   *
   *  D63 (issue 1298) is that figure for the paid tiers:
   *  `VENDOR.paidSerpAbortMs`, never past the pass's own ceiling
   *  (`serpAbortFor`). The free path keeps the short bound and asks a
   *  timed-out read once more instead. */
  serpAbortMs: number;
  /** SPEC §6 (2026-09-20, #919) — does this pass ask the published pages'
   *  own questions beside the twelve?
   *
   *  The weekly pass, and it alone. A free scan has no site and no
   *  published page; the onboarding deep pass runs before the first page
   *  exists, and a page's question is a *weekly* measurement — §6's rule is
   *  stated in weeks ("8 weeks without a mention"), so a second pass in the
   *  same week would spend a week of a question's life in an afternoon. */
  pageQuestions: boolean;
  /** #1195: how long before the ceiling this tier's asks stop waiting
   *  (`TIMING.paidPassAskReserveS`), so a slow queue costs one engine's
   *  cell and never the pass's scoring. The free path's is
   *  `TIMING.freePassAskReserveS` (issue 1352): its Google reads are queued
   *  too, and it waits for them until that long before its own ceiling. */
  askReserveS: number;
  /** #1195: how many of the market's buyer prompts this tier asks AI Mode
   *  beside the twelve (`BATTERY.MARKET_PROMPTS`). The deep pass's: it is
   *  the pass that concludes a new market's rivals at once, and the
   *  weekly pass's 40¢ is not raised for it. */
  marketPrompts: number;
  /** Does the pass ask §6.2's two engines for each of the twelve? The deep
   *  pass does. The weekly pass does not (owner, D19 final of 2026-10-03,
   *  #1162): its AI measure is the tracked prompts, and the twelve keep
   *  their Google searches — whose AI Overview is bought with them (issue 1357) — for search. A
   *  page's own question still asks both engines (#919). */
  batteryOnTheTwelve: boolean;
  /** D19: does the pass ask the site's tracked buyer prompts, on
   *  `TRACKED_PROMPTS.ENGINES` × `TRACKED_PROMPTS.RUNS`? The weekly pass,
   *  and it alone: the measure is a weekly rate. */
  trackedPrompts: boolean;
  /** SPEC §2 (owner, 2026-10-15, issue 1440): does a pass that stored a
   *  report with searches it chose and did not read send `scan/finish-reads`,
   *  to read them in the background inside the same cap? The free path, and
   *  it alone: its 50 s is what leaves them unread. */
  finishesReads: boolean;
  /** D67 for the free pass (owner ruling 2026-10-15, issue 1441): does the
   *  pass measure in the town its home page states? The free pass: it has
   *  no stored place and no market call to settle one. A paid pass measures
   *  the place its market conclusion settled. */
  measuresStatedPlace: boolean;
  /** Owner W1 (2026-10-20): the cents of the cap the stages leave for the typing after the stored report. */
  typingReserveC: number;
}

export const TIER_PARAMETERS: Readonly<Record<Tier, TierParameters>> = Object.freeze({
  free: Object.freeze({
    cap: "FREE",
    serpMode: "live",
    serpPriority: "high",
    serpPollMs: VENDOR.waitedQueuePollIntervalS * 1000,
    asyncAiOverview: true,
    deadlineApplies: true,
    ceilingS: TIMING.reportCeilingS,
    serpFanout: PAID_SERP_FANOUT,
    adoptsClaim: true,
    servesStoredReport: true,
    sizesRivals: false,
    rivalResizes: null,
    battery: false,
    stageBudgets: true,
    serpWindowDays: CACHE_WINDOWS_D.serp,
    extraSeeds: SELECTION.maxExtraSeeds,
    ladderStopsAt: "questions",
    marketTooSmallAlert: "none",
    questionsFitThePurse: true,
    serpAbortMs: VENDOR.requestAbortMs,
    pageQuestions: false,
    askReserveS: TIMING.freePassAskReserveS,
    marketPrompts: 0,
    batteryOnTheTwelve: false,
    trackedPrompts: false,
    finishesReads: true,
    measuresStatedPlace: true,
    typingReserveC: 0,
  }),
  deep: Object.freeze({
    cap: "DEEP",
    serpMode: "live",
    serpPriority: "high",
    serpPollMs: VENDOR.waitedQueuePollIntervalS * 1000,
    asyncAiOverview: true,
    deadlineApplies: false,
    ceilingS: TIMING.paidPassCeilingS,
    serpFanout: PAID_SERP_FANOUT,
    adoptsClaim: true,
    servesStoredReport: false,
    sizesRivals: true,
    rivalResizes: null,
    battery: true,
    stageBudgets: false,
    serpWindowDays: CACHE_WINDOWS_D.serp,
    extraSeeds: SELECTION.maxExtraSeeds,
    ladderStopsAt: "twelve",
    marketTooSmallAlert: "immediate",
    questionsFitThePurse: false,
    serpAbortMs: VENDOR.paidSerpAbortMs,
    pageQuestions: false,
    askReserveS: TIMING.paidPassAskReserveS,
    marketPrompts: BATTERY.MARKET_PROMPTS,
    batteryOnTheTwelve: true,
    trackedPrompts: false,
    finishesReads: false,
    measuresStatedPlace: false,
    typingReserveC: TYPING_RESERVE_C,
  }),
  weekly: Object.freeze({
    cap: "WEEKLY",
    serpMode: "std",
    serpPriority: "normal",
    serpPollMs: VENDOR.stdQueuePollIntervalS * 1000,
    asyncAiOverview: true,
    deadlineApplies: false,
    ceilingS: TIMING.paidPassCeilingS,
    serpFanout: PAID_SERP_FANOUT,
    adoptsClaim: false,
    servesStoredReport: false,
    sizesRivals: true,
    rivalResizes: WEEKLY_RIVAL_RESIZES,
    battery: true,
    stageBudgets: false,
    serpWindowDays: CACHE_WINDOWS_D.serpWeeklyRecheck,
    extraSeeds: SELECTION.maxExtraSeeds,
    ladderStopsAt: "twelve",
    marketTooSmallAlert: "digest",
    questionsFitThePurse: false,
    serpAbortMs: VENDOR.paidSerpAbortMs,
    pageQuestions: true,
    askReserveS: TIMING.paidPassAskReserveS,
    marketPrompts: 0,
    batteryOnTheTwelve: false,
    trackedPrompts: true,
    finishesReads: false,
    measuresStatedPlace: false,
    typingReserveC: TYPING_RESERVE_C,
  }),
} as const);

// ── The sections a pass accumulates ─────────────────────────────────────

interface Sections {
  measurement: DomainMeasurement | null;
  profile: Measured<Profile>;
  /** SPEC §2 (issue 1387): `search` where the profile was read from the
   *  site's listing in search because bot protection kept the reader off
   *  its own pages; `null` where it was read from those pages, or not read. */
  marketFrom: "search" | null;
  /** Why that listing named no market, where it did not: the pass then
   *  guesses none, and the report keeps the reason. */
  marketThin: ThinFootprint | null;
  /** Which evidence named the town a free pass measured in (issue 1441);
   *  `null` where it measured in none, or a paid pass settled the place. */
  placeFrom: PlaceFrom | null;
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
  /** SPEC §6's page questions (#919), beside the twelve and never inside
   *  them: `serps` and `battery` above are what the score, the rivals and
   *  the coherence verdict are counted over, and a page question in either
   *  would move a published score by being asked. Three parallel arrays
   *  again, in the order the questions were asked. */
  pageAsked: PageQuestionCandidate[];
  pageSerps: Measured<SerpResult>[];
  pageBattery: BatteryAnswers[];
  /** The pages whose question ran out of weeks this pass. */
  pageRetired: RetiredPageQuestion[];
  /** The composed section, rebuilt by `score` beside the AI-answers card. */
  pageQuestions: PageQuestionsSection | null;
  /** The site's name as an AI answer is read for it (issue 1420,
   *  `promptSiteName`), from the profile this pass built; `null` until it is
   *  built, and then the domain's label is read instead. */
  siteName: string | null;
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
  /** The pages that crawl read, as the market conclusion reads them
   *  (#1185). `null` until the crawl has run. */
  pagesRead: readonly { url: string; title: string; h1: string; text: string }[] | null;
  /** The category this pass concluded and measured under (#1185), where it
   *  concluded one; the report records it as `measuredCategory`. */
  concludedCategory: string | undefined;
  /** The market this pass concluded and measures (#1185), where it
   *  concluded one: the market's buyer prompts are built from it (#1195). */
  market: MarketConclusion | null;
  /** The founder's own answer about who buys, which the prompts name over
   *  the inferred buyer (D49, issue 1270). `null` where they gave none. */
  founderBuyer: string | null;
  /** The rivals whose ranked rows may join this pass's pool (#1195): the
   *  rivals concluded for the market in force. `null` admits every tracked
   *  rival — a founder's own, or a pass with no concluded market. A rival
   *  chosen under an earlier market is not evidence about this one. */
  poolRivals: ReadonlySet<string> | null;
  /** The market's buyer prompts, asked of AI Mode beside the twelve
   *  (#1195) and stored for the rival conclusion; never in the score. */
  marketPrompts: MarketPromptAnswer[];
  /** D19 (#1162): the tracked prompts this pass asked and what each answer
   *  said. `null` where the pass asked none. */
  prompts: PromptsSection | null;
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

/** A stage that did not run at all, as `StageOutcome` says it: nothing was
 *  spent and nothing was cut off. A retry skips two stages this way (issue
 *  715), and a skipped stage still reports its exit — the screen's stage
 *  list reads straight through, because the pass really did get past it. */
const SKIPPED_STAGE: StageOutcome<void> = Object.freeze({ spent: false, value: undefined });

/**
 * Issue 715 — the market a retry starts from, read back off the report it
 * is retrying a part of instead of bought again.
 *
 * Four members, and every one of them comes out of the stored blob:
 * `MarketSet` carries both the profile and the suggestion rows it was built
 * from (ADR-095), and each of the twelve `Question`s carries the
 * `SelectedSearch` it was phrased from (#103). So nothing is invented and
 * nothing is derived a second way — the retry asks the same twelve
 * questions, in the same words, about the same market, which is what makes
 * it a retry of a part rather than a second measurement.
 *
 * A report whose market or questions are `unmeasured` resumes as
 * `unmeasured`: the pass then has no question to ask and composes the same
 * marketless report it is retrying, which is the truth about it. Nothing
 * here can make a report better than the one it read.
 */
function resumeMarket(sections: Sections, report: StoredReport): void {
  const market = report.market;
  sections.profile =
    market.kind === "unmeasured"
      ? unmeasured(market.reason, market.at)
      : { kind: market.kind, value: market.value.profile, at: market.at };
  sections.marketRows =
    market.kind === "unmeasured"
      ? unmeasured(market.reason, market.at)
      : { kind: market.kind, value: market.value.suggestions, at: market.at };
  sections.marketFrom = report.marketFrom ?? null;
  sections.questions = report.questions;
  sections.selected =
    report.questions.kind === "unmeasured" ? [] : report.questions.value.map((question) => question.search);
}

/**
 * Issue 715 — the question SERPs a retry that is not retrying them starts
 * from, so the two cards counted over them are rebuilt from the answers the
 * report already showed.
 *
 * The battery beside them is `noBattery` per question, which is exactly
 * what a free pass stores: §6.2's two engines are on §6.4's never-pull list
 * for this path, so every free report's rows already carry them as
 * `not_attempted`. A retry is a free-path control — it is drawn on the free
 * report and nowhere else — so this loses no measurement anybody made.
 */
function resumeSerps(sections: Sections, report: StoredReport): void {
  const at = report.verdict.measuredAt;
  for (const serp of report.serps) sections.serps.push(serp);
  for (let i = 0; i < report.serps.length; i += 1) sections.battery.push(noBattery(at));
}

/** Everything outstanding, before any stage has run. `not_attempted` is
 *  the honest arm for work a ceiling may yet stop: it says we did not get
 *  to it, which no 0 and no empty list can say. */
function freshSections(at: Date): Sections {
  return {
    measurement: null,
    profile: unmeasured("not_attempted", at),
    marketFrom: null,
    marketThin: null,
    placeFrom: null,
    marketRows: unmeasured("not_attempted", at),
    selected: [],
    sealed: false,
    questions: unmeasured("not_attempted", at),
    serps: [],
    battery: [],
    pageAsked: [],
    pageSerps: [],
    pageBattery: [],
    pageRetired: [],
    pageQuestions: null,
    siteName: null,
    rivals: unmeasured("not_attempted", at),
    rivalSizes: unmeasured("not_attempted", at),
    rivalRows: null,
    sources: [],
    aiAnswers: null,
    presence: null,
    coherence: { verdict: "unjudgeable", measuredCount: 0 },
    siteCrawl: null,
    pagesRead: null,
    concludedCategory: undefined,
    market: null,
    founderBuyer: null,
    poolRivals: null,
    marketPrompts: [],
    prompts: null,
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
  gte(column: string, value: string): MinimalQueryBuilder<T>;
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
  /** `RunScanArgs.locale`. Stages read `localeOfPass`, never this. */
  locale?: Locale;
  /** `RunScanArgs.concludesMarket`. */
  concludesMarket?: boolean;
  /** `RunScanArgs.asksTrackedPrompts`. */
  asksTrackedPrompts?: boolean;
  /** `RunScanArgs.measuredSince`, as days before the pass started: the
   *  oldest stored read this pass may be served (issue 1170). */
  sinceDays?: number;
  /** SPEC §2's "Retry this part" (issue 715): the report this pass is
   *  re-measuring one part of, and which part. Its presence is what makes
   *  `reading_your_market` a read of the stored report rather than a
   *  purchase — see `retry.ts` for why that stage and no other. */
  retry?: { report: StoredReport; part: RetryPart };
}

/** What the report records of where it was measured (D66): nothing for the
 *  United States in English with no fallback, which is what every report
 *  before D66 was. */
function reportLocale(m: DomainMeasurement): ReportLocale | null {
  const usual = m.locale.country === DEFAULT_LOCALE.country && m.locale.language === DEFAULT_LOCALE.language;
  const place = m.locale.place;
  const alsoServes = m.alsoServes ?? [];
  const guessed = m.localeBasis === "default";
  if (usual && !guessed && m.localeFellBack === null && place === undefined && alsoServes.length === 0) return null;
  const listing = guessed ? listingLocaleOf(m.ownRankedRows) : null;
  return {
    country: m.locale.country,
    language: m.locale.language,
    // D67 (issue 1441): the town the pass was measured in, which the
    // measurement line names.
    ...(place === undefined ? {} : { place }),
    ...(m.localeFellBack === null ? {} : { fellBack: m.localeFellBack }),
    ...(alsoServes.length === 0 ? {} : { alsoServes }),
    ...(guessed ? { basis: "default" as const } : {}),
    ...(listing === null || listing.country === m.locale.country ? {} : { listingReads: listing.country }),
  };
}

/** What a pass stores as the site's market where the founder set none: what
 *  it read of the site, else the country its listing reads as, and never a
 *  guess (D66). */
function readSiteLocale(m: DomainMeasurement): Locale | null {
  return m.localeBasis === "default" ? listingLocaleOf(m.ownRankedRows) : m.locale;
}

/** The country and language this pass measures in (D66): the one stage one
 *  settled — the site's stored answer, else the reading of its home page.
 *  Before stage one has read the site nothing is bought, so the fallback
 *  below is reached by no vendor call. */
function localeOfPass(a: Pick<StageArgs, "sections" | "locale">): Locale {
  return a.sections.measurement?.locale ?? a.locale ?? DEFAULT_LOCALE;
}

/** The pass measures in `placed` from here on (issue 1441). */
function inPlace(sections: Sections, placed: PassPlace): void {
  if (sections.measurement === null) return;
  sections.measurement = { ...sections.measurement, locale: { ...sections.measurement.locale, place: placed.place } };
  sections.placeFrom = placed.from;
}

/** The pass measures in its country again (issues 1454, 1480): the town
 *  `inPlace` set is not this business's market. */
function outOfPlace(sections: Sections): void {
  if (sections.measurement === null) return;
  const locale: Locale = { ...sections.measurement.locale };
  delete locale.place;
  sections.measurement = { ...sections.measurement, locale };
  sections.placeFrom = null;
}

/** How long a free pass waits for the search vendor's list of cities: it
 *  answers in under a second, and a pass that does not have it measures in
 *  the country. */
const FREE_PLACE_LOOKUP_MS = 6_000;

/** A town a free pass measures in, and which evidence named it. */
interface PassPlace {
  place: Place;
  from: PlaceFrom;
}

/** The search vendor's name for `place` in the pass's country, or `null`
 *  where the list does not hold it or could not be read. Never throws. */
async function locatedIn(place: Place, m: DomainMeasurement, near: readonly Place[] = []): Promise<{ location: string | null } | null> {
  try {
    const { placeLocation } = await import("@/lib/vendors/dataforseo");
    return await placeLocation({ place, country: m.locale.country, timeoutMs: FREE_PLACE_LOOKUP_MS, near });
  } catch (error) {
    console.log(JSON.stringify({ event: "free_place_unlocated", because: error instanceof Error ? error.message : String(error) }));
    return null;
  }
}

function logPassPlace(fields: { from: PlaceFrom | null; place: string | null; location: string | null }): void {
  console.log(JSON.stringify({ event: "free_place_located", ...fields }));
}

/**
 * The town a free pass measures in from the home page's structured data
 * (D67; owner ruling 2026-10-15, issue 1441), in the order of the
 * evidence, stopping at the first that holds: the structured address
 * `statedPlace` reads, which stands even where the vendor's list does not
 * hold it (the town is searched by name and read in its country); then a
 * business's `areaServed`, and an address written as one string, each only
 * where the list holds the town in the site's country. `null` where none
 * holds or the pass already has a place: the profile call's reading of the
 * page is tried next (`townFromPage`). Never throws.
 */
async function statedPlaceOfPass(m: DomainMeasurement): Promise<PassPlace | null> {
  if (m.locale.place !== undefined || m.stated === undefined) return null;
  const candidates = placeCandidates(m.stated);
  const served = candidates.filter((c) => c.from === "area_served").map((c) => c.place);
  for (const candidate of candidates) {
    const near = candidate.from === "area_served" ? served.filter((other) => other !== candidate.place) : [];
    const found = await locatedIn(candidate.place, m, near);
    if (candidate.from === "address" || (found !== null && found.location !== null)) {
      const location = found?.location ?? null;
      logPassPlace({ from: candidate.from, place: candidate.place.name, location });
      return { place: location === null ? candidate.place : { ...candidate.place, location }, from: candidate.from };
    }
  }
  return null;
}

/** Whether a free pass measures in `place` (issue 1480): `townHolds` over
 *  the profile and the home page the pass read, the paid path's rule. */
function holdsTown(place: Place, profile: Profile, m: DomainMeasurement, domain: string): boolean {
  const held = townHolds({
    place,
    profile,
    ...(m.stated === undefined ? {} : { stated: m.stated }),
    home: m.text.home === null ? null : { url: `https://${domain}/`, title: "", text: m.text.home },
  });
  if (!held) console.log(JSON.stringify({ event: "free_place_dropped", because: "not_served" }));
  return held;
}

/** The town the profile call read off the home page's own words (rule 4 of
 *  issue 1441), where the vendor's list holds it in the site's country: a
 *  town the model made up, or one abroad, is dropped. */
async function townFromPage(town: string | undefined, m: DomainMeasurement): Promise<PassPlace | null> {
  const place = placeOf(town);
  if (place === null) return null;
  const found = await locatedIn(place, m);
  if (found === null || found.location === null) {
    logPassPlace({ from: null, place: place.name, location: null });
    return null;
  }
  logPassPlace({ from: "page_text", place: place.name, location: found.location });
  return { place: { ...place, location: found.location }, from: "page_text" };
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
 *
 * **The site's crawl may run beside the market** (issue 1419), and the pass
 * waits for it before it ends, so the report is composed with its site
 * issues in it.
 */
async function runStages(a: StageArgs): Promise<void> {
  const crawl: SiteCrawl = { reading: Promise.resolve() };
  try {
    await stagesOf(a, crawl);
  } finally {
    await crawl.reading;
  }
}

/**
 * Issue 1551: the score's Content over the site's measured pages — the
 * pages ReachKit has live for it, newest first, then the pages its crawl
 * read — up to the tier's allowance (`withMeasuredPages`). A free scan has
 * no site and an allowance of none, so it reads nothing here. A list of our
 * pages that cannot be read leaves the crawl's pages to stand alone.
 */
async function measuredContent(a: StageArgs, m: DomainMeasurement, crawled: readonly string[]): Promise<DomainMeasurement["drivers"]["answerability"]> {
  let ours: readonly string[] = [];
  if (a.siteId !== undefined) {
    try {
      const { readLivePages } = await import("@/lib/known-content/ours");
      ours = await readLivePages(a.siteId);
    } catch (error) {
      console.log(JSON.stringify({ event: "live_pages_unread", because: error instanceof Error ? error.message : String(error) }));
    }
  }
  const read = await withMeasuredPages(a.cost, {
    measurement: m,
    domain: a.domain,
    tier: a.tier,
    at: a.startedAt,
    pages: [...ours, ...crawled],
    ...(a.sinceDays === undefined ? {} : { ownWindowDays: a.sinceDays }),
  });
  return read.drivers.answerability;
}

/** The crawl of the customer's own site, while it runs (issue 1419). */
interface SiteCrawl {
  reading: Promise<void>;
}

async function stagesOf(a: StageArgs, crawl: SiteCrawl): Promise<void> {
  const { scanId, bounds, cost, domain, sections, retry } = a;

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
    attempt("reading_your_site", () =>
      measureDomain(cost, {
        domain,
        at: a.startedAt,
        tier: a.tier,
        ...(a.locale === undefined ? {} : { locale: a.locale }),
        ...(a.sinceDays === undefined ? {} : { ownWindowDays: a.sinceDays }),
        ...(a.siteId === undefined ? {} : { listingDecides: true }),
      })
    )
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
  const siteLocale = failed(measurement) || measurement.homeRefusal !== null ? null : readSiteLocale(measurement);
  if (siteLocale !== null && a.siteId !== undefined && a.locale === undefined) {
    // The reading is the site's from here on (D66). A write that fails
    // costs nothing this pass, which already holds it: the next pass reads
    // the site again.
    await writeSiteLocale(a.siteId, siteLocale).catch((error: unknown) =>
      console.log(
        JSON.stringify({ event: "site_locale_unwritten", because: error instanceof Error ? error.message : String(error) })
      )
    );
  }

  // A site whose own home document could not be read — refused by the
  // fetcher, or a read that raised — is not measured by anything after it,
  // and the pass does not pretend otherwise: it stops here, and the ending
  // is `site_unreadable` with the refusal, never `complete` (issue #479).
  if (failed(measurement) || measurement.homeRefusal !== null) {
    bounds.siteUnreadable(failed(measurement) ? null : measurement.homeRefusal);
    return;
  }

  // D67 for the free pass (owner ruling 2026-10-15, issue 1441): a home page
  // that states the town it serves is measured there, as a paid pass
  // measures the place it settled. Looked up beside the crawl and the
  // access rules, and in force before the market is read.
  const placing = a.parameters.measuresStatedPlace && a.concludesMarket !== true ? statedPlaceOfPass(measurement) : Promise.resolve(null);

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
  //
  // **Beside the market, where the market does not read it** (issue 1419).
  // A free pass reads its market from the home document alone, and waiting
  // for up to 100 pages first cost its Google reads a median of 8.7 s of the
  // queue (the stored free scans of 2026-10-08 to 2026-10-14): the one
  // read stripe.com asked gave up at the deadline. A pass that concludes
  // its market reads the crawled pages for it, so it still waits here.
  const readTheSite = async (): Promise<void> => {
    try {
      const { buildSiteProfileWithCrawl } = await import("@/lib/site-profile");
      const { readingOf } = await import("@/lib/site-issues");
      const { profile, crawl } = await buildSiteProfileWithCrawl(cost, {
        domain,
        // `CanonicalDomain` is the branded string itself, and the home
        // address the measurement read is `https://<domain>/` — the same
        // one `measureDomain` builds, whose own helper is private to that
        // module. The crawl re-reads nothing: this address is row one of
        // the inventory and is already in the `fetches` cache.
        homeUrl: `https://${domain}/`,
        // Issue 1379: where bot protection answered the plain read and the
        // vendor's browser returned the site, that document is the home
        // page — the crawl's own read of it would be the protection's.
        homeHtml: measurement.renderedHome ?? null,
        sitemaps: measurement.robots.kind === "unmeasured" ? [] : measurement.robots.value.sitemaps,
        tier: a.tier,
        locale: measurement.locale,
      });
      const content = await measuredContent(a, measurement, crawl.pages.map((page) => page.url));
      // SPEC §9: the technical-issue checks run over exactly this crawl —
      // the one run, nothing fetched beyond its set (2026-09-12).
      if (!bounds.abandoned() && !sections.sealed) {
        if (sections.measurement !== null) {
          sections.measurement = { ...sections.measurement, drivers: { ...sections.measurement.drivers, answerability: content } };
        }
        if (profile !== null) sections.siteName = promptSiteName(profile.siteName, domain);
        sections.siteCrawl = readingOf(crawl);
        sections.pagesRead = crawl.pages.map((page) => ({
          url: page.url,
          title: page.title,
          h1: page.h1,
          text: page.text,
        }));
      }
    } catch (error) {
      console.log(
        JSON.stringify({
          event: "site_profile_undeterminable",
          because: error instanceof Error ? error.message : String(error),
        })
      );
    }
  };
  if (bounds.stopNow() === null) crawl.reading = readTheSite();
  if (a.concludesMarket === true) await crawl.reading;

  // Reports the access rules stage one already read: it buys nothing and
  // waits for nothing, so it has nothing to spend its budget on.
  if (bounds.stopNow() !== null) return;
  await enter("reading_access_rules");
  await exitStage(scanId, "reading_access_rules");

  const placed = await placing;
  if (bounds.abandoned()) return;
  if (placed !== null) inPlace(sections, placed);

  if (bounds.stopNow() !== null) return;
  await enter("reading_your_market");
  // **A retry reads the market it already has** (SPEC §2, issue 715). The
  // stage is entered and exited so the screen's stage list still reads
  // straight through, and it buys nothing: `resumeMarket` puts the stored
  // report's profile, suggestions, twelve searches and wording back into
  // `sections`, which is the one part of a free pass the ledger cannot
  // return for free (`llm()` caches at `freshnessDays: 0`). Re-deriving it
  // would cost the two nano calls again and could come back with different
  // questions — a different report at the same address, not a retried part.
  const marketFromCents = cost.spentCents();
  let market: StageOutcome<void> = SKIPPED_STAGE;
  if (retry === undefined) {
    // The market spends from the purse it shares with the twelve, and the
    // twelve get what it left (issue 835): an extra seed is only ever
    // bought with the SERPs of questions the pass does not have.
    market = await inBudget(
      "reading_your_market",
      (b, abandoned) => readMarket({ ...a, bounds: b }, abandoned),
      MARKET_PURSE_CENTS
    );
  } else {
    resumeMarket(sections, retry.report);
  }
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
  // **A retry of a part this stage does not produce does not ask again**
  // (issue 715). The stored SERPs go back into `sections` instead, so the
  // two cards counted over them are rebuilt from the same answers the
  // report already showed — never re-derived from an empty battery, which
  // would replace a measured card with an unmeasured one for the sake of a
  // part that is neither. Where the part *is* this stage's, it runs: the
  // questions already bought come back from `fetches` free of charge and
  // only the ones the ceiling cut off are paid for.
  let twelve: StageOutcome<void> = SKIPPED_STAGE;
  let asking: Promise<void> = Promise.resolve();
  if (retry !== undefined && RETRY_STAGE[retry.part] !== "asking_the_twelve") {
    resumeSerps(sections, retry.report);
  } else {
    twelve = await inBudget(
      "asking_the_twelve",
      async (b, abandoned) => {
        // **Beside the twelve, not after them** (#1160). The page questions
        // (#919) run inside this same budget row — the same clock, the same
        // `WEEKLY` cap and the same `stopNow()` before every call — and the
        // twelve are handed to the queue first. They used to ask *after*
        // the twelve, and on the standard queue that is a second full wait
        // of two to three minutes: the weekly passes of 2026-09-21 and
        // 2026-09-28 met their ceiling inside it and never reached scoring,
        // so rivals were never sized. A standard-queue ask costs its wait
        // whether one question is in the queue or twenty-four, so asking
        // both sets together costs the pass no time.
        // The market's buyer prompts join them (#1195), so the rivals are
        // concluded from answers in the market this pass measures.
        asking = askTheTwelve({ ...a, bounds: b }, abandoned, bounds);
        await Promise.all([
          asking,
          askThePageQuestions({ ...a, bounds: b }, abandoned),
          askTheMarketPrompts({ ...a, bounds: b }),
          askTheTrackedPrompts({ ...a, bounds: b }),
        ]);
      },
      twelveCents
    );
  }
  // D63 (issue 1298): a stage that spent its clock stops waiting, and the
  // asks it left go on. The pass waits for them here — the reads still
  // queued and the one more ask of a read that failed — so what was bought
  // is scored. No new first ask starts, and every queued read gives up by
  // itself `askReserveS` before the pass's ceiling (issue 1352), so the
  // pass still ends `complete`.
  if (twelve.spent && stillCollecting(bounds, a.parameters)) await asking;
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
  // **A ceiling met during the asks still counts what they bought**
  // (#1160). Scoring buys nothing and cannot be cut off. Skipping it left
  // a pass that had paid for eleven AI Mode answers with no AI-answers
  // section at all. Only the purchase in the stage (`sizeSerpRivals`) is
  // what the ceiling stops.
  if (bounds.stopNow() !== null) {
    await crawl.reading;
    score(a);
    return;
  }
  await enter("scoring");
  await Promise.all([sizeSerpRivals(a), crawl.reading]);
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
  // D64: a weekly pass sizes one due rival again; the rest keep their size.
  const purse = a.parameters.rivalResizes === null ? a.cost : withPurse(a.cost, a.parameters.rivalResizes * PRICE_BOOK.RANKED_RIVAL_COST_C);
  const sized = await attempt("checking_your_presence", () =>
    sizeRivals(purse, {
      rivals,
      ownRanked,
      at,
      locale: localeOfPass(a),
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
 * `SERP_RIVAL_SIZING` and by what the pass has left, which is already net
 * of the reserve the opportunity typing still needs. A candidate the purse could not reach is
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

  // SPEC §6 (owner D64, issue 1301): of the top tens' domains, only the ones
  // this market holds as on-market are sized — never a publisher, an
  // aggregator or a domain a conclusion left out. The market is the one this
  // pass concluded, else the one the site holds.
  const market = sections.market ?? (await storedMarketOf(a.siteId));
  if (bounds.abandoned()) return;
  const { inTopTens, domains: candidates } = serpDomainsToSize({
    serps,
    ownDomain: a.domain,
    market,
    answers: sections.marketPrompts,
    alreadySized: current,
    max: SERP_RIVAL_SIZING.candidatesMax,
  });
  logSerpCandidates(candidates.length, current.size, inTopTens);
  if (candidates.length === 0) return;

  const measurement = sections.measurement;
  const at = measurement === null ? a.startedAt : measurement.drivers.foundations.at;
  const ownRanked = measurement === null ? 0 : ownRankedValue(measurement.ownRanked);
  const purse = Math.min(
    SERP_RIVAL_SIZING.candidatesMax * PRICE_BOOK.RANKED_RIVAL_COST_C,
    bounds.remainingCents()
  );

  const sized = await attempt("scoring", () =>
    sizeRivals(withPurse(cost, purse), {
      rivals: candidates,
      ownRanked,
      at,
      locale: localeOfPass(a),
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
function logSerpCandidates(candidates: number, alreadySized: number, inTopTens: number): void {
  console.log(JSON.stringify({ event: "serp_rival_candidates", candidates, alreadySized, inTopTens }));
}

/** The market a site holds, or `null` where it holds none or it could not
 *  be read: a pass that knows no market sizes no top-ten domain (D64). */
async function storedMarketOf(siteId: string | undefined): Promise<MarketConclusion | null> {
  if (siteId === undefined) return null;
  try {
    const { readSiteMarket } = await import("@/lib/market/infer/stored");
    return (await readSiteMarket(siteId))?.stored.current ?? null;
  } catch {
    return null;
  }
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

/**
 * What the profile call reads (§6.7 step 1): the site's own home and pricing
 * text, or `null` where there is none to read.
 *
 * **A site its bot protection kept the reader off** (SPEC §2, owner
 * 2026-10-10, issue 1387), or whose home page did not answer in time
 * (issue 1449), has no text of its own, and only then is its
 * listing in search read in its place: the ranked rows stage one already
 * bought, with the title and snippet Google shows for each page. A listing
 * too thin to name a market from is not read, and the reason is kept.
 */
function marketReadingOf(
  a: StageArgs,
  measurement: DomainMeasurement
): { home: string; pricing?: string } | { search: string } | null {
  if (measurement.text.home !== null) {
    return {
      home: measurement.text.home,
      ...(measurement.text.pricing === null ? {} : { pricing: measurement.text.pricing }),
    };
  }
  // Issue 1449: and so is one whose home page did not answer in time.
  if (measurement.protection === undefined && measurement.homeTimedOut !== true) return null;
  return listingReadingOf(a, measurement);
}

/** The site's listing in search as the profile call's reading, or `null`
 *  where it is too thin to name a market from (and why is kept). */
function listingReadingOf(a: StageArgs, measurement: DomainMeasurement): { search: string } | null {
  const footprint = searchFootprintOf({ domain: a.domain, rows: measurement.ownRankedRows });
  if (footprint.kind === "thin") {
    a.sections.marketThin = footprint.because;
    logMarketFromSearch({ read: false, because: footprint.because, searches: footprint.searches, descriptive: footprint.descriptive });
    return null;
  }
  logMarketFromSearch({ read: true, searches: footprint.searches, descriptive: footprint.descriptive, pages: footprint.pages });
  return { search: footprint.text };
}

/** Issue 1450: whether the stage still has the time for a second profile
 *  call — at least half its own seconds left. A first call that failed
 *  fast (a refused request) leaves it; one that ran out its budget does
 *  not, so the free pass's inference arithmetic is not stretched. */
function roomForAnotherProfile(bounds: Bounds): boolean {
  return bounds.stopNow() === null && bounds.remainingMs() >= (STAGE_BUDGETS.reading_your_market.seconds * 1000) / 2;
}

/** Counts only: never a search, a title or a snippet. */
function logMarketFromSearch(fields: { read: boolean; because?: ThinFootprint; searches?: number; descriptive?: number; pages?: number }): void {
  console.log(JSON.stringify({ event: "market_from_search", ...fields }));
}

/**
 * Whether a stored report is one this build would measure further (issue
 * 1387): bot protection kept the reader off the site, and the pass that
 * stored it never tried to read a market from search; or (issue 1450) the
 * site ranks, its market was not read, and that pass is a day old. Such a
 * report is not served inside the re-scan window. One whose listing was read and found too thin
 * carries that reason, and is served as any other.
 */
function awaitsMarketFromSearch(report: StoredReport, now: Date): boolean {
  if (report.market.kind !== "unmeasured" || report.market.because !== undefined) return false;
  if (report.onPage.kind === "unmeasured" && report.onPage.because === BOT_PROTECTION) return true;
  // Issue 1450: a site that ranks, whose market a vendor or the model did
  // not answer for. This build reads one from its ranked rows instead —
  // but a pass that failed so is measured again at most once a day, so a
  // site that keeps failing costs at most one extra free pass a day.
  const ageMs = now.getTime() - new Date(report.verdict.measuredAt).getTime();
  return report.market.reason === "undeterminable" && report.ownRankedRows.length > 0 && ageMs >= MARKET_REMEASURE_H * 3_600_000;
}

/** §6.7 steps 1–4: profile → measured market → the twelve → their wording.
 *  Each step's failure stops the chain at that step and leaves everything
 *  after it on the arm it was initialised with; nothing downstream is
 *  synthesised from a step that did not answer. */
async function readMarket(a: StageArgs, abandoned: () => boolean): Promise<void> {
  const { bounds, cost, sections } = a;
  const measurement = sections.measurement;
  if (measurement === null) return;
  const pages = marketReadingOf(a, measurement);
  if (pages === null) return;
  let reading = pages;

  let profile = await attempt("reading_your_market", () => deriveProfile(cost, { locale: localeOfPass(a), ...pages }));
  if (abandoned()) return;
  // Issue 1450: the site's pages were read and the model gave no profile of
  // them (trello.com's call came back `http_400`). A site that ranks has a
  // listing in search, and that is read in their place, as for a site its
  // bot protection kept the reader off — but only where the pass still has
  // the time for this call and the phrasing after it.
  if ((failed(profile) || profile.kind === "unmeasured") && "home" in reading && roomForAnotherProfile(bounds)) {
    const listing = listingReadingOf(a, measurement);
    if (listing !== null) {
      reading = listing;
      profile = await attempt("reading_your_market", () => deriveProfile(cost, { locale: localeOfPass(a), ...listing }));
      if (abandoned()) return;
    }
  }
  if (failed(profile)) return;
  if ("search" in reading) {
    // The model was told to name no category the listing does not support
    // (issue 1387). Where it named none, there is no market, and none is
    // guessed: the pass goes on as it did before the listing was read.
    if (profile.kind !== "unmeasured" && profile.value.category === "") {
      sections.marketThin = "market_not_named";
      logMarketFromSearch({ read: false, because: "market_not_named" });
      return;
    }
    if (profile.kind !== "unmeasured") sections.marketFrom = "search";
  }
  sections.profile = profile;
  if (profile.kind === "unmeasured") return;
  // Issue 1454: on a paying site the customer's corrections to who buys
  // and what the business does are what its searches are chosen by. The
  // report keeps the profile as read.
  const selecting = a.siteId !== undefined && a.concludesMarket === true ? await withFounderEdits(a.siteId, profile.value) : profile.value;
  if (abandoned()) return;
  // Issues 1454 and 1480: a town is the market of a business that sells
  // there, by the rule a paid pass holds its place to. One the profile
  // reads as selling across its country or beyond, or as software, is
  // measured there, whatever address its home page states (hubspot.com
  // states Cambridge, MA, and was asked one search of it). Nothing has been
  // bought in the town yet: the place is first read by the seeds below.
  const placedIn = sections.measurement?.locale.place;
  if (a.concludesMarket !== true && sections.placeFrom !== null && placedIn !== undefined && !holdsTown(placedIn, selecting, measurement, a.domain)) {
    outOfPlace(sections);
  }

  // SPEC §6 (owner D28, #1185): the market is ReachKit's to keep current.
  // Re-checked here, before anything is bought for it, so this pass seeds
  // and measures the market that stands after the check.
  let measuredUnder = a.category;
  let synonyms: readonly string[] = [];
  if (a.concludesMarket === true && a.siteId !== undefined && sections.pagesRead !== null) {
    try {
      const { concludeMarketForPass } = await import("./market-conclusion");
      const concluded = await concludeMarketForPass({
        siteId: a.siteId,
        domain: a.domain,
        scanId: a.scanId,
        cost,
        pages: sections.pagesRead,
        at: a.startedAt,
        ...(measurement.stated === undefined ? {} : { stated: measurement.stated }),
      });
      if (abandoned()) return;
      if (concluded !== null) {
        // D67 (issue 1318): from here the pass measures where the business
        // serves — the place this conclusion settled, or none.
        const country: Locale = { country: measurement.locale.country, language: measurement.locale.language };
        sections.measurement = { ...measurement, locale: concluded.place === null ? country : { ...country, place: concluded.place } };
        measuredUnder = concluded.category;
        synonyms = concluded.synonyms;
        sections.concludedCategory = concluded.category;
        sections.market = concluded.market;
        sections.founderBuyer = concluded.founderBuyer;
        if (!concluded.rivalsOverridden) {
          sections.poolRivals = new Set(concluded.market.rivals.map((r) => r.domain));
        }
      }
    } catch (error) {
      console.log(
        JSON.stringify({
          event: "market_conclusion_failed",
          because: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  // Issue 1441, rule 4: where the structured data named no town, the town
  // the profile call read off the page's own words, once the vendor's list
  // holds it.
  if (a.parameters.measuresStatedPlace && a.concludesMarket !== true && sections.measurement !== null && localeOfPass(a).place === undefined) {
    const fromPage = await townFromPage(selecting.town, sections.measurement);
    if (abandoned()) return;
    if (fromPage !== null && holdsTown(fromPage.place, selecting, measurement, a.domain)) inPlace(sections, fromPage);
  }

  // SPEC §6 thin markets (#778): the first seed is the one every pass buys.
  // The rest of the ladder is bought one seed at a time, only while short —
  // except the market's other names, which are bought with the first inside
  // the same three extra purchases (#1159): its searched terms where it
  // holds any (D65, issue 1303), else a concluded market's synonyms.
  const place = localeOfPass(a).place;
  const searched = marketSeeds(sections.market, place);
  // D67: a local business's market is bought for its place, so every seed
  // is the service plus the place.
  const ladder = seedLadder(selecting, measuredUnder, synonyms, searched);
  const seeds = place === undefined ? ladder : [...new Set(ladder.map((seed) => localSearch(seed, place)))];
  // Issue 1454: the other lines the business sells are bought with the
  // first while the purse holds each of them and the questions after.
  const lines = offeringSeeds(selecting).filter((_, i) =>
    affordsSeed({ remainingCents: bounds.remainingCents() - (i + 1) * PRICE_BOOK.SUGGESTIONS_COST_C, selected: BATTERY.QUESTIONS })
  );
  const withFirst = (searched.length > 0 ? searched : [...lines, ...synonyms]).map((seed) => (place === undefined ? seed : localSearch(seed, place)));
  const boughtWithFirst = (seed: string): boolean => withFirst.some((x) => x.trim().toLowerCase() === seed.toLowerCase());
  const leading = seeds.slice(1).findIndex((seed) => !boughtWithFirst(seed));
  const upfront = Math.min(leading === -1 ? seeds.length - 1 : leading, a.parameters.extraSeeds);
  // The site's own footprint, the same number derivation bands by, read
  // before any market is bought: every suggestions purchase asks only for
  // rows inside its window (issue 846), and selection never takes a search
  // outsized for it (SPEC §6 right-sizing, issue 830).
  const ownRanked = ownRankedValue(measurement.ownRanked);
  if (bounds.stopNow() !== null) return;
  const market = await attempt("reading_your_market", () =>
    deriveMarketSet(cost, { seeds: seeds.slice(0, 1 + upfront), ownRanked, locale: localeOfPass(a) })
  );
  if (abandoned()) return;
  // Issue 1450: suggestions that did not come back (hiverhq.com's timed
  // out) are not the end of the market. The site's own ranked rows, and
  // any rival's the pass reads below, are the pool selection already
  // widens into, and the ladder's further seeds are still bought while the
  // pass is short. Where none of them answered either, the questions are
  // chosen from the pool alone and the record keeps that the suggestions
  // were not read.
  const suggestionsRead = !failed(market) && market.kind !== "unmeasured";
  sections.marketRows = failed(market) ? unmeasured("undeterminable", a.startedAt) : market;
  if (!suggestionsRead && poolOf(sections).length === 0) return;
  const bought: readonly SuggestionRow[] = suggestionsRead ? market.value : [];

  // The market's other names are its words too (#1195): a search in them is
  // about this market, not off it. And the market in force says which of
  // its own searches are measured and which searches never are (D65).
  let measuredMarket = measuredMarketOf(sections.market, place);
  // Issue 1549: what this site's passes measured in the last weeks, so the
  // week's twelve read something new. A correction re-reads its own week.
  const recent = a.siteId === undefined || a.tier !== "weekly" || a.correction ? [] : await recentSearches(a.siteId, a.startedAt);
  const category = (): Pick<Parameters<typeof selectTwelve>[0], "category" | "synonyms" | "measured" | "place" | "recent"> => ({
    ...(measuredUnder === undefined ? {} : { category: measuredUnder }),
    ...(recent.length === 0 ? {} : { recent }),
    synonyms: [...synonyms, ...searched],
    ...(measuredMarket === undefined ? {} : { measured: measuredMarket }),
    // Issue 1441: a free pass with a town has no market to say where it
    // measures; the town is no part of what the business sells.
    ...(place === undefined ? {} : { place }),
  });
  // Issue 1454: a business that sells several lines has its searches
  // spread across them by their weight, chosen from twice as many.
  const offerings = offeringsOf(selecting);
  const spread = (pick: (limit: number) => SelectedSearch[], limit: number = BATTERY.QUESTIONS): SelectedSearch[] =>
    offerings.length < 2 ? pick(limit) : spreadAcrossOfferings(pick(limit * 2), offerings, limit, selecting.language);
  const widen = (floors?: readonly number[], limit?: number): SelectedSearch[] => {
    const rows = sections.marketRows;
    return spread(
      (wanted) =>
        selectWidened({
          profile: selecting,
          suggestions: rows.kind === "unmeasured" ? [] : rows.value,
          pool: poolOf(sections),
          ownRanked,
          ...category(),
          ...(floors === undefined ? {} : { floors }),
          limit: wanted,
        }),
      limit
    );
  };
  // D65: before a search is worded and asked, the ones the market holds no
  // judgement for are judged — the twelve and their runners-up in one call —
  // and the twelve are chosen again without the ones that are off it.
  const judgeThenPhrase = async (): Promise<void> => {
    const marketNow = sections.market;
    if (measuredMarket !== undefined && marketNow !== null && a.siteId !== undefined && bounds.stopNow() === null) {
      if (unjudged(sections.selected, measuredMarket).length > 0) {
        const { judgeSearchesForPass } = await import("./market-conclusion");
        const judged = await judgeSearchesForPass({
          siteId: a.siteId,
          cost,
          market: marketNow,
          searches: unjudged(widen(undefined, BATTERY.QUESTIONS * 2), measuredMarket),
        });
        if (abandoned()) return;
        if (judged !== null) {
          sections.market = judged;
          measuredMarket = measuredMarketOf(judged, place);
          sections.selected = widen();
        }
      }
    }
    return phrase(a, abandoned);
  };

  sections.selected = spread((limit) => selectTwelve({ profile: selecting, market: [...bought], ownRanked, ...category(), limit }));
  if (!isShort(sections.selected)) return judgeThenPhrase();

  // Short. Widen in SPEC §6's order, stopping as soon as twelve survive:
  // the ranked rows the pass already buys join the pool (the rivals' are
  // read now rather than in `checking_your_presence`, which then sizes
  // nothing), then further seeds at the first step, then the lower steps.
  if (a.parameters.sizesRivals && bounds.stopNow() === null) await sizeTrackedRivals(a);
  if (abandoned()) return;
  sections.selected = widen([SELECTION.volumeFloorPerMonth]);
  // What the pass would ask if it stopped here. The free path reads every
  // volume step, because that is what it falls back to below.
  const held = (): number =>
    a.parameters.ladderStopsAt === "questions" ? widen().length : sections.selected.length;
  const readEnough = (): boolean =>
    a.parameters.ladderStopsAt === "questions"
      ? held() >= SELECTION.freeLadderMinQuestions
      : !isShort(sections.selected);

  for (const seed of seeds.slice(1 + upfront, 1 + a.parameters.extraSeeds)) {
    if (readEnough() || bounds.stopNow() !== null) break;
    // Widening never spends what the questions already held are asked
    // with (issues 835 and 1235).
    if (!affordsSeed({ remainingCents: bounds.remainingCents(), selected: held() })) break;
    const more = await attempt("reading_your_market", () => deriveMarketSet(cost, { seeds: [seed], ownRanked, locale: localeOfPass(a) }));
    if (abandoned()) return;
    if (failed(more)) break;
    sections.marketRows = joinMarketSets(sections.marketRows, more);
    sections.selected = widen([SELECTION.volumeFloorPerMonth]);
  }

  if (isShort(sections.selected)) sections.selected = widen();
  return judgeThenPhrase();
}

/** Issue 1549: the searches this site's passes measured in the
 *  `SELECTION.freshWeeks` weeks before `at`, from their stored reports.
 *  None where they cannot be read: the twelve are then chosen as before. */
async function recentSearches(siteId: string, at: Date): Promise<string[]> {
  try {
    const since = new Date(at.getTime() - SELECTION.freshWeeks * 7 * 86_400_000).toISOString();
    const { data, error } = await untyped(dbAdmin())
      .from<{ questions: unknown }>("scans")
      .select("questions:report->questions")
      .eq("site_id", siteId)
      .gte("created_at", since);
    if (error !== null) return [];
    return (data ?? []).flatMap((row) => {
      const questions = row.questions as { kind?: unknown; value?: unknown } | null;
      if (questions?.kind !== "measured" || !Array.isArray(questions.value)) return [];
      return questions.value.flatMap((question: { search?: { keyword?: unknown } }) =>
        typeof question?.search?.keyword === "string" ? [question.search.keyword] : []
      );
    });
  } catch {
    return [];
  }
}

/** The profile with the customer's own corrections applied (issue 1454);
 *  the profile as read where their edits cannot be read. */
async function withFounderEdits(siteId: string, profile: Profile): Promise<Profile> {
  try {
    const [{ readBusinessEdits }, { profileWithEdits }] = await Promise.all([
      import("@/lib/site-profile/business/edits"),
      import("@/lib/business/understanding"),
    ]);
    return profileWithEdits(profile, await readBusinessEdits(siteId));
  } catch {
    return profile;
  }
}

/** §6.7 step 4: the selected searches, worded — as many of them as the
 *  pass can pay to ask (issue 873). */
async function phrase(a: StageArgs, abandoned: () => boolean): Promise<void> {
  const { bounds, cost, sections } = a;
  if (bounds.stopNow() !== null) return;
  const place = localeOfPass(a).place;
  if (a.parameters.measuresStatedPlace && place !== undefined) sections.selected = inTheTown(sections.selected, place);
  if (a.parameters.questionsFitThePurse) sections.selected = whatThePurseCanAsk(a);
  const questions = await attempt("reading_your_market", () =>
    phraseQuestions(cost, { selected: sections.selected, locale: localeOfPass(a) })
  );
  if (!failed(questions) && !abandoned()) sections.questions = questions;
}

/**
 * The searches a free pass asks for a business with a town, each asked of
 * the town (owner ruling 2026-10-15, issue 1441): a "near me" search is
 * answered for wherever it is asked from, and one that names no place for
 * the whole country, so each becomes the service plus the town
 * (`localSearch`). Two that become one search are asked once, in the
 * selection's order; each keeps the volume the vendor listed it at.
 */
function inTheTown(selected: readonly SelectedSearch[], place: Place): SelectedSearch[] {
  const seen = new Set<string>();
  const out: SelectedSearch[] = [];
  for (const search of selected) {
    const keyword = localSearch(search.keyword, place);
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(keyword === search.keyword ? search : { ...search, keyword, rank: out.length + 1 });
  }
  return out.map((search, i) => (search.rank === i + 1 ? search : { ...search, rank: i + 1 }));
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
  const sized = sections.rivalRows ?? new Map<string, readonly RankedRow[]>();
  const admitted = sections.poolRivals;
  const rivals = admitted === null ? sized : new Map([...sized].filter(([domain]) => admitted.has(domain)));
  return poolFrom({ own: sections.measurement?.ownRankedRows ?? [], rivals });
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

/** The tier's SERP window, narrowed to the pass's own period where it has
 *  one (issue 1170): a weekly pass's AI input is never a SERP bought before
 *  its week wearing this week's date. */
function serpWindowOf(a: StageArgs): number {
  const days = a.parameters.serpWindowDays;
  return a.sinceDays === undefined ? days : Math.min(days, a.sinceDays);
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
function untilCeiling(bounds: Bounds, parameters: TierParameters): number {
  return Date.now() + Math.max(0, bounds.remainingMs() - parameters.askReserveS * 1000);
}

/**
 * The wall clock one SERP request of this pass may hold (D63, issue 1298):
 * the tier's bound, and on a pass with no stage budgets never more than is
 * left of its ceiling. The free path's stage clock does not shorten its
 * bound — a shorter one only buys aborted, billed calls (issue 877).
 */
function serpAbortFor(pass: Bounds, parameters: TierParameters): number {
  if (parameters.stageBudgets) return parameters.serpAbortMs;
  return Math.max(1, Math.min(parameters.serpAbortMs, pass.remainingMs()));
}

/** How this tier's Google organic reads are queued (issue 1352). */
function queueOf(parameters: TierParameters): { priority?: "high"; pollMs: number } {
  return { ...(parameters.serpPriority === "high" ? { priority: "high" as const } : {}), pollMs: parameters.serpPollMs };
}

/** What a pass keeps beyond one request's bound to ledger and score its
 *  answer, so waiting for a read never runs the pass into its ceiling. */
const SERP_SETTLE_MS = 2_000;

/**
 * Whether the pass's clock holds one more whole SERP read (D63). On the
 * free path that is one request's bound, the time to store what it brings
 * and the time the pass keeps before its ceiling; a paid pass's bound is
 * already cut to what is left of its ceiling.
 */
function roomForOneRead(pass: Bounds, parameters: TierParameters): boolean {
  if (!parameters.stageBudgets) return pass.remainingMs() > 0;
  return pass.remainingMs() >= parameters.askReserveS * 1000 + parameters.serpAbortMs + SERP_SETTLE_MS;
}

/**
 * Whether the pass still waits for the Google reads it has posted (issue
 * 1352): until `untilCeiling`, the moment every queued read gives up by
 * itself. So waiting here never runs the pass into its ceiling.
 */
function stillCollecting(pass: Bounds, parameters: TierParameters): boolean {
  return pass.remainingMs() > parameters.askReserveS * 1000;
}

/**
 * `pass` is the pass's own bounds where `a.bounds` is one stage's: the one
 * more ask (below) is bounded by the pass's clock, not the stage's.
 */
async function askTheTwelve(a: StageArgs, abandoned: () => boolean, pass: Bounds = a.bounds): Promise<void> {
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
        locale: localeOfPass(a),
        mode: "std",
        ...queueOf(parameters),
        loadAsyncAiOverview: parameters.asyncAiOverview && !a.correction,
        scope: cacheScope(a),
        freshnessDays: serpWindowOf(a),
        abortMs: serpAbortFor(pass, parameters),
        // The pass's clock, not the stage's (issue 1352): a queued read is
        // paid for when it is posted, and the pass waits for it.
        untilMs: untilCeiling(pass, parameters),
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
      // The SERP and the battery at once (#1160): neither reads the other,
      // and on the standard queue each is minutes of waiting. Asked one
      // after the other, a weekly question cost a SERP's wait and then the
      // engines' — longer than the whole ceiling.
      const [got, battery] = await Promise.all([
        askOne(question.search.keyword),
        parameters.batteryOnTheTwelve
          ? askTheBattery(a, question.search.keyword, questions.at, engines)
          : noBattery(questions.at),
      ]);
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
  //
  // **It is bounded by the pass, not by the stage** (D63, issue 1298). On
  // the free path a read that met its 10 s bound left three of the stage's
  // thirteen seconds, so the second ask was made and its answer dropped, or
  // never made. It is asked while the report is not composed, the purse
  // still holds it, and the pass's own ceiling leaves room for one whole
  // bound; `runStages` waits for it. A paid pass has no stage clock, and
  // this is the rule it always had.
  const mayAskAgain = (): boolean =>
    !sections.sealed && !pass.abandoned() && !bounds.capHit() && roomForOneRead(pass, parameters);
  let nextRetry = 0;
  const askAgain = async (): Promise<void> => {
    for (;;) {
      const owed = worthOneMore[nextRetry];
      nextRetry += 1;
      if (owed === undefined) return;
      if (!mayAskAgain()) return;
      const got = await askOne(owed.keyword);
      // The seal the first asks are written under: a late answer is kept.
      if (sections.sealed) return;
      const cell = cellFor(got, questions.at);
      logSerpRetry({ because: owed.because, outcome: cell.kind === "unmeasured" ? "unmeasured" : "measured" });
      sections.serps[owed.index] = cell;
      if (abandoned()) rescore(a);
    }
  };

  if (worthOneMore.length > 0 && mayAskAgain()) {
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

/**
 * The market's buyer prompts (#1195), asked of AI Mode beside the twelve
 * and inside their budget: the same clock, the same cap and the same
 * deadline before the ceiling. Built from the market this pass concluded
 * (`buyerPrompts`), so a pass that moved the site to a new market reads
 * who answers in it before its rivals are concluded — the twelve may still
 * be thin there. Never in the score. A prompt that did not answer is left
 * out; nothing here throws.
 */
async function askTheMarketPrompts(a: StageArgs): Promise<void> {
  const { bounds, cost, parameters, sections } = a;
  if (!parameters.battery || parameters.marketPrompts === 0 || sections.market === null) return;
  // D49: asked in the words buyers search, for the buyer the founder named.
  const prompts = buyerPrompts(spokenMarket(sections.market, sections.founderBuyer), parameters.marketPrompts, localeOfPass(a).language, localeOfPass(a).place);
  await Promise.all(
    prompts.map(async (prompt) => {
      if (bounds.stopNow() !== null) return;
      const got = await attempt("asking_the_twelve", () =>
        aiMode(cost, {
          query: prompt,
          locale: localeOfPass(a),
          mode: parameters.serpMode,
          scope: cacheScope(a),
          untilMs: untilCeiling(bounds, parameters),
          abortMs: serpAbortFor(bounds, parameters),
        })
      );
      if (sections.sealed || failed(got) || got.kind === "unmeasured" || !got.value.answered) return;
      const cited = got.value.citedDomains.map((d) => d.toLowerCase().replace(/^www\./, ""));
      const text = got.value.text;
      // Issue 1420: the score's own reading of linked and named.
      const reading = classifyReferences(got.value.citedDomains, a.domain, { urls: got.value.citedUrls ?? [], text, siteName: sections.siteName });
      sections.marketPrompts.push({
        prompt,
        citedDomains: cited,
        namesSite: reading.cited || reading.mentioned,
        excerpt: text.slice(0, EVIDENCE_BOUNDS.excerptChars),
      });
    })
  );
  console.log(
    JSON.stringify({ event: "market_prompts", asked: prompts.length, answered: sections.marketPrompts.length })
  );
}

/**
 * SPEC §6 (owner, D19 final and D33 of 2026-10-03, #1162) — the site's
 * tracked buyer prompts, asked by the weekly pass and by a founder's
 * re-measure (owner, 2026-10-03), beside the twelve and inside their budget:
 * the same clock, the same `WEEKLY` cap and the same deadline before the
 * ceiling.
 *
 * The set is the site's own (`sites.tracked_prompts`): built from the
 * market in force the first time, kept after that, and rotated only as
 * `nextPromptSet` allows. Every prompt is asked of both engines, an
 * unbranded one `TRACKED_PROMPTS.RUNS` times and a branded one
 * `TRACKED_PROMPTS.BRANDED_RUNS` times, all at once — a standard-queue ask costs
 * its wait whether one is queued or a hundred (#1160) — and each run has
 * its own cache key, so the second is a second answer and not the first
 * served again.
 *
 * What is stored is each answer's reading — named, linked, the site's own
 * pages cited, the rivals named — never the engine's prose. An ask that did
 * not answer is left out, so it leaves the rate's denominator. Unbranded
 * answers that are not comparisons also join the rival evidence, as the
 * deep pass's market prompts do (#1195). Nothing here throws.
 */
async function askTheTrackedPrompts(a: StageArgs): Promise<void> {
  const { bounds, cost, parameters, sections, siteId } = a;
  const asks = parameters.trackedPrompts || (a.asksTrackedPrompts === true && parameters.battery);
  if (!asks || siteId === undefined || bounds.stopNow() !== null) return;
  // Each day's asks are their own samples: without the day in the key, a
  // Monday pass two days after a re-measure would be served the
  // re-measure's answers as a second week's measurement. A retry the same
  // day is served what it already bought.
  const asOf = a.startedAt.toISOString().slice(0, 10);
  try {
    const [{ readPromptSet, writePromptSet }, { readSiteMarket }, { readSiteProfile }, { readBusinessEdits }] =
      await Promise.all([
        import("@/lib/market/prompts/store"),
        import("@/lib/market/infer/stored"),
        import("@/lib/site-profile/store"),
        import("@/lib/site-profile/business/edits"),
      ]);
    const market = sections.market ?? (await readSiteMarket(siteId))?.stored.current ?? null;
    if (market === null) {
      console.log(JSON.stringify({ event: "tracked_prompts", asked: 0, because: "no_market" }));
      return;
    }
    const siteName = promptSiteName((await readSiteProfile(a.domain))?.siteName ?? null, a.domain);
    const stored = await readPromptSet(siteId);
    // D49: a prompt names the market by its searched terms, never by a
    // label nobody searches, and the buyer by the founder's own answer.
    const buyer =
      sections.market === null
        ? ((await readBusinessEdits(siteId).catch(() => null))?.answers.buyers ?? null)
        : sections.founderBuyer;
    // D54: a set built from another label is rebuilt whole from the search
    // term here, once.
    // D69: a set worded for software is rebuilt once for the kind of
    // business the market records, and D67: a local business's prompts
    // name its place.
    const set = nextPromptSet(
      stored,
      generatePrompts(spokenMarket(market, buyer), siteName, localeOfPass(a).language, localeOfPass(a).place),
      new Date(),
      searchedName(market),
      market.kind ?? null
    );
    if (set.prompts.length === 0 || sections.sealed) return;
    if (set !== stored) await writePromptSet(siteId, set);
    if (set.rebuiltAt !== undefined && set.rebuiltAt !== stored.rebuiltAt) {
      console.log(JSON.stringify({ event: "tracked_prompts_rebuilt", siteId, from: stored.prompts.length, to: set.prompts.length }));
    }

    const answers: (PromptAnswer & { namesABrand: boolean })[] = [];
    const evidence = new Map<string, MarketPromptAnswer>();
    let asked = 0;
    const askOne = async (prompt: TrackedPrompt, engine: PromptEngine, run: number): Promise<void> => {
      if (bounds.stopNow() !== null) return;
      asked += 1;
      const scope = cacheScope(a);
      const untilMs = untilCeiling(bounds, parameters);
      const locale = localeOfPass(a);
      const got = await attempt("asking_the_twelve", () =>
        engine === "chatgpt"
          ? llmScraper(cost, { query: prompt.text, mode: "std", scope, locale, untilMs, run, asOf })
          : // The standard queue on every tier: the measure is the same
            // ask whichever pass makes it, at the price D19 was costed at.
            aiMode(cost, { query: prompt.text, mode: "std", scope, locale, untilMs, run, asOf, abortMs: serpAbortFor(bounds, parameters) })
      );
      if (failed(got) || got.kind === "unmeasured" || !got.value.answered) return;
      const reading = readPromptAnswer({
        text: got.value.text,
        citedDomains: got.value.citedDomains,
        citedUrls: got.value.citedUrls ?? [],
        ownDomain: a.domain,
        siteName,
        rivals: market.rivals,
        language: locale.language,
      });
      answers.push({
        promptId: prompt.id,
        engine,
        run,
        named: reading.named,
        linked: reading.linked,
        ownUrls: reading.ownUrls,
        rivals: reading.rivals,
        ...(reading.alternatives.length === 0 ? {} : { alternatives: reading.alternatives }),
        ...(reading.cited.length === 0 ? {} : { cited: reading.cited }),
        ...(reading.states.length === 0 ? {} : { states: reading.states }),
        namesABrand: reading.namesABrand,
      });
      if (prompt.kind !== "branded" && prompt.kind !== "comparison" && !evidence.has(prompt.id)) {
        evidence.set(prompt.id, {
          prompt: prompt.text,
          citedDomains: got.value.citedDomains.map((d) => d.toLowerCase().replace(/^www\./, "")),
          namesSite: reading.named || reading.linked,
          excerpt: got.value.text.slice(0, EVIDENCE_BOUNDS.excerptChars),
        });
      }
    };
    const asks: Promise<void>[] = [];
    for (const prompt of set.prompts) {
      for (const engine of PROMPT_ENGINES) {
        for (let run = 1; run <= runsOf(prompt); run += 1) asks.push(askOne(prompt, engine, run));
      }
    }
    await Promise.all(asks);

    // D33: a prompt rotated in stays only if an answer to it named a brand.
    const verdicts = new Map<string, "keep" | "drop">();
    for (const prompt of set.prompts) {
      if (prompt.precheck !== true) continue;
      const own = answers.filter((answer) => answer.promptId === prompt.id);
      if (own.length > 0) verdicts.set(prompt.id, own.some((answer) => answer.namesABrand) ? "keep" : "drop");
    }
    const settled = settlePrechecks(set, verdicts);
    if (settled !== set) await writePromptSet(siteId, settled);

    console.log(
      JSON.stringify({ event: "tracked_prompts", prompts: settled.prompts.length, asked, answered: answers.length })
    );
    if (sections.sealed) return;
    const kept = new Set(settled.prompts.map((prompt) => prompt.id));
    sections.prompts = {
      siteName,
      asked: settled.prompts.map((prompt) => ({ id: prompt.id, kind: prompt.kind, text: prompt.text })),
      asks: settled.prompts.reduce((sum, prompt) => sum + PROMPT_ENGINES.length * runsOf(prompt), 0),
      ...(settled.rebuiltAt === undefined ? {} : { restartedAt: settled.rebuiltAt }),
      answers: answers
        .filter((answer) => kept.has(answer.promptId))
        .map((answer) => ({
          promptId: answer.promptId,
          engine: answer.engine,
          run: answer.run,
          named: answer.named,
          linked: answer.linked,
          ownUrls: answer.ownUrls,
          rivals: answer.rivals,
          ...(answer.alternatives === undefined ? {} : { alternatives: answer.alternatives }),
        })),
    };
    for (const [id, answer] of evidence) if (kept.has(id)) sections.marketPrompts.push(answer);
  } catch (error) {
    console.log(
      JSON.stringify({
        event: "tracked_prompts_failed",
        because: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

/**
 * SPEC §6 (2026-09-20, #908 · #919) — the published pages' own questions,
 * asked after the twelve and inside their budget.
 *
 * **Everything that decides *which* questions is pure and lives
 * elsewhere.** `trackedQuestions` holds the cap arithmetic and the
 * retirement (`src/lib/market/questions/tracked.ts`); `page-questions.ts`
 * holds the two reads it is answered from. This function asks what it is
 * handed, with the same two calls per question the twelve are asked with —
 * one SERP, whose AI Overview rides free, and the battery's two engines.
 *
 * **It is the first thing a short pass loses.** It runs after the twelve
 * in the same stage, under the same cap and the same clock, and every
 * worker re-reads both before taking a question — so a ceiling stops the
 * pages and never the market.
 *
 * **It writes to its own three arrays**, which no card, no rival
 * derivation, no coherence verdict and no score reads.
 *
 * At a tier that asks none, on a pass with no site, and on a site with no
 * live page, it returns having bought nothing and leaves the section
 * `null`. Per question, at the standard queue's prices: one SERP read to
 * `slotDepth` (`SERP_STD_C` 0.06¢ a page of ten, 0.66¢ at a hundred with the
 * AI Overview's one surcharge) plus ChatGPT (`CHATGPT_SCRAPE_STD_C` 0.12¢)
 * and AI Mode (`AI_MODE_STD_C` 0.12¢) — at most 0.9¢. Only the first twelve
 * slots read deep; a thin market's slots past them read ten (0.36¢), so the
 * most is 10.8¢ + 4.32¢ against `CAPS.WEEKLY_C`'s 40¢, and the figure does
 * not move with how many pages the customer has published, which is the
 * cap's whole purpose.
 */
async function askThePageQuestions(a: StageArgs, abandoned: () => boolean): Promise<void> {
  const { bounds, parameters, sections, siteId } = a;
  if (!parameters.pageQuestions || siteId === undefined) return;
  if (abandoned() || bounds.stopNow() !== null) return;

  const at = sections.questions.at;
  const selected = sections.questions.kind === "unmeasured" ? 0 : sections.questions.value.length;
  const [candidates, misses] = await Promise.all([
    pageQuestionCandidates({ siteId, ownRankedRows: sections.measurement?.ownRankedRows ?? [] }),
    pageQuestionMisses(siteId),
  ]);
  if (candidates.length === 0) return;

  const tracked = trackedQuestions({ selected, candidates, misses, now: a.startedAt });
  logPageQuestions({
    candidates: candidates.length,
    asking: tracked.asked.length,
    retired: tracked.retired.length,
    waiting: tracked.waiting.length,
    tracked: tracked.tracked,
  });

  // The retirements are recorded whether or not a single question is then
  // asked: a question that has run out of weeks has left the set, and a
  // ceiling that stops the asking does not put it back.
  for (const page of tracked.retired) {
    sections.pageRetired.push({
      publicationId: page.publicationId,
      liveUrl: page.liveUrl,
      question: page.question,
      weeksWithoutMention: misses.get(page.publicationId) ?? PAGE_QUESTION_RETIRE_WEEKS,
    });
  }
  if (tracked.asked.length === 0 || abandoned()) return;

  // Every asked question's slot, on the arm that says we did not get to
  // it — the same shape `askTheTwelve` writes, so a page question a
  // ceiling stopped is `not_attempted` and never a miss.
  for (const candidate of tracked.asked) {
    sections.pageAsked.push(candidate);
    sections.pageSerps.push(unmeasured("not_attempted", at));
    sections.pageBattery.push(noBattery(at));
  }

  let next = 0;
  const engines = newEngineWatch();
  const buyOne = async (): Promise<void> => {
    for (;;) {
      const i = next;
      next += 1;
      const candidate = tracked.asked[i];
      if (candidate === undefined) return;
      if (bounds.stopNow() !== null) continue;
      const [serp, battery] = await Promise.all([
        attempt("asking_the_twelve", () =>
          serpOrganic(a.cost, {
            query: candidate.search,
            locale: localeOfPass(a),
            mode: "std",
            ...queueOf(parameters),
            loadAsyncAiOverview: parameters.asyncAiOverview && !a.correction,
            scope: cacheScope(a),
            freshnessDays: serpWindowOf(a),
            abortMs: serpAbortFor(bounds, parameters),
            untilMs: untilCeiling(bounds, parameters),
            depth: slotDepth(candidate, i),
          })
        ),
        askTheBattery(a, askedIn(candidate.question, localeOfPass(a).place), at, engines),
      ]);
      // The same seal the twelve are written under: a late answer is kept,
      // and a composed report is never written into.
      if (sections.sealed) return;
      sections.pageSerps[i] = failed(serp) ? unmeasured("undeterminable", at) : serp;
      sections.pageBattery[i] = battery;
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(parameters.serpFanout, tracked.asked.length) }, () => buyOne())
  );
}

/** How many times each engine asks a tracked prompt in one pass. */
function runsOf(prompt: TrackedPrompt): number {
  return prompt.kind === "branded" ? TRACKED_PROMPTS.BRANDED_RUNS : TRACKED_PROMPTS.RUNS;
}

/** One line per pass over the page questions (#919): how many pages could
 *  carry one, how many the cap left room for, how many retired and how many
 *  are waiting for a slot. No customer, no page and no question text — the
 *  shape of the set, readable from the deployment log. */
function logPageQuestions(fields: {
  candidates: number;
  asking: number;
  retired: number;
  waiting: number;
  tracked: number;
}): void {
  console.log(JSON.stringify({ event: "page_questions", ...fields }));
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

  // Both engines at once (#1160): one engine's queue wait never delays
  // the other's answer, and a slow ChatGPT cannot cost AI Mode's column.
  const [chatgpt, mode] = await Promise.all([
    bounds.stopNow() !== null
      ? unmeasured<AiAnswer>("not_attempted", at)
      : engineAnswer(at, "chatgpt", watch, (onFailure) =>
          llmScraper(cost, { query, mode: "std", scope: cacheScope(a), locale: localeOfPass(a), onFailure, untilMs: untilCeiling(bounds, parameters) })
        ),
    bounds.stopNow() !== null
      ? unmeasured<AiAnswer>("not_attempted", at)
      : engineAnswer(at, "ai_mode", watch, (onFailure) =>
          aiMode(cost, {
            query,
            mode: parameters.serpMode,
            scope: cacheScope(a),
            locale: localeOfPass(a),
            onFailure,
            untilMs: untilCeiling(bounds, parameters),
            // D63 (issue 1314): AI Mode waits as the pass's other SERP reads do.
            abortMs: serpAbortFor(bounds, parameters),
          })
        ),
  ]);

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
 * It bites on the asks that start after a refusal is known: the page
 * questions' and #865's retries. The twelve are asked at once, so the first
 * wave is bought before any refusal is known. Issue 869 also made an
 * engine that had not answered yet take one question at a time. On the
 * standard queue that cost a whole queue wait, one to three minutes, before
 * the other eleven were asked, and a weekly pass could not fit it in its
 * ceiling (#1160). That turn-taking is gone. An outage now costs at most
 * one ask per question, 1.44¢ for ChatGPT across the twelve, inside the
 * `WEEKLY` cap.
 */
interface EngineWatch {
  readonly failures: Map<BatteryEngine, number>;
  readonly because: Map<BatteryEngine, string>;
}

/** Two in a row, counted per pass. */
const ENGINE_GIVE_UP_AFTER = 2;

function newEngineWatch(): EngineWatch {
  return { failures: new Map(), because: new Map() };
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
  work: (onFailure: (failure: VendorFailure) => void) => Promise<Measured<AiAnswer>>
): Promise<Measured<AiAnswer>> {
  const alreadyFailed = watch.failures.get(engine) ?? 0;
  if (alreadyFailed >= ENGINE_GIVE_UP_AFTER) {
    return unmeasured<AiAnswer>("not_attempted", at, watch.because.get(engine));
  }

  const heard: { failure: VendorFailure | null } = { failure: null };
  const answer = await attempt("asking_the_twelve", () =>
    work((failure) => {
      heard.failure = failure;
    })
  );

  if (heard.failure !== null) {
    const failures = (watch.failures.get(engine) ?? 0) + 1;
    watch.failures.set(engine, failures);
    watch.because.set(engine, heard.failure.vendorFailure);
    if (failures === ENGINE_GIVE_UP_AFTER) {
      logEngineDropped({ engine, because: heard.failure.vendorFailure, after: failures });
    }
  } else if (!failed(answer) && answer.kind !== "unmeasured") {
    // An answer of any kind, a zero included: the engine is answering, so
    // the count clears.
    watch.failures.set(engine, 0);
  }

  if (failed(answer)) return unmeasured<AiAnswer>("undeterminable", at);
  if (answer.kind === "unmeasured" && heard.failure !== null) {
    return unmeasured<AiAnswer>(answer.reason, answer.at, heard.failure.vendorFailure);
  }
  return answer;
}

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

function score(a: Pick<StageArgs, "domain" | "sections" | "parameters" | "correction">): void {
  const { domain, sections } = a;
  const serps = sections.serps as readonly Measured<MarketSerp>[];
  const cards = cardsOf({
    serps,
    questions: sections.questions.kind === "unmeasured" ? [] : sections.questions.value,
    selected: sections.selected,
    battery: sections.battery,
    rivalSizes: sections.rivalSizes,
    ownDomain: domain,
    reach: {
      measuredInTown: sections.measurement?.locale.place !== undefined,
      profile: sections.profile.kind === "unmeasured" ? null : sections.profile.value,
      schemaTypes: sections.measurement === null || sections.measurement.onPage.kind === "unmeasured" ? [] : sections.measurement.onPage.value.schemaTypes,
    },
    siteName: sections.siteName,
    coverage: a.parameters.asyncAiOverview && !a.correction ? "async_included" : "cached_only",
  });
  sections.rivals = measured(cards.rivals, sections.questions.at);
  sections.sources = cards.sources;
  sections.presence = cards.presence;
  sections.aiAnswers = answersSectionOf({
    card: cards.card,
    questions: sections.questions,
    rivals: cards.rivals,
    ownDomain: domain,
    measuredAt: sections.questions.at,
  });

  // Beside the card, never inside it (#919): the page questions are
  // composed from their own three arrays, and none of the four values
  // above — the rivals, the presence card, the AI-answers card and the
  // coherence verdict — has seen one. The score's AI Presence reads their
  // cells beside the twelve's (owner, 2026-10-19, issue 1551).
  sections.pageQuestions = pageQuestionsSectionOf({
    asked: sections.pageAsked,
    serps: sections.pageSerps as readonly Measured<MarketSerp>[],
    battery: sections.pageBattery,
    retired: sections.pageRetired,
    selected: sections.questions.kind === "unmeasured" ? 0 : sections.questions.value.length,
    ownDomain: domain,
    siteName: sections.siteName,
    measuredAt: sections.questions.at,
  });

  sections.coherence = cards.coherence;
}

// ── Composition ─────────────────────────────────────────────────────────

/** BUILD §4.1 module 3's two counts. The opportunities engine (issue #40)
 *  derives them and is not built, so they are `not_attempted` — the arm
 *  that says we did not get to it. A 0 would be a claim about the
 *  customer's site that nobody has made. */
function UNMEASURED_SUPPLY(at: Date): SupplySection {
  return { missingPages: unmeasured("not_attempted", at), unquotablePages: unmeasured("not_attempted", at) };
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
  /**
   * Issue 715 — the report a retry started from.
   *
   * A retry re-measures one part and carries the rest, so a section this
   * pass did not produce falls back to the one the earlier report already
   * had rather than to `null`. The order is always "what this pass
   * measured, else what the report already held": a retry can only ever
   * add to a report, never take a card off it.
   *
   * Absent on every ordinary pass, where a section nothing produced is
   * genuinely absent and `null` is the truth about it.
   */
  carried?: StoredReport;
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
  // Issue 715: what a retry carries forward, read once. `undefined` and
  // `null` are one thing here — "there is nothing carried" — so the three
  // fallbacks below read a single value rather than an optional chain each.
  const carried = a.carried ?? null;
  const carriedSiteIssues = carried === null ? null : carried.siteIssues;
  // Issue 1551: the page questions' AI Overviews count toward AI presence
  // beside the twelve's — the section the report stores, read as stored.
  const pageCells = (s.pageQuestions ?? carried?.pageQuestions)?.rows.map((row) => row.cell) ?? [];

  // One date: the moment the pass started (issue 1392), which the
  // measurement was handed and every `Measured` under the verdict carries;
  // `verdictOf` asserts it. A stored read of the home page does not date it.
  const measuredAt = m === null ? a.startedAt : m.drivers.foundations.at;

  const onPage: Measured<OnPageFacts> = m === null ? unmeasured("not_attempted", measuredAt) : m.onPage;
  const robots: Measured<RobotsPolicy> = m === null ? unmeasured("not_attempted", measuredAt) : m.robots;

  const searchCard = s.presence ?? carried?.presence ?? null;
  const drivers: Drivers =
    m === null
      ? {
          foundations: unmeasured("not_attempted", measuredAt),
          answerability: unmeasured("not_attempted", measuredAt),
          searchPresence: unmeasured("not_attempted", measuredAt),
          aiPresence: unmeasured("not_attempted", measuredAt),
        }
      : {
          ...m.drivers,
          searchPresence: searchPresenceOf({ card: searchCard, serps: s.serps, at: measuredAt }),
          aiPresence: aiPresenceOf({ serps: s.serps, pageCells, ownDomain: a.domain, siteName: s.siteName, at: measuredAt }),
        };

  const market: Measured<MarketSet> =
    s.profile.kind === "unmeasured"
      ? // Issue 1387: where the site's listing in search named no market,
        // the record says which way it fell short.
        unmeasured(s.profile.reason, measuredAt, s.marketThin ?? undefined)
      : s.marketRows.kind === "unmeasured"
        ? marketFromPool(s, measuredAt)
        : {
            kind: s.marketRows.kind,
            value: marketSetOf({ profile: s.profile.value, suggestions: s.marketRows.value, pool: poolOf(s) }),
            at: measuredAt,
          };

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
    // Issue 1450: a market chosen from the ranked pool, where the
    // suggestions did not answer, is a market read.
    market_suggestions: outcomeOf(s.marketRows.kind === "unmeasured" && market.kind !== "unmeasured" ? market : s.marketRows),
    own_ranked_rows: m === null ? { read: false, because: "not_attempted" } : outcomeOf(m.ownRanked),
    question_serps: outcomeOf(foldSerps(s.serps, measuredAt)),
  };

  const aiSample = aiSampleOf({ serps: s.serps, pageCells, ownDomain: a.domain, siteName: s.siteName });
  const verdict: Verdict = verdictOf({
    domain: a.domain,
    measuredAt,
    drivers,
    inputs,
    robots,
    aiRange: aiPresenceRangeOf(aiSample),
    searchRange: searchPresenceRangeOf(searchCard),
    searchesRead: aiSample.read,
  });

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

  const assembled = assembleReport({
    scanId: a.scanId,
    domain: a.domain,
    tier: a.tier,
    stoppedReason: a.stoppedReason,
    fromIncompleteRescan: a.fromIncompleteRescan,
    verdict,
    blockedAgents: blockedAgentsOf(robots),
    aiAnswers: s.aiAnswers ?? carried?.aiAnswers ?? null,
    pageQuestions: s.pageQuestions ?? carried?.pageQuestions ?? null,
    // A pass that never bought a SERP has no card to show, and an empty
    // one would read as "we looked and nobody is there". `null` is the
    // screen's own named-absent arm.
    presence: s.presence ?? carried?.presence ?? null,
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
    // Issue 715: a retry whose crawl did not run again keeps the checks
    // the report already carried. `checkSite` over a `null` crawl reports
    // every check as "could not run", which on a retry would be a report
    // losing nine measurements to gain one.
    siteIssues:
      s.siteCrawl === null && carriedSiteIssues !== null
        ? carriedSiteIssues
        : checkSite({ crawl: s.siteCrawl, robots, blockedAgents: blockedAgentsOf(robots) }),
    coherence: s.coherence,
    correctionState: a.correctionState,
    // Issue 866: the category the pass was handed, so REQ-071's comparison
    // can see a category change and see it cleared. `null` where the pass
    // seeded from the profile — the inferred category is not this fact.
    measuredCategory: a.category ?? null,
    marketPrompts: s.marketPrompts,
    prompts: s.prompts,
  });
  // SPEC §2 (issue 787): the one first-page proposal is the best right-sized
  // Write target this pass measured — derived, never padded.
  const measuredIn = m === null ? null : reportLocale(m);
  // D67 and issue 1370: only a page that says it serves a place states one.
  const statedPlace = m?.stated === undefined ? null : statedPlaceOf(m.stated);
  const report: StoredReport = {
    ...assembled,
    freePage: freePageOf(assembled) ?? carried?.freePage ?? null,
    ...(measuredIn === null ? {} : { locale: s.placeFrom === null ? measuredIn : { ...measuredIn, placeFrom: s.placeFrom } }),
    ...(statedPlace === null ? {} : { statedPlace }),
    ...(s.marketFrom === null || market.kind === "unmeasured" ? {} : { marketFrom: s.marketFrom }),
  };

  // #770: a market read and found too small buys no SERP, so AI presence
  // has nothing to be read from. That is the market's answer and not a
  // missing section. Never for a pass a ceiling stopped (issue 855): it did
  // not finish. Since issue 1439 Presence is never missing — what was not
  // read widens the score's range instead — so a pass whose own ranked read
  // failed is named missing here, as it was before.
  const tooSmall = marketTooSmall(s.questions) && !stoppedOnCeiling(a.stoppedReason);
  const missingFactors = verdict.missing;
  const searchUnread = !inputs.own_ranked_rows.read;

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

  // Read off the composed report and not off `sections` (issue 715): a
  // retry that carried a card forward has that card, so the pass is not
  // missing it. Everything else here is `sections`' as before.
  const sectionMissing =
    report.aiAnswers === null ||
    report.presence === null ||
    missingFactors.length > 0 ||
    searchUnread ||
    market.kind === "unmeasured" ||
    s.questions.kind === "unmeasured" ||
    noQuestionMeasured;

  return { report, drivers, sectionMissing, marketTooSmall: tooSmall, marketUnread };
}

/**
 * Issue 1450: the market where the suggestions were not read. Where the
 * questions were chosen from the ranked pool in their place, the market is
 * that pool, and it says the suggestions were not read; with nothing chosen
 * it is unmeasured, as before.
 */
function marketFromPool(s: Sections, at: Date): Measured<MarketSet> {
  const rows = s.marketRows;
  if (s.profile.kind === "unmeasured" || rows.kind !== "unmeasured") throw new Error("marketFromPool: a profile and unread suggestions only");
  const pool = poolOf(s);
  if (pool.length === 0 || s.selected.length === 0) return unmeasured(rows.reason, at);
  return measured({ ...marketSetOf({ profile: s.profile.value, suggestions: [], pool }), suggestionsUnread: rows.reason }, at);
}

/** Issue 898 — the two §6.7 steps that can leave a pass with no market at
 *  all, under the `ScanInput` names the verdict already reads them under. */
type MarketUnread = Extract<ScanInput, "business_profile" | "market_suggestions"> | null;

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
