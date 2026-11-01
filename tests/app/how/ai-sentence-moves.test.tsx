// tests/app/how/ai-sentence-moves.test.tsx
//
// R15: How it works' AI sentence is built from the constants the weekly AI
// battery runs on, so a changed constant moves the rendered numbers. The
// constants are a double here: four more category questions and six weeks.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

vi.mock("@/lib/config/constants", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/config/constants")>();
  return {
    ...real,
    ANSWER_RATE_WEEKS: 6,
    TRACKED_PROMPTS: { ...real.TRACKED_PROMPTS, SPLIT: { ...real.TRACKED_PROMPTS.SPLIT, category: real.TRACKED_PROMPTS.SPLIT.category + 4 } },
  };
});
vi.mock("@/app/(public)/_how/examples", () => ({ readLiveExamples: async () => ({ report: null, page: null, founder: null }) }));

const { TRACKED_PROMPTS } = await import("@/lib/config/constants");
const { copy } = await import("@/lib/presentation/copy");
const { default: HowItWorksPage } = await import("@/app/(public)/how-it-works/page");

const text = (markup: string): string => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("the AI sentence follows the constants", () => {
  it("states the doubled battery's questions, weeks and answers", () => {
    const prompts = Object.values(TRACKED_PROMPTS.SPLIT).reduce((sum, n) => sum + n, 0);
    const unbranded = prompts - TRACKED_PROMPTS.SPLIT.branded;
    const shown = text(renderToStaticMarkup(HowItWorksPage()));
    const sentence = copy("how.measure.ai", {
      engines: copy("how.measure.engines"),
      prompts,
      weeks: 6,
      answers: TRACKED_PROMPTS.ENGINES * unbranded * TRACKED_PROMPTS.RUNS * 6,
      unbranded,
    });
    expect(shown).toContain(sentence);
    expect(shown).toContain(`6 weeks give up to ${TRACKED_PROMPTS.ENGINES * unbranded * 6} answers to ${unbranded} questions`);
  });
});
