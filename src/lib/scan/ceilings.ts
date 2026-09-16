// src/lib/scan/ceilings.ts — BP-023 `## Public interface`, WO-281
// (consolidates WO-059; see `archive/sdlc-factory-2026-09-04/corpus/docs/work-orders/WO-281.md`
// `## Consolidation`)
//
// **Read `decisions/ADR-021.md` first.** Two ceilings — the pinned
// `TIMING.reportCeilingS` and the free path's spend cap
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
// **Time is preemptive; money is cooperative.** The deadline can
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
// **The pin, and only the pin.** REQ-003 c5 states that bound as 90
// seconds and this file used to repeat the figure in prose. It is 50 now
// (master ruling 2026-09-10, issue #456): the invocation this runs inside
// is frozen by the platform at 60, so a design ceiling above that could
// never fire and the partial report the criterion promises could never be
// stored. Nothing here spells a number — the deadline is read from
// `TIMING.reportCeilingS`, and the order of the two ceilings is held by
// `tests/scan/ceilings-pins.test.ts`.
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
import { withCostContext, type CapName, type CostContext, type FetchRefusalReason } from "@/lib/costs";

/** REQ-003's "bounded moment", made total. A free scan reaches exactly one. */
export type Ending =
  | { kind: "report"; complete: true; stoppedReason: "complete" }
  | { kind: "report"; complete: false; stoppedReason: "time_ceiling" | "spend_ceiling" }
  /** The body read nothing of the customer's own site and stopped there
   *  (issue #479): `refusal` is the fetcher's reason, or `null` where the
   *  read raised rather than being refused (its reason is then the
   *  `stage_undeterminable` line). Never called `complete`. */
  | { kind: "report"; complete: false; stoppedReason: "site_unreadable"; refusal: FetchRefusalReason | null }
  | { kind: "no_report"; stoppedReason: "failed" };

/** The deadline every stage and every multi-call step re-checks, exactly as
 *  BP-007's `capHit()` is re-checked between calls. */
export interface Bounds {
  expired(): boolean; // now ≥ startedAt + TIMING.reportCeilingS
  remainingMs(): number;
  capHit(): boolean; // delegates to the CostContext, CAP_FREE
  stopNow(): "time_ceiling" | "spend_ceiling" | null;
  /** Called by the body when its first stage could not read the site's own
   *  home document, before it stops (issue #479). Not a ceiling: the pass
   *  ends `site_unreadable` where no ceiling fired first. */
  siteUnreadable(refusal: FetchRefusalReason | null): void;
  /** What `siteUnreadable` recorded, or `undefined` where it was never called. */
  unreadable(): { refusal: FetchRefusalReason | null } | undefined;
  /** Called by the body when a stage the pass cannot continue without spent
   *  that stage's own budget (issue #539): the pass ends bounded, by the
   *  column that ran out. A ceiling the pass itself hit still outranks it. */
  stageExhausted(reason: "time_ceiling" | "spend_ceiling"): void;
  /** What `stageExhausted` recorded, or `undefined` where it was never called. */
  exhausted(): "time_ceiling" | "spend_ceiling" | undefined;
  /** `true` from the moment the pass's deadline won the race against the
   *  body (issue 607). The report is composed from `sections` from then on,
   *  so a stage still in flight — nothing here can cancel it — checks this
   *  before every write and writes nothing. `false` for the life of a pass
   *  the deadline does not apply to, and for a body that settled first. */
  abandoned(): boolean;
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
export const FREE_SCAN_POLICY_VERSION = 1;

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
function makeBounds(a: { startedAt: Date; clock: () => Date; cost: CapReader }): Bounds & { abandon(): void } {
  const deadlineMs = a.startedAt.getTime() + TIMING.reportCeilingS * 1000;
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

/** A delay that can be cleared — `budgets.ts`'s own shape, for the same
 *  reason: an uncleared timer holds the invocation open for the rest of
 *  the ceiling after a body that answered early. */
function cancellableDelay(ms: number): { promise: Promise<void>; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms);
  });
  return { promise, cancel: () => clearTimeout(timer) };
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
 *   - no ceiling fired and `body` resolved having called `stageExhausted`
 *     → `{ kind: 'report', complete: false, stoppedReason }` carrying the
 *     column that stage ran out of (issue #539).
 *   - no ceiling fired, `body` resolved and called `siteUnreadable` →
 *     `{ kind: 'report', complete: false, stoppedReason: 'site_unreadable',
 *     refusal }` (issue #479 — a pass that read nothing is never
 *     `complete`).
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
      if (stopped) return { result, ending: { kind: "report" as const, complete: false as const, stoppedReason: stopped } };
      // A stage the pass cannot continue without spent its own budget: the
      // pass is bounded by that column, and its report is not whole (#539).
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

  // The deep pass is released at ten minutes rather than stopped, and the
  // weekly pass runs on the standard queue; for both, the spend cap
  // re-checked between stages is the whole of the bound, so there is no
  // timer to race against. `bounds.expired()` is `false` for the life of
  // such a pass and `stopNow()` reads the cap alone. No timer is even set
  // for one: a deadline that cannot end the pass must not be able to
  // abandon its body either (issue 607).
  if (!a.deadlineApplies) return bodyOutcome;

  const timer = cancellableDelay(bounds.remainingMs());
  const deadlineOutcome: Promise<{ result: T | null; ending: Ending }> = (async () => {
    await timer.promise;
    // **The losing body cannot be cancelled, so it is told** (issue 607) —
    // `withStageBudget`'s rule one level up. The caller composes the report
    // from `sections` as soon as this resolves; flipped here, at the
    // timer, rather than after the race settles, so no worker's write can
    // land in the microtasks between the two.
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
      ...(a.ending.stoppedReason === "site_unreadable" ? { refusal: a.ending.refusal } : {}),
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
