// tests/scan/free/stage-budgets.test.ts — issue #539
//
// The per-stage budget seam. What this suite decides: that the budgets add
// up to less than the two ceilings the pass actually has, and that a stage
// driven to its own budget ends there — bounded, with the pass's own
// ceilings untouched, so the stages after it still run and still measure.
//
// `budgets.ts` imports the pins and nothing else at run time (every other
// import is a type), so there is no database, no env and no vendor to
// double here.
import { afterEach, describe, expect, it, vi } from "vitest";

// `STAGES` is read below to prove no stage is missing a budget, and
// `stages.ts` reaches `dbAdmin()` for the one thing its event bus cannot
// answer — so the client is mocked here wholesale, the same way
// `tests/scan/free/stages.test.ts` mocks it. Nothing in this suite reaches
// a database; `budgets.ts` itself imports the pins and nothing else at run
// time (every other import it has is a type).
vi.mock("@/lib/db", () => ({ dbAdmin: vi.fn() }));

import { CAPS, TIMING } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { SERP_FANOUT, STAGE_BUDGETS, withStageBudget } from "@/lib/scan/budgets";
import type { Bounds } from "@/lib/scan/ceilings";
import { STAGES } from "@/lib/scan/stages";

/** The pass's own bounds, with nothing fired — the state a stage's budget
 *  has to be able to end a stage from. `stopNow` is the real implementation's
 *  order (time, then money) over these two answers. */
function passBounds(over: { expired?: boolean; capHit?: boolean } = {}): Bounds {
  const expired = over.expired ?? false;
  const capHit = over.capHit ?? false;
  return {
    expired: () => expired,
    remainingMs: () => (expired ? 0 : TIMING.reportCeilingS * 1000),
    capHit: () => capHit,
    stopNow: () => (expired ? "time_ceiling" : capHit ? "spend_ceiling" : null),
    siteUnreadable: () => undefined,
    unreadable: () => undefined,
  };
}

function fakeCost(spentCents: () => number): CostContext {
  return { spentCents, capHit: () => false, degraded: () => false } as unknown as CostContext;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("the budget adds up to less than the ceilings the pass has", () => {
  it("every stage has one, and no stage is missing from the table", () => {
    expect(Object.keys(STAGE_BUDGETS).sort()).toEqual([...STAGES].sort());
  });

  it("the seconds sum under the target the pass aims at, which is itself under the ceiling that stops it", () => {
    const seconds = Object.values(STAGE_BUDGETS).reduce((total, b) => total + b.seconds, 0);
    expect(seconds).toBeLessThanOrEqual(TIMING.reportTargetS);
    expect(seconds).toBeLessThan(TIMING.reportCeilingS);
  });

  it("the cents sum under the free pass's cap", () => {
    const cents = Object.values(STAGE_BUDGETS).reduce((total, b) => total + b.cents, 0);
    expect(cents).toBeLessThanOrEqual(CAPS.FREE_C);
  });
});

describe("a stage driven to its time budget ends there, and the pass does not", () => {
  it("work that never answers ends at the stage's own budget, not at the pass's ceiling", async () => {
    vi.useFakeTimers();
    const bounds = passBounds();
    const budget = STAGE_BUDGETS.asking_the_twelve;

    const outcome = withStageBudget(
      { stage: "asking_the_twelve", bounds, cost: fakeCost(() => 0), applies: true },
      () => new Promise<string>(() => undefined)
    );
    await vi.advanceTimersByTimeAsync(budget.seconds * 1000);

    expect(await outcome).toEqual({ spent: true });
    // The pass's own ceilings never fired: it is the *stage* that ended, so
    // the stages after it still run and the ending is still `complete`.
    expect(bounds.stopNow()).toBeNull();
    expect(budget.seconds * 1000).toBeLessThan(TIMING.reportCeilingS * 1000);
  });

  it("work that answers inside its budget returns what it answered", async () => {
    const outcome = await withStageBudget(
      { stage: "reading_your_market", bounds: passBounds(), cost: fakeCost(() => 0), applies: true },
      async () => "measured"
    );
    expect(outcome).toEqual({ spent: false, value: "measured" });
  });

  it("a stage that has spent its own cents reads as stopped inside the stage while the pass has headroom", async () => {
    const bounds = passBounds();
    const spent = { cents: 0 };
    let insideStage: string | null = null;

    await withStageBudget(
      { stage: "reading_your_market", bounds, cost: fakeCost(() => spent.cents), applies: true },
      async (stageBounds) => {
        expect(stageBounds.stopNow()).toBeNull();
        spent.cents = STAGE_BUDGETS.reading_your_market.cents;
        insideStage = stageBounds.stopNow();
      }
    );

    expect(insideStage).toBe("spend_ceiling");
    // The pass itself is untouched — its cap is the sum of every stage's.
    expect(bounds.stopNow()).toBeNull();
    expect(bounds.capHit()).toBe(false);
  });

  it("a pass with no report deadline gets no per-stage bound at all", async () => {
    vi.useFakeTimers();
    const outcome = withStageBudget(
      { stage: "asking_the_twelve", bounds: passBounds(), cost: fakeCost(() => 0), applies: false },
      async () => "paid pass"
    );
    await vi.advanceTimersByTimeAsync(STAGE_BUDGETS.asking_the_twelve.seconds * 2000);
    expect(await outcome).toEqual({ spent: false, value: "paid pass" });
  });

  it("the pass's own ceiling still ends a stage, whatever the stage's budget has left", async () => {
    const outcome = await withStageBudget(
      { stage: "asking_the_twelve", bounds: passBounds({ expired: true }), cost: fakeCost(() => 0), applies: true },
      async (stageBounds) => stageBounds.stopNow()
    );
    expect(outcome).toEqual({ spent: false, value: "time_ceiling" });
  });
});

describe("the fan-out is narrower than the twelve it buys", () => {
  it("so a pass never opens a socket per question at once", () => {
    expect(SERP_FANOUT).toBeGreaterThan(1);
    expect(SERP_FANOUT).toBeLessThan(12);
  });
});

describe("a stage that was abandoned says so to the work still running inside it", () => {
  it("work still in flight is told, so its late answer is not written back", async () => {
    vi.useFakeTimers();
    const budget = STAGE_BUDGETS.asking_the_twelve;
    const written: string[] = [];
    let answer: () => void = () => undefined;

    const outcome = withStageBudget(
      { stage: "asking_the_twelve", bounds: passBounds(), cost: fakeCost(() => 0), applies: true },
      async (_stageBounds, abandoned) => {
        expect(abandoned()).toBe(false);
        await new Promise<void>((resolve) => {
          answer = resolve;
        });
        if (!abandoned()) written.push("late answer");
      }
    );

    await vi.advanceTimersByTimeAsync(budget.seconds * 1000);
    expect(await outcome).toEqual({ spent: true });

    // The vendor answers after the stage ended. The worker asks before it
    // writes, and keeps its answer out of a `sections` the pass has already
    // scored and stored.
    answer();
    await vi.advanceTimersByTimeAsync(0);
    expect(written).toEqual([]);
  });

  it("work that answered inside its budget is never told it was abandoned, and leaves no timer behind", async () => {
    vi.useFakeTimers();
    let toldWhileRunning = true;
    const outcome = await withStageBudget(
      { stage: "reading_your_market", bounds: passBounds(), cost: fakeCost(() => 0), applies: true },
      async (_stageBounds, abandoned) => {
        toldWhileRunning = abandoned();
        return "measured";
      }
    );
    expect(outcome).toEqual({ spent: false, value: "measured" });
    expect(toldWhileRunning).toBe(false);
    // The budget's own timer goes with the stage rather than holding the
    // event loop open for the rest of the budget.
    expect(vi.getTimerCount()).toBe(0);
  });
});
