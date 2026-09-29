// SPEC §6 (2026-09-29, #1131): the one same-question judgement a pass makes.
import "../env";
import { beforeEach, expect, it, vi } from "vitest";
import { fakeCost } from "../cost";
import { toolUseMessage } from "../../llm/fixtures";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: createMock };
  },
}));

const { judgeSameQuestion, SAME_QUESTION_CALL_SITE } = await import(
  "../../../src/lib/opportunities/derive/same-question"
);

beforeEach(() => createMock.mockReset());

it("keeps a pair only between searches it was shown, in one ledgered call", async () => {
  createMock.mockResolvedValue(
    toolUseMessage(
      {
        pairs: [
          { search: "What is the best SEO software", sameAs: "best seo software" },
          { search: "best seo software for small business", sameAs: "an invented search" },
        ],
      },
      100,
      20,
      SAME_QUESTION_CALL_SITE
    )
  );
  const { ctx, sources } = fakeCost();
  const judged = await judgeSameQuestion(ctx, {
    searches: ["what is the best seo software", "best seo software for small business"],
    topics: ["best seo software"],
  });
  expect([...judged]).toEqual([["what is the best seo software", "best seo software"]]);
  expect(sources).toEqual([SAME_QUESTION_CALL_SITE]);
});

it("asks nothing where there is nothing to compare", async () => {
  const { ctx, sources } = fakeCost();
  expect((await judgeSameQuestion(ctx, { searches: ["best seo software"], topics: [] })).size).toBe(0);
  expect(sources).toEqual([]);
});
