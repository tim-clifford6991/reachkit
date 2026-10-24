// src/lib/scan/pass/tier.ts — the tier's parameters: one frozen table, so the pass never branches on tier.
import { BATTERY, CACHE_WINDOWS_D, SELECTION, WEEKLY_RIVAL_RESIZES, TIMING, TYPING_RESERVE_C, VENDOR } from "@/lib/config/constants";
import type { CapName } from "@/lib/costs";
import { PAID_SERP_FANOUT } from "../budgets";
import type { Tier } from "../report";

// ── Tier as a parameter ─────────────────────────────────────────────────

export interface TierParameters {
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
