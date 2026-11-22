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
import type { CrawledPage } from "@/lib/site-profile/crawl";
import type { StageSummary, StageName } from "../stages";
import type { TierParameters } from "./tier";

// ── The sections a pass accumulates ─────────────────────────────────────

export interface Sections {
  measurement: DomainMeasurement | null;
  profile: Measured<Profile>;
  /** `search` where the profile was read from the site's listing in search because bot protection kept the reader off its pages; `null` otherwise. */
  marketFrom: "search" | null;
  /** Why that listing named no market, where it did not: the pass then
   *  guesses none, and the report keeps the reason. */
  marketThin: ThinFootprint | null;
  /** Which evidence named the town a free pass measured in; `null` where it measured in none, or a paid pass settled the place. */
  placeFrom: PlaceFrom | null;
  marketRows: Measured<readonly SuggestionRow[]>;
  selected: SelectedSearch[];
  /** The searches after the twelve by the same selection score, which the AI panel is drawn from beside them. */
  runnersUp: string[];
  questions: Measured<Question[]>;
  serps: Measured<SerpResult>[];
  /** §6.2's battery, one entry per question in question order, parallel to `serps`. It reaches the blob only as the AI-answers card's engine columns:
   *  the engines' prose has no member to travel in. */
  battery: BatteryAnswers[];
  /** The page questions, beside the twelve and never inside them: a page question in `serps` or `battery` would move a published score by being asked.
   *  Three parallel arrays, in the order asked. */
  pageAsked: PageQuestionCandidate[];
  pageSerps: Measured<SerpResult>[];
  pageBattery: BatteryAnswers[];
  /** The pages whose question ran out of weeks this pass. */
  pageRetired: RetiredPageQuestion[];
  /** The market's rivals the page questions' answers are read for; `null` where none is concluded or it could not be read. */
  pageRivals: readonly { name: string; domain: string }[] | null;
  /** The composed section, rebuilt by `score` beside the AI-answers card. */
  pageQuestions: PageQuestionsSection | null;
  /** The site's name as an AI answer is read for it (`promptSiteName`), from this pass's profile; `null` until built, then the domain's label is read. */
  siteName: string | null;
  rivals: Measured<RivalCandidate[]>;
  /** §6.6's sizing, where the tier says so: the customer's rivals (`checking_your_presence`), then this pass's own top-ten domains (`scoring`).
   *  A pass that read neither keeps `freshSections`' arm, never a zero, which would satisfy every winnability bar.
   *  One entry per domain; a fresh measurement replaces a carried-forward one. */
  rivalSizes: Measured<RivalSize[]>;
  /** The rows sizing read, by rival; the thin-market pool selects over them. `null` until attempted, which also stops a second sizing. */
  rivalRows: Map<string, readonly RankedRow[]> | null;
  sources: readonly string[];
  aiAnswers: AiAnswersSection | null;
  presence: PresenceCard | null;
  coherence: CoherenceVerdict;
  /** The site profile's one crawl, as SPEC §9's checks read it. `null` until
   *  the crawl has run — and after a crawl that raised, which the checks
   *  report as not run rather than as a site with no issues. */
  siteCrawl: CrawlReading | null;
  /** The pages that crawl read, as the market conclusion reads them. `null` until the crawl has run. */
  pagesRead: readonly Pick<CrawledPage, "url" | "title" | "h1" | "text" | "unread">[] | null;
  /** The category this pass concluded, or read from the site at its market
   *  stage, and measured under; the report records it as `measuredCategory`. */
  concludedCategory: string | undefined;
  /** The market this pass concluded and measures, where it concluded one: its buyer prompts are built from it. */
  market: MarketConclusion | null;
  /** The founder's own answer about who buys, which the prompts name over the inferred buyer. `null` where none. */
  founderBuyer: string | null;
  /** The rivals whose ranked rows may join this pass's pool: those concluded for the market in force. `null` admits every tracked rival.
   *  A rival chosen under an earlier market is not evidence about this one. */
  poolRivals: ReadonlySet<string> | null;
  /** The market's buyer prompts, asked of AI Mode beside the twelve and stored for the rival conclusion; never in the score. */
  marketPrompts: MarketPromptAnswer[];
  /** The tracked prompts this pass asked and what each answer said; `null` where none. */
  prompts: PromptsSection | null;
  /** True once the report is being composed: an uncancellable call may answer after its stage was abandoned, and its paid answer is kept until here.
   *  After it, `composeReport` reads `sections`, and a write would mutate a composed report. */
  sealed: boolean;
}

/** A stage that did not run: nothing spent, nothing cut off. A retry skips stages this way, and each still reports its exit so the screen's list reads through. */
export const SKIPPED_STAGE: StageOutcome<void> = Object.freeze({ spent: false, value: undefined });

/** The market a retry starts from, read back off the report instead of bought again: `MarketSet` and each `Question` carry what they were built from,
 *  so the retry asks the same twelve in the same words. An `unmeasured` market or questions resume `unmeasured`; nothing here improves a report. */
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

/** The question SERPs a retry not retrying them starts from, so both cards are rebuilt from the answers already shown.
 *  The battery is `noBattery` per question, which is what every free report stores (§6.4), so nothing measured is lost. */
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
    runnersUp: [],
    sealed: false,
    questions: unmeasured("not_attempted", at),
    serps: [],
    battery: [],
    pageAsked: [],
    pageSerps: [],
    pageBattery: [],
    pageRetired: [],
    pageRivals: null,
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

// ── The row a pass writes to ─────────────────────────────────────────────
// `scans.stopped_reason` and `scans.finished_at` are not in the generated `Database` type; nothing else here bypasses the generated client.

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
  /** `RunScanArgs.measuredSince`, as days before the pass started: the oldest stored read this pass may be served. */
  sinceDays?: number;
  /** The report this pass re-measures one part of, and which part; it makes `reading_your_market` read the stored report instead of buying (see `retry.ts`). */
  retry?: { report: StoredReport; part: RetryPart };
}

/** The country and language this pass measures in: what stage one settled, the site's stored answer else its home page. Nothing is bought before that,
 *  so the fallback below reaches no vendor call. */
export function localeOfPass(a: Pick<StageArgs, "sections" | "locale">): Locale {
  return a.sections.measurement?.locale ?? a.locale ?? DEFAULT_LOCALE;
}

/** One pass's cost context narrowed to a purse, as `stageBounds` narrows `Bounds`: steps that re-read `capHit()` respect it unchanged.
 *  It never widens anything; every cap is still read and spend ledgered through the wrapped context. A cache hit costs no purse. */
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

/** Whose purchase this pass's vendor calls are: a paid pass buys for its site, the free path for the domain. Never shared, since cost is stated per customer.
 *  Derived from `siteId` rather than passed in, so there is no second value to disagree. */
export function cacheScope(a: StageArgs): CacheScope {
  return a.siteId === undefined ? { domain: a.domain } : { site: a.siteId };
}

/** The tier's SERP window, narrowed to the pass's own period: a weekly pass's AI input is never a SERP bought before its week. */
export function serpWindowOf(a: StageArgs): number {
  const days = a.parameters.serpWindowDays;
  return a.sinceDays === undefined ? days : Math.min(days, a.sinceDays);
}

/** The instant this pass's ceiling runs out, for a call that waits inside itself: standard-queue polls run to `VENDOR.stdQueueDeadlineMin`,
 *  far past a paid pass's ceiling and invocation, where no between-calls check reaches. So the deadline goes in with the call; read at the call, never carried. */
export function untilCeiling(bounds: Bounds, parameters: TierParameters): number {
  return Date.now() + Math.max(0, bounds.remainingMs() - parameters.askReserveS * 1000);
}

/** The wall clock one SERP request may hold: the tier's bound, and on a pass with no stage budgets never more than its ceiling leaves.
 *  The free stage clock does not shorten it: a shorter one only buys aborted, billed calls. */
export function serpAbortFor(pass: Bounds, parameters: TierParameters): number {
  if (parameters.stageBudgets) return parameters.serpAbortMs;
  return Math.max(1, Math.min(parameters.serpAbortMs, pass.remainingMs()));
}

/** How this tier's Google organic reads are queued. */
export function queueOf(parameters: TierParameters): { priority?: "high"; pollMs: number } {
  return { ...(parameters.serpPriority === "high" ? { priority: parameters.serpPriority } : {}), pollMs: parameters.serpPollMs };
}

/** What a pass keeps beyond one request's bound to ledger and score its
 *  answer, so waiting for a read never runs the pass into its ceiling. */
const SERP_SETTLE_MS = 2_000;

/** Whether the pass's clock holds one more whole SERP read: on the free path one request's bound plus settling time before the ceiling;
 *  a paid pass's bound is already cut to its ceiling. */
export function roomForOneRead(pass: Bounds, parameters: TierParameters): boolean {
  if (!parameters.stageBudgets) return pass.remainingMs() > 0;
  return pass.remainingMs() >= parameters.askReserveS * 1000 + parameters.serpAbortMs + SERP_SETTLE_MS;
}

/** Whether the pass still waits for its posted Google reads: until `untilCeiling`, when every queued read gives up by itself. */
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

/** The market the report records, from what the pass has read so far: where questions were chosen from the ranked pool instead,
 *  the market is that pool and says the suggestions were not read. */
export function marketOf(s: Sections, at: Date): Measured<MarketSet> {
  if (s.profile.kind === "unmeasured") {
    // Where the site's listing in search named no market, the record says which way it fell short.
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
      if (read.kind !== null) summary.kind = read.kind;
      const buyer = read.buyers[0];
      if (buyer !== undefined) summary.buyer = buyer;
      if (read.where.place !== null) summary.place = read.where.place.name;
      else if (read.where.reach === "national" || read.where.reach === "international") {
        summary.reach = read.where.reach;
        summary.country = read.where.country;
      }
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
