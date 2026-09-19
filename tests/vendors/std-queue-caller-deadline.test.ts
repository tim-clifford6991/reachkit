// tests/vendors/std-queue-caller-deadline.test.ts — issue 902.
//
// The standard queue's wait is inside one call, and until this issue
// nothing but the vendor's own pin bounded it: `task_post`, then a poll
// every `VENDOR.stdQueuePollIntervalS` for up to
// `VENDOR.stdQueueDeadlineMin` — forty-five minutes. A paid pass reads its
// ceiling between calls (`bounds.stopNow()`), which is a check that cannot
// reach inside a call, so one slow task could hold a pass whose whole
// ceiling is `TIMING.paidPassCeilingS` for eleven times it, and past the
// `/api/jobs` invocation it runs in — where the platform freezes it
// mid-write and the step is retried.
//
// The mutations this suite exists to kill:
//
//  - dropping `untilMs` on the way from the call site to `callEndpoint`,
//    so the bound is declared and never applied;
//  - taking the caller's deadline as the *only* deadline, which would let
//    a caller with no ceiling of its own poll forever;
//  - taking the longer of the two rather than the earlier;
//  - posting (and being charged for) a task after the caller's ceiling has
//    already run out.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { envelope, fakeCostContext, setEnvFixture, stubVendorFetch, taskCreated, taskInQueue } from "./harness.ts";

let serp: typeof import("../../src/lib/vendors/dataforseo/serp.ts");
let ai: typeof import("../../src/lib/vendors/dataforseo/ai.ts");
let constants: typeof import("../../src/lib/config/constants.ts");

beforeAll(async () => {
  setEnvFixture();
  serp = await import("../../src/lib/vendors/dataforseo/serp.ts");
  ai = await import("../../src/lib/vendors/dataforseo/ai.ts");
  constants = await import("../../src/lib/config/constants.ts");
});

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const SCOPE = { site: "site-902" } as const;

/** The pass's ceiling, as the deadline a caller hands in. */
function ceilingMs(): number {
  return constants.TIMING.paidPassCeilingS * 1000;
}

describe("a caller's own ceiling bounds the standard queue's wait (issue 902)", () => {
  it("gives up when the caller's ceiling runs out, long before the vendor's forty-five minutes", async () => {
    stubVendorFetch((_request, index) => (index === 0 ? taskCreated() : taskInQueue()));
    const { ctx } = fakeCostContext();
    vi.useFakeTimers();

    const pending = ai.llmScraper(ctx, {
      query: "best onboarding software",
      mode: "std",
      scope: SCOPE,
      untilMs: Date.now() + ceilingMs(),
    });
    // One second past the pass's ceiling — and nowhere near the vendor's
    // pinned deadline, which is what used to be the only way out of here.
    await vi.advanceTimersByTimeAsync(ceilingMs() + 1000);
    const result = await pending;

    expect(result.kind).toBe("unmeasured");
    if (result.kind !== "unmeasured") throw new Error("unreachable");
    expect(result.reason).toBe("undeterminable");
    // The whole point: it answered inside the pass's ceiling rather than
    // holding it for the vendor's own deadline.
    expect(ceilingMs()).toBeLessThan(constants.VENDOR.stdQueueDeadlineMin * 60 * 1000);
  });

  it("a caller with no ceiling of its own still stops at the vendor's pinned deadline", async () => {
    stubVendorFetch((_request, index) => (index === 0 ? taskCreated() : taskInQueue()));
    const { ctx } = fakeCostContext();
    vi.useFakeTimers();

    const pending = ai.llmScraper(ctx, { query: "best onboarding software", mode: "std", scope: SCOPE });
    await vi.advanceTimersByTimeAsync((constants.VENDOR.stdQueueDeadlineMin + 1) * 60 * 1000);
    const result = await pending;

    expect(result.kind).toBe("unmeasured");
  });

  it("the earlier deadline wins: a caller whose ceiling outlasts the vendor's does not extend the wait", async () => {
    let polls = 0;
    stubVendorFetch((_request, index) => {
      if (index === 0) return taskCreated();
      polls += 1;
      return taskInQueue();
    });
    const { ctx } = fakeCostContext();
    vi.useFakeTimers();

    const pending = serp.serpOrganic(ctx, {
      query: "best crm",
      mode: "std",
      loadAsyncAiOverview: false,
      scope: SCOPE,
      freshnessDays: constants.CACHE_WINDOWS_D.serp,
      // Twice the vendor's own deadline.
      untilMs: Date.now() + constants.VENDOR.stdQueueDeadlineMin * 2 * 60 * 1000,
    });
    await vi.advanceTimersByTimeAsync((constants.VENDOR.stdQueueDeadlineMin + 1) * 60 * 1000);
    const result = await pending;

    expect(result.kind).toBe("unmeasured");
    // It stopped at the vendor's pin, so it polled about that many times
    // and not twice that many.
    expect(polls).toBeLessThanOrEqual(
      (constants.VENDOR.stdQueueDeadlineMin * 60) / constants.VENDOR.stdQueuePollIntervalS + 1
    );
  });

  it("posts nothing at all once the caller's ceiling has already run out — an unbilled refusal, not a charged task nobody collects", async () => {
    const stub = stubVendorFetch(() => envelope({ items: [] }));
    const { ctx, ledgered } = fakeCostContext();

    const result = await ai.llmScraper(ctx, {
      query: "best onboarding software",
      mode: "std",
      scope: SCOPE,
      untilMs: Date.now() - 1,
    });

    expect(result.kind).toBe("unmeasured");
    expect(stub.requests).toHaveLength(0);
    // The vendor charges at the post. Nothing was posted, so nothing is
    // settled against the pass's cap.
    expect(ledgered).toEqual([0]);
  });

  it("a task that completes inside the caller's ceiling is measured exactly as before", async () => {
    stubVendorFetch((_request, index) => {
      if (index === 0) return taskCreated("queued-902");
      if (index === 1) return taskInQueue("queued-902");
      return envelope({ items: [{ type: "ai_overview", markdown: "Try these.", references: [{ domain: "rival.com" }] }] });
    });
    const { ctx } = fakeCostContext();
    vi.useFakeTimers();

    const pending = ai.llmScraper(ctx, {
      query: "best onboarding software",
      mode: "std",
      scope: SCOPE,
      untilMs: Date.now() + ceilingMs(),
    });
    await vi.advanceTimersByTimeAsync(constants.VENDOR.stdQueuePollIntervalS * 1000 * 3);
    const result = await pending;

    expect(result.kind).not.toBe("unmeasured");
  });
});
