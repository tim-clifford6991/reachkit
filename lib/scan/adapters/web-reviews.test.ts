import { describe, it, expect } from "vitest";
import {
  parseWebReviewSnippets,
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

// `filterSubjectSnippets` was deleted in v3 (no production caller; its bare
// brand-token matching was the attribution hole). Its brand-ambiguity duties
// live in `filterSubjectResults` below.

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

  it("v3: a bare brand-NAME match is never attribution — a name-keyed platform result with no domain evidence is dropped, a domain-keyed one is kept (Stripe)", () => {
    // v2 kept the G2 result via the brand-token fallback ("uncontested batch").
    // That fallback is exactly what shipped reachkit.AI's reviews as
    // reachkit.app's (poisoned sheet, fact_sheets id 110) — at the snippet
    // level a name-only page about a same-named different product is
    // indistinguishable from a genuine one, so it cannot count as evidence.
    // Trustpilot keys products by DOMAIN, so genuine coverage still survives.
    const body = {
      results: [
        { url: "https://www.g2.com/products/stripe/reviews", title: "Stripe Reviews", content: "Stripe is easy to integrate and the docs are great." },
        { url: "https://www.trustpilot.com/review/stripe.com", title: "Stripe Reviews | stripe.com", content: "Rated 3.2/5 from 12,000 reviews." },
      ],
    };
    const kept = filterSubjectResults(body, "stripe.com");
    expect(kept).toHaveLength(1);
    expect(kept[0]).toContain("12,000 reviews");
  });

  it("v3 REGRESSION (the live batch that poisoned fact_sheets id 110): name-keyed platform listings of the OTHER product + the subject's own site → []", () => {
    // Verbatim shapes from the real Tavily batch (raw_documents, 2026-07-19
    // 15:50): Capterra/GetApp key by NAME so reachkit.AI's listings carry no
    // domain token at all; salesforge names "ReachKit AI" only as prose; the
    // subject's own /gallery page is marketing, not a review. Under v2 a batch
    // like this with no conflicting domain token was "uncontested" and the
    // brand-token fallback kept the platform listings → "Features 5/5" themes
    // for an unlaunched product, cached under a fresh policy stamp.
    const body = {
      results: [
        { url: "https://www.capterra.com/p/10029405/Reachkit", title: "Reachkit Software Pricing, Alternatives & More 2026", content: "Based on 2 user reviews 5.0. Reachkit is a user friendly tool, very clear and effective. It's easy and fun to use." },
        { url: "https://www.getapp.ie/software/2081334/reachkit", title: "Reachkit Price, Reviews & Ratings | GetApp Ireland 2026", content: "Customer Service 5.0 (2) Money 5/5 Features 5/5 Ease of Use 5/5 Customer Support 5/5 100% recommended this app" },
        { url: "https://www.salesforge.ai/directory/sales-tools/reachkit", title: "ReachKit Overview (2026) – Features, Pros, Cons & Pricing", content: "ReachKit AI is an AI-powered email outreach and inbox management platform designed to enhance cold email campaigns." },
        { url: "https://reachkit.app/gallery", title: "Public Scans — Discoverability Analyses — ReachKit", content: "Every site we scan gets a permanent, public discoverability report — the score, the positioning gap, and the fixes that move it." },
      ],
    };
    expect(filterSubjectResults(body, "reachkit.app")).toEqual([]);
  });

  it("v3: a result hosted ON the subject's own domain is never a review (self-marketing cannot launder into evidence)", () => {
    const body = {
      results: [
        { url: "https://www.reachkit.app/pricing", title: "ReachKit pricing — reachkit.app", content: "Every claim grounded in your live page." },
        { url: "https://thirdparty.example.com/roundup", title: "Tools roundup", content: "We tried reachkit.app and liked the score breakdown." },
      ],
    };
    const kept = filterSubjectResults(body, "reachkit.app");
    expect(kept).toHaveLength(1);
    expect(kept[0]).toContain("roundup");
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
