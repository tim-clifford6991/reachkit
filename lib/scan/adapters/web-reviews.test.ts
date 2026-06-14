import { describe, it, expect } from "vitest";
import { parseWebReviewSnippets } from "./web-reviews";

describe("parseWebReviewSnippets", () => {
  it("extracts review-bearing snippets from a Tavily-style body (answer + results)", () => {
    const body = {
      answer: "Users praise Acquire's vetted listings; some cite high fees.",
      results: [{ title: "Acquire reviews — Trustpilot", url: "https://trustpilot.com/acquire", content: "4.2/5 from 380 reviews. Great support." }],
    };
    const out = parseWebReviewSnippets(body);
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out.join(" ")).toMatch(/vetted listings/);
    expect(out.join(" ")).toMatch(/380 reviews/);
  });

  it("returns [] for an empty / null body (never throws)", () => {
    expect(parseWebReviewSnippets({})).toEqual([]);
    expect(parseWebReviewSnippets(null)).toEqual([]);
  });

  it("skips results with no usable text", () => {
    const out = parseWebReviewSnippets({ results: [{ title: "", content: "" }, { title: "G2", content: "Solid tool." }] });
    expect(out).toEqual(["G2 — Solid tool."]);
  });
});
