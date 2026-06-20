import { describe, it, expect } from "vitest";
import { buildMarketTrend } from "./market-trends";

const snap = (takenAt: string, summary: unknown) => ({ takenAt, summary });

describe("buildMarketTrend", () => {
  it("returns no metrics with fewer than 2 snapshots", () => {
    const t = buildMarketTrend([snap("2026-06-01", { selfSharePct: 0.3, keywordGapCount: 5 })]);
    expect(t.weeks).toBe(1);
    expect(t.metrics).toEqual([]);
  });

  it("builds sov / keyword / gap / pocket series with current + delta", () => {
    const summary = (sov: number, selfKw: number, rivalKw: number[], gap: number, pockets: number) => ({
      self: { domain: "me.com", organicKeywords: selfKw, etv: 1, referringDomains: 1 },
      rivals: rivalKw.map((k) => ({ domain: "r", organicKeywords: k, etv: 1, referringDomains: 1 })),
      selfSharePct: sov,
      demandPocketCount: pockets,
      keywordGapCount: gap,
    });
    const t = buildMarketTrend([
      snap("2026-06-01", summary(0.2, 100, [200, 400], 10, 3)),
      snap("2026-06-08", summary(0.3, 150, [200, 600], 14, 5)),
    ]);

    const sov = t.metrics.find((m) => m.key === "sov")!;
    expect(sov.values).toEqual([20, 30]); // selfSharePct * 100
    expect(sov.current).toBe(30);
    expect(sov.previous).toBe(20);
    expect(sov.unit).toBe("%");

    const rivalMed = t.metrics.find((m) => m.key === "rival_median_keywords")!;
    expect(rivalMed.values).toEqual([300, 400]); // median(200,400)=300 ; median(200,600)=400

    expect(t.metrics.find((m) => m.key === "self_keywords")!.values).toEqual([100, 150]);
    expect(t.metrics.find((m) => m.key === "keyword_gap")!.values).toEqual([10, 14]);
    expect(t.metrics.find((m) => m.key === "demand_pockets")!.values).toEqual([3, 5]);
  });

  it("skips snapshots where a metric is null/absent (older rows)", () => {
    const t = buildMarketTrend([
      snap("2026-06-01", { selfSharePct: 0.2, keywordGapCount: 5 }),
      snap("2026-06-08", { selfSharePct: null, keywordGapCount: 8 }), // sov missing
      snap("2026-06-15", { selfSharePct: 0.4, keywordGapCount: 12 }),
    ]);
    // sov has only 2 present values → included; gap has 3.
    expect(t.metrics.find((m) => m.key === "sov")!.values).toEqual([20, 40]);
    expect(t.metrics.find((m) => m.key === "keyword_gap")!.values).toEqual([5, 8, 12]);
  });
});
