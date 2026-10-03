// tests/generate/pipeline/answerability.test.ts — issue 475 and issue 1137,
// SPEC §7: the answerability pass may only reorder sections, give a section
// its opening answer — adding one where there is none, shortening one where
// there is — and insert evidence already in the brief. Each boundary is
// driven here.
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
  return { title: "", description: "", order: [0, 1], openings: [], insertFacts: [], ...over };
}

const ANSWER = "The right tool is the one whose plan covers every person who opens it each day.";
const LEAD = ":::answer\nCount the people first.\n:::\n\n:::takeaways\n- Count the people.\n:::";

describe("a section's opening answer is added or shortened, inside the bound", () => {
  it("is added before a list, a table or a sub-heading that opens the section", () => {
    for (const opens of ["- one\n- two", "| a | b |\n| --- | --- |\n| c | d |", "### A sub-point\n\nText."]) {
      const body = page(`## Which tool should a small team pick?\n\n${opens}`);
      const out = applyAnswerability(body, ops({ order: [0], openings: [{ section: 0, text: ANSWER }] }), []);
      expect(out.bodyMarkdown).toBe(`## Which tool should a small team pick?\n\n${ANSWER}\n\n${opens}`);
    }
  });

  it("replaces an opening paragraph only where it is shorter", () => {
    const shorter = applyAnswerability(BODY, ops({ openings: [{ section: 0, text: ANSWER }] }), []);
    expect(shorter.bodyMarkdown.includes(ANSWER) && !shorter.bodyMarkdown.includes(OPENING)).toBe(true);

    const body = page("## Which tool should a small team pick?\n\nShort opening that says enough here.");
    const longer = applyAnswerability(body, ops({ order: [0], openings: [{ section: 0, text: ANSWER }] }), []);
    expect(longer.bodyMarkdown).toBe(body.bodyMarkdown);
  });

  it.each([
    ["a heading", `## Is it worth it? ${"e".repeat(60)}`],
    ["a question", "Which tool should a small team pick when every plan looks the same?"],
    ["four sentences", "One sentence here now. Two sentences here now. Three sentences here now. Four sentences here."],
    ["two paragraphs", `${ANSWER}\n\n${ANSWER}`],
    ["a fragment", "Too short."],
  ])("never takes %s as an opening", (_what, text) => {
    const out = applyAnswerability(BODY, ops({ openings: [{ section: 0, text }] }), []);
    expect(out.bodyMarkdown).toBe(BODY.bodyMarkdown);
  });

  it("cannot reach the short answer or the takeaways above the first section", () => {
    const body = page(`${LEAD}\n\n## Which tool should a small team pick?\n\n- one\n- two`);
    const out = applyAnswerability(body, ops({ order: [0], openings: [{ section: 0, text: ANSWER }] }), []);
    expect(out.bodyMarkdown.startsWith(`${LEAD}\n\n## Which tool`)).toBe(true);
  });

  it("moves an H3 with the H2 it stands under", () => {
    const body = page("## First?\n\nOne.\n\n### Under first\n\nSub.\n\n## Second?\n\nTwo.");
    const out = applyAnswerability(body, ops({ order: [1, 0] }), []);
    expect(out.bodyMarkdown).toBe("## Second?\n\nTwo.\n\n## First?\n\nOne.\n\n### Under first\n\nSub.");
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
