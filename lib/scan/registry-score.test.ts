import { describe, it, expect } from "vitest";
import { registryScore, type RegistryScoreRow } from "./registry-score";

const row = (pillar: RegistryScoreRow["pillar"], weight: number, normalised: number | null, state = normalised == null ? "unmeasured" : "pass"): RegistryScoreRow => ({ pillar, weight, normalised, state });

describe("registryScore", () => {
  it("returns 100 when every measured signal is perfect", () => {
    const rows = [row("seo", 0.5, 100), row("seo", 0.5, 100), row("content", 1, 100), row("outreach", 1, 100)];
    expect(registryScore(rows).total).toBe(100);
  });

  it("scores a pillar over its measured signals (weighted)", () => {
    const rows = [row("seo", 0.5, 100), row("seo", 0.5, 0)];
    expect(registryScore(rows).breakdown.seo).toBe(50);
  });

  it("excludes a pillar with no measured signals from the total (anti-vanity)", () => {
    // Only SEO measured → total equals the SEO pillar, not dragged down by content/outreach.
    const rows = [
      row("seo", 1, 80),
      row("content", 1, null),
      row("outreach", 1, null),
    ];
    const s = registryScore(rows);
    expect(s.assessed).toEqual(["seo"]);
    expect(s.total).toBe(80);
  });

  it("weights assessed pillars by PILLAR_WEIGHTS, renormalised", () => {
    // SEO=100 (w .45), Content=0 (w .30) assessed; Outreach unmeasured.
    // total = (.45*100 + .30*0) / (.45+.30) = 45/0.75 = 60
    const rows = [row("seo", 1, 100), row("content", 1, 0), row("outreach", 1, null)];
    expect(registryScore(rows).total).toBe(60);
  });

  it("returns 0 when nothing is measured", () => {
    const rows = [row("seo", 1, null), row("content", 1, null)];
    expect(registryScore(rows).total).toBe(0);
    expect(registryScore(rows).assessed).toEqual([]);
  });
});
