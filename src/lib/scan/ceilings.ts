// The two ceilings on one scan, `TIMING.reportCeilingS` and the spend cap, and exactly one `Ending` however a free scan stops.
// Neither ceiling is raised at runtime and no partial result is computed from what a ceiling left: `withFreeBounds` has no third parameter, environment escape or per-scan exemption.
// Time is preemptive (the body may be stuck in a call that never resolves, so it is raced); money is cooperative, read between calls through `stopNow()`/`capHit()`. Time is checked first.
// `withFreeBounds` opens its own cost context, so `capHit()` reaches it without a third parameter.
import { TIMING } from "@/lib/config/constants";
import { CAP_VALUES, withCostContext, type CapName, type CostContext, type FetchRefusalReason } from "@/lib/costs";

/** A free scan reaches exactly one ending. */
export type Ending =
  | { kind: "report"; complete: true; stoppedReason: "complete" }
  | { kind: "report"; complete: false; stoppedReason: "time_ceiling" | "spend_ceiling" }
  /** The body read nothing of the customer's own site and stopped there: `refusal` is the fetcher's reason, or `null` where the read raised
   *  (its reason is then the `stage_undeterminable` line). Never called `complete`. */
  | { kind: "report"; complete: false; stoppedReason: "site_unreadable"; refusal: FetchRefusalReason | null }
  | { kind: "no_report"; stoppedReason: "failed" };

/** The deadline every stage and multi-call step re-checks between calls, as `capHit()` is. */
export interface Bounds {
  expired(): boolean; // now ≥ startedAt + the pass's own ceiling (the free path's: TIMING.reportCeilingS)
  remainingMs(): number;
  capHit(): boolean; // delegates to the CostContext, CAP_FREE
  /** Cents left before the pass's cap (or the stage's budget), so a step can ask whether its next purchase fits. */
  remainingCents(): number;
  stopNow(): "time_ceiling" | "spend_ceiling" | null;
  /** Called when the first stage could not read the site's home document. Not a ceiling: the pass ends `site_unreadable` where no ceiling fired first. */
  siteUnreadable(refusal: FetchRefusalReason | null): void;
  /** What `siteUnreadable` recorded, or `undefined` where it was never called. */
  unreadable(): { refusal: FetchRefusalReason | null } | undefined;
  /** Called when a stage the pass cannot continue without spent its own budget: the pass ends bounded by that column; a pass ceiling still outranks it. */
  stageExhausted(reason: "time_ceiling" | "spend_ceiling"): void;
  /** What `stageExhausted` recorded, or `undefined` where it was never called. */
  exhausted(): "time_ceiling" | "spend_ceiling" | undefined;
  /** True once the pass's deadline won the race: the report is composed from `sections` then, so an uncancellable stage still in flight writes nothing.
   *  False for a pass the deadline does not apply to, and for a body that settled first. */
  abandoned(): boolean;
}

// The generation the free scan's cache reads are keyed against; bumping it ages out every free-scan cache entry.
export const FREE_SCAN_POLICY_VERSION = 1;

/** The slice of `CostContext` a `Bounds` needs, so `makeBounds` cannot reach `recordFetch`. */
interface CapReader {
  capHit(): boolean;
  spentCents(): number;
  readonly cap: CapName;
}

/** The clock is a parameter here, never a global read inside the methods, so a test can build `Bounds` on a fake clock. */
function makeBounds(a: {
  startedAt: Date;
  ceilingS: number;
  clock: () => Date;
  cost: CapReader;
  holdBackCents: number;
}): Bounds & { abandon(): void } {
  // The pass's own ceiling: a deep pass runs in a job invocation and must not stop at the free report's.
  const deadlineMs = a.startedAt.getTime() + a.ceilingS * 1000;
  let unreadable: { refusal: FetchRefusalReason | null } | undefined;
  let exhausted: "time_ceiling" | "spend_ceiling" | undefined;
  let abandoned = false;
  const bounds: Bounds & { abandon(): void } = {
    expired(): boolean {
      return a.clock().getTime() >= deadlineMs;
    },
    remainingMs(): number {
      return Math.max(0, deadlineMs - a.clock().getTime());
    },
    capHit(): boolean {
      return a.cost.capHit();
    },
    remainingCents(): number {
      return Math.max(0, CAP_VALUES[a.cost.cap] - a.holdBackCents - a.cost.spentCents());
    },
    stopNow(): "time_ceiling" | "spend_ceiling" | null {
      if (bounds.expired()) return "time_ceiling";
      if (bounds.capHit()) return "spend_ceiling";
      return null;
    },
    siteUnreadable(refusal: FetchRefusalReason | null): void {
      unreadable = { refusal };
    },
    unreadable() {
      return unreadable;
    },
    stageExhausted(reason: "time_ceiling" | "spend_ceiling"): void {
      exhausted = reason;
    },
    exhausted() {
      return exhausted;
    },
    abandoned() {
      return abandoned;
    },
    // Not on `Bounds`: only the race below may say nobody is waiting, so a
    // stage handed these bounds cannot abandon its own pass.
    abandon(): void {
      abandoned = true;
    },
  };
  return bounds;
}

/** A delay that can be cleared, as in `budgets.ts`: an uncleared timer holds the invocation open after a body that answered early. */
function cancellableDelay(ms: number): { promise: Promise<void>; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms);
  });
  return { promise, cancel: () => clearTimeout(timer) };
}

/** Runs `body` and settles one `Ending`: a ceiling fired → incomplete report whatever `body` did; `stageExhausted` → incomplete, by that column;
 *  `siteUnreadable` → `site_unreadable`; resolved → complete; threw with no ceiling → `no_report` `failed`. */
async function runBounded<T>(
  a: { startedAt: Date; ceilingS: number; cost: CostContext; deadlineApplies: boolean; holdBackCents: number },
  body: (b: Bounds, c: CostContext) => Promise<T>
): Promise<{ result: T | null; ending: Ending }> {
  const bounds = makeBounds({
    startedAt: a.startedAt,
    ceilingS: a.ceilingS,
    clock: () => new Date(),
    cost: a.cost,
    holdBackCents: a.holdBackCents,
  });

  const bodyOutcome: Promise<{ result: T | null; ending: Ending }> = (async () => {
    try {
      const result = await body(bounds, a.cost);
      const stopped = bounds.stopNow();
      if (stopped) return { result, ending: { kind: "report" as const, complete: false as const, stoppedReason: stopped } };
      // A stage the pass cannot continue without spent its own budget: the pass is bounded by that column.
      const exhausted = bounds.exhausted();
      if (exhausted)
        return { result, ending: { kind: "report" as const, complete: false as const, stoppedReason: exhausted } };
      const unread = bounds.unreadable();
      return unread
        ? {
            result,
            ending: {
              kind: "report" as const,
              complete: false as const,
              stoppedReason: "site_unreadable" as const,
              refusal: unread.refusal,
            },
          }
        : { result, ending: { kind: "report" as const, complete: true as const, stoppedReason: "complete" as const } };
    } catch {
      const stopped = bounds.stopNow() ?? bounds.exhausted();
      return stopped
        ? { result: null, ending: { kind: "report" as const, complete: false as const, stoppedReason: stopped } }
        : { result: null, ending: { kind: "no_report" as const, stoppedReason: "failed" as const } };
    }
  })();

  // A paid pass is not raced (nobody waits on it): its own `ceilingS` is read between calls, and no timer may abandon its body.
  if (!a.deadlineApplies) return bodyOutcome;

  const timer = cancellableDelay(bounds.remainingMs());
  const deadlineOutcome: Promise<{ result: T | null; ending: Ending }> = (async () => {
    await timer.promise;
    // The losing body cannot be cancelled, so it is told; flipped at the timer so no write lands between the race and the caller's compose.
    bounds.abandon();
    return {
      result: null,
      ending: { kind: "report" as const, complete: false as const, stoppedReason: "time_ceiling" as const },
    };
  })();

  try {
    return await Promise.race([bodyOutcome, deadlineOutcome]);
  } finally {
    timer.cancel();
  }
}

/** One line per ending: `stoppedReason`, elapsed ms, cents and whether the cost context degraded. The figures leave this module only here. */
function logEnding(a: { scanId: string; ending: Ending; elapsedMs: number; cost: CostContext }): void {
  console.log(
    JSON.stringify({
      event: "scan_ending",
      scanId: a.scanId,
      stoppedReason: a.ending.stoppedReason,
      ...(a.ending.stoppedReason === "site_unreadable" ? { refusal: a.ending.refusal } : {}),
      elapsedMs: a.elapsedMs,
      costCents: a.cost.spentCents(),
      degraded: a.cost.degraded(),
    })
  );
}

/** Runs `body` and on either ceiling stops and returns a `report` ending; the caller marks what is outstanding `not_attempted`. No third parameter, environment escape or per-scan exemption. */
export async function withFreeBounds<T>(
  a: { scanId: string; startedAt: Date },
  body: (b: Bounds, c: CostContext) => Promise<T>
): Promise<{ result: T | null; ending: Ending }> {
  return withScanBounds(
    { scanId: a.scanId, startedAt: a.startedAt, cap: "FREE", ceilingS: TIMING.reportCeilingS, deadlineApplies: true },
    body
  );
}

/** The same two-ceiling shape for a pass whose cap and time ceiling are not the free path's, its deadline read between calls rather than raced. */
export async function withScanBounds<T>(
  a: {
    scanId: string;
    startedAt: Date;
    cap: CapName;
    /** The pass's time ceiling: `TIMING.reportCeilingS` free, `TIMING.paidPassCeilingS` paid. */
    ceilingS: number;
    deadlineApplies: boolean;
    priorCents?: number;
    /** Cents of the cap the stages leave for the spend after the stored report. */
    holdBackCents?: number;
    failsWhenFundsRefused?: true;
  },
  body: (b: Bounds, c: CostContext) => Promise<T>
): Promise<{ result: T | null; ending: Ending }> {
  return withCostContext(
    {
      scanId: a.scanId,
      cap: a.cap,
      policyVersion: FREE_SCAN_POLICY_VERSION,
      ...(a.priorCents === undefined ? {} : { priorCents: a.priorCents }),
      holdBackCents: a.holdBackCents ?? 0,
      ...(a.failsWhenFundsRefused === true ? { failsWhenFundsRefused: true } : {}),
    },
    async (cost) => {
      const outcome = await runBounded(
        {
          startedAt: a.startedAt,
          ceilingS: a.ceilingS,
          cost,
          deadlineApplies: a.deadlineApplies,
          holdBackCents: a.holdBackCents ?? 0,
        },
        body
      );
      logEnding({ scanId: a.scanId, ending: outcome.ending, elapsedMs: Date.now() - a.startedAt.getTime(), cost });
      return outcome;
    }
  );
}

/** The context a paid pass spends in once its report is stored (the §6.3 opportunity typing): keyed to the pass's row, so it counts in `scans.cost_cents` and against the same cap. */
export function withStoredPassSpend<T>(
  a: { scanId: string; cap: CapName },
  body: (c: CostContext) => Promise<T>
): Promise<T> {
  return withCostContext(
    { scanId: a.scanId, cap: a.cap, policyVersion: FREE_SCAN_POLICY_VERSION, rollUp: "add" },
    body
  );
}
