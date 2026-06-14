import { describe, it, expect } from "vitest";
import { STEP_SCRIPT, computeStepStates, labelFor } from "./scan-narrative";

describe("scan narrative", () => {
  it("step 1 is active at start, rest pending; nothing done", () => {
    const s = computeStepStates({ confirmedLabels: new Set(), tick: 1, ctx: {} });
    expect(s[0]!.state).toBe("active");
    expect(s.slice(1).every((x) => x.state === "pending")).toBe(true);
  });

  it("optimistic steps auto-complete as the tick advances (never static)", () => {
    const s = computeStepStates({ confirmedLabels: new Set(), tick: 3, ctx: {} });
    expect(s[0]!.state).toBe("done"); // homepage
    expect(s[1]!.state).toBe("done"); // hero
    expect(s[2]!.state).toBe("active"); // ctas (now active)
  });

  it("optimistic ticking never advances past the first non-optimistic step", () => {
    // huge tick, but no real milestones: the 3 optimistic steps done, reviews ACTIVE, never done
    const s = computeStepStates({ confirmedLabels: new Set(), tick: 99, ctx: {} });
    expect(s.filter((x) => x.state === "done").map((x) => x.id)).toEqual(["homepage", "hero", "ctas"]);
    expect(s.find((x) => x.id === "reviews")!.state).toBe("active");
  });

  it("a non-optimistic step never completes until its milestone confirms", () => {
    const s = computeStepStates({ confirmedLabels: new Set(["Read your product page"]), tick: 99, ctx: {} });
    expect(s.find((x) => x.id === "reviews")!.state).not.toBe("done");
  });

  it("confirming 'Found 5 competitors' marks the competitor step done with the live count", () => {
    const s = computeStepStates({
      confirmedLabels: new Set(["Read your product page", "Analysed 6 reviews", "Found 5 competitors"]),
      tick: 99,
      ctx: { competitorCount: 5, reviewCount: 6 },
    });
    const comp = s.find((x) => x.id === "competitors")!;
    expect(comp.state).toBe("done");
    expect(comp.label).toMatch(/5 rivals/);
    expect(s.find((x) => x.id === "reviews")!.label).toMatch(/6 reviews/);
  });

  it("the __findings__ marker confirms the final step", () => {
    const all = new Set([
      "Read your product page", "Analysed 6 reviews", "Found 5 competitors",
      "Reading your reviews & positioning", "Comparing you to your competitors",
      "Scoring your discoverability", "Drafting your action plan",
      "Pressure-testing each recommendation", "__findings__",
    ]);
    const s = computeStepStates({ confirmedLabels: all, tick: 99, ctx: {} });
    expect(s.find((x) => x.id === "finalize")!.state).toBe("done");
    expect(s.every((x) => x.state === "done")).toBe(true);
  });

  it("labelFor injects dynamic counts and falls back cleanly when unknown", () => {
    expect(labelFor("reviews", { reviewCount: 6 })).toMatch(/6 reviews/);
    expect(labelFor("reviews", {})).toMatch(/public reviews/i);
    expect(labelFor("competitors", { competitorCount: 3 })).toMatch(/3 rivals/);
    expect(labelFor("ctas", { ctaCount: 1 })).toMatch(/found 1/);
    expect(labelFor("ctas", {})).toBe("Counting your CTAs");
  });

  it("STEP_SCRIPT covers every emitted heavy milestone label", () => {
    const confirmable = STEP_SCRIPT.flatMap((s) => s.confirmBy);
    for (const lbl of [
      "Reading your reviews & positioning",
      "Comparing you to your competitors",
      "Scoring your discoverability",
      "Drafting your action plan",
      "Pressure-testing each recommendation",
      "Finalising your report",
    ]) {
      expect(confirmable).toContain(lbl);
    }
  });
});
