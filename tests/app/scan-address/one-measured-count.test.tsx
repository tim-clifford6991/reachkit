// tests/app/scan-address/one-measured-count.test.tsx — issue 1309
//
// One finished report names one count of measured searches. The shape is
// the one found live on 7 October 2026: ten questions listed, two measured,
// and a page that said 2, 10 and 12 for the same market.
//
// The real registry, not a mock: the defect was in the sentences.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { ReportView } from "@/app/(public)/scan/[domain]/_address/report-view";
import { FIXTURE_REPORT } from "@/app/(public)/scan/[domain]/_fixture/states";
import { copy } from "@/lib/presentation/copy";
import type { AiAnswersSection, AnswerCell, PresenceSection } from "@/lib/scan/report";

const NOT_REACHED: AnswerCell = { kind: "unmeasured", reason: "not_attempted" };

function render(report: typeof FIXTURE_REPORT): string {
  return renderToStaticMarkup(
    React.createElement(ReportView, {
      state: { report, notice: null, control: { kind: "none" }, correction: { offered: true, as: "first" } },
    })
  );
}

/** Every number the page puts in front of "searches", whatever the sentence. */
function searchCounts(html: string): string[] {
  return [...html.matchAll(/(\d+) (?:biggest |buyer )?searches/g)].map((match) => match[1] ?? "");
}

function shortReport(): typeof FIXTURE_REPORT {
  const ai = FIXTURE_REPORT.aiAnswers as AiAnswersSection;
  const presence = FIXTURE_REPORT.presence as PresenceSection;
  const named: AnswerCell = { kind: "answered", citedDomains: [ai.ownDomain], namesCustomer: true };
  const missed: AnswerCell = { kind: "answered", citedDomains: ["rival.example.net"], namesCustomer: false };
  const cells = [named, missed];
  return {
    ...FIXTURE_REPORT,
    aiAnswers: {
      ...ai,
      measuredSearches: 2,
      answeredSearches: 2,
      customerCitations: 1,
      rivals: ai.rivals.map((rival) => ({ ...rival, cells: rival.cells.slice(0, 10).map((cell, i) => (i < 2 ? cell : NOT_REACHED)) })),
      rows: ai.rows.slice(0, 10).map((row, i) => {
        const cell = cells[i] ?? NOT_REACHED;
        return { ...row, cell, engines: [{ engine: "ai_overview" as const, cell }] };
      }),
    },
    presence: {
      ...presence,
      measuredSearches: 2,
      you: { ...presence.you, top10Count: 1 },
      rivals: presence.rivals.map((rival) => ({ ...rival, top10Count: 1 })),
      absentFrom: presence.absentFrom.slice(0, 1),
    },
  };
}

describe("issue 1309 — one report, one count of measured searches", () => {
  it("a report that measured two of ten questions says two wherever it counts searches", () => {
    const html = render(shortReport());
    const counts = searchCounts(html);

    expect(counts.length).toBeGreaterThanOrEqual(2);
    expect(new Set(counts)).toEqual(new Set(["2"]));
    // The ten are named as questions found, beside the two measured.
    expect(html).toContain(copy("ai-answers.questions.title.partial", { total: "10", measured: "2" }));
  });

  it("the reserved-name fixture still reads as one report of twelve", () => {
    const html = render(FIXTURE_REPORT).replaceAll(copy("presence.absent-from.title"), "");
    expect(new Set(searchCounts(html))).toEqual(new Set(["12"]));
  });

  it("the shared link's description promises no number of searches", () => {
    expect(copy("meta.report.description", { domain: "mailchimp.com" })).not.toMatch(/\d/);
  });
});
