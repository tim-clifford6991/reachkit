// tests/app/scan-address/ai-answers-all-questions.test.tsx — issue 1436
//
// Opening the questions shows every question. With five questions the list
// used to show four and hide the fifth behind a second toggle inside the
// first.
//
// Rendering convention as in `ai-answers-unmeasured.test.tsx`:
// `react-dom/server` and `copy()` mocked to its key.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("@/lib/presentation/copy", () => ({
  copy: (key: string, vars?: Record<string, string>) =>
    vars === undefined ? key : `${key}(${Object.values(vars).join("|")})`,
}));

import { AiAnswersCard } from "@/app/(public)/scan/[domain]/_modules/ai-answers";
import { FIXTURE_REPORT } from "@/app/(public)/scan/[domain]/_fixture/states";
import type { AiAnswersSection } from "@/lib/scan/report";

const SECTION = FIXTURE_REPORT.aiAnswers as AiAnswersSection;

function render(rows: number): string {
  const section: AiAnswersSection = {
    ...SECTION,
    rows: SECTION.rows.slice(0, rows),
    rivals: SECTION.rivals.map((rival) => ({ ...rival, cells: rival.cells.slice(0, rows) })),
  };
  return renderToStaticMarkup(React.createElement(AiAnswersCard, { section, measuredOn: "6 Sep 2026" }));
}

function count(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

describe("issue 1436 — the open list holds every question", () => {
  it.each([5, SECTION.rows.length])("%i questions: one toggle, and every row inside it", (rows) => {
    const html = render(rows);
    expect(count(html, "<details")).toBe(1);
    const list = html.slice(html.indexOf("<details"), html.indexOf("</details>"));
    expect(count(list, "ai-answers.question.provenance")).toBe(rows);
  });
});
