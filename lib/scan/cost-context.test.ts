import { describe, it, expect } from "vitest";
import {
  newCostSink,
  runInCostContext,
  recordExternalCost,
  recordDataForSeoCost,
  recordTavilyCost,
  tavilyCredits,
  externalCapBreached,
} from "./cost-context";

describe("cost-context", () => {
  it("accumulates costs into the active sink", async () => {
    const sink = newCostSink();
    await runInCostContext(sink, async () => {
      recordExternalCost("dataforseo", 0.02);
      recordExternalCost("dataforseo", 0.03);
      recordExternalCost("tavily", 0.008);
    });
    expect(sink.dataforseo).toBeCloseTo(0.05, 10);
    expect(sink.tavily).toBeCloseTo(0.008, 10);
  });

  it("is a no-op outside a context (never throws)", () => {
    expect(() => recordExternalCost("dataforseo", 1)).not.toThrow();
  });

  it("ignores non-finite / non-positive amounts", async () => {
    const sink = newCostSink();
    await runInCostContext(sink, async () => {
      recordExternalCost("dataforseo", Number.NaN);
      recordExternalCost("dataforseo", -5);
      recordExternalCost("dataforseo", 0);
    });
    expect(sink.dataforseo).toBe(0);
  });

  it("reads DataForSEO cost from the response envelope", async () => {
    const sink = newCostSink();
    await runInCostContext(sink, async () => {
      recordDataForSeoCost({ status_code: 20000, cost: 0.0123, tasks: [] });
      recordDataForSeoCost({ cost: 0 }); // cache-served → free
      recordDataForSeoCost({}); // missing cost → 0
      recordDataForSeoCost(null);
    });
    expect(sink.dataforseo).toBeCloseTo(0.0123, 10);
  });

  it("isolates concurrent contexts", async () => {
    const a = newCostSink();
    const b = newCostSink();
    await Promise.all([
      runInCostContext(a, async () => {
        await new Promise((r) => setTimeout(r, 5));
        recordExternalCost("dataforseo", 1);
      }),
      runInCostContext(b, async () => {
        recordExternalCost("dataforseo", 2);
      }),
    ]);
    expect(a.dataforseo).toBe(1);
    expect(b.dataforseo).toBe(2);
  });

  describe("tavilyCredits", () => {
    it("prices search by depth", () => {
      expect(tavilyCredits("search", { depth: "basic" })).toBe(1);
      expect(tavilyCredits("search", { depth: "advanced" })).toBe(2);
      expect(tavilyCredits("search")).toBe(1); // default basic
    });

    it("prices extract per group of 5 URLs", () => {
      expect(tavilyCredits("extract", { urlCount: 1 })).toBe(1);
      expect(tavilyCredits("extract", { urlCount: 5 })).toBe(1);
      expect(tavilyCredits("extract", { urlCount: 6 })).toBe(2);
      expect(tavilyCredits("extract", { urlCount: 11, depth: "advanced" })).toBe(6);
    });
  });

  describe("external soft cap (invariant #2 — degrade, never throw)", () => {
    it("flips breached when cumulative spend crosses the cap — and NEVER throws", async () => {
      const sink = newCostSink(0.1); // 10¢ cap
      await runInCostContext(sink, async () => {
        recordExternalCost("dataforseo", 0.06);
        expect(externalCapBreached()).toBe(false);
        expect(() => recordExternalCost("tavily", 0.05)).not.toThrow(); // crosses 0.10
        expect(externalCapBreached()).toBe(true);
        // Recording continues after breach (spend stays measured, just flagged).
        recordExternalCost("dataforseo", 0.02);
      });
      expect(sink.breached).toBe(true);
      expect(sink.dataforseo).toBeCloseTo(0.08, 10);
    });

    it("no cap configured → never breaches", async () => {
      const sink = newCostSink();
      await runInCostContext(sink, async () => {
        recordExternalCost("dataforseo", 999);
        expect(externalCapBreached()).toBe(false);
      });
      expect(sink.breached).toBe(false);
    });

    it("externalCapBreached is false outside any context", () => {
      expect(externalCapBreached()).toBe(false);
    });
  });

  it("records Tavily cost as credits × rate", async () => {
    const sink = newCostSink();
    await runInCostContext(sink, async () => {
      recordTavilyCost("search", 0.008, { depth: "advanced" }); // 2 × 0.008
      recordTavilyCost("extract", 0.008, { urlCount: 6 }); // 2 × 0.008
    });
    expect(sink.tavily).toBeCloseTo(0.032, 10);
  });
});
