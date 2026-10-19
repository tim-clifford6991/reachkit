/** @vitest-environment jsdom */
// Issue 1551 (owner, 2026-10-19; SEO review R5.1) — the AI tab leads with the
// published pages' own questions cited, and the buyer-prompt rate beside it
// is labelled as brand reputation.
import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AnswerTiles } from "@/app/(account)/app/_overview/AnswerTiles";
import { PromptRate } from "@/app/(account)/app/_overview/PromptCards";
import { assembleAnswers, type AnswerMark, type AnswerQuestion } from "@/app/(account)/app/_overview/answers-model";
import { assemblePrompts } from "@/app/(account)/app/_overview/prompts-model";
import { FIXTURE_PROMPT_WINDOW } from "@/app/(account)/app/_overview/prompts-fixture";
import { fromStored } from "@/lib/presentation/generated";
import { copy } from "@/lib/presentation/copy";

const AT = new Date("2026-10-19T06:00:00.000Z");

const question = (n: number, marks: readonly AnswerMark[]): AnswerQuestion => ({
  n,
  wording: fromStored("questions.wording", `Question ${n}?`),
  search: `search ${n}`,
  marks,
  page: null,
});

function render(node: React.JSX.Element): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(node);
  return container;
}

describe("the AI tab leads with the pages' own questions cited", () => {
  const model = assembleAnswers(
    {
      weeks: [
        {
          weekStart: AT,
          // The twelve name nobody: no prompt mention either.
          questions: Array.from({ length: 12 }, (_, i) => question(i + 1, ["names_others", "no_answer", "names_others"])),
          pageQuestions: [question(13, ["links_to_you", "no_answer", "names_others"]), question(14, ["no_answer", "names_others", "not_measured"])],
        },
      ],
      measuredAt: AT,
    },
    AT
  );

  it("one page cited of two asked, while the rate is zero, and it is the first tile", () => {
    expect(model.pagesCited).toMatchObject({ value: { value: 1 }, of: 2 });
    const tiles = render(<AnswerTiles model={model} />).querySelector('[data-testid="answers-tiles"]');
    const first = tiles?.firstElementChild;
    expect(first?.getAttribute("data-testid")).toBe("answers-tile-pages-cited");
    expect(first?.querySelector('[data-testid="answers-tile-pages-cited-value"]')?.textContent).toBe("1");
    expect(first?.textContent).toContain(copy("overview.answers.pages-cited.of", { of: "2" }));
    expect(tiles?.querySelector('[data-testid="answers-tile-week-value"]')?.textContent).toBe("0");
  });

  it("a pass that asked no page question says when it will show, never a zero", () => {
    const none = assembleAnswers({ weeks: [{ weekStart: AT, questions: [question(1, ["no_answer", "no_answer", "no_answer"])] }], measuredAt: AT }, AT);
    expect(none.pagesCited.value.kind).toBe("unmeasured");
    const tile = render(<AnswerTiles model={none} />).querySelector('[data-testid="answers-tile-pages-cited"]');
    expect(tile?.textContent).toContain(copy("overview.answers.pages-cited.none"));
  });

  it("the buyer-prompt rate is labelled as brand reputation", () => {
    const rate = render(<>{PromptRate({ model: assemblePrompts(FIXTURE_PROMPT_WINDOW) })}</>);
    expect(rate.querySelector('[data-testid="prompts-rate-reputation"]')?.textContent).toBe(copy("overview.prompts.rate.reputation"));
  });
});
