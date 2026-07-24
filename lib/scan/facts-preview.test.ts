import { describe, it, expect } from "vitest";
import { scopeFactsForStream } from "@/lib/scan/facts-preview";
import type { PreliminaryFacts } from "@/lib/scan/types";

// A full, pre-redaction facts object — the exact thing the pipeline collects and
// that MUST NOT reach the unauthenticated /api/scan/[id]/stream broadcast (H2 /
// invariant #12). Populated with sensitive fields so the guard bites if any leak.
const FULL: PreliminaryFacts = {
  mode: "web",
  listing: {
    name: "Acme",
    category: "Analytics",
    description: "SECRET internal positioning copy that free viewers must not see",
    pricing: "$499/mo enterprise",
  },
  competitors: [
    { name: "Rival A", url: "https://rival-a.com", source: "discovery", rank: 1 },
    { name: "Rival B", url: "https://rival-b.com", source: "discovery", rank: 2 },
  ],
  reviewVolume: 42,
  ratingTrend: 4.6,
  webProxy: { monthlyTraffic: 123456 } as unknown as PreliminaryFacts["webProxy"],
  themes: [{ theme: "secret theme", count: 9 }] as unknown as PreliminaryFacts["themes"],
  sourcesUsed: ["https://internal-source.example/private"],
  coldStart: false,
};

describe("scopeFactsForStream — public wire redaction (H2 / invariant #12)", () => {
  const scoped = scopeFactsForStream(FULL);

  it("carries EXACTLY the fields the progress UI renders", () => {
    expect(Object.keys(scoped).sort()).toEqual(["competitors", "listing", "mode", "reviewVolume"]);
    expect(scoped.mode).toBe("web");
    expect(scoped.listing).toEqual({ name: "Acme" });
    expect(scoped.reviewVolume).toBe(42);
  });

  it("preserves competitor COUNT but leaks no per-competitor data", () => {
    const competitors = scoped.competitors as unknown[];
    expect(competitors).toHaveLength(2); // scan-stream.tsx renders only .length
    for (const c of competitors) expect(Object.keys(c as object)).toHaveLength(0);
  });

  it("leaks NONE of the sensitive facts fields (mutation-proof)", () => {
    const wire = JSON.stringify(scoped);
    // The heavy/paid fields that used to be broadcast verbatim.
    expect(wire).not.toContain("SECRET internal positioning");
    expect(wire).not.toContain("$499/mo");
    expect(wire).not.toContain("rival-a.com");
    expect(wire).not.toContain("internal-source.example");
    expect(wire).not.toContain("123456"); // webProxy traffic
    expect(wire).not.toContain("secret theme");
    // And the structural leak surfaces must be absent entirely.
    for (const leaked of ["description", "pricing", "webProxy", "themes", "sourcesUsed", "ratingTrend", "url", "rank"]) {
      expect(scoped).not.toHaveProperty(leaked);
      expect(wire).not.toContain(`"${leaked}"`);
    }
  });
});
