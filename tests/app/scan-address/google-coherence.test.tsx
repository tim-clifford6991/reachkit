/** @vitest-environment jsdom */
// The Google bar and the presence card count the same thing: on every
// report the fixture states draw, the bar's tenths are the card's page-one
// share in tenths, wherever both are measured.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { ReportView } from "@/app/(public)/scan/[domain]/_address/report-view";
import { FIXTURE_DOMAINS, FIXTURE_REPORT, fixtureStateFor } from "@/app/(public)/scan/[domain]/_fixture/states";
import { measured } from "@/lib/measure/measured";
import { copy } from "@/lib/presentation/copy";
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
