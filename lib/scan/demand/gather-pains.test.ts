import { describe, it, expect } from "vitest";
import { fallbackBuyerInsights } from "./gather";

describe("fallbackBuyerInsights (pains shape)", () => {
  it("returns pains as PainInsight[] from brief problem + JTBD", () => {
    const bi = fallbackBuyerInsights(
      { brand: "x", problem: "manual notes", audience: "ops", valueProp: "auto", category: "c",
        seedKeywords: [], coreTerms: [], icp: { whoItsFor: "ops teams", jobsToBeDone: ["capture notes"], useCases: [] } } as never,
      [],
    );
    expect(bi.pains.every((p) => typeof p.text === "string")).toBe(true);
    expect(bi.pains.map((p) => p.text)).toContain("manual notes");
  });
});
