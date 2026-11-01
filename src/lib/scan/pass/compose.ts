// src/lib/scan/pass/compose.ts — the score and the stored report, composed from the sections.
import type { RobotsPolicy } from "@/lib/egress/types";
import type { CorrectionState } from "@/lib/market/coherence/state";
import type { MarketSerp } from "@/lib/market/views";
import { freePageOf } from "@/lib/opportunities/free-page";
import { statedPlace as statedPlaceOf } from "@/lib/locale/place";
import { aiPresenceOf, aiSampleOf, searchPresenceOf } from "@/lib/measure";
import { aiPresenceRangeOf, searchPresenceRangeOf } from "@/lib/measure/drivers";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import { foldSerps, outcomeOf, type InputOutcome, type ScanInput } from "@/lib/measure/partition";
import type { OnPageFacts } from "@/lib/measure/parse";
import type { Drivers } from "@/lib/measure/score";
import { verdictOf, type Verdict } from "@/lib/measure/verdict";
import { cardsOf } from "../cards";
import type { CanonicalDomain } from "../domain";
import { marketTooSmall, stoppedOnCeiling } from "../market-floor";
import type { StoppedReason, StoredReport, SupplySection, Tier } from "../report";
import { answersSectionOf, blockedAgentsOf, pageQuestionsSectionOf } from "../sections";
import { checkSite } from "@/lib/site-issues/checks";
import { assembleReport } from "../store";
import { marketOf, type Sections, type StageArgs } from "./sections";
import { reportLocale } from "./place";

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
export function rescore(a: StageArgs): void {
  if (a.sections.sealed || a.sections.presence === null) return;
  score(a);
}

export function score(a: Pick<StageArgs, "domain" | "sections" | "parameters" | "correction">): void {
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

export function composeReport(a: {
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

  const market = marketOf(s, measuredAt);

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
    freePage:
      assembled.questions.kind === "unmeasured" || assembled.market.kind === "unmeasured" ? (carried?.freePage ?? null) : freePageOf(assembled),
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

/** Issue 898 — the two §6.7 steps that can leave a pass with no market at
 *  all, under the `ScanInput` names the verdict already reads them under. */
type MarketUnread = Extract<ScanInput, "business_profile" | "market_suggestions"> | null;
