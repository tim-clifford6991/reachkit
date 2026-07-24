import { describe, it, expect } from "vitest";
import { isBoilerplateSource } from "@/lib/scan/referral/classify";

describe("isBoilerplateSource — boilerplate backlinks are not quality referrers (owner 2026-07-24)", () => {
  it("flags legal/policy/utility source pages", () => {
    for (const url of [
      "https://dontpayfull.com/privacy-policy", // the reported plausible.io case
      "https://dontpayfull.com/privacy",
      "https://example.com/terms",
      "https://example.com/terms-of-service",
      "https://example.com/cookie-policy",
      "https://example.com/cookies",
      "https://example.com/legal",
      "https://example.com/gdpr",
      "https://example.com/imprint",
      "https://example.com/impressum",
      "https://example.com/sitemap.xml",
      "https://example.com/disclaimer",
    ]) {
      expect(isBoilerplateSource(url), url).toBe(true);
    }
  });

  it("does NOT flag genuine editorial/directory referrals", () => {
    for (const url of [
      "https://dontpayfull.com/coupons/plausible", // a real listing on the same host
      "https://alternativeto.net/software/plausible/",
      "https://news.ycombinator.com/item?id=123",
      "https://blog.example.com/best-analytics-tools",
      "https://example.com/reviews/plausible",
    ]) {
      expect(isBoilerplateSource(url), url).toBe(false);
    }
  });

  it("matches the PATH, not the brand — a privacy-named product isn't excluded", () => {
    // host/brand contains "privacy" but the source page is real editorial content
    expect(isBoilerplateSource("https://privacytools.io/blog/analytics")).toBe(false);
    expect(isBoilerplateSource("https://theprivacyblog.com/reviews")).toBe(false);
  });
});
