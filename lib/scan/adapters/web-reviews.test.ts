import { describe, it, expect } from "vitest";
import {
  parseWebReviewSnippets,
  filterSubjectSnippets,
  reviewCountFromSnippets,
  filterSubjectResults,
  dropDomainConflicts,
} from "./web-reviews";

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

// Real-shape payload from prod scan 4093f1c9 (2026-07-19): the subject is
// reachkit.app but every result is about reachkit.AI (a different product) or an
// unattributable "Reachkit" listing. The old token filter kept all of them.
const CONTESTED_BATCH = {
  results: [
    {
      url: "https://www.trustpilot.com/review/reachkit.ai",
      title: 'Reachkit is rated "Great" with 3.8 / 5 on Trustpilot',
      content: "TrustScore 4 out of 5. We use technology to protect platform integrity.",
    },
    {
      url: "https://www.getapp.co.uk/software/2081334/reachkit",
      title: "Reachkit Reviews, Prices & Ratings",
      content: "Overall rating 5/5 (2) Value for Money 5/5 Customer Support 5/5",
    },
  ],
};

describe("filterSubjectResults — domain-conflict subject validation (WS-A)", () => {
  it("drops the whole batch when a same-brand DIFFERENT domain is referenced (reachkit.ai vs reachkit.app)", () => {
    expect(filterSubjectResults(CONTESTED_BATCH, "reachkit.app")).toEqual([]);
  });

  it("keeps genuine reviews when no conflicting domain appears (the Stripe class)", () => {
    const body = {
      results: [
        { url: "https://www.g2.com/products/stripe/reviews", title: "Stripe Reviews", content: "Stripe is easy to integrate and the docs are great." },
      ],
    };
    expect(filterSubjectResults(body, "stripe.com")).toHaveLength(1);
  });

  it("in a contested batch, keeps only results that explicitly reference the subject host", () => {
    const body = {
      results: [
        { url: "https://www.trustpilot.com/review/reachkit.ai", title: "Reachkit", content: "…" },
        { url: "https://www.trustpilot.com/review/reachkit.app", title: "Reachkit review", content: "Great for solo founders." },
      ],
    };
    const kept = filterSubjectResults(body, "reachkit.app");
    expect(kept).toHaveLength(1);
    expect(kept[0]).toContain("solo founders");
  });

  it("still blocks the same-named different product with no domain evidence in an uncontested batch (nudgi class)", () => {
    const body = { results: [{ url: "https://example.com/x", title: "Nudge AI review", content: "Clinical documentation tool." }] };
    expect(filterSubjectResults(body, "nudgi.ai")).toEqual([]);
  });

  it("drops a SINGLE result that names BOTH the subject host and a conflicting same-brand domain (comparison-page class)", () => {
    // A per-result conflict check is only observable when one result mentions
    // BOTH domains at once — a batch-level "some result conflicts, so require
    // subject evidence" gate alone would wrongly KEEP this result (it does
    // reference the subject host), so it can't stand in for the per-result drop.
    const body = {
      results: [
        {
          url: "https://comparisons.example.com/reachkit-app-vs-reachkit-ai",
          title: "reachkit.app vs reachkit.ai — which should you pick?",
          content: "A side-by-side comparison of reachkit.app and reachkit.ai.",
        },
      ],
    };
    expect(filterSubjectResults(body, "reachkit.app")).toEqual([]);
  });
});

describe("dropDomainConflicts — reused by the recent-buzz pass (WS-A class sweep)", () => {
  it("drops a same-brand different-domain news hit, keeps the ORIGINAL object shape (url/publishedDate preserved)", () => {
    const news = [
      { url: "https://techcrunch.com/reachkit-ai-raises-seed", title: "Reachkit.ai raises seed round", content: "Reachkit.ai today announced funding.", publishedDate: "2026-07-01" },
    ];
    expect(dropDomainConflicts(news, "reachkit.app")).toEqual([]);
  });

  it("keeps clean news with no conflicting domain, preserving every field", () => {
    const news = [
      { url: "https://techcrunch.com/stripe-news", title: "Stripe launches new product", content: "Stripe today announced X.", publishedDate: "2026-07-01" },
    ];
    expect(dropDomainConflicts(news, "stripe.com")).toEqual(news);
  });

  it("in a contested batch, keeps only news that explicitly references the subject host", () => {
    const news = [
      { url: "https://techcrunch.com/reachkit-ai-raises-seed", title: "Reachkit.ai raises seed round", content: "…", publishedDate: null },
      { url: "https://techcrunch.com/reachkit-app-launch", title: "Reachkit.app launches", content: "…", publishedDate: "2026-07-10" },
    ];
    const kept = dropDomainConflicts(news, "reachkit.app");
    expect(kept).toHaveLength(1);
    expect(kept[0]!.url).toContain("reachkit-app-launch");
  });

  it("drops a SINGLE news item that names BOTH the subject host and a conflicting same-brand domain", () => {
    const news = [
      { url: "https://comparisons.example.com/x", title: "reachkit.app vs reachkit.ai", content: "A comparison of reachkit.app and reachkit.ai.", publishedDate: null },
    ];
    expect(dropDomainConflicts(news, "reachkit.app")).toEqual([]);
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
