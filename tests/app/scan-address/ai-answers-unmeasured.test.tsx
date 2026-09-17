// tests/app/scan-address/ai-answers-unmeasured.test.tsx — issue 869
//
// An unmeasured cell is unmeasured. It is not "you are not mentioned".
//
// The AI Mode engine answered 1 call in 14 on production (issue 869), so
// its column arrives `unmeasured` — and the question list used to fall
// through to the red `not you` badge for exactly that cell, printing the
// customer's own problem over an outage. §2.5 keeps red for a problem being
// shown to the customer, and "we could not read this" is not one.
//
// Rendering convention as in `ai-answers.test.tsx`: `react-dom/server` and
// `copy()` mocked to its key.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("@/lib/presentation/copy", () => ({
  copy: (key: string, vars?: Record<string, string>) =>
    vars === undefined ? key : `${key}(${Object.values(vars).join("|")})`,
}));

import { AiAnswersCard } from "@/app/(public)/scan/[domain]/_modules/ai-answers";
import { FIXTURE_REPORT } from "@/app/(public)/scan/[domain]/_fixture/states";
import type { AiAnswersSection, AnswerCell } from "@/lib/scan/report";

const SECTION = FIXTURE_REPORT.aiAnswers as AiAnswersSection;

/** What a pass stores for a question whose AI Overview could not be read —
 *  with the vendor's own kind on it (issue 865's `because`). */
const UNREADABLE: AnswerCell = { kind: "unmeasured", reason: "undeterminable", because: "timeout" };

function render(section: AiAnswersSection): string {
  return renderToStaticMarkup(
    React.createElement(AiAnswersCard, { section, measuredOn: "6 Sep 2026" })
  );
}

function count(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

/** Every question's own cell unmeasured — the engine outage, as stored. */
function allUnmeasured(): AiAnswersSection {
  return {
    ...SECTION,
    measuredSearches: 0,
    answeredSearches: 0,
    customerCitations: 0,
    rows: SECTION.rows.map((row) => ({
      ...row,
      cell: UNREADABLE,
      engines: [
        { engine: "ai_overview" as const, cell: UNREADABLE },
        { engine: "ai_mode" as const, cell: UNREADABLE },
        { engine: "chatgpt" as const, cell: UNREADABLE },
      ],
    })),
  };
}

describe("issue 869 — a question nobody could read is not a question you were left out of", () => {
  it("renders the not-measured line, never the red `not you`, for an unmeasured cell", () => {
    const html = render(allUnmeasured());

    expect(count(html, "ai-answers.question.not-you")).toBe(0);
    expect(count(html, "badge-error")).toBe(0);
    expect(count(html, "ai-answers.engine.not-measured")).toBeGreaterThanOrEqual(SECTION.rows.length);
  });

  it("does not call it `no answer` either — the engine did not answer nothing, it was not read", () => {
    const html = render(allUnmeasured());
    expect(count(html, "ai-answers.question.no-answer")).toBe(0);
  });

  it("a measured miss still says so — the red badge is not simply gone", () => {
    const missed: AnswerCell = { kind: "answered", citedDomains: ["rival.com"], namesCustomer: false };
    const html = render({
      ...SECTION,
      rows: SECTION.rows.map((row) => ({
        ...row,
        cell: missed,
        engines: [{ engine: "ai_overview" as const, cell: missed }],
      })),
    });

    expect(count(html, "ai-answers.question.not-you")).toBe(SECTION.rows.length);
  });
});
