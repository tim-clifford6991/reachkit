import { describe, it, expect } from "vitest";
import { computeSizeTier } from "@/lib/scan/referral/discover-competitors";

describe("computeSizeTier — ratio-based (subject has real traffic)", () => {
  // Subject has 10,000/mo — well above the 1,000 SIZE_BASELINE
  const subjectEtv = 10_000;

  it("≤3× → similar (includes smaller competitors)", () => {
    expect(computeSizeTier(5_000, subjectEtv)).toBe("similar"); // 0.5×
    expect(computeSizeTier(10_000, subjectEtv)).toBe("similar"); // 1× exact peer
    expect(computeSizeTier(30_000, subjectEtv)).toBe("similar"); // 3× boundary
  });

  it("3–8× → bigger", () => {
    expect(computeSizeTier(31_000, subjectEtv)).toBe("bigger"); // just over 3×
    expect(computeSizeTier(80_000, subjectEtv)).toBe("bigger"); // 8× boundary
  });

  it("8–25× → much_bigger", () => {
    expect(computeSizeTier(81_000, subjectEtv)).toBe("much_bigger"); // just over 8×
    expect(computeSizeTier(250_000, subjectEtv)).toBe("much_bigger"); // 25× boundary
  });

  it(">25× → biggest", () => {
    expect(computeSizeTier(251_000, subjectEtv)).toBe("biggest");
    expect(computeSizeTier(5_000_000, subjectEtv)).toBe("biggest");
  });
});

describe("computeSizeTier — absolute ETV-based (subject has ~0 traffic — new product)", () => {
  // Subject has 0 traffic (the dogfood case: reachkit-pi.vercel.app)
  const subjectEtv = 0;

  it("<10k → similar", () => {
    expect(computeSizeTier(0, subjectEtv)).toBe("similar");
    expect(computeSizeTier(500, subjectEtv)).toBe("similar");
    expect(computeSizeTier(9_999, subjectEtv)).toBe("similar");
  });

  it("10k–100k → bigger", () => {
    expect(computeSizeTier(10_000, subjectEtv)).toBe("bigger");
    expect(computeSizeTier(50_000, subjectEtv)).toBe("bigger");
    expect(computeSizeTier(99_999, subjectEtv)).toBe("bigger");
  });

  it("100k–1M → much_bigger", () => {
    expect(computeSizeTier(100_000, subjectEtv)).toBe("much_bigger");
    expect(computeSizeTier(500_000, subjectEtv)).toBe("much_bigger");
    expect(computeSizeTier(999_999, subjectEtv)).toBe("much_bigger");
  });

  it("≥1M → biggest", () => {
    expect(computeSizeTier(1_000_000, subjectEtv)).toBe("biggest");
    expect(computeSizeTier(10_000_000, subjectEtv)).toBe("biggest");
  });

  it("produces a spread across tiers for a typical cohort with 0-traffic subject", () => {
    const cohortEtvs = [500, 5_000, 25_000, 80_000, 300_000, 2_000_000];
    const tiers = cohortEtvs.map((etv) => computeSizeTier(etv, 0));
    const uniqueTiers = new Set(tiers);
    // All four tiers should appear
    expect(uniqueTiers.has("similar")).toBe(true);
    expect(uniqueTiers.has("bigger")).toBe(true);
    expect(uniqueTiers.has("much_bigger")).toBe(true);
    expect(uniqueTiers.has("biggest")).toBe(true);
  });
});
