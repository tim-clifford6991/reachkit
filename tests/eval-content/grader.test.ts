// Issue 1158 — the grader that could not tell pages apart. What is pinned
// here is what round 1 got wrong: a figure "held" by any page that printed
// the same digits, a claim on the site counted as new, a business fact that
// was the model's call, and a pair decided by which page was shown first.
import "../generate/env";
import { describe, expect, it } from "vitest";
import { addsVerdict, placeInCode } from "../../scripts/eval-content/adds";
import { checklist, traceNumbers } from "../../scripts/eval-content/grade";
import { tally, type Reading } from "../../scripts/eval-content/judge";

const SITE = [{ url: "https://acme.test/pricing", text: "Acme costs €49 a month, VAT included. Every page waits 24 hours before it goes live." }];

describe("the number trace", () => {
  const trace = (body: string) =>
    traceNumbers({ body, facts: SITE.map((page) => ({ text: page.text, source: page.url })), pool: [] }).map((each) => `${each.number}:${each.verdict}`);

  it("holds a figure only where the source carries the same sign or the same words beside it", () => {
    expect(trace("Acme costs €49 a month and each page waits 24 hours.")).toEqual(["49:traced", "24:traced"]);
    expect(trace("Customers see 49% more traffic within 24 days.")).toEqual(["49:invented", "24:invented"]);
  });

  it("does not read a cited page's title in the Sources list as the page's own number", () => {
    expect(trace("Acme costs €49 a month.\n\n## Sources\n\n- Rival, [17 best tools](https://rival.test/17), read 2026-09-29")).toEqual(["49:traced"]);
  });
});

describe("the code checks", () => {
  const list = checklist({
    bodyMarkdown: [
      "## What does it cost?",
      "",
      "Acme is the plan most small teams end up choosing for this work. [F7] Acme is the plan most small teams end up choosing for this work.",
      "",
      "| Tool | Price |",
      "|---|---|",
      "| Acme | — |",
      "| Rival | not linked to a stated figure |",
      "",
      "## Sources",
      "",
      "- Rival, [A study](https://rival.test/study), read 2026-09-29",
    ].join("\n"),
    type: "answer_page",
    query: "what does acme cost",
    domain: "acme.test",
    businessName: "Acme",
    factsUsed: [],
    faq: [],
    pages: SITE,
    evidence: { topResults: ["https://rival.test/study"], resolves: () => true },
  });

  // Round 2 (issue 1250): a phrase standing in for a value is an empty cell.
  it("counts a leaked fact label, a repeated sentence, and a dash or a placeholder phrase as an empty cell", () => {
    expect([list.factLabels, list.duplicateSentences.length, list.emptyCells]).toEqual([1, 1, 2]);
  });

  it("does not ask the Sources heading to be a question or to open with a paragraph", () => {
    expect(list.blocks["question headings"]).toBe(true);
    expect(list.blocks["sections open with an answer"]).toBe(true);
  });

  it("says when every source named is one of the top results", () => {
    expect(list.sources).toEqual({ listed: 1, resolved: 1, beyondTop: 0 });
  });
});

describe("what a page adds, placed in code", () => {
  const placed = placeInCode({
    markdown: [
      "Every page waits 24 hours before it goes live, so you can read it first.",
      "",
      "[Rival](https://rival.test/review) says its tracker covers six regions across four answer engines today.",
      "",
      "Acme is built for a founder who owns a small company website and knows nothing about SEO.",
      "",
      "Acme is trusted by more than ten thousand companies around the world.",
    ].join("\n"),
    domain: "acme.test",
    business: "Acme",
    topResults: [{ url: "https://rival.test/review", text: "A long review of trackers." }],
    sitePages: SITE,
    founderFacts: ["Acme is built for a founder who owns a small company website and knows nothing about SEO."],
  }).map((row) => row.placed);

  it("places a sentence on the site, a cited top result and a founder's answer without a model", () => {
    expect(placed).toEqual(["site", "commodity", "business", null]);
  });

  it("counts a business fact only where code placed one", () => {
    const row = (kind: "new" | "unsupported" | "business") => ({ sentence: "", placed: kind, by: "model" as const, from: "" });
    expect(addsVerdict([row("new"), row("new"), row("new"), row("unsupported")]).passes).toBe(false);
    expect(addsVerdict([row("new"), row("new"), row("business")]).passes).toBe(true);
  });
});

describe("a pair read twice", () => {
  const reading = (order: [string, string], overall: string): Reading => ({
    order,
    criteria: { accuracy: { winner: null, why: "" }, adds: { winner: overall, why: "" }, intent: { winner: overall, why: "" }, editorial: { winner: overall, why: "" } },
    overall,
    why: "",
  });

  it("is won only by the page that wins in both orders", () => {
    expect(tally(["A", "B"], [reading(["A", "B"], "B"), reading(["B", "A"], "B")]).pick).toBe("B");
    expect(tally(["A", "B"], [reading(["A", "B"], "A"), reading(["B", "A"], "B")]).pick).toBeNull();
  });

  it("reports the share of decisions won, ties left out", () => {
    expect(tally(["A", "B"], [reading(["A", "B"], "B"), reading(["B", "A"], "B")]).winRate).toEqual({ A: 0, B: 1 });
  });
});
