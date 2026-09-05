// tests/scan/report/fixtures.ts — the shapes the report suites share
// (issue #25). Not a suite of its own: vitest collects `*.test.ts`.
//
// Every value here is built from the type its own module declares, so a
// section whose shape changes fails to compile here rather than drifting
// quietly into a stored blob.
import { buildAiAnswersCard } from "../../../src/lib/market/questions/matrix";
import { buildPresenceCard } from "../../../src/lib/market/rivals/presence";
import type { Profile } from "../../../src/lib/market/questions/profile";
import type { Question } from "../../../src/lib/market/questions/phrase";
import type { SelectedSearch } from "../../../src/lib/market/questions/select";
import { marketSetOf } from "../../../src/lib/market/questions/market-set";
import { measured, measuredZero, unmeasured, type Measured } from "../../../src/lib/measure/measured";
import type { OnPageFacts } from "../../../src/lib/measure/parse";
import type { Verdict } from "../../../src/lib/measure/verdict";
import type { RobotsPolicy } from "../../../src/lib/egress/types";
import type { SerpResult } from "../../../src/lib/vendors/dataforseo/types";
import type { CanonicalDomain } from "../../../src/lib/scan/domain";
import type { ReportSections } from "../../../src/lib/scan/store";

export const AT = new Date("2026-09-05T10:00:00.000Z");
export const DOMAIN = "example.com" as CanonicalDomain;

export const PROFILE: Profile = {
  category: "user onboarding software",
  job: "get new users to their first success",
  offeringType: "saas",
  audienceTerms: ["product teams", "saas"],
  namedRivals: ["appcues.com"],
  vocabulary: ["onboarding", "product tours"],
  brandTokens: ["example"],
};

export const SELECTED: SelectedSearch = {
  keyword: "best user onboarding software",
  volume: 1900,
  intent: "decision",
  score: 9.9,
  rank: 1,
};

export const QUESTION: Question = {
  id: "q1",
  text: "What's the best user onboarding software?",
  search: SELECTED,
  phrasing: "template",
};

export const SERP: SerpResult = {
  organic: [
    { position: 1, domain: "appcues.com", url: "https://appcues.com/", title: "Appcues" },
    { position: 2, domain: "userpilot.com", url: "https://userpilot.com/", title: "Userpilot" },
  ],
  aiOverview: { present: true, asynchronousAiOverview: true, referenceDomains: ["appcues.com"] },
};

export const ON_PAGE: OnPageFacts = {
  url: "https://example.com/",
  headings: 8,
  questionShapedHeadings: 3,
  directAnswerHeadings: 2,
  numerals: 12,
  dates: 1,
  outboundCitations: 2,
  visibleChars: 4200,
  schemaTypes: ["organization"],
  openGraphProperties: ["og:title"],
  noindex: false,
  noindexAppliesToEveryReader: false,
};

export const ROBOTS: RobotsPolicy = {
  ok: true,
  origin: "https://example.com",
  readAt: AT,
  disallowsAll: false,
  disallowedAgents: {},
  sitemaps: [],
  absent: false,
};

export const VERDICT: Verdict = {
  domain: DOMAIN,
  measuredAt: AT,
  scoreAndBand: measured({ score: 31, band: "hard-to-find" }, AT),
  limiting: { kind: "factor", factor: "presence" },
  missing: [],
  unmeasuredElsewhere: [],
  blockedReaders: measuredZero(0, AT),
};

/** A verdict whose score could not be computed — ADR-021's "a cut-off
 *  factor nulls the score". */
export const UNMEASURED_VERDICT: Verdict = {
  ...VERDICT,
  scoreAndBand: unmeasured("not_attempted", AT),
  limiting: { kind: "none", because: "score_unmeasured" },
  missing: [{ factor: "presence", reason: "not_attempted" }],
};

/** Every section on its most-populated arm. */
export function fullSections(over: Partial<ReportSections> = {}): ReportSections {
  const serps: Measured<SerpResult>[] = [measured(SERP, AT)];
  return {
    scanId: "11111111-1111-4111-8111-111111111111",
    domain: DOMAIN,
    measuredAt: AT,
    tier: "free",
    stoppedReason: "complete",
    fromIncompleteRescan: false,
    verdict: VERDICT,
    market: measured(marketSetOf({ profile: PROFILE, suggestions: [{ keyword: SELECTED.keyword, volume: 1900 }] }), AT),
    questions: measured([QUESTION], AT),
    answers: buildAiAnswersCard({ questions: [QUESTION], serps, ownDomain: DOMAIN, coverage: "async_included" }),
    presence: buildPresenceCard({ serps, selected: [SELECTED], ownDomain: DOMAIN, rivals: [] }),
    serps,
    rivals: measured([], AT),
    sources: [],
    onPage: measured(ON_PAGE, AT),
    robots: measured(ROBOTS, AT),
    coherence: { verdict: "unjudgeable", measuredCount: 1 },
    correctionState: "none",
    ...over,
  };
}

/** Every section a stage produces on the arm a ceiling leaves it — the
 *  shape a pass stopped at stage one stores. */
export function unreachedSections(over: Partial<ReportSections> = {}): ReportSections {
  return fullSections({
    stoppedReason: "time_ceiling",
    verdict: UNMEASURED_VERDICT,
    market: unmeasured("not_attempted", AT),
    questions: unmeasured("not_attempted", AT),
    answers: buildAiAnswersCard({ questions: [], serps: [], ownDomain: DOMAIN, coverage: "cached_only" }),
    presence: buildPresenceCard({ serps: [], selected: [], ownDomain: DOMAIN, rivals: [] }),
    serps: [],
    rivals: unmeasured("not_attempted", AT),
    onPage: unmeasured("not_attempted", AT),
    robots: unmeasured("not_attempted", AT),
    ...over,
  });
}
