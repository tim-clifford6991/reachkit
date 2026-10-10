// tests/generate/rules/title.test.ts — SPEC §7 (owner, D51, issue 1266;
// issue 1389): the `<title>` a page is published under is the form a buyer
// searches, its H1 is the same words, and code picks it from what the writer
// proposes.
import "../env";
import { describe, expect, it } from "vitest";
import { titleBrief, titleRuleFor } from "../../../src/lib/generate/pipeline/title";
import { checkTitle, pickTitle, titleFaults, type TitleRuleInputs } from "../../../src/lib/generate/rules/title";
import { pack } from "../fixtures";

const DESCRIPTION =
  "Seven AI visibility tools compared on price, engines covered and who each one suits, with the pricing pages they were read from linked.";

const rule = (over: Partial<TitleRuleInputs> = {}): TitleRuleInputs => ({
  type: "listicle",
  terms: ["ai visibility tool"],
  follow: [],
  asks: false,
  rivals: ["Profound", "Peec AI"],
  places: [],
  holds: "Seven tools compared. 7 options. Plans start at $29 a month. Our own page was named in 0 of 10 answers.",
  year: 2026,
  titles: [],
  description: DESCRIPTION,
  ...over,
});

// The owner's examples (issue 1389), each on the kind of site it is for.
const howTo = rule({ type: "how_to", terms: ["how to rank in ai overview"], asks: true });
const local = rule({ type: "documentation", terms: ["boiler service cost"], places: ["Leeds"], holds: "A boiler service is £85 including VAT." });
const alternatives = rule({ terms: ["peec ai alternatives"], holds: "5", rivals: ["Peec AI"] });

describe("the title check (D51, issue 1389)", () => {
  it("passes the owner's examples and the titles that rank today", () => {
    expect(titleFaults("How to rank in AI Overview (we measured ours: 0 of 10)", howTo)).toEqual([]);
    expect(titleFaults("Boiler service cost in Leeds: £85, and what's included", local)).toEqual([]);
    expect(titleFaults("Peec AI alternatives: 5 tools compared on price and engines", alternatives)).toEqual([]);
    expect(titleFaults("7 best AI visibility tools for small businesses (2026)", rule())).toEqual([]);
  });

  it("stops the H1 reachkit.app published on 10 October and the trope the owner named", () => {
    expect(titleFaults("How to get your business named in AI Overview and other AI answers", howTo)).toEqual(["length", "term", "specific", "banned"]);
    const trope = titleFaults("Unlocking AI visibility: a comprehensive guide for businesses", rule({ terms: ["ai visibility"] }));
    expect(trope).toContain("specific");
    expect(trope).toContain("banned");
  });

  it("holds the title to 30–65 characters", () => {
    expect(titleFaults("AI visibility tools: 7", rule())).toContain("length");
    expect(titleFaults("7 best AI visibility tools for founders who sell software to other founders (2026)", rule())).toContain("length");
  });

  it("wants the search's wording, or a question buyers ask, to start inside the first 30 characters", () => {
    expect(titleFaults("What 7 founders told us about choosing AI visibility tools", rule())).toContain("term");
    expect(titleFaults("7 Profound alternatives for small businesses (2026)", rule({ terms: ["ai visibility tool", "profound alternatives"] }))).toEqual([]);
    const asked = rule({ type: "qa", asks: true, follow: ["Is Profound worth the price?"] });
    expect(titleFaults("Is Profound worth the price? What $29 a month buys", asked)).toEqual([]);
  });

  it("wants one specific the pack holds: a question, an audience or a number from nowhere is not one", () => {
    expect(titleFaults("How to choose an AI visibility tool without regret", rule({ type: "how_to", asks: true }))).toContain("specific");
    expect(titleFaults("AI visibility tools for founders on a budget", rule())).toContain("specific");
    expect(titleFaults("AI visibility tools: 43 ways to compare them", rule())).toContain("specific");
    expect(titleFaults("AI visibility tools from $29 a month, compared", rule())).not.toContain("specific");
    expect(titleFaults("AI visibility tools that track ChatGPT answers", rule())).not.toContain("specific");
    expect(titleFaults("AI visibility tools for Leeds firms compared", rule({ places: ["Leeds"] }))).not.toContain("specific");
  });

  it("is a question only where the search is one", () => {
    expect(titleFaults("What is an AI visibility tool? 7 compared", rule())).toContain("question");
    expect(titleFaults("What is an AI visibility tool? 7 compared", rule({ terms: ["what is an ai visibility tool"], asks: true }))).not.toContain("question");
  });

  it("keeps the year to the types that date, to this year, and off the tail", () => {
    expect(titleFaults("How to choose an AI visibility tool (2026)", rule({ type: "how_to" }))).toContain("year");
    expect(titleFaults("7 best AI visibility tools for founders (2025)", rule())).toContain("year");
    expect(titleFaults("7 best AI visibility tools for founders 2026", rule())).toContain("year");
  });

  it("stops the banned tropes, a bracket, a pipe and a word said twice — but never the searcher's own word", () => {
    for (const title of [
      "The complete guide to 7 AI visibility tools",
      "AI visibility tools: everything you need to know about 7",
      "Navigating 7 AI visibility tools with confidence",
      "Why AI visibility tools matter: 7 compared",
      "AI visibility tools in today's search world: 7 picks",
      "7 best AI visibility tools [tested] for founders",
      "7 best AI visibility tools for founders | ReachKit",
      "AI visibility tools: 7 visibility tools for founders",
    ]) {
      expect(titleFaults(title, rule()), title).toContain("banned");
    }
    const phones = rule({ type: "how_to", terms: ["how to unlock an iphone"], asks: true, holds: "Unlocking takes 10 minutes." });
    expect(titleFaults("How to unlock an iPhone in 10 minutes at home", phones)).toEqual([]);
  });

  it("stops a title the site already has, and a meta description outside 120–155 characters", () => {
    const titles = ["7 best AI visibility tools for small businesses (2026)"];
    expect(titleFaults("8 best AI visibility tools for small businesses (2026)", rule({ titles, holds: "8" }))).toContain("overlap");
    expect(titleFaults("7 best AI visibility tools for small businesses (2026)", rule({ description: "Seven tools compared." }))).toEqual(["description"]);
  });

  it("holds the H1 to the title: the same words pass, another promise does not", () => {
    const title = "How to rank in AI Overview (we measured ours: 0 of 10)";
    expect(checkTitle({ title, heading: title, rule: howTo })).toBeNull();
    expect(checkTitle({ title, heading: "How to rank in AI Overview: we measured ours, 0 of 10", rule: howTo })).toBeNull();
    expect(checkTitle({ title, heading: "How to get your business named in AI Overview and other AI answers", rule: howTo })).toMatchObject({
      detail: { faults: ["heading"] },
    });
  });

  it("asks nothing of an update, which keeps its live title, or of a founder's own edit", () => {
    expect(checkTitle({ title: "Old", rule: rule({ type: "update" }) })).toBeNull();
    expect(checkTitle({ title: "Old", rule: null })).toBeNull();
  });
});

describe("what a title is held to is read off the pack", () => {
  it("a count is a specific where the page counts it out, and a rival only on the page that compares", () => {
    const business = { ...pack().business, rivals: ["trello.com"] };
    const steps = [{ key: "steps", heading: "What are the steps?", items: 4 }];
    const howTo = pack({ type: "how_to", business, target: { question: "how to plan a sprint", searches: ["how to plan a sprint"] } });
    expect(titleFaults("How to plan a sprint in 4 steps with a small team", titleRuleFor(howTo, { description: DESCRIPTION, sections: steps }))).toEqual([]);
    expect(titleFaults("How to plan a sprint in 4 steps with a small team", titleRuleFor(howTo, { description: DESCRIPTION }))).toEqual(["specific"]);
    expect(titleFaults("How to plan a sprint the way Trello teams do it", titleRuleFor(howTo, { description: DESCRIPTION }))).toEqual(["specific"]);
    const compared = pack({ type: "listicle", business, target: { question: "sprint planning tools", searches: ["sprint planning tools"] } });
    expect(titleFaults("Sprint planning tools: Trello and Acme compared", titleRuleFor(compared, { description: DESCRIPTION }))).toEqual([]);
  });

  it("the writer is shown the figures the pack states, and told a statement where the search is one", () => {
    const brief = titleBrief(pack({ target: { question: "What is the best project management software?", searches: ["best project management software"] } }));
    expect(brief.figures).toEqual(["plan get 25 seats and unlimited"]);
    expect((brief.rules as string[]).join(" ")).toContain("never a question");
  });
});

describe("the writer proposes, code picks (issue 1389)", () => {
  it("picks the title that passes every rule over one that reads closer to the search but fails", () => {
    const picked = pickTitle(
      ["How to rank in AI Overview and other AI answers", "Unlocking AI Overview: a comprehensive guide", "How to rank in AI Overview (we measured ours: 0 of 10)"],
      howTo
    );
    expect(picked.chosen).toBe("How to rank in AI Overview (we measured ours: 0 of 10)");
    expect(picked.candidates.map((each) => each.faults.length === 0)).toEqual([false, false, true]);
  });

  it("among titles that pass, picks the one closest to the search and the questions buyers ask after it", () => {
    const asked = rule({ ...alternatives, follow: ["Is Peec AI cheaper than Profound?", "Which engines does Peec AI track?"] });
    const picked = pickTitle(
      ["Peec AI alternatives: 5 tools compared for small teams", "Peec AI alternatives: 5 tools compared on price and engines", "Peec AI alternatives: 5 tools and what each one costs"],
      asked
    );
    expect(picked.chosen).toBe("Peec AI alternatives: 5 tools compared on price and engines");
  });

  it("among equals, prefers the aimed length; where none passes, hands stage 4 the one that fails fewest", () => {
    const equal = pickTitle(["Peec AI alternatives: 5 tools compared", "Peec AI alternatives: 5 tools compared on price and engines"], alternatives);
    expect(equal.chosen).toBe("Peec AI alternatives: 5 tools compared on price and engines");
    const none = pickTitle(["Unlocking Peec AI alternatives: the ultimate guide", "Peec AI alternatives: a closer look at each one"], alternatives);
    expect(none.chosen).toBe("Peec AI alternatives: a closer look at each one");
    expect(titleFaults(none.chosen, alternatives)).toEqual(["specific"]);
  });
});
