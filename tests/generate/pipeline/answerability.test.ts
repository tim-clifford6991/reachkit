// tests/generate/pipeline/answerability.test.ts — issue 475, SPEC §7: the
// answerability pass may only reorder sections, shorten a first block to
// 40–320 characters under a question heading, and insert evidence already in
// the brief. Each boundary is driven here.
import "../env";
import { describe, expect, it } from "vitest";
import { applyAnswerability, type AnswerabilityOps } from "../../../src/lib/generate/pipeline/answerability";

const FACT = "Teams on the starter plan get 25 seats and unlimited projects for a flat monthly fee.";
const OPENING = "a".repeat(400);

function page(markdown: string) {
  return { title: "Title", slug: "slug", description: "Description", bodyMarkdown: markdown };
}

const BODY = page(`## Which tool should a small team pick?\n\n${OPENING}\n\n## What decides it\n\nSeats.`);

function ops(over: Partial<AnswerabilityOps> = {}): AnswerabilityOps {
  return { title: "", description: "", order: [0, 1], firstBlock: "", insertFacts: [], ...over };
}

describe("the first block is shortened only inside the bound", () => {
  it.each([
    [39, false],
    [40, true],
    [320, true],
    [321, false],
  ])("a %i-character opening is taken: %s", (length, taken) => {
    const shortened = "b".repeat(length);
    const out = applyAnswerability(BODY, ops({ firstBlock: shortened }), []);
    expect(out.bodyMarkdown.includes(shortened) && !out.bodyMarkdown.includes(OPENING)).toBe(taken);
  });

  it("is not taken where it is no shorter than the paragraph it replaces", () => {
    const body = page("## Which tool should a small team pick?\n\nShort opening that says enough here.");
    const longer = "c".repeat(60);
    expect(applyAnswerability(body, ops({ order: [0], firstBlock: longer }), []).bodyMarkdown).not.toContain(longer);
  });

  it("is not taken where the first heading is not a question", () => {
    const body = page(`## Seat counts\n\n${OPENING}`);
    const out = applyAnswerability(body, ops({ order: [0], firstBlock: "d".repeat(100) }), []);
    expect(out.bodyMarkdown).toContain(OPENING);
  });

  it("cannot smuggle a heading in as the shortened text", () => {
    const heading = `## Is it worth it? ${"e".repeat(60)}`;
    expect(applyAnswerability(BODY, ops({ firstBlock: heading }), []).bodyMarkdown).not.toContain(heading);
  });
});

describe("sections are reordered only by a permutation", () => {
  it("a permutation reorders the heading sections", () => {
    const out = applyAnswerability(BODY, ops({ order: [1, 0] }), []);
    expect(out.bodyMarkdown.startsWith("## What decides it")).toBe(true);
  });

  it.each([[[0]], [[0, 0]], [[1, 2]]])("%j is ignored", (order) => {
    expect(applyAnswerability(BODY, ops({ order }), []).bodyMarkdown).toBe(BODY.bodyMarkdown);
  });
});

describe("evidence is inserted only from the brief", () => {
  it("a selected fact is appended to the section, word for word", () => {
    const out = applyAnswerability(BODY, ops({ insertFacts: [{ section: 1, fact: 0 }] }), [FACT]);
    expect(out.bodyMarkdown.endsWith(`Seats.\n\n${FACT}`)).toBe(true);
  });

  it("an index outside the facts, or a section that does not exist, adds nothing", () => {
    const out = applyAnswerability(
      BODY,
      ops({ insertFacts: [{ section: 1, fact: 1 }, { section: 5, fact: 0 }] }),
      [FACT]
    );
    expect(out.bodyMarkdown).toBe(BODY.bodyMarkdown);
  });
});
