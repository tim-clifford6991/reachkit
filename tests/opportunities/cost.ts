// tests/opportunities/cost.ts — a `CostContext` these suites control.
//
// Not a suite. `recordFetch` is the seam every model call in the engine
// goes through, so a suite that wants to know whether the engine called a
// model asks this: `sources` is the call-site list, in order, and it is
// empty for every derivation that made none.
import "./env";
import type { CostContext } from "../../src/lib/costs";

export interface FakeCost {
  ctx: CostContext;
  sources: string[];
}

/** Records every `recordFetch`, runs it, and never caps. `payload` is what
 *  `run()` returned — so `llm()`'s own parse-and-degrade path runs for
 *  real above it. */
export function fakeCost(over: { capHit?: () => boolean } = {}): FakeCost {
  const sources: string[] = [];
  const ctx: CostContext = {
    cap: "DEEP",
    async recordFetch<P>(call: {
      source: string;
      cacheKey: string;
      freshnessDays: number;
      costCents: number;
      settleCents?: (payload: P) => number;
      run: () => Promise<P>;
    }) {
      sources.push(call.source);
      const payload = await call.run();
      const costCents = call.settleCents ? call.settleCents(payload) : call.costCents;
      return { payload, fresh: true, costCents };
    },
    capHit: over.capHit ?? (() => false),
    spentCents: () => 0,
    degraded: () => false,
  };
  return { ctx, sources };
}

/** A context whose cap is already spent: `recordFetch` never calls `run()`,
 *  exactly `withCostContext`'s own `{ skipped: 'cap' }` path. */
export function cappedCost(): FakeCost {
  const sources: string[] = [];
  const ctx: CostContext = {
    cap: "DEEP",
    async recordFetch<P>(call: { source: string; run: () => Promise<P> }) {
      sources.push(call.source);
      return { skipped: "cap" as const };
    },
    capHit: () => true,
    spentCents: () => 9999,
    degraded: () => true,
  };
  return { ctx, sources };
}
