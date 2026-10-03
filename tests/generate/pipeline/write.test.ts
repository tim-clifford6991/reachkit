// tests/generate/pipeline/write.test.ts — SPEC §7 (2026-09-29) *Length and
// the writer*, issue 1138: what a customer's page gains from the writer
// tier, a length it is held to, and a critic.
//
//   * the draft's calls are on the writer tier, the sections in turn, each
//     call reading the ones before it;
//   * a page short of its floor is written once more, then held;
//   * a critic may add to the page, and may never take it under its floor.
import "../env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AT, GROUNDED, OUTLINE_ANSWER, draftAnswers, fakeCost, opportunity } from "../fixtures";
import { buildPromptInputs } from "../../../src/lib/generate/voice/inputs";
import type { Outline } from "../../../src/lib/generate/pipeline/steps";

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));

const { writeDraft } = await import("../../../src/lib/generate/pipeline/write");

// An explainer: 1,200–1,800 words. Over these six blocks the floor asks
// 150, 300, 300, 225, 75 and 150 words of the sections.
const PAGE = opportunity({ targetQuery: "what a seat limit costs a small team" });
const OUTLINE = OUTLINE_ANSWER as Outline;
const FULL = [160, 310, 310, 235, 85, 160];
const BRIEF = { readerQuestion: "What does it cost?", angle: "count the seats", mustCover: ["seats"], factIndexes: [0] };
const INPUTS = buildPromptInputs({
  businessName: "Acme",
  domain: "example.com",
  category: "project management software",
  voiceText: null,
  opportunity: PAGE,
  grounded: GROUNDED,
  links: [],
  profile: null,
});

/** `words` distinct words, so nothing the layout tidies is in them. */
const prose = (words: number, stem: string): string => Array.from({ length: words }, (_, i) => `${stem}${i}`).join(" ");
const measured = (value: unknown) => ({ kind: "measured", value, at: AT });
const UNANSWERED = { kind: "unmeasured", reason: "undeterminable", at: AT };
const SCORES = { adds: 2, specificity: 2, fit: 3, blocks: 3, length: 3 };

type Call = {
  site: string;
  tier: string;
  input: { write?: (number | { index: number; note: string })[]; written?: string[] };
};

/** A model that writes each section to `first` words, and to `again` words
 *  when it is asked for a section a second time. */
function model(a: { first: number[]; again?: Record<number, number>; critic?: unknown }): void {
  llmMock.mockReset();
  llmMock.mockImplementation(async (_c: unknown, call: Call) => {
    if (call.site === "generate.critic") return a.critic ?? measured({ ...SCORES, revise: [] });
    if (call.site === "generate.draft") {
      return measured(draftAnswers()[0]);
    }
    return measured({
      sections: call.input.write!.map((asked) =>
        typeof asked === "number" ? prose(a.first[asked]!, `seat${asked}x`) : prose(a.again![asked.index]!, `again${asked.index}x`)
      ),
    });
  });
}

const write = () =>
  writeDraft(fakeCost(), INPUTS, {
    opportunity: PAGE,
    brief: BRIEF,
    outline: OUTLINE,
    facts: [{ url: GROUNDED.url, passage: GROUNDED.passage }],
    tidy: { facts: [], promises: [], queries: [], names: [] },
  });
const calls = (): Call[] => llmMock.mock.calls.map((call) => call[1] as Call);
const again = (): Call[] => calls().filter((call) => call.input.write?.some((asked) => typeof asked !== "number"));

beforeEach(() => {
  llmMock.mockReset();
});

describe("a customer's page is written on the writer tier, its sections in turn", () => {
  it("every draft call is the writer's, and each section call reads the bodies written before it", async () => {
    model({ first: FULL });
    const page = await write();

    expect(calls().map((call) => [call.site, call.tier, call.input.written?.length])).toEqual([
      ["generate.draft", "writer", undefined],
      ["generate.sections", "writer", 0],
      ["generate.sections", "writer", 3],
      ["generate.critic", "writer", undefined],
    ]);
    expect(page).toMatchObject({ kind: "written", length: { floor: 1200, ceiling: 1800, rewritten: 0 } });
    expect(page.kind === "written" && page.length.words).toBeGreaterThanOrEqual(1200);
  });

  it("a call that did not answer stops the page as a step that did not run", async () => {
    llmMock.mockResolvedValue(UNANSWERED);
    expect(await write()).toEqual({ kind: "failed" });
  });
});

describe("a page short of its floor is written once more, then held", () => {
  it("only the short section is written again, told how short it was, and the page goes on", async () => {
    model({ first: [160, 40, 310, 235, 85, 160], again: { 1: 320 } });
    const page = await write();

    expect(again().map((call) => call.input.write)).toEqual([
      [{ index: 1, note: "This section has 40 words and needs at least 300. Write it fuller." }],
    ]);
    expect(page).toMatchObject({ kind: "written", length: { rewritten: 1 } });
  });

  it("a page still short after that is held, and no critic is paid to read it", async () => {
    model({ first: [160, 40, 310, 235, 85, 160], again: { 1: 60 } });
    const page = await write();

    expect(page).toMatchObject({ kind: "short", length: { floor: 1200, rewritten: 1 } });
    expect(again()).toHaveLength(1);
    expect(calls().some((call) => call.site === "generate.critic")).toBe(false);
  });
});

describe("the critic may add to the page and may not take it under its floor", () => {
  it("a section it asks for is written again and kept, with its scores recorded", async () => {
    model({
      first: FULL,
      again: { 1: 500 },
      critic: measured({ ...SCORES, adds: 1, revise: [{ section: 1, instruction: "Add what a second seat tier costs." }] }),
    });
    const page = await write();

    expect(page).toMatchObject({ kind: "written", critic: { scores: { ...SCORES, adds: 1 }, revised: 1, kept: true } });
    expect(page.kind === "written" && page.parts.sections[1]).toContain("again1x");
  });

  it("a rewrite that leaves the page under its floor is refused, and the page stands as it was", async () => {
    model({
      first: FULL,
      again: { 1: 100 },
      critic: measured({ ...SCORES, revise: [{ section: 1, instruction: "Cut the repetition." }] }),
    });
    const page = await write();

    expect(page).toMatchObject({ kind: "written", critic: { revised: 1, kept: false } });
    expect(page.kind === "written" && page.length.words).toBeGreaterThanOrEqual(1200);
    expect(page.kind === "written" && page.parts.sections[1]).not.toContain("again1x");
  });

  it("a critic that does not answer leaves the page as written — it is not a step that failed", async () => {
    model({ first: FULL, critic: UNANSWERED });
    expect(await write()).toMatchObject({ kind: "written", critic: null });
  });
});
