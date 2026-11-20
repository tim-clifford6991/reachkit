// The cost context every driver hands the product: production's caps stay out (the eval ledger is the only ceiling),
// nothing is written to a table, and each call's source and cache key are kept so a case can be labelled faithful.
import type { CostContext } from "@/lib/costs";

export interface Seen {
  source: string;
  cacheKey: string;
}

export function passThrough(seen: Seen[] = []): CostContext {
  let spent = 0;
  return {
    cap: "DRAFT",
    capHit: () => false,
    spentCents: () => spent,
    degraded: () => false,
    async recordFetch(call) {
      seen.push({ source: call.source, cacheKey: call.cacheKey });
      const payload = await call.run();
      const costCents = call.settleCents?.(payload) ?? call.costCents;
      spent += costCents;
      return { payload, fresh: true, costCents, storedAt: null };
    },
  };
}
