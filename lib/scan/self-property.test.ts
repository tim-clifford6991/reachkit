import { describe, it, expect } from "vitest";
import { isSelfProperty, selfBrandTokens } from "@/lib/scan/self-property";

describe("isSelfProperty — never propose the subject's own page as a community (A3)", () => {
  it("flags the subject's own repo/profile on a platform (the plausible.io GitHub case)", () => {
    // The exact reported bug: an HN hit linking to plausible's own repo became a "community".
    expect(isSelfProperty("https://github.com/plausible/analytics", "plausible.io", ["Plausible Analytics"])).toBe(true);
    expect(isSelfProperty("https://twitter.com/plausiblehq", "plausible.io", [])).toBe(false); // handle ≠ brand token "plausible"
    expect(isSelfProperty("https://twitter.com/plausible", "plausible.io", [])).toBe(true);
  });

  it("flags the subject's own domain + subdomains", () => {
    expect(isSelfProperty("https://plausible.io/docs", "plausible.io", [])).toBe(true);
    expect(isSelfProperty("https://blog.plausible.io/x", "plausible.io", [])).toBe(true);
    expect(isSelfProperty("https://www.plausible.io", "plausible.io", [])).toBe(true);
  });

  it("does NOT flag genuine third-party communities", () => {
    expect(isSelfProperty("https://reddit.com/r/analytics", "plausible.io", ["Plausible"])).toBe(false);
    expect(isSelfProperty("https://news.ycombinator.com/item?id=1", "plausible.io", [])).toBe(false);
    expect(isSelfProperty("https://github.com/matomo-org/matomo", "plausible.io", ["Plausible"])).toBe(false);
    expect(isSelfProperty("https://indiehackers.com/product/plausible-clone", "plausible.io", [])).toBe(false); // not a profile-platform namespace
  });

  it("selfBrandTokens derives ≥3-char tokens from domain + names", () => {
    expect([...selfBrandTokens("plausible.io", ["Plausible Analytics"])].sort()).toEqual(["analytics", "plausible"]);
    expect(selfBrandTokens("x.com", []).has("x")).toBe(false); // too short, no false self-match
  });
});
