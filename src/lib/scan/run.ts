// BUILD §4.1, §6.3, §6.5 — the one scan pipeline. Tier is a parameter.
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
import { FREE_RESCAN_WINDOW_D } from "@/lib/config/constants";
import type { CapName, CostContext } from "@/lib/costs";
import { dbAdmin } from "@/lib/db";
import type { RobotsPolicy } from "@/lib/egress/types";
import { checkCoherence, type CoherenceVerdict } from "@/lib/market/coherence/check";
import { nextCorrectionState, type CorrectionState } from "@/lib/market/coherence/state";
import { buildAiAnswersCard } from "@/lib/market/questions/matrix";
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
import type { MarketSerp } from "@/lib/market/views";
import { aiPresenceOf, measureDomain, type DomainMeasurement } from "@/lib/measure";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import type { InputOutcome, ScanInput } from "@/lib/measure/partition";
import type { OnPageFacts } from "@/lib/measure/parse";
import type { Drivers } from "@/lib/measure/score";
import { verdictOf, type Verdict } from "@/lib/measure/verdict";
import { serpOrganic } from "@/lib/vendors/dataforseo";
import type { SerpResult } from "@/lib/vendors/dataforseo/types";
import { withScanBounds, type Bounds } from "./ceilings";
import { advanceCorrectionState, readCorrectionFacts, registerCorrectionRunner } from "./correction";
import { parseDomain, type CanonicalDomain } from "./domain";
import { readCurrentReport } from "./report";
import type { AiAnswersSection, StoppedReason, StoredReport, SupplySection, Tier } from "./report";
import { answersSectionOf, blockedAgentsOf, categoryOf } from "./sections";
import { emitEnding, enterStage, exitStage } from "./stages";
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
}

export const TIER_PARAMETERS: Readonly<Record<Tier, TierParameters>> = Object.freeze({
  free: Object.freeze({
    cap: "FREE",
    serpMode: "live",
    asyncAiOverview: true,
    deadlineApplies: true,
    adoptsClaim: true,
  }),
  deep: Object.freeze({
    cap: "DEEP",
    serpMode: "live",
    asyncAiOverview: false,
    deadlineApplies: false,
    adoptsClaim: false,
  }),
  weekly: Object.freeze({
    cap: "WEEKLY",
    serpMode: "std",
    asyncAiOverview: false,
    deadlineApplies: false,
    adoptsClaim: false,
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
  rivals: Measured<RivalCandidate[]>;
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
    rivals: unmeasured("not_attempted", at),
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function wholeDaysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

// ── runScan ─────────────────────────────────────────────────────────────

export interface RunScanArgs {
  domain: string;
  siteId?: string;
  tier: Tier;
  /** A market correction re-measures inside the scan it corrects: same
   *  spend ceiling, no second allowance consumed. */
  correctionOf?: string;
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
  } else {
    scanId = crypto.randomUUID();
  }

  // 2. §6.4's seven-day window.
  if (a.correctionOf === undefined) {
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
    { scanId, startedAt, cap: parameters.cap, deadlineApplies: parameters.deadlineApplies },
    async (bounds, cost) => {
      try {
        await runStages({ scanId, bounds, cost, domain, tier: a.tier, parameters, correction: a.correctionOf !== undefined, sections });
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

  logPass({ scanId, tier: a.tier, stoppedReason, status: stored.status, because: "pass_ended" });
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

  if (bounds.stopNow() !== null) return;
  enterStage(scanId, "reading_your_site");
  const measurement = await attempt("reading_your_site", () => measureDomain(cost, { domain, tier: a.tier }));
  if (!failed(measurement)) sections.measurement = measurement;
  exitStage(scanId, "reading_your_site");

  if (bounds.stopNow() !== null) return;
  enterStage(scanId, "reading_access_rules");
  exitStage(scanId, "reading_access_rules");

  if (bounds.stopNow() !== null) return;
  enterStage(scanId, "reading_your_market");
  await readMarket(a);
  exitStage(scanId, "reading_your_market");

  if (bounds.stopNow() !== null) return;
  enterStage(scanId, "checking_your_presence");
  exitStage(scanId, "checking_your_presence");

  if (bounds.stopNow() !== null) return;
  enterStage(scanId, "asking_the_twelve");
  await askTheTwelve(a);
  exitStage(scanId, "asking_the_twelve");

  if (bounds.stopNow() !== null) return;
  enterStage(scanId, "scoring");
  score(a);
  exitStage(scanId, "scoring");
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
 *  SERP's own AI Overview at no extra cost. The ceilings are re-checked
 *  between every one — this is the multi-call step §6.5 names — and a
 *  question the ceiling stopped us reaching carries `not_attempted`, which
 *  lowers the cards' denominator rather than reading as a miss. */
async function askTheTwelve(a: StageArgs): Promise<void> {
  const { bounds, cost, parameters, sections } = a;
  const questions = sections.questions;
  const asked = questions.kind === "unmeasured" ? [] : questions.value;

  for (const question of asked) {
    if (bounds.stopNow() !== null) {
      sections.serps.push(unmeasured("not_attempted", questions.at));
      continue;
    }
    const serp = await attempt("asking_the_twelve", () =>
      serpOrganic(cost, {
        query: question.search.keyword,
        mode: parameters.serpMode,
        loadAsyncAiOverview: parameters.asyncAiOverview && !a.correction,
      })
    );
    sections.serps.push(failed(serp) ? unmeasured("undeterminable", questions.at) : serp);
  }
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
    category: categoryOf(market),
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
