// src/lib/scan/pass/tier.ts — the tier's parameters: one frozen table, so the pass never branches on tier.
import { BATTERY, CACHE_WINDOWS_D, SELECTION, WEEKLY_RIVAL_RESIZES, TIMING, TYPING_RESERVE_C, VENDOR } from "@/lib/config/constants";
import type { CapName } from "@/lib/costs";
import { PAID_SERP_FANOUT } from "../budgets";
import type { Tier } from "../report";

// ── Tier as a parameter ─────────────────────────────────────────────────

export interface TierParameters {
  /** Which of the four caps the pass spends against (§6.1). */
  cap: CapName;
  /** §6.4: live mode only where a human is waiting; everything scheduled runs on the standard queue. It is AI Mode's surface: Google organic reads are all queued (`serpPriority`). */
  serpMode: "live" | "std";
  /** The queue priority of this tier's Google organic reads: none is live, since the live surface failed where queued tasks answered in seconds.
   *  `high` only for the free scan's waiting visitor: that queue hides each result's address behind a Google redirect, and a paid pass reads addresses. */
  serpPriority: "high" | "normal";
  /** How often this tier asks the queue whether a Google read is ready. */
  serpPollMs: number;
  /** §6.2: the question-SERPs count Google's actual AI answers at every tier; without it most AI Overviews came back with no sources.
   *  A correction's re-run switches it off: that is the correction's parameter, not this table's. */
  asyncAiOverview: boolean;
  /** Whether the ceiling below is raced — the free report's, which a
   *  visitor is waiting on. A paid pass reads its ceiling between calls, as
   *  it reads the cap. */
  deadlineApplies: boolean;
  /** The pass's time ceiling in seconds: the free report's `reportCeilingS`, or a paid pass's `paidPassCeilingS`, which fits its job invocation. */
  ceilingS: number;
  /** How many of the twelve are bought at once: one wave at every tier, since a queued read costs its wait whether one task is posted or twelve. */
  serpFanout: number;
  /** A free scan is never started outside admission control: it adopts the claimed row and never inserts a second. The deep pass adopts the row setup
   *  claimed on accepting the address (`claimOnboardingPass`), so the rival suggestion it spends has a row to ledger against. */
  adoptsClaim: boolean;
  /** §6.4: "A free re-scan of the same domain within 7 days serves the stored report". Free only: the weekly pass must replace a five-day-old report,
   *  and the deep pass reuses a fresh free scan through §6.4's cache windows instead, which spends nothing and still measures. */
  servesStoredReport: boolean;
  /** §6.4 never pulls per-rival `ranked_keywords` on the free path; §6.3's paid list buys `ranked_keywords`@100 ×rivals monthly.
   *  The monthly cadence is the cache window's (`CACHE_WINDOWS_D.rival`), not a second schedule: a weekly pass inside it spends nothing. */
  sizesRivals: boolean;
  /** How many tracked rivals one pass of this tier sizes again when their 30 days are up; `null` sizes every one due. */
  rivalResizes: number | null;
  /** §6.2's paid battery (ChatGPT std + AI Mode std, the AI Overview riding the SERP), bought per question inside `asking_the_twelve`.
   *  `false` on the free path, which makes zero AI Optimization API calls (§6.2, §6.1). A parameter, not a branch, as `sizesRivals` is.
   *  Belt and braces: `aiMode` and `llmScraper` also refuse under a `FREE` cost context, since a breach is money spent against a promise. */
  battery: boolean;
  /** Whether each stage runs inside its own budget (`STAGE_BUDGETS`): the free path's only, since those budgets fit the free path's sums.
   *  Paid passes are bounded by the cap between stages; a per-stage clock would cut work nobody waits on. A row, so the pipeline branches on no tier. */
  stageBudgets: boolean;
  /** §6.4's SERP window for this tier's target SERPs: "SERPs 30d (except the weekly target re-check)". A tier's fact, passed down to `serpOrganic`.
   *  At 30 days a weekly pass would be served a cached SERP wearing this week's date (`CACHE_WINDOWS_D.serpWeeklyRecheck`); passes a human waits for buy at 30. */
  serpWindowDays: number;
  /** Thin markets: how many `keyword_suggestions` beyond the first seed a pass short of twelve may buy, at most `SELECTION.maxExtraSeeds`, inside its cap.
   *  On the free path, where a new site's seed can answer nothing, they are paid from the purse shared with the twelve, and only while `affordsSeed`. */
  extraSeeds: number;
  /** When the seed ladder stops buying. `twelve`: twelve questions at the first volume step. `questions`: the free path stops once it has
   *  `SELECTION.freeLadderMinQuestions` at any step, so its 12¢ goes to the report a visitor reads rather than a fuller twelve. */
  ladderStopsAt: "twelve" | "questions";
  /** How the owner hears of a pass that found too little market: `immediate` mails at once (a site's first, deep pass), `digest` joins the Monday digest
   *  (`./weekly/market-digest`), `none` has no site to speak of. */
  marketTooSmallAlert: "immediate" | "digest" | "none";
  /** Whether the number of questions is decided by the money left: true on the free path, whose ladder and twelve share one purse,
   *  so no question is shown without a SERP. Paid tiers buy all twelve, bounded by their ceiling. */
  questionsFitThePurse: boolean;
  /** The wall clock one question's SERP request may hold, carried per call so each tier can have its own figure.
   *  Free: `VENDOR.requestAbortMs`, re-asking a timed-out read once. Paid: `VENDOR.paidSerpAbortMs`, never past the pass's ceiling (`serpAbortFor`). */
  serpAbortMs: number;
  /** Whether the pass asks the published pages' own questions beside the twelve: the weekly pass alone, since the rule is stated in weeks
   *  ("8 weeks without a mention") and a second pass in a week would spend a week of a question's life. */
  pageQuestions: boolean;
  /** How long before the ceiling this tier's asks stop waiting, so a slow queue costs one engine's cell and never the pass's scoring. */
  askReserveS: number;
  /** How many of the market's buyer prompts this tier asks AI Mode beside the twelve: the deep pass's, which concludes a new market's rivals at once. */
  marketPrompts: number;
  /** Whether the pass asks §6.2's two engines for each of the twelve: the deep pass does; the weekly pass's AI measure is the tracked prompts,
   *  its twelve keeping their Google searches and AI Overviews. A page's own question still asks both engines. */
  batteryOnTheTwelve: boolean;
  /** Whether the pass asks the site's tracked buyer prompts (`TRACKED_PROMPTS.ENGINES` × `RUNS`): the weekly pass alone, since the measure is a weekly rate. */
  trackedPrompts: boolean;
  /** Whether a pass that stored chosen searches unread sends `scan/finish-reads` to read them in the background inside the same cap: the free path alone. */
  finishesReads: boolean;
  /** Whether the pass measures in the town its home page states: the free pass, which has no stored place or market call. A paid pass measures the place its conclusion settled. */
  measuresStatedPlace: boolean;
  /** The cents of the cap the stages leave for the typing after the stored report. */
  typingReserveC: number;
}

export const TIER_PARAMETERS: Readonly<Record<Tier, TierParameters>> = Object.freeze({
  free: Object.freeze({
    cap: "FREE",
    // eslint-disable-next-line local/serp-normal-queue -- the free report answers inside its 50 s ceiling.
    serpMode: "live",
    // eslint-disable-next-line local/serp-normal-queue -- the free report answers inside its 50 s ceiling.
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
    // eslint-disable-next-line local/serp-normal-queue -- AI Mode: none of 149 live answers since 31 Oct cites a wrapped link.
    serpMode: "live",
    serpPriority: "normal",
    serpPollMs: VENDOR.stdQueuePollIntervalS * 1000,
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
