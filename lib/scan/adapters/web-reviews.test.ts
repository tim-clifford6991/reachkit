import { describe, it, expect } from "vitest";
import { parseWebReviewSnippets, filterSubjectSnippets, reviewCountFromSnippets } from "./web-reviews";

describe("parseWebReviewSnippets", () => {
  it("extracts review-bearing snippets from the RESULTS only", () => {
    const body = {
      answer: "Users praise Acquire's vetted listings; some cite high fees.",
      results: [{ title: "Acquire reviews — Trustpilot", url: "https://trustpilot.com/acquire", content: "4.2/5 from 380 reviews. Great support." }],
    };
    const out = parseWebReviewSnippets(body);
    expect(out.join(" ")).toMatch(/380 reviews/);
  });

  it("NEVER treats Tavily's synthesized `answer` as a review snippet (grounding honesty)", () => {
    // Tavily's `answer` is LLM-synthesized prose, not a real review. Laundering it
    // as review #1 is what produced invented reviews for the unlaunched reachkit.app
    // (scan 6d49d58e, 2026-07-16). It must never enter the snippet stream.
    const out = parseWebReviewSnippets({
      answer: "Users consistently praise ReachKit for being user-friendly.",
      results: [{ content: "Real snippet from a real page about reachkit." }],
    });
    expect(out).not.toContain("Users consistently praise ReachKit for being user-friendly.");
    expect(out.join(" ")).not.toMatch(/consistently praise/);
    expect(out).toEqual(["— Real snippet from a real page about reachkit."]);
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

describe("filterSubjectSnippets (brand-ambiguity hard rule)", () => {
  it("drops a same-named different product's reviews (nudgi.ai vs 'Nudge AI' clinical tool)", () => {
    const snippets = [
      "Nudge AI is an AI-powered tool for clinical documentation, praised for automating CPT note creation.",
      "nudgi.ai reviews — users say it nails meeting prep and attendee briefings.",
    ];
    const out = filterSubjectSnippets(snippets, "nudgi.ai");
    expect(out).toEqual(["nudgi.ai reviews — users say it nails meeting prep and attendee briefings."]);
  });

  it("keeps subject reviews referenced by host (acquire.com), ignores www.", () => {
    const snippets = ["Acquire.com reviews on Trustpilot: 4.2/5 from 380 reviews."];
    expect(filterSubjectSnippets(snippets, "www.acquire.com")).toEqual(snippets);
  });

  it("returns [] when nothing references the subject", () => {
    expect(filterSubjectSnippets(["Some other product entirely."], "nudgi.ai")).toEqual([]);
  });

  it("keeps reviews that reference the brand name, not just the full host (Stripe)", () => {
    const out = filterSubjectSnippets(
      ["Stripe Reviews 2026 — verified pros & cons.", "My experience with Stripe has been positive."],
      "stripe.com",
    );
    expect(out).toHaveLength(2); // was 0 before brand-token matching ("1 review for Stripe" bug)
  });

  it("falls back to the full host when the brand token is too short to be safe", () => {
    // brand token "go" (<4 chars) → require the full host so it doesn't match everything
    expect(filterSubjectSnippets(["Go is a programming language."], "go.com")).toEqual([]);
  });
});

describe("reviewCountFromSnippets", () => {
  it("returns the largest review/rating figure across snippets", () => {
    expect(reviewCountFromSnippets(["4.2/5 from 380 reviews", "G2: 1,240 reviews"])).toBe(1240);
    expect(reviewCountFromSnippets(["12,450 verified ratings on Capterra"])).toBe(12450);
  });
  it("returns 0 when no count is present (caller falls back to snippet count)", () => {
    expect(reviewCountFromSnippets(["a reliable payment platform"])).toBe(0);
    expect(reviewCountFromSnippets([])).toBe(0);
  });
});
