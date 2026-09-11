// tests/scan/free/ceilings.test.ts
//
// WO-281 `## Test plan` (criteria quoted verbatim from `requirements/
// REQ-003.md` and `requirements/REQ-004.md`, carried from WO-059) — the
// ending-totality, deadline, cap and ADR-021 suites for `withFreeBounds`.
//
// `withFreeBounds` opens `@/lib/costs`'s `withCostContext` internally
// (`src/lib/scan/ceilings.ts`'s own header explains why its two-parameter
// signature still reaches a `CostContext`). That module is mocked here
// wholesale — the same pattern `tests/scan/free/admission-check.test.ts`
// uses for `@/lib/db` — so this suite exercises `withFreeBounds`'s own
// deadline and ending logic against a controllable, in-memory stand-in
// for the cost seam, never a live database: BP-007's own behaviour is
// exercised in `tests/costs/context.test.ts` and is out of this WO's
// scope (`## Out of scope`: "BP-007's `capHit()` itself, the ledger and
// the cache — another node's"). No live-DB suite is added by this file,
// so it needs no `--no-file-parallelism` flag and does not join
// `tests/scan/free/schema.test.ts`'s own racing group.
//
// **REQ-003 c5's own 90 s is superseded on the pin** (master ruling
// 2026-09-10, issue #456): the invocation the free pass runs in is frozen
// by the platform at 60 s, so a design ceiling above that could never fire
// and the partial report ADR-021 promises could never be stored.
// `TIMING.reportCeilingS` is now 50. The criteria below are still quoted
// verbatim — they are a frozen document's words, and quoting them is not
// asserting the figure — but every deadline this file exercises is read
// from the pin rather than typed, so the ordering ruling moves the tests
// with it. The order itself is `tests/scan/ceilings-pins.test.ts`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/costs", () => ({ withCostContext: vi.fn() }));

import { TIMING } from "@/lib/config/constants";
import { withCostContext } from "@/lib/costs";
import { withFreeBounds, type Bounds } from "@/lib/scan/ceilings";

/** The deadline `withFreeBounds` races against, in milliseconds — the pin,
 *  never a literal, so this suite follows the ruling that sets it. */
const CEILING_MS = TIMING.reportCeilingS * 1000;

interface CostStub {
  recordFetch: ReturnType<typeof vi.fn>;
  capHit: () => boolean;
  spentCents: () => number;
  degraded: () => boolean;
  setCapHit(v: boolean): void;
  setSpentCents(v: number): void;
  setDegraded(v: boolean): void;
}

function makeCostStub(): CostStub {
  let capHitValue = false;
  let spentCentsValue = 0;
  let degradedValue = false;
  return {
    recordFetch: vi.fn(async () => ({ payload: undefined, fresh: true, costCents: 0 })),
    capHit: () => capHitValue,
    spentCents: () => spentCentsValue,
    degraded: () => degradedValue,
    setCapHit: (v: boolean) => {
      capHitValue = v;
    },
    setSpentCents: (v: number) => {
      spentCentsValue = v;
    },
    setDegraded: (v: boolean) => {
      degradedValue = v;
    },
  };
}

let activeCost: CostStub;

beforeEach(() => {
  activeCost = makeCostStub();
  vi.mocked(withCostContext).mockImplementation(
    (async (_ctx: unknown, body: (cost: unknown) => unknown) => body(activeCost)) as typeof withCostContext
  );
});

afterEach(() => {
  vi.mocked(withCostContext).mockReset();
  vi.useRealTimers();
});

// A fresh "now" per use, not a fixed calendar date — this file's own
// deadline arithmetic is `startedAt + TIMING.reportCeilingS`, and a stale fixed date would
// already read as expired by the time the real suite runs, well outside
// any test that fakes its own clock.
function startedNow(): Date {
  return new Date();
}

function never<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

// ── REQ-003 c5 ────────────────────────────────────────────────────────

describe(
  'REQ-003 c5 — "Given a scan still running past 60 seconds — including when the delay is the scanned domain\'s own server answering slowly — when it reaches 90 seconds, then measuring stops and the visitor is shown the report of everything measured by that point, with the rest reported as unmeasured (REQ-004). No visitor waits on a running scan beyond 90 seconds."',
  () => {
    it("ceilings/time · the deadline fires at the pinned ceiling whatever is blocking", async () => {
      vi.useFakeTimers();
      const promise = withFreeBounds({ scanId: "scan-1", startedAt: startedNow() }, async () => {
        return never<string>(); // a call that never resolves
      });
      const started = Date.now();
      await vi.advanceTimersByTimeAsync(CEILING_MS);
      const outcome = await promise;
      expect(outcome.ending).toEqual({ kind: "report", complete: false, stoppedReason: "time_ceiling" });
      expect(outcome.result).toBeNull();
      expect(Date.now() - started).toBeLessThanOrEqual(CEILING_MS);
    });

    it("ceilings/time · stopNow() is re-checked between calls inside a multi-call stage, not only between stages", async () => {
      vi.useFakeTimers();
      const observedAt: Array<"time_ceiling" | "spend_ceiling" | null> = [];
      let loopDone: () => void = () => {};
      const loopFinished = new Promise<void>((resolve) => {
        loopDone = resolve;
      });
      // A body that keeps making calls a quarter of the ceiling apart —
      // `withFreeBounds`'s own race settles at the deadline (after the 4th
      // call), but this loop is not cancelled by that race: it keeps
      // running underneath, exactly as a real multi-call stage's own loop
      // would, and this test observes it directly rather than through the
      // race's winner. The step is derived from the pin, so the ceiling can
      // move without this test's arithmetic being re-typed.
      const stepMs = CEILING_MS / 4;
      void withFreeBounds({ scanId: "scan-2", startedAt: startedNow() }, async (bounds: Bounds) => {
        for (let i = 0; i < 5; i++) {
          observedAt.push(bounds.stopNow());
          await new Promise((resolve) => setTimeout(resolve, stepMs));
        }
        loopDone();
        return "done";
      });
      await vi.advanceTimersByTimeAsync(CEILING_MS + stepMs * 2);
      await loopFinished;
      // The first four calls land before the deadline and read null; the
      // fifth lands on it and reads 'time_ceiling' — proving the check
      // happens on every call, not once per stage.
      expect(observedAt.slice(0, 4)).toEqual([null, null, null, null]);
      expect(observedAt[4]).toBe("time_ceiling");
    });

    it("ceilings/time · when both ceilings have fired, time wins (WO-281 `## Steps` step 3)", async () => {
      vi.useFakeTimers();
      activeCost.setCapHit(true); // the spend ceiling has already fired too
      let observed: "time_ceiling" | "spend_ceiling" | null = null;
      void withFreeBounds({ scanId: "scan-both-ceilings", startedAt: startedNow() }, async (bounds: Bounds) => {
        await new Promise((resolve) => setTimeout(resolve, CEILING_MS));
        observed = bounds.stopNow();
        return "done";
      });
      await vi.advanceTimersByTimeAsync(CEILING_MS);
      expect(observed, "REQ-003 c5: TIMING.reportCeilingS is the bound stated absolutely").toBe("time_ceiling");
    });
  }
);

// ── REQ-003 c11 ───────────────────────────────────────────────────────

describe(
  'REQ-003 c11 — "Given a free scan that reaches its spend ceiling while it is running, when it ends, then the ceiling is never exceeded to finish any outstanding measurement, whether or not a driver of the score depends on it: all remaining work is skipped, and the visitor is shown the report of everything measured up to that point, the skipped parts reading as not measured and the score reading as REQ-004 criterion 9 requires, with one written line stating the scan stopped early and the report is incomplete — never an error, a hang, or a refusal."',
  () => {
    it(
      // must fail first — ADR-021's "let it run 0.4¢ over"
      "ceilings/spend · no call is made after the cap fires [ADR-021]",
      async () => {
        const callSpy = vi.fn();
        const outcome = await withFreeBounds({ scanId: "scan-3", startedAt: startedNow() }, async (bounds: Bounds) => {
          for (let i = 0; i < 12; i++) {
            if (bounds.stopNow()) break;
            callSpy(i);
            if (i === 5) activeCost.setCapHit(true); // the cap fires mid-stage
          }
          return "partial";
        });
        // Calls 0..5 run (six calls); the cap fires after call 5 and the
        // loop's own next iteration (i === 6) observes it and stops —
        // never seven or more.
        expect(callSpy).toHaveBeenCalledTimes(6);
        expect(outcome.ending).toEqual(
          expect.objectContaining({ kind: "report", complete: false, stoppedReason: "spend_ceiling" })
        );
        expect(outcome.ending.kind).not.toBe("no_report");
      }
    );

    it(
      // must fail first — ADR-021's "compute a partial score"
      "ceilings/spend · a score input is cut off like any other work [ADR-021]",
      async () => {
        activeCost.setCapHit(true);
        const callSpy = vi.fn();
        const outcome = await withFreeBounds({ scanId: "scan-4", startedAt: startedNow() }, async (bounds: Bounds) => {
          for (let i = 0; i < 12; i++) {
            if (bounds.stopNow()) break;
            callSpy(i);
          }
          return null;
        });
        expect(callSpy).not.toHaveBeenCalled();
        expect(outcome.ending).toEqual({ kind: "report", complete: false, stoppedReason: "spend_ceiling" });

        expect(withFreeBounds.length, "ADR-021: no third parameter is exposed").toBe(2);

        const source = (await import("node:fs")).readFileSync(
          (await import("node:path")).resolve(import.meta.dirname, "../../../src/lib/scan/ceilings.ts"),
          "utf8"
        );
        for (const forbidden of ["override", "raise", "extra", "grace", "allowOverrun"]) {
          expect(
            new RegExp(`\\b${forbidden}\\b`, "i").test(source),
            `ADR-021: "${forbidden}" must not appear in src/lib/scan/ceilings.ts`
          ).toBe(false);
        }
      }
    );

    it('ceilings/ending · "never an error, a hang, or a refusal" [ADR-021]', async () => {
      // Over both ceilings and over a body that throws, that hangs, and
      // that returns partially: the ending is always `kind: 'report'`.
      const scenarios: Array<{
        label: string;
        arrange: () => void;
        body: (bounds: Bounds) => Promise<unknown>;
        advanceMs?: number;
      }> = [
        {
          label: "spend ceiling, body throws",
          arrange: () => activeCost.setCapHit(true),
          body: async () => {
            throw new Error("vendor call failed");
          },
        },
        {
          label: "spend ceiling, body returns partially",
          arrange: () => activeCost.setCapHit(true),
          body: async () => "partial",
        },
        {
          label: "time ceiling, body throws",
          arrange: () => {},
          // Throws only once it has itself waited out the deadline — a
          // body that throws *before* the deadline race settles would
          // race the assertion, not the ceiling (this file's own
          // "failed means nothing was determined" suite covers that
          // case, where no ceiling is in play at all).
          body: async () => {
            await new Promise((resolve) => setTimeout(resolve, CEILING_MS));
            throw new Error("vendor call failed");
          },
          advanceMs: CEILING_MS,
        },
        {
          label: "time ceiling, body hangs forever",
          arrange: () => {},
          body: () => never<unknown>(),
          advanceMs: CEILING_MS,
        },
      ];

      for (const scenario of scenarios) {
        vi.useFakeTimers();
        activeCost = makeCostStub();
        vi.mocked(withCostContext).mockImplementation(
          (async (_ctx: unknown, body: (cost: unknown) => unknown) => body(activeCost)) as typeof withCostContext
        );
        scenario.arrange();

        const promise = withFreeBounds({ scanId: `scan-scenario-${scenario.label}`, startedAt: startedNow() }, scenario.body);
        if (scenario.advanceMs) await vi.advanceTimersByTimeAsync(scenario.advanceMs);
        const outcome = await promise;

        expect(outcome.ending.kind, `${scenario.label}: expected a report ending [ADR-021]`).toBe("report");
        vi.useRealTimers();
      }
    });
  }
);

// ── REQ-003 c4 ────────────────────────────────────────────────────────

describe(
  'REQ-003 c4 — "Given a scan that cannot complete at all, when it ends, then the visitor is told in one written line that the measurement failed and is offered a manual retry (the retry window is REQ-001\'s)."',
  () => {
    it("ceilings/ending · failed means nothing was determined", async () => {
      const outcome = await withFreeBounds({ scanId: "scan-5", startedAt: startedNow() }, async () => {
        throw new Error("every driver ended unmeasured/undeterminable");
      });
      expect(outcome.ending).toEqual({ kind: "no_report", stoppedReason: "failed" });
    });

    it("ceilings/ending · a run with any not_attempted anywhere yields a report ending, never failed", async () => {
      activeCost.setCapHit(true);
      const outcome = await withFreeBounds({ scanId: "scan-6", startedAt: startedNow() }, async () => {
        throw new Error("threw after a ceiling had already fired");
      });
      expect(outcome.ending.kind).toBe("report");
      expect(outcome.ending.kind).not.toBe("no_report");
    });
  }
);

// ── REQ-003's non-goal ────────────────────────────────────────────────

describe('REQ-003\'s non-goal — "No spend, cost or cap figure shown to a visitor."', () => {
  it("ceilings/observability · no cost figure leaves this module toward a surface", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    activeCost.setSpentCents(7);
    activeCost.setDegraded(true);
    const outcome = await withFreeBounds({ scanId: "scan-7", startedAt: startedNow() }, async () => "ok");

    const endingJson = JSON.stringify(outcome.ending);
    expect(endingJson.toLowerCase()).not.toMatch(/cent|cost|cap|spend/);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(consoleSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(logged.event).toBe("scan_ending");
    expect(logged.costCents).toBe(7);
    expect(logged.degraded).toBe(true);
    expect(logged.stoppedReason).toBe("complete");
    expect(typeof logged.elapsedMs).toBe("number");

    consoleSpy.mockRestore();
  });
});

// ── REQ-003 c2 ────────────────────────────────────────────────────────

describe(
  'REQ-003 c2 — "Given any 100 consecutive free scans of reachable domains … then no more than 5 of those 100 take longer than 60 seconds, and none takes longer than the 90 seconds of criterion 5."',
  () => {
    it("ceilings/time · the hard stop is absolute over a batch", async () => {
      vi.useFakeTimers();
      const start = new Date();
      // 100 simulated vendor latencies, spread from instant to well past
      // the ceiling — a fixture distribution, not a live measurement
      // (this criterion's own 60 s p95 half is a claim about real vendor
      // latency and is not testable here; `SPEC.md` §16 milestone 3 is,
      // this WO's own first `rests-on` row).
      const latenciesMs = Array.from({ length: 100 }, (_, i) => (i % 10) * (CEILING_MS / 5));
      const promises = latenciesMs.map((latency) =>
        withFreeBounds({ scanId: `batch-${latency}-${Math.random()}`, startedAt: start }, async () => {
          await delayFake(latency);
          return "measured";
        })
      );
      await vi.advanceTimersByTimeAsync(CEILING_MS + 1);
      const outcomes = await Promise.all(promises);
      expect(outcomes).toHaveLength(100);
      for (const { ending } of outcomes) {
        expect(ending.stoppedReason).not.toBe(undefined);
        if (ending.stoppedReason === "time_ceiling") {
          expect(ending.complete).toBe(false);
        } else {
          // Resolved inside the ceiling — never past it, by construction:
          // `withFreeBounds` races every call against the same pinned
          // deadline regardless of how long `body` itself takes.
          expect(ending.stoppedReason).toBe("complete");
        }
      }
    });
  }
);

function delayFake(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Issue #479 — a pass that read nothing of the site is never `complete` ──

describe("issue #479 — `siteUnreadable` ends the pass with its cause, not `complete`", () => {
  it("ceilings/site · a body that could not read the site ends `site_unreadable`, carrying the refusal", async () => {
    const outcome = await withFreeBounds({ scanId: "scan-479", startedAt: startedNow() }, async (bounds: Bounds) => {
      bounds.siteUnreadable("too_large");
      return "stopped after the first stage";
    });
    expect(outcome.ending).toEqual({
      kind: "report",
      complete: false,
      stoppedReason: "site_unreadable",
      refusal: "too_large",
    });
    expect(outcome.result).toBe("stopped after the first stage");
  });

  it("ceilings/site · a ceiling that fired outranks it — a ceiling always produces its own ending (ADR-021)", async () => {
    const outcome = await withFreeBounds({ scanId: "scan-479b", startedAt: startedNow() }, async (bounds: Bounds) => {
      bounds.siteUnreadable("timeout");
      activeCost.setCapHit(true);
      return null;
    });
    expect(outcome.ending).toEqual({ kind: "report", complete: false, stoppedReason: "spend_ceiling" });
  });

  it("ceilings/site · the one ending line names it, with the refusal beside the reason", async () => {
    const lines: unknown[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      lines.push(line);
    });
    try {
      await withFreeBounds({ scanId: "scan-479c", startedAt: startedNow() }, async (bounds: Bounds) => {
        bounds.siteUnreadable(null);
      });
    } finally {
      spy.mockRestore();
    }
    const ending = lines.map((l) => JSON.parse(String(l)) as Record<string, unknown>).find((l) => l.event === "scan_ending");
    expect(ending).toMatchObject({ stoppedReason: "site_unreadable", refusal: null });
  });
});
