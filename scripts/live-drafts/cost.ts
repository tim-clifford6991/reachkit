// scripts/live-drafts/cost.ts — the run's money.
//
// `withCostContext()` is the product's own ledger and it writes three
// database rows per call (`fetches`, the scan roll-up, the day's totals).
// This box has no Postgres, so the run supplies the `CostContext` interface
// itself: **the same arithmetic, the same order, with the writes removed.**
// What it keeps is everything the cap depends on —
//
//   * the cap is checked against the **reservation**, the most a call can
//     cost, before the call is made;
//   * the ledgered figure is the **settlement** the call site computes from
//     the vendor's own reported `usage` numbers, clamped to the reservation
//     and never above it;
//   * a refused fetch and an unbilled vendor failure ledger at zero, decided
//     by the product's own `isFetchRefusal` / `isVendorFailure`;
//   * a reservation is held until its settlement is recorded, so two calls
//     in flight are both counted against the cap.
//
// and what it drops is the three writes and the cache (nothing is cached: a
// run that served an earlier run's answer would not be a live run).
//
// Two ceilings stand over this run. `CAPS.DRAFT_C` — 45¢, the product's own
// per-draft cap — bounds each draft, exactly as it does in production. The
// run total is the owner's ruling of 2026-09-22, and it is checked twice:
// no call may carry the run past it, and **no draft is started unless the
// whole of `CAPS.DRAFT_C` still fits underneath it**, so the run can never
// stop halfway through a page it has already paid for.
//
// The unit is the ledger's cent — the one `CAPS` and `INFERENCE_PRICE_BOOK`
// are written in, which is a US cent, the currency the model is billed in.
// The owner's €1.35 is therefore checked as 135 of these; since a euro buys
// more than a dollar, a run inside 135 US cents is inside €1.35 as well.
import { CAPS } from "@/lib/config/constants";
import { isFetchRefusal, isVendorFailure, type CostContext } from "@/lib/costs";

/** One paid call, as the run records it. */
export interface LedgerRow {
  /** Which of the three drafts spent it, 1-based. */
  draft: number;
  /** The `llm()` call site — one string per pipeline step. */
  source: string;
  reservedCents: number;
  /** Settled from the vendor's own usage numbers. */
  costCents: number;
  /** The vendor's own `usage.input_tokens` / `usage.output_tokens`, as the
   *  seam reports them back through the payload. `null` where the payload
   *  carried none, which is a call that never reached the vendor. */
  tokensIn: number | null;
  tokensOut: number | null;
  durationMs: number;
}

/** A call the cap refused, and which ceiling refused it. */
export interface RefusalRow {
  draft: number;
  source: string;
  reservedCents: number;
  ceiling: "draft_cap" | "run_cap";
}

/** The payload `llm()` hands back to `recordFetch` carries the vendor's own
 *  token counts. Read defensively — this module is not the seam's owner and
 *  must not assume a shape it does not control. */
function usageOf(payload: unknown): { tokensIn: number | null; tokensOut: number | null } {
  if (payload === null || typeof payload !== "object") return { tokensIn: null, tokensOut: null };
  const blob = payload as Record<string, unknown>;
  return {
    tokensIn: typeof blob.tokensIn === "number" ? blob.tokensIn : null,
    tokensOut: typeof blob.tokensOut === "number" ? blob.tokensOut : null,
  };
}

export interface ProofLedger {
  readonly rows: readonly LedgerRow[];
  readonly refusals: readonly RefusalRow[];
  /** Everything settled so far, across every draft. */
  spentCents(): number;
  /** What is left of the run's ceiling. */
  headroomCents(): number;
  /** The owner's cap, read before a draft is opened: a draft is started only
   *  where the whole of the per-draft cap still fits under the run's total.
   *  This is what makes "refuses to start a draft that could exceed it" a
   *  property of the run rather than a hope about how cheap a page is. */
  canStartDraft(): boolean;
  /** One draft's context. `cap` is `"DRAFT"` because that is the ceiling it
   *  runs under, and the one call site that reads `cap` reads it to refuse a
   *  free-path call. */
  contextFor(draft: number): CostContext;
}

export function proofLedger(runCapCents: number): ProofLedger {
  const rows: LedgerRow[] = [];
  const refusals: RefusalRow[] = [];
  let settledCents = 0;

  function contextFor(draft: number): CostContext {
    const capValue = CAPS.DRAFT_C;
    let ledgeredCents = 0;
    let inFlightReserved = 0;
    let degraded = false;

    function spentCents(): number {
      return ledgeredCents + inFlightReserved;
    }

    return {
      cap: "DRAFT",

      async recordFetch<P>(call: {
        source: string;
        cacheKey: string;
        freshnessDays: number;
        costCents: number;
        settleCents?: (payload: P) => number;
        run: () => Promise<P>;
      }): Promise<
        // `storedAt` is the moment a served row was bought, and the product's
        // context returns it non-`null` exactly where `fresh` is `false`
        // (`src/lib/costs/index.ts`, issue #715). Nothing is cached here — a
        // run that served an earlier run's answer would not be a live run —
        // so every answer this harness returns is fresh and its `storedAt` is
        // `null`, which is the same statement the shape makes in the product.
        { payload: P; fresh: boolean; costCents: number; storedAt: Date | null } | { skipped: "cap" }
      > {
        // The run's own ceiling first, the way the product's day outranks a
        // pass's cap: a draft with headroom of its own still stops when the
        // run has none.
        if (settledCents + inFlightReserved + call.costCents > runCapCents) {
          degraded = true;
          refusals.push({ draft, source: call.source, reservedCents: call.costCents, ceiling: "run_cap" });
          return { skipped: "cap" };
        }
        // Then this draft's own cap, checked against the reservation.
        if (spentCents() + call.costCents > capValue) {
          degraded = true;
          refusals.push({ draft, source: call.source, reservedCents: call.costCents, ceiling: "draft_cap" });
          return { skipped: "cap" };
        }

        inFlightReserved += call.costCents;
        const startedMs = Date.now();
        try {
          const payload = await call.run();

          let settled = call.costCents;
          if (isFetchRefusal(payload)) {
            settled = 0;
          } else if (isVendorFailure(payload) && !payload.billed) {
            settled = 0;
          } else if (call.settleCents) {
            const proposed = call.settleCents(payload);
            // A settlement never raises a charge: clamp to the reservation.
            settled = proposed > call.costCents ? call.costCents : proposed;
          }

          ledgeredCents += settled;
          settledCents += settled;
          rows.push({
            draft,
            source: call.source,
            reservedCents: call.costCents,
            costCents: settled,
            ...usageOf(payload),
            durationMs: Date.now() - startedMs,
          });

          return { payload, fresh: true, costCents: settled, storedAt: null };
        } finally {
          inFlightReserved -= call.costCents;
        }
      },

      capHit(): boolean {
        return spentCents() >= capValue || settledCents + inFlightReserved >= runCapCents;
      },

      spentCents,

      degraded(): boolean {
        return degraded;
      },
    };
  }

  return {
    rows,
    refusals,
    spentCents: () => settledCents,
    headroomCents: () => runCapCents - settledCents,
    canStartDraft: () => settledCents + CAPS.DRAFT_C <= runCapCents + 1e-9,
    contextFor,
  };
}
