// tests/business/understanding.test.ts — issue 1454: one reading of a
// business for every surface, the customer's word first.
import { describe, expect, it } from "vitest";
import { profileOfReport, profileWithEdits, understandBusiness } from "../../src/lib/business/understanding.ts";
import type { Profile } from "../../src/lib/market/questions/profile-types.ts";
import type { MarketConclusion, StoredMarket } from "../../src/lib/market/infer/types.ts";

const PROFILE: Profile = {
  category: "plumbing services",
  job: "fix leaks",
  offeringType: "service",
  audienceTerms: ["homeowners", "landlords"],
  namedRivals: [],
  vocabulary: ["plumber"],
  brandTokens: ["Austin Plumbery"],
  town: "",
  offerings: [
    { name: "Plumbing", category: "plumbing services", weight: 0.7 },
    { name: "Water heaters", category: "water heater repair", weight: 0.3 },
  ],
  kind: "local-service",
};
const US = { country: "US", language: "en" } as const;

function market(current: Partial<MarketConclusion>, extra: Partial<StoredMarket> = {}): StoredMarket {
  return {
    current: { buyer: "", job: "", category: "", synonyms: [], differentiators: [], notOurMarket: [], categoryReason: "", rivals: [], ...current },
    adoptedAt: null,
    pending: null,
    categoryOverridden: false,
    rivalsOverridden: false,
    ...extra,
  };
}

describe("what a free report says it read", () => {
  it("reads the profile: its name, every line, its buyers, and where it measured", () => {
    const u = understandBusiness({ domain: "austinplumbery.com", profile: PROFILE, locale: { ...US, place: { name: "Austin" } } });
    expect(u.name).toBe("Austin Plumbery");
    expect(u.sells.map((o) => o.category)).toEqual(["plumbing services", "water heater repair"]);
    expect(u.buyers).toEqual(["homeowners", "landlords"]);
    expect(u.where).toEqual({ reach: "local", place: { name: "Austin" }, country: "US" });
    expect(u.kind).toBe("local-service");
  });

  it("a stored scan with neither a reach nor a town says only where it was measured", () => {
    const old: Profile = { ...PROFILE, offerings: undefined, kind: undefined };
    const u = understandBusiness({ domain: "austinplumbery.com", profile: old, locale: US });
    expect(u.where.reach).toBeNull();
    expect(u.kind).toBeNull();
    expect(u.sells).toEqual([{ name: "plumbing services", category: "plumbing services", weight: 1 }]);
  });
});

describe("a paying site: the customer's word, then the paid pass, then the scan", () => {
  it("the paid pass's market leads what it sells, who buys and its kind, and a pass that settled no place reads it as national", () => {
    const u = understandBusiness({
      domain: "example.com",
      profile: { ...PROFILE, kind: "software" },
      locale: US,
      market: market({ category: "plumbing repair and maintenance", buyer: "homeowners in Austin", kind: "local-service", serves: null }),
    });
    expect(u.sells.map((o) => o.category)).toEqual(["plumbing repair and maintenance", "water heater repair"]);
    expect(u.buyers).toEqual(["homeowners in Austin"]);
    expect(u.kind).toBe("local-service");
    expect(u.where.reach).toBe("national");
  });

  it("the customer's category, buyers and job stand over both", () => {
    const u = understandBusiness({
      domain: "example.com",
      profile: PROFILE,
      locale: US,
      market: market({ category: "plumbing", buyer: "homeowners", job: "plumbing" }, { categoryOverridden: true, area: { place: { name: "Austin" }, by: "founder" } }),
      category: "emergency plumber",
      edits: { buyers: "property managers", job: "fix it the same day" },
    });
    expect(u.sells[0]?.category).toBe("emergency plumber");
    expect(u.buyers).toEqual(["property managers"]);
    expect(u.job).toBe("fix it the same day");
    expect(u.where).toEqual({ reach: "local", place: { name: "Austin" }, country: "US" });
  });

  it("the customer's corrections are what the next pass selects by", () => {
    const edited = profileWithEdits(PROFILE, {
      job: "",
      added: { audienceTerms: ["property managers"], vocabulary: ["drain"] },
      removed: { audienceTerms: ["Landlords"] },
    });
    expect(edited.audienceTerms).toEqual(["homeowners", "property managers"]);
    expect(edited.vocabulary).toEqual(["plumber", "drain"]);
    expect(edited.job).toBe("fix leaks");
  });
});

describe("a stored field that names nothing (issue 1479)", () => {
  // gusto.com's free report printed "What you sell: <UNKNOWN>"; a profile
  // read off a protection's page carried its vendor's name.
  const stored = (profile: Profile, domain = "gusto.com") => ({ domain, market: { kind: "measured", value: { profile } } });

  it("a placeholder is never what it sells, who buys, or its name", () => {
    const profile = profileOfReport(
      stored({
        ...PROFILE,
        category: "<UNKNOWN>",
        job: "N/A",
        audienceTerms: ["<UNKNOWN>", "small businesses"],
        brandTokens: ["<UNKNOWN>"],
        offerings: [
          { name: "<UNKNOWN>", category: "<UNKNOWN>", weight: 0.5 },
          { name: "Payroll", category: "payroll software", weight: 0.5 },
        ],
      })
    )!;
    const u = understandBusiness({ domain: "gusto.com", profile, locale: US });
    expect(JSON.stringify(u)).not.toMatch(/UNKNOWN|N\/A/);
    expect(u.name).toBe("Gusto");
    expect(u.sells).toEqual([{ name: "Payroll", category: "payroll software", weight: 1 }]);
    expect(u.buyers).toEqual(["small businesses"]);
    expect(u.job).toBeNull();
  });

  it("a protection page's words are no name or line, except on the vendor's own site", () => {
    const profile = { ...PROFILE, category: "Just a moment...", brandTokens: ["Cloudflare"], offerings: undefined };
    const sage = understandBusiness({ domain: "sage.com", profile: profileOfReport(stored(profile, "sage.com"))!, locale: US });
    expect(sage.name).toBe("Sage");
    expect(sage.sells).toEqual([]);
    expect(profileOfReport(stored(profile, "cloudflare.com"))!.brandTokens).toEqual(["Cloudflare"]);
  });

  it("a clean profile is read as stored", () => {
    expect(profileOfReport(stored(PROFILE, "austinplumbery.com"))).toBe(PROFILE);
  });
});
