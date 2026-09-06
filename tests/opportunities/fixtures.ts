// tests/opportunities/fixtures.ts — the reports the §7 suites derive from.
//
// Not a suite. Built on `tests/scan/report/fixtures.ts` and
// `assembleReport`, so a report here is the very shape the pipeline
// stores: a section whose type changes fails to compile here rather than
// drifting quietly into a derivation.
import "./env";
import { assembleReport } from "../../src/lib/scan/store";
import type { StoredReport } from "../../src/lib/scan/report";
import type { ReportSections } from "../../src/lib/scan/store";
import { answersSectionOf } from "../../src/lib/scan/sections";
import { buildAiAnswersCard } from "../../src/lib/market/questions/matrix";
import type { Question } from "../../src/lib/market/questions/phrase";
import type { SelectedSearch } from "../../src/lib/market/questions/select";
import { measured, unmeasured, type Measured } from "../../src/lib/measure/measured";
import type { RankedCounts } from "../../src/lib/opportunities/winnability/counts";
import type { SerpResult } from "../../src/lib/vendors/dataforseo/types";
import { AT, DOMAIN, PROFILE, fullSections } from "../scan/report/fixtures";

export { AT, DOMAIN, PROFILE };

export const SITE_ID = "22222222-2222-4222-8222-222222222222";
export const SCAN_ID = "11111111-1111-4111-8111-111111111111";

export function search(over: Partial<SelectedSearch> = {}): SelectedSearch {
  return {
    keyword: "best user onboarding software",
    volume: 1900,
    intent: "decision",
    score: 9.9,
    rank: 1,
    ...over,
  };
}

export function question(over: Partial<Question> = {}): Question {
  return {
    id: "q1",
    text: "What's the best user onboarding software?",
    search: search(),
    phrasing: "template",
    ...over,
  };
}

/** A top ten the customer is absent from, headed by a rival. */
export function serp(over: Partial<SerpResult> = {}): SerpResult {
  return {
    organic: [
      { position: 1, domain: "appcues.com", url: "https://appcues.com/a", title: "Appcues" },
      { position: 2, domain: "userpilot.com", url: "https://userpilot.com/b", title: "Userpilot" },
    ],
    aiOverview: { present: true, asynchronousAiOverview: true, referenceDomains: ["appcues.com"] },
    ...over,
  };
}

/** Ranked counts small enough to clear the winnable bar at cold start. */
export function smallCounts(domains: readonly string[] = ["appcues.com", "userpilot.com"]): RankedCounts {
  return new Map(domains.map((domain) => [domain, measured(40, AT)] as const));
}

export function bigCounts(domains: readonly string[] = ["appcues.com", "userpilot.com"]): RankedCounts {
  return new Map(domains.map((domain) => [domain, measured(4000, AT)] as const));
}

export function unreadableCounts(
  domains: readonly string[] = ["appcues.com", "userpilot.com"]
): RankedCounts {
  return new Map(
    domains.map((domain) => [domain, unmeasured<number>("undeterminable", AT)] as const)
  );
}

/**
 * One stored report, assembled from the questions and SERPs given.
 *
 * `namesCustomer` on every answer cell follows from the SERP's own AI
 * overview references, exactly as the matrix builds it — the fixture never
 * hand-writes a cell, so a suite cannot accidentally assert against a
 * matrix shape the engine does not produce.
 */
export function reportOf(
  a: { questions: Question[]; serps: SerpResult[] },
  over: Partial<ReportSections> = {}
): StoredReport {
  const serps: Measured<SerpResult>[] = a.serps.map((one) => measured(one, AT));
  const questions = measured(a.questions, AT);
  const card = buildAiAnswersCard({
    questions: a.questions,
    serps,
    ownDomain: DOMAIN,
    coverage: "async_included",
  });
  return assembleReport(
    fullSections({
      scanId: SCAN_ID,
      // No gate failing unless a suite says so: the shared report fixture
      // blocks one AI reader, which would put a Fix instruction in every
      // derivation and quietly change every count asserted here.
      blockedAgents: [],
      questions,
      serps,
      aiAnswers: answersSectionOf({
        card,
        questions,
        rivals: [],
        ownDomain: DOMAIN,
        measuredAt: AT,
      }),
      ...over,
    })
  );
}

/** The default: one decision search, a top ten the customer is absent
 *  from, and an AI answer that cited a rival and not them. */
export function defaultReport(over: Partial<ReportSections> = {}): StoredReport {
  return reportOf({ questions: [question()], serps: [serp()] }, over);
}
