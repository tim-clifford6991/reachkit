import { describe, it, expect } from "vitest";
import { dropDomainConflicts } from "./web-reviews";

// `parseWebReviewSnippets`/`reviewCountFromSnippets`/`filterSubjectResults`/
// `GROUNDING_POLICY_VERSION` were CUT M3b (2026-07-23, O-7): the review_themes
// producer they fed is retired for both tiers. `dropDomainConflicts` (+
// `referencedDomains`, tested indirectly) survives — it is a SEPARATE, still-
// live producer's guard: the recent-buzz Tavily NEWS search in `gap/run.ts`.

describe("dropDomainConflicts — recent-buzz domain-conflict subject validation (WS-A)", () => {
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
