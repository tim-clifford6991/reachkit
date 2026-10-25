// src/lib/scan/pass/sections.ts — what a pass accumulates, the stage arguments, and the helpers every stage shares.
import { AI_READER_AGENTS } from "@/lib/config/constants";
import { understandBusiness } from "@/lib/business/understanding";
import type { CostContext } from "@/lib/costs";
import { dbAdmin } from "@/lib/db";
import type { CoherenceVerdict } from "@/lib/market/coherence/check";
import { EMPTY_STORED_MARKET, type MarketConclusion } from "@/lib/market/infer/types";
import type { BatteryAnswers } from "@/lib/market/questions/matrix";
import type { PageQuestionCandidate } from "@/lib/market/questions/tracked";
import { marketSetOf, type MarketSet, type SuggestionRow } from "@/lib/market/questions/market-set";
import type { Question } from "@/lib/market/questions/phrase";
import type { Profile } from "@/lib/market/questions/profile";
import type { SelectedSearch } from "@/lib/market/questions/select";
import { poolFrom, type PoolRow } from "@/lib/market/questions/widen";
import type { RivalCandidate } from "@/lib/market/rivals/derive";
import { ownPresenceBySearch, type PresenceCard } from "@/lib/market/rivals/presence";
import type { RivalSize } from "@/lib/market/rivals/size";
import type { MarketSerp } from "@/lib/market/views";
import { DEFAULT_LOCALE, type Locale } from "@/lib/locale/locales";
import type { PlaceFrom } from "@/lib/locale/place";
import type { DomainMeasurement } from "@/lib/measure";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import type { CacheScope, RankedRow, SerpResult } from "@/lib/vendors/dataforseo/types";
import type { StageOutcome } from "../budgets";
import type { Bounds } from "../ceilings";
import type { CanonicalDomain } from "../domain";
import type { RetryPart } from "../retry";
import type { ThinFootprint } from "../search-footprint";
import type { PageQuestionsSection, RetiredPageQuestion, AiAnswersSection, MarketPromptAnswer, PromptsSection, StoredReport, Tier } from "../report";
import { blockedAgentsOf, categoryOf } from "../sections";
import type { CrawlReading } from "@/lib/site-issues/checks";
import type { StageSummary, StageName } from "../stages";
import type { TierParameters } from "./tier";

// ── The sections a pass accumulates ─────────────────────────────────────

export interface Sections {
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
export const SKIPPED_STAGE: StageOutcome<void> = Object.freeze({ spent: false, value: undefined });

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
export function resumeMarket(sections: Sections, report: StoredReport): void {
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
export function resumeSerps(sections: Sections, report: StoredReport): void {
  const at = report.verdict.measuredAt;
  for (const serp of report.serps) sections.serps.push(serp);
  for (let i = 0; i < report.serps.length; i += 1) sections.battery.push(noBattery(at));
}

/** Everything outstanding, before any stage has run. `not_attempted` is
 *  the honest arm for work a ceiling may yet stop: it says we did not get
 *  to it, which no 0 and no empty list can say. */
export function freshSections(at: Date): Sections {
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

export interface StageFailure {
  readonly stageFailed: true;
}

const STAGE_FAILED: StageFailure = Object.freeze({ stageFailed: true });

export function failed(value: unknown): value is StageFailure {
  return typeof value === "object" && value !== null && "stageFailed" in value;
}

/** Runs one unit of a stage's work and turns a raised error into the arm
 *  that is true of it — the source did not answer. The ceilings' own arms
 *  are never reached this way: a ceiling is read from `Bounds` *before*
 *  the work runs and yields `not_attempted`, which is a different claim. */
export async function attempt<T>(stage: string, work: () => Promise<T>): Promise<T | StageFailure> {
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

export function untyped(client: ReturnType<typeof dbAdmin>): MinimalClient {
  return client as unknown as MinimalClient;
}

// ── The six stages ──────────────────────────────────────────────────────

export interface StageArgs {
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

/** The country and language this pass measures in (D66): the one stage one
 *  settled — the site's stored answer, else the reading of its home page.
 *  Before stage one has read the site nothing is bought, so the fallback
 *  below is reached by no vendor call. */
export function localeOfPass(a: Pick<StageArgs, "sections" | "locale">): Locale {
  return a.sections.measurement?.locale ?? a.locale ?? DEFAULT_LOCALE;
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
export function withPurse(cost: CostContext, cents: number): CostContext {
  const spentAtEntry = cost.spentCents();
  return {
    cap: cost.cap,
    recordFetch: (call) => cost.recordFetch(call),
    capHit: () => cost.capHit() || cost.spentCents() - spentAtEntry >= cents,
    spentCents: () => cost.spentCents(),
    degraded: () => cost.degraded(),
  };
}

/** The customer's own count as a number for the banding. `unmeasured` is
 *  the cold-start 0 — the honest reading and the conservative one: at 0
 *  the winnability bars are 500 and 100, the tightest they go. */
export function ownRankedValue(ownRanked: Measured<number>): number {
  return ownRanked.kind === "unmeasured" ? 0 : ownRanked.value;
}

/** SPEC §6 thin markets: the ranked rows this pass already bought. */
export function poolOf(sections: Sections): PoolRow[] {
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
export function cacheScope(a: StageArgs): CacheScope {
  return a.siteId === undefined ? { domain: a.domain } : { site: a.siteId };
}

/** The tier's SERP window, narrowed to the pass's own period where it has
 *  one (issue 1170): a weekly pass's AI input is never a SERP bought before
 *  its week wearing this week's date. */
export function serpWindowOf(a: StageArgs): number {
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
export function untilCeiling(bounds: Bounds, parameters: TierParameters): number {
  return Date.now() + Math.max(0, bounds.remainingMs() - parameters.askReserveS * 1000);
}

/**
 * The wall clock one SERP request of this pass may hold (D63, issue 1298):
 * the tier's bound, and on a pass with no stage budgets never more than is
 * left of its ceiling. The free path's stage clock does not shorten its
 * bound — a shorter one only buys aborted, billed calls (issue 877).
 */
export function serpAbortFor(pass: Bounds, parameters: TierParameters): number {
  if (parameters.stageBudgets) return parameters.serpAbortMs;
  return Math.max(1, Math.min(parameters.serpAbortMs, pass.remainingMs()));
}

/** How this tier's Google organic reads are queued (issue 1352). */
export function queueOf(parameters: TierParameters): { priority?: "high"; pollMs: number } {
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
export function roomForOneRead(pass: Bounds, parameters: TierParameters): boolean {
  if (!parameters.stageBudgets) return pass.remainingMs() > 0;
  return pass.remainingMs() >= parameters.askReserveS * 1000 + parameters.serpAbortMs + SERP_SETTLE_MS;
}

/**
 * Whether the pass still waits for the Google reads it has posted (issue
 * 1352): until `untilCeiling`, the moment every queued read gives up by
 * itself. So waiting here never runs the pass into its ceiling.
 */
export function stillCollecting(pass: Bounds, parameters: TierParameters): boolean {
  return pass.remainingMs() > parameters.askReserveS * 1000;
}

/** The battery nobody bought: both engines on the arm that says we did not
 *  get to them. It is what the free path stores for every question, and
 *  what a ceiling leaves behind — never a `zero`, which would claim the
 *  engines were asked and said nothing. */
export function noBattery(at: Date): BatteryAnswers {
  return { aiMode: unmeasured("not_attempted", at), chatgpt: unmeasured("not_attempted", at) };
}

/**
 * Issue 1450: the market where the suggestions were not read. Where the
 * questions were chosen from the ranked pool in their place, the market is
 * that pool, and it says the suggestions were not read; with nothing chosen
 * it is unmeasured, as before.
 */
/** The market the report records, from what the pass has read so far. */
export function marketOf(s: Sections, at: Date): Measured<MarketSet> {
  if (s.profile.kind === "unmeasured") {
    // Issue 1387: where the site's listing in search named no market,
    // the record says which way it fell short.
    return unmeasured(s.profile.reason, at, s.marketThin ?? undefined);
  }
  if (s.marketRows.kind === "unmeasured") return marketFromPool(s, at);
  return { kind: s.marketRows.kind, value: marketSetOf({ profile: s.profile.value, suggestions: s.marketRows.value, pool: poolOf(s) }), at };
}

// Google's own reader heads the pinned list, so the name is never written twice.
const [GOOGLE_READER] = AI_READER_AGENTS;

/** What a finished stage tells the waiting screen, copied from what the
 *  pass already holds; a field it does not hold yet is left out. */
export function summaryAt(stage: StageName, a: Pick<StageArgs, "domain" | "sections" | "startedAt" | "locale">): StageSummary {
  const s = a.sections;
  const summary: { -readonly [K in keyof StageSummary]: StageSummary[K] } = {};
  // The crawl runs beside the later stages, so its count rides on whichever exit follows it.
  const pages = s.siteCrawl?.pages.length ?? 0;
  if (pages > 0) summary.pagesRead = pages;
  const robots = s.measurement?.robots;
  if (stage === "reading_access_rules" && robots !== undefined && robots.kind !== "unmeasured") {
    const blocked = blockedAgentsOf(robots);
    summary.readers = { google: blocked.includes(GOOGLE_READER) ? "out" : "in", ai: blocked.length > 0 ? "out" : "in" };
  }
  if (stage === "reading_your_market") {
    const market = marketOf(s, a.startedAt);
    const category = categoryOf(market);
    if (category !== null) summary.category = category;
    if (market.kind !== "unmeasured") {
      // The report's own reading, so the screen and the report name the same buyer and town.
      const read = understandBusiness({
        domain: a.domain,
        profile: market.value.profile,
        locale: localeOfPass(a),
        market: s.market === null ? null : { ...EMPTY_STORED_MARKET, current: s.market },
        edits: { buyers: s.founderBuyer },
      });
      const buyer = read.buyers[0];
      if (buyer !== undefined) summary.buyer = buyer;
      if (read.where.place !== null) summary.place = read.where.place.name;
    }
  }
  if (stage === "asking_the_twelve") {
    const searches = ownPresenceBySearch({ serps: s.serps as readonly Measured<MarketSerp>[], selected: s.selected, ownDomain: a.domain });
    summary.searches = searches.map((search) => ({ words: search.keyword, onPageOne: search.present }));
  }
  return summary;
}

function marketFromPool(s: Sections, at: Date): Measured<MarketSet> {
  const rows = s.marketRows;
  if (s.profile.kind === "unmeasured" || rows.kind !== "unmeasured") throw new Error("marketFromPool: a profile and unread suggestions only");
  const pool = poolOf(s);
  if (pool.length === 0 || s.selected.length === 0) return unmeasured(rows.reason, at);
  return measured({ ...marketSetOf({ profile: s.profile.value, suggestions: [], pool }), suggestionsUnread: rows.reason }, at);
}
