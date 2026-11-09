/** @vitest-environment jsdom */
// Owner R4 (2026-10-31): the report's first two bars, and the gap card that names one, say what they measure.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { ReportView } from "@/app/(public)/scan/[domain]/_address/report-view";
import { FIXTURE_REPORT } from "@/app/(public)/scan/[domain]/_fixture/states";
import type { StoredReport } from "@/lib/scan/report";

function rendered(report: StoredReport): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <ReportView state={{ report, notice: null, control: { kind: "none" }, correction: { offered: true, as: "first" } }} />
  );
  return container;
}

describe("the report's bars are named Website basics and Answers questions", () => {
  it("each bar carries its name", () => {
    const labels = [...rendered(FIXTURE_REPORT).querySelectorAll("progress")].map((bar) => bar.getAttribute("aria-label"));
    expect(labels).toEqual(expect.arrayContaining(["Website basics", "Answers questions"]));
  });

  it.each([
    ["foundations", "Biggest gap: Website basics"],
    ["answerability", "Biggest gap: Answers questions"],
  ] as const)("a report held back by %s names that bar in its gap card", (factor, title) => {
    const report = { ...FIXTURE_REPORT, verdict: { ...FIXTURE_REPORT.verdict, limiting: { kind: "factor", factor } } } as StoredReport;
    expect(rendered(report).querySelector('[data-testid="report-gap"] h2')?.textContent).toBe(title);
  });
});
