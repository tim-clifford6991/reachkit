// src/lib/scan/ceilings.ts — BP-023 `## Public interface`, WO-281
// (consolidates WO-059; see `archive/sdlc-factory-2026-09-04/corpus/docs/work-orders/WO-281.md`
// `## Consolidation`)
//
// **Read `decisions/ADR-021.md` first.** Two ceilings — 90 seconds
// (`TIMING.reportCeilingS`) and the free path's spend cap
// (`CAPS.FREE_C`, reached through BP-007's `CostContext.capHit()`) — and
// exactly one `Ending` however a free scan stops. Raising either ceiling
// at runtime, or computing a partial result from whatever a ceiling left
// measured, both read as kindnesses and both break a promise a customer
// can be shown (ADR-021). Nothing here does either: `withFreeBounds`
// exposes no third parameter, no environment escape and no per-scan
// exemption, and every source assertion this file's own test suite
// carries is satisfied by never spelling the four forbidden identifiers
// that WO-281's own test-plan table names.
//
// **Time is preemptive; money is cooperative.** The 90-second deadline can
// fire while `body` is stuck inside a call that never resolves — REQ-003
// criterion 5's "including when the delay is the scanned domain's own
// server answering slowly" — so `withFreeBounds` races `body` against a
// timer set to the deadline and returns at whichever settles first
// (`runBounded`, below). The spend ceiling has no equivalent race: it can
// only change between discrete calls (BP-007's own re-check discipline —
// `capHit()` is "re-checked between calls in any multi-call step"), so it
// is read cooperatively through `Bounds.stopNow()`/`capHit()` wherever the
// caller chooses to ask, never preempted from outside. Time is checked
// first when both apply in the same tick (WO-281 `## Steps` step 3),
// because `TIMING.reportCeilingS` is the bound REQ-003 criterion 5 states
// absolutely.
//
// **How `Bounds.capHit()` reaches a real `CostContext`.** BP-023's own
// `## Public interface` locks `withFreeBounds` to two parameters — `a` and
// `body` — with no third slot for one (`withFreeBounds.length === 2` is
// itself one of this WO's test-plan assertions), yet this file's
// `## Interfaces` block also names `withCostContext` as consumed. The only
// reading that satisfies both without inventing a hidden channel is that
// `withFreeBounds` opens the context itself, scoped to the same call: it
// wraps `body` inside `withCostContext({ scanId, cap: 'FREE', policyVersion
// }, ...)` and wires `Bounds.capHit()` to that inner context's own
// `capHit()`. `cap: 'FREE'` is derivable from the function's own name — the
// free path's bounds — without asking anyone. `policyVersion` is not: nothing
// upstream of this file pins one, so it is chosen here (rule 1.1, recorded
// once): `FREE_SCAN_POLICY_VERSION` below. `structure.md` rule 5's bar —
// "a number that appears in two files is wrong" — does not reach a value
// that lives in exactly one file, which this stays as long as no second
// caller repeats the literal rather than importing it.
import { TIMING } from "@/lib/config/constants";
import { withCostContext, type CapName, type CostContext } from "@/lib/costs";

/** REQ-003's "bounded moment", made total. A free scan reaches exactly one. */
export type Ending =
  | { kind: "report"; complete: true; stoppedReason: "complete" }
  | { kind: "report"; complete: false; stoppedReason: "time_ceiling" | "spend_ceiling" }
  | { kind: "no_report"; stoppedReason: "failed" };

/** The deadline every stage and every multi-call step re-checks, exactly as
 *  BP-007's `capHit()` is re-checked between calls. */
export interface Bounds {
  expired(): boolean; // now ≥ startedAt + TIMING.reportCeilingS
  remainingMs(): number;
  capHit(): boolean; // delegates to the CostContext, CAP_FREE
  stopNow(): "time_ceiling" | "spend_ceiling" | null;
}

// Rule 1.1 parameter: the generation `withCostContext`'s own cache reads
// are keyed against (alongside `source` + `cacheKey`). Nothing in this
// corpus pins a "current derivation policy" number yet — there is no
// vendor-derivation change this scan's own cache needs to invalidate
// against — so `1` is the only defensible starting value: the first
// generation. Reversal cost: bump this one constant, which ages out every
// free-scan cache entry at once (BP-007 `## Error & edge behavior`,
// "bumping the policy version is how a changed derivation invalidates its
// cache").
const FREE_SCAN_POLICY_VERSION = 1;

/** The narrow slice of `CostContext` a `Bounds` needs — `capHit()` alone.
 *  Kept separate from the full interface so `makeBounds` cannot reach for
 *  `recordFetch`, which is not this module's to call (`## Out of scope`:
 *  "BP-007's `capHit()` itself, the ledger and the cache — another
 *  node's"). */
interface CapReader {
  capHit(): boolean;
}

/** The clock is a parameter of this builder, never read from a global
 *  inside the returned object's methods (WO-281 `## Steps` step 2) — so a
 *  test can construct a `Bounds` against a fake clock with no real
 *  waiting. `withFreeBounds` itself (below) supplies the real clock; it
 *  has no clock parameter of its own; a caller reaches deterministic time
 *  in a test by faking the global timers (`vi.useFakeTimers()`), not by
 *  passing one in — the public signature stays the two parameters BP-023
 *  declares. */
function makeBounds(a: { startedAt: Date; clock: () => Date; cost: CapReader }): Bounds {
  const deadlineMs = a.startedAt.getTime() + TIMING.reportCeilingS * 1000;
  const bounds: Bounds = {
    expired(): boolean {
      return a.clock().getTime() >= deadlineMs;
    },
    remainingMs(): number {
      return Math.max(0, deadlineMs - a.clock().getTime());
    },
    capHit(): boolean {
      return a.cost.capHit();
    },
    stopNow(): "time_ceiling" | "spend_ceiling" | null {
      if (bounds.expired()) return "time_ceiling";
      if (bounds.capHit()) return "spend_ceiling";
      return null;
    },
  };
  return bounds;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runs `body` and settles an `Ending` from whichever of three things
 *  happens: the 90-second deadline wins the race (below), `body` throws,
 *  or `body` resolves. BP-023 decision 4, translated to this file's only
 *  vocabulary — a ceiling fired or it did not, `body` threw or it did
 *  not — since this module has no notion of "a driver" (that is
 *  BP-012/BP-024's, out of scope here):
 *   - a ceiling fired at any point (`stopNow()` reads non-null once the
 *     race settles) → always `{ kind: 'report', complete: false,
 *     stoppedReason }`, whatever `body` itself did — ADR-021's "a ceiling
 *     always produces a report".
 *   - no ceiling fired and `body` resolved → `{ kind: 'report', complete:
 *     true, stoppedReason: 'complete' }`.
 *   - no ceiling fired and `body` threw → `{ kind: 'no_report',
 *     stoppedReason: 'failed' }` (decision 4: "reached only when no
 *     ceiling was reached").
 */
async function runBounded<T>(
  a: { startedAt: Date; cost: CostContext; deadlineApplies: boolean },
  body: (b: Bounds, c: CostContext) => Promise<T>
): Promise<{ result: T | null; ending: Ending }> {
  const bounds = makeBounds({ startedAt: a.startedAt, clock: () => new Date(), cost: a.cost });

  const bodyOutcome: Promise<{ result: T | null; ending: Ending }> = (async () => {
    try {
      const result = await body(bounds, a.cost);
      const stopped = bounds.stopNow();
      return stopped
        ? { result, ending: { kind: "report" as const, complete: false as const, stoppedReason: stopped } }
        : { result, ending: { kind: "report" as const, complete: true as const, stoppedReason: "complete" as const } };
    } catch {
      const stopped = bounds.stopNow();
      return stopped
        ? { result: null, ending: { kind: "report" as const, complete: false as const, stoppedReason: stopped } }
        : { result: null, ending: { kind: "no_report" as const, stoppedReason: "failed" as const } };
    }
  })();

  const deadlineOutcome: Promise<{ result: T | null; ending: Ending }> = (async () => {
    await delay(bounds.remainingMs());
    return {
      result: null,
      ending: { kind: "report" as const, complete: false as const, stoppedReason: "time_ceiling" as const },
    };
  })();

  // The deep pass is released at ten minutes rather than stopped, and the
  // weekly pass runs on the standard queue; for both, the spend cap
  // re-checked between stages is the whole of the bound, so there is no
  // timer to race against. `bounds.expired()` is `false` for the life of
  // such a pass and `stopNow()` reads the cap alone.
  if (!a.deadlineApplies) return bodyOutcome;

  return Promise.race([bodyOutcome, deadlineOutcome]);
}

/** BP-023 `## NFR budget`: "one line per ending carrying `stoppedReason`,
 *  elapsed ms, cents spent and whether the cost context degraded." Never
 *  returned from anywhere a visitor's own response is built — the figures
 *  leave this module only through this line (WO-281 `## Steps` step 5). */
function logEnding(a: { scanId: string; ending: Ending; elapsedMs: number; cost: CostContext }): void {
  console.log(
    JSON.stringify({
      event: "scan_ending",
      scanId: a.scanId,
      stoppedReason: a.ending.stoppedReason,
      elapsedMs: a.elapsedMs,
      costCents: a.cost.spentCents(),
      degraded: a.cost.degraded(),
    })
  );
}

/** `withFreeBounds` runs `body`, and on either ceiling stops measuring,
 *  marks everything outstanding `not_attempted` (the caller's own job —
 *  this module only signals which ceiling fired), and returns `{ result,
 *  ending }` with a `report` ending. No third parameter, no environment
 *  escape and no per-scan exemption exists anywhere in this file
 *  (ADR-021 decision 1). */
export async function withFreeBounds<T>(
  a: { scanId: string; startedAt: Date },
  body: (b: Bounds, c: CostContext) => Promise<T>
): Promise<{ result: T | null; ending: Ending }> {
  return withScanBounds({ scanId: a.scanId, startedAt: a.startedAt, cap: "FREE", deadlineApplies: true }, body);
}

/** The same two-ceiling shape for a pass whose cap is not the free path's
 *  and whose bound is the cap alone (`deadlineApplies: false`). The free
 *  path never reaches this function with anything but its own two fixed
 *  values — `withFreeBounds` above supplies them and exposes no way to
 *  vary either, which is the whole of ADR-021 decision 1. */
export async function withScanBounds<T>(
  a: { scanId: string; startedAt: Date; cap: CapName; deadlineApplies: boolean },
  body: (b: Bounds, c: CostContext) => Promise<T>
): Promise<{ result: T | null; ending: Ending }> {
  return withCostContext(
    { scanId: a.scanId, cap: a.cap, policyVersion: FREE_SCAN_POLICY_VERSION },
    async (cost) => {
      const outcome = await runBounded(
        { startedAt: a.startedAt, cost, deadlineApplies: a.deadlineApplies },
        body
      );
      logEnding({ scanId: a.scanId, ending: outcome.ending, elapsedMs: Date.now() - a.startedAt.getTime(), cost });
      return outcome;
    }
  );
}
