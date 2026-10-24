/** @vitest-environment jsdom */
// The Google bar and the presence card count the same thing, and so do the
// AI bar and the AI-answers card: on every report the fixture states draw,
// each bar's tenths are its card's share in tenths, wherever both are
// measured.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { ReportView } from "@/app/(public)/scan/[domain]/_address/report-view";
import { FIXTURE_DOMAINS, FIXTURE_REPORT, fixtureStateFor } from "@/app/(public)/scan/[domain]/_fixture/states";
import { searchPresenceOf, searchPresenceRangeOf } from "@/lib/measure/drivers";
import { measured, unmeasured } from "@/lib/measure/measured";
import { NO_AI_ANSWERS } from "@/lib/measure/score";
import { verdictOf } from "@/lib/measure/verdict";
import { copy } from "@/lib/presentation/copy";
import { FEEDS } from "@/lib/measure/partition";
import type { CanonicalDomain } from "@/lib/scan/domain";
import type { StoredReport } from "@/lib/scan/report";

type ReportState = React.ComponentProps<typeof ReportView>["state"];

/** The tenths the rendered Google bar draws, or `null` where it draws none. */
function googleBar(state: ReportState): number | null {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(<ReportView state={state} />);
  const bar = container.querySelector<HTMLProgressElement>(`progress[aria-label="${copy("verdict.factor.google")}"]`);
  return bar === null ? null : Number(bar.getAttribute("value"));
}

/** Each report whose bar and card are both measured and disagree. */
function disagreements(states: readonly { domain: string; state: ReportState }[]): string[] {
  return states.flatMap(({ domain, state }) => {
    const card = state.report.presence;
    const bar = googleBar(state);
    if (card === null || card.measuredSearches === 0 || bar === null) return [];
    const share = Math.round((10 * card.you.top10Count) / card.measuredSearches);
    return bar === share ? [] : [`${domain}: bar ${bar}/10, card ${card.you.top10Count} of ${card.measuredSearches}`];
  });
}

const REPORT_STATES = FIXTURE_DOMAINS.flatMap((domain) => {
  const state = fixtureStateFor(domain as CanonicalDomain);
  return state?.kind === "report" ? [{ domain, state }] : [];
});

describe("the Google bar equals the presence card's page-one share", () => {
  it("on every report state, wherever both are measured", () => {
    const compared = REPORT_STATES.filter(({ state }) => state.report.presence !== null && googleBar(state) !== null);
    expect(compared.length).toBeGreaterThanOrEqual(2);
    expect(disagreements(REPORT_STATES)).toEqual([]);
  });

  it("a bar skewed off its card is caught", () => {
    const at = FIXTURE_REPORT.verdict.measuredAt;
    const skewed: StoredReport = { ...FIXTURE_REPORT, verdict: { ...FIXTURE_REPORT.verdict, halves: { google: measured(100, at), ai: measured(10, at) } } };
    const state: ReportState = { report: skewed, notice: null, control: { kind: "none" }, correction: { offered: true, as: "first" } };
    expect(disagreements([{ domain: "skewed.example.com", state }])).toEqual(["skewed.example.com: bar 10/10, card 1 of 12"]);
  });
});

/** The tenths the rendered AI bar draws, and the "not you" marks on the AI card's questions. */
function aiRead(state: ReportState): { bar: number | null; notYou: number } {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(<ReportView state={state} />);
  const bar = container.querySelector<HTMLProgressElement>(`progress[aria-label="${copy("verdict.factor.ai")}"]`);
  const notYou = [...container.querySelectorAll(".badge")].filter((badge) => badge.textContent === copy("ai-answers.question.not-you")).length;
  return { bar: bar === null ? null : Number(bar.getAttribute("value")), notYou };
}

/** Each report whose AI bar or row marks disagree with the AI card's x of N. */
function aiDisagreements(states: readonly { domain: string; state: ReportState }[]): string[] {
  return states.flatMap(({ domain, state }) => {
    const card = state.report.aiAnswers;
    if (card === null || card.answeredSearches === 0) return [];
    const { bar, notYou } = aiRead(state);
    const share = Math.round((10 * card.customerCitations) / card.answeredSearches);
    const marks = card.answeredSearches - card.customerCitations;
    return [
      ...(bar === null || bar === share ? [] : [`${domain}: bar ${bar}/10, card ${card.customerCitations} of ${card.answeredSearches}`]),
      ...(notYou === marks ? [] : [`${domain}: ${notYou} questions marked not you, card ${card.customerCitations} of ${card.answeredSearches}`]),
    ];
  });
}

describe("the AI bar and the AI card's marks equal the card's named-or-linked count", () => {
  it("on every report state, wherever both are measured", () => {
    const compared = REPORT_STATES.filter(({ state }) => (state.report.aiAnswers?.answeredSearches ?? 0) > 0 && aiRead(state).bar !== null);
    expect(compared.length).toBeGreaterThanOrEqual(2);
    expect(aiDisagreements(REPORT_STATES)).toEqual([]);
  });

  it("a bar skewed off its card is caught", () => {
    const at = FIXTURE_REPORT.verdict.measuredAt;
    const skewed: StoredReport = { ...FIXTURE_REPORT, verdict: { ...FIXTURE_REPORT.verdict, halves: { google: measured(100 / 12, at), ai: measured(95, at) } } };
    const state: ReportState = { report: skewed, notice: null, control: { kind: "none" }, correction: { offered: true, as: "first" } };
    expect(aiDisagreements([{ domain: "skewed.example.com", state }])).toEqual(["skewed.example.com: bar 10/10, card 3 of 9"]);
  });
});

describe("the score's range spans a Google share counted over few searches", () => {
  it("on page one for 0 of 4, AI answering none: the report reads somewhere between 14 and 53 beside a Google bar of 0", () => {
    const at = FIXTURE_REPORT.verdict.measuredAt;
    const stored = FIXTURE_REPORT.presence as NonNullable<StoredReport["presence"]>;
    const card = { ...stored, measuredSearches: 4, you: { ...stored.you, top10Count: 0 } };
    const verdict = verdictOf({
      domain: FIXTURE_REPORT.verdict.domain,
      measuredAt: at,
      drivers: {
        foundations: measured(100, at),
        answerability: measured(30, at),
        searchPresence: searchPresenceOf({ card, serps: [], at }),
        aiPresence: unmeasured("undeterminable", at, NO_AI_ANSWERS),
      },
      inputs: Object.fromEntries(Object.keys(FEEDS).map((input) => [input, { read: true, empty: false }])) as Parameters<typeof verdictOf>[0]["inputs"],
      robots: unmeasured("not_attempted", at),
      searchRange: searchPresenceRangeOf(card),
      searchesRead: 12,
    });
    expect(verdict.estimate?.confidence).toBe("rough");
    const state: ReportState = { report: { ...FIXTURE_REPORT, presence: card, verdict }, notice: null, control: { kind: "none" }, correction: { offered: true, as: "first" } };
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<ReportView state={state} />);
    expect(container.querySelector('[data-testid="verdict-estimate"]')?.textContent).toBe(copy("verdict.estimate.range", { low: "14", high: "53" }));
    expect(googleBar(state)).toBe(0);
    expect(disagreements([{ domain: "thin.example.com", state }])).toEqual([]);
  });
});
