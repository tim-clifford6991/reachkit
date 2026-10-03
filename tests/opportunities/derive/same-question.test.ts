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

// Braces: a returned mock is run by vitest as the test's cleanup.
beforeEach(() => {
  createMock.mockReset();
});

it("keeps a pair only between two different searches it was shown, in one ledgered call", async () => {
  createMock.mockImplementation(async (request: { messages: { content: string }[] }) => {
    const { topics } = JSON.parse(request.messages[0]!.content) as { topics: { i: number; search: string; ask?: true }[] };
    const at = (search: string) => topics.find((topic) => topic.search === search)!.i;
    return toolUseMessage(
      {
        pairs: [
          { i: at("acme cost"), sameAs: at("acme pricing") },
          // Issue 1208: the model pairing a search with itself, and with an
          // index it was not shown.
          { i: at("acme pricing"), sameAs: at("acme pricing") },
          { i: at("acme for small business"), sameAs: 99 },
        ],
      },
      100,
      20,
      SAME_QUESTION_CALL_SITE
    );
  });
  const { ctx, sources } = fakeCost();
  const judged = await judgeSameQuestion(ctx, {
    searches: ["Acme cost", "acme pricing", "acme for small business"],
    topics: ["best acme"],
  });
  expect([...judged]).toEqual([["acme cost", "acme pricing"]]);
  expect(sources).toEqual([SAME_QUESTION_CALL_SITE]);
});

it("asks nothing where there is nothing to compare", async () => {
  const { ctx, sources } = fakeCost();
  expect((await judgeSameQuestion(ctx, { searches: ["best seo software"], topics: [] })).size).toBe(0);
  expect(sources).toEqual([]);
});
