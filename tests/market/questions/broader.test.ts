// tests/market/questions/broader.test.ts — SPEC §6 (owner ruling 2026-09-17,
// issue 837): the broader categories a market too small is offered.
import { describe, expect, it } from "vitest";
import { broaderCategories } from "../../../src/lib/market/questions/broader";
import type { Profile } from "../../../src/lib/market/questions/profile";

const PROFILE: Profile = {
  category: "SEO and content marketing software",
  job: "write pages that rank",
  offeringType: "saas",
  audienceTerms: ["founders"],
  namedRivals: [],
  vocabulary: ["seo", "content marketing tool", "reachkit autopilot"],
  brandTokens: ["reachkit"],
};

describe("a thin market is offered broader categories from the site's own profile", () => {
  it("offers two or three, broadest head terms first, never the measured category, a single word or the brand", () => {
    const offered = broaderCategories({ category: "SEO content marketing software", profile: PROFILE });
    expect(offered).toEqual(["content marketing software", "marketing software", "seo and content marketing software"]);
  });

  it("reads the vocabulary and a multi-word offering type once the head terms run out", () => {
    const offered = broaderCategories({
      category: "bookkeeping software for therapists",
      profile: { ...PROFILE, category: "bookkeeping software for therapists", offeringType: "cloud accounting service" },
    });
    expect(offered).toEqual(["bookkeeping software", "content marketing tool", "cloud accounting service"]);
  });

  it("still offers the head terms when the pass stored no profile", () => {
    expect(broaderCategories({ category: "user onboarding software for SaaS teams", profile: null })).toEqual([
      "user onboarding software",
      "onboarding software",
    ]);
  });
});
