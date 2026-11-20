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

/** The scoring, run again over a section that arrived late: `score` reads only `sections` and buys nothing (§6.6's "zero extra cost"),
 *  so the cards, rivals and coherence verdict keep agreeing with the SERPs stored. Skipped before the scoring stage has run. */
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

  // Beside the card, never inside it: the page questions are composed from their own three arrays, and the score's AI Presence reads their cells beside the twelve's.
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

/** BUILD §4.1 module 3's two counts, derived by the opportunities engine, so `not_attempted` here: a 0 would be a claim about the site nobody made. */
function UNMEASURED_SUPPLY(at: Date): SupplySection {
  return { missingPages: unmeasured("not_attempted", at), unquotablePages: unmeasured("not_attempted", at) };
}

/** A read that found nothing to read: a home document that links to no
 *  pricing page is a fact about the home document, not a failed fetch. */
const READ_AND_EMPTY: InputOutcome = { read: true, empty: true };

export function composeReport(a: {
  scanId: string;
  /** `RunScanArgs.category`: the category this pass measured under, kept on the record. */
  category?: string;
  domain: CanonicalDomain;
  tier: Tier;
  stoppedReason: StoppedReason;
  fromIncompleteRescan: boolean;
  sections: Sections;
  startedAt: Date;
  correctionState: CorrectionState;
  /** The report a retry started from: a section this pass did not produce falls back to the earlier report's, so a retry only ever adds to a report.
   *  Absent on an ordinary pass, where `null` is the truth about a section nothing produced. */
  carried?: StoredReport;
}): {
  report: StoredReport;
  drivers: Drivers;
  sectionMissing: boolean;
  marketTooSmall: boolean;
  /** Which §6.7 step left this pass with no market, or `null`; named by its `ScanInput` so the log line and the verdict say one word. */
  marketUnread: MarketUnread;
} {
  const s = a.sections;
  const m = s.measurement;
  // What a retry carries forward, read once; `undefined` and `null` both mean nothing carried.
  const carried = a.carried ?? null;
  const carriedSiteIssues = carried === null ? null : carried.siteIssues;
  // The page questions' AI Overviews count toward AI presence beside the twelve's, read as stored.
  const pageCells = (s.pageQuestions ?? carried?.pageQuestions)?.rows.map((row) => row.cell) ?? [];

  // One date: the moment the pass started, which every `Measured` under the verdict carries (`verdictOf` asserts it). A stored home read does not date it.
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
    // A market chosen from the ranked pool, where the suggestions did not answer, is a market read.
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

  // Which step left the pass with no market, read once so the log and the report cannot disagree.
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
    // A retry whose crawl did not run again keeps the checks already carried: `checkSite` over a `null` crawl would lose nine measurements to gain one.
    siteIssues:
      s.siteCrawl === null && carriedSiteIssues !== null
        ? carriedSiteIssues
        : checkSite({ crawl: s.siteCrawl, robots, blockedAgents: blockedAgentsOf(robots) }),
    coherence: s.coherence,
    correctionState: a.correctionState,
    // The category the pass was handed, so a category change and its clearing are visible; `null` where it seeded from the profile.
    measuredCategory: a.category ?? null,
    marketPrompts: s.marketPrompts,
    prompts: s.prompts,
  });
  // The one first-page proposal is the best right-sized Write target this pass measured: derived, never padded.
  const measuredIn = m === null ? null : reportLocale(m);
  // Only a page that says it serves a place states one.
  const statedPlace = m?.stated === undefined ? null : statedPlaceOf(m.stated);
  const report: StoredReport = {
    ...assembled,
    freePage:
      assembled.questions.kind === "unmeasured" || assembled.market.kind === "unmeasured" ? (carried?.freePage ?? null) : freePageOf(assembled),
    ...(measuredIn === null ? {} : { locale: s.placeFrom === null ? measuredIn : { ...measuredIn, placeFrom: s.placeFrom } }),
    ...(statedPlace === null ? {} : { statedPlace }),
    ...(s.marketFrom === null || market.kind === "unmeasured" ? {} : { marketFrom: s.marketFrom }),
  };

  // A market read and found too small buys no SERP, so presence is the market's answer, not a missing section; never for a pass a ceiling stopped.
  // A pass whose own ranked read failed is still named missing here.
  const tooSmall = marketTooSmall(s.questions) && !stoppedOnCeiling(a.stoppedReason);
  const missingFactors = verdict.missing;
  const searchUnread = !inputs.own_ranked_rows.read;

  // The twelve are a battery, not a section: each cell carries its own arm and `because`, so the pass misses this section only when no question was measured.
  // A wholly absent section, a ceiling or a cap still degrade the pass.
  const noQuestionMeasured = s.serps.length > 0 && s.serps.every((serp) => serp.kind === "unmeasured");

  // Read off the composed report, not `sections`: a retry that carried a card forward has it.
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

/** The two §6.7 steps that can leave a pass with no market, under the `ScanInput` names the verdict reads them by. */
type MarketUnread = Extract<ScanInput, "business_profile" | "market_suggestions"> | null;
