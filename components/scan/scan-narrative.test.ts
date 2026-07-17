import { describe, it, expect } from "vitest";
import {
  STEP_SCRIPT,
  DEEP_STEPS,
  computeStepStates,
  labelFor,
  scanProgressPct,
  PROGRESS_CEILING,
} from "./scan-narrative";

// ---------------------------------------------------------------------------
// Progress percentage. Every case here is anchored to a MEASURED prod timing
// (2026-07-17) — these are the exact moments the old `done / steps.length`
// number froze or lied.
// ---------------------------------------------------------------------------
describe("scanProgressPct", () => {
  const FREE_TOTAL = STEP_SCRIPT.length; // 9
  const DEEP_TOTAL = STEP_SCRIPT.length + DEEP_STEPS.length; // 12

  it("100 is RESERVED for actually-complete — never reached while running", () => {
    // The deep pass confirms ALL 12 steps at "Finalising your report" (t+89.3s)
    // while the market pass still has ~47s to run. The old math read exactly 100
    // here, then froze there for a third of the scan.
    const midPipeline = scanProgressPct({
      stepsDone: DEEP_TOTAL,
      stepsTotal: DEEP_TOTAL,
      elapsedS: 89.3,
      deep: true,
      complete: false,
    });
    expect(midPipeline).toBeLessThanOrEqual(PROGRESS_CEILING);
    expect(midPipeline).toBeLessThan(100);

    expect(
      scanProgressPct({ stepsDone: DEEP_TOTAL, stepsTotal: DEEP_TOTAL, elapsedS: 136.4, deep: true, complete: true }),
    ).toBe(100);
  });

  it("KEEPS MOVING through the deep pass's 47s dead zone (t+89.3s → t+136.4s)", () => {
    // Not one artifact is emitted between "Finalising your report" and `done`.
    // Event-driven progress is frozen by definition; time-driven is not.
    const at89 = scanProgressPct({ stepsDone: 11, stepsTotal: DEEP_TOTAL, elapsedS: 89.3, deep: true, complete: false });
    const at136 = scanProgressPct({ stepsDone: 11, stepsTotal: DEEP_TOTAL, elapsedS: 136.4, deep: true, complete: false });
    expect(at136).toBeGreaterThan(at89);
  });

  it("KEEPS MOVING through the free scan's 22.4s synth call (t+14.3s → t+36.8s)", () => {
    // One runSynth call is 56% of a 40.2s free scan, with zero events inside it.
    const at14 = scanProgressPct({ stepsDone: 7, stepsTotal: FREE_TOTAL, elapsedS: 14.3, deep: false, complete: false });
    const at36 = scanProgressPct({ stepsDone: 7, stepsTotal: FREE_TOTAL, elapsedS: 36.8, deep: false, complete: false });
    expect(at36).toBeGreaterThan(at14);
  });

  it("is monotonic in elapsed time — the bar never goes backwards", () => {
    let prev = -1;
    for (let t = 0; t <= 200; t += 5) {
      const p = scanProgressPct({ stepsDone: 3, stepsTotal: DEEP_TOTAL, elapsedS: t, deep: true, complete: false });
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });

  it("the checklist ratchets FORWARD — a fast scan is pulled ahead of the time curve", () => {
    const timeOnly = scanProgressPct({ stepsDone: 0, stepsTotal: FREE_TOTAL, elapsedS: 5, deep: false, complete: false });
    const ratcheted = scanProgressPct({ stepsDone: 7, stepsTotal: FREE_TOTAL, elapsedS: 5, deep: false, complete: false });
    expect(ratcheted).toBeGreaterThan(timeOnly);
  });

  it("never shows a dead 0, and never exceeds the ceiling on an overrunning scan", () => {
    expect(scanProgressPct({ stepsDone: 0, stepsTotal: FREE_TOTAL, elapsedS: 0, deep: false, complete: false })).toBeGreaterThan(0);
    // A scan running 10x over budget still must not claim done.
    expect(
      scanProgressPct({ stepsDone: 0, stepsTotal: DEEP_TOTAL, elapsedS: 1400, deep: true, complete: false }),
    ).toBeLessThanOrEqual(PROGRESS_CEILING);
  });
});

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

  it("the __findings__ marker confirms the snapshot closer (all steps done)", () => {
    const all = new Set([
      "Read your product page", "Analysed 6 reviews", "Found 5 competitors",
      "Reading your reviews & positioning", "Comparing you to your competitors",
      "Scoring your discoverability", "__findings__",
    ]);
    const s = computeStepStates({ confirmedLabels: all, tick: 99, ctx: {} });
    expect(s.find((x) => x.id === "snapshot")!.state).toBe("done");
    expect(s.every((x) => x.state === "done")).toBe(true);
  });

  it("snapshot is the active closer until findings land (after scoring)", () => {
    const collectFindings = new Set([
      "Read your product page", "Analysed 6 reviews", "Found 5 competitors",
      "Reading your reviews & positioning", "Comparing you to your competitors",
      "Scoring your discoverability",
    ]);
    const s = computeStepStates({ confirmedLabels: collectFindings, tick: 99, ctx: {} });
    expect(s.find((x) => x.id === "score")!.state).toBe("done");
    expect(s.find((x) => x.id === "snapshot")!.state).toBe("active"); // waits for __findings__
  });

  it("deep=false: the base script ends at snapshot — no deep-pass steps", () => {
    const s = computeStepStates({ confirmedLabels: new Set(), tick: 1, ctx: {} });
    expect(s.some((x) => x.id === "actions")).toBe(false);
    expect(s.some((x) => x.id === "report")).toBe(false);
    expect(s[s.length - 1]!.id).toBe("snapshot");
  });

  it("deep=true: appends actions → critic → report after snapshot", () => {
    const s = computeStepStates({ confirmedLabels: new Set(), tick: 1, ctx: {}, deep: true });
    expect(s.map((x) => x.id).slice(-4)).toEqual(["snapshot", "actions", "critic", "report"]);
  });

  it("deep=true: findings done flips snapshot done and drafting active (not stuck for the whole deep pass)", () => {
    const throughFindings = new Set([
      "Read your product page", "Analysed 6 reviews", "Found 5 competitors",
      "Reading your reviews & positioning", "Comparing you to your competitors",
      "Scoring your discoverability", "__findings__",
    ]);
    const s = computeStepStates({ confirmedLabels: throughFindings, tick: 99, ctx: {}, deep: true });
    expect(s.find((x) => x.id === "snapshot")!.state).toBe("done");
    expect(s.find((x) => x.id === "actions")!.state).toBe("active");
  });

  it("deep=true: the report step is the closer until the report event lands", () => {
    const throughCritic = new Set([
      "Read your product page", "Analysed 6 reviews", "Found 5 competitors",
      "Reading your reviews & positioning", "Comparing you to your competitors",
      "Scoring your discoverability", "__findings__",
      "Drafting your action plan", "Pressure-testing each recommendation",
    ]);
    const active = computeStepStates({ confirmedLabels: throughCritic, tick: 99, ctx: {}, deep: true });
    expect(active.find((x) => x.id === "critic")!.state).toBe("done");
    expect(active.find((x) => x.id === "report")!.state).toBe("active"); // waits for __report__

    const done = computeStepStates({
      confirmedLabels: new Set([...throughCritic, "__report__"]),
      tick: 99,
      ctx: {},
      deep: true,
    });
    expect(done.every((x) => x.state === "done")).toBe(true);
  });

  it("labelFor injects dynamic counts and falls back cleanly when unknown", () => {
    expect(labelFor("reviews", { reviewCount: 6 })).toMatch(/6 reviews/);
    expect(labelFor("reviews", {})).toMatch(/public reviews/i);
    expect(labelFor("competitors", { competitorCount: 3 })).toMatch(/3 rivals/);
    expect(labelFor("ctas", { ctaCount: 1 })).toMatch(/found 1/);
    expect(labelFor("ctas", {})).toBe("Counting your CTAs");
  });

  it("STEP_SCRIPT covers every watched (collect→findings) milestone label", () => {
    const confirmable = STEP_SCRIPT.flatMap((s) => s.confirmBy);
    for (const lbl of [
      "Reading your reviews & positioning",
      "Comparing you to your competitors",
      "Scoring your discoverability",
      "__findings__",
    ]) {
      expect(confirmable).toContain(lbl);
    }
    // The full-scan labels are intentionally NOT watched (they run in the background).
    for (const lbl of ["Drafting your action plan", "Pressure-testing each recommendation", "Finalising your report"]) {
      expect(confirmable).not.toContain(lbl);
    }
  });
});
