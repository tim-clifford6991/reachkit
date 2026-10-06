// tests/generate/rules/title.test.ts — SPEC §7 (owner, D51; issue 1266): the
// `<title>` a page is published under is the form a buyer searches.
import "../env";
import { describe, expect, it } from "vitest";
import { checkTitle, titleFaults, type TitleRuleInputs } from "../../../src/lib/generate/rules/title";

const DESCRIPTION =
  "Seven AI visibility tools compared on price, engines covered and who each one suits, with the pricing pages they were read from linked.";

const rule = (over: Partial<TitleRuleInputs> = {}): TitleRuleInputs => ({
  type: "listicle",
  terms: ["ai visibility tool"],
  rivals: ["Profound", "Peec AI"],
  audience: ["founders and small business owners"],
  year: 2026,
  titles: [],
  description: DESCRIPTION,
  ...over,
});

describe("the title check (D51)", () => {
  it("passes the titles that rank today", () => {
    expect(titleFaults("7 best AI visibility tools for small businesses (2026)", rule())).toEqual([]);
    expect(titleFaults("Peec AI vs Profound (2026): pricing and features", rule({ terms: ["peec ai vs profound"] }))).toEqual([]);
    expect(titleFaults("How to get recommended by ChatGPT", rule({ type: "how_to", terms: ["how to get recommended by chatgpt"] }))).toEqual([]);
  });

  it("stops the title reachkit.app published on 5 October", () => {
    const faults = titleFaults("ReachKit vs AEO Engine: 7 buyer questions, answered", rule({ type: "qa" }));
    expect(faults).toContain("term");
    expect(faults).toContain("banned");
  });

  it("holds the title to 30–65 characters", () => {
    expect(titleFaults("AI visibility tools: 7", rule())).toContain("length");
    expect(titleFaults("7 best AI visibility tools for founders who sell software to other founders (2026)", rule())).toContain("length");
  });

  it("wants the search term to start inside the first five words", () => {
    expect(titleFaults("What 7 founders told us about choosing AI visibility tools", rule())).toContain("term");
    // The target query stands where the market holds no search term for it.
    expect(titleFaults("7 Profound alternatives for small businesses (2026)", rule({ terms: ["ai visibility tool", "profound alternatives"] }))).toEqual([]);
  });

  it("wants one specific", () => {
    expect(titleFaults("AI visibility tools worth a careful look", rule())).toContain("specific");
    expect(titleFaults("AI visibility tools that track ChatGPT answers", rule())).not.toContain("specific");
    expect(titleFaults("AI visibility tools for founders on a budget", rule())).not.toContain("specific");
  });

  it("keeps the year to the types that date, to this year, and off the tail", () => {
    expect(titleFaults("How to choose an AI visibility tool (2026)", rule({ type: "how_to" }))).toContain("year");
    expect(titleFaults("7 best AI visibility tools for founders (2025)", rule())).toContain("year");
    expect(titleFaults("7 best AI visibility tools for founders 2026", rule())).toContain("year");
  });

  it("stops a square bracket, a pipe and a word said twice", () => {
    expect(titleFaults("7 best AI visibility tools [tested] for founders", rule())).toContain("banned");
    expect(titleFaults("7 best AI visibility tools for founders | ReachKit", rule())).toContain("banned");
    expect(titleFaults("AI visibility tools: 7 visibility tools for founders", rule())).toContain("banned");
  });

  it("stops a title the site already has", () => {
    const titles = ["7 best AI visibility tools for small businesses (2026)"];
    expect(titleFaults("8 best AI visibility tools for small businesses (2026)", rule({ titles }))).toContain("overlap");
    expect(titleFaults("5 Profound alternatives for small businesses (2026)", rule({ titles, terms: ["profound alternatives"] }))).toEqual([]);
  });

  it("holds the meta description to 120–155 characters", () => {
    expect(titleFaults("7 best AI visibility tools for small businesses (2026)", rule({ description: "Seven tools compared." }))).toEqual(["description"]);
  });

  it("asks nothing of an update, which keeps its live title, or of a founder's own edit", () => {
    expect(checkTitle({ title: "Old", rule: rule({ type: "update" }) })).toBeNull();
    expect(checkTitle({ title: "Old", rule: null })).toBeNull();
  });
});
