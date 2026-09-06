// BUILD §7, §11 — the weekly top-up.
//
// §11's `weekly/refresh` re-measures every active site each Monday. What
// that re-measurement finds becomes supply here: additive only. This
// dismisses nothing, deletes nothing, re-ranks nothing and re-derives
// nothing that already exists — a re-derived target lands on the partial
// unique index and is counted as a duplicate, so two runs of the same
// week's top-up leave exactly the same supply.
//
// Access ended, nothing runs. A site whose access has lapsed gets no
// top-up and no derivation, the same shape re-measurement itself takes.
// `hasActiveAccess` is passed in rather than imported: the billing gate
// (`hasActiveAccess()`, the one symbol importable from
// `src/lib/account/billing`) is not on disk yet, and inventing a local
// second copy of the access rule is the one thing that must not happen
// here. The caller — §11's job — decides, and this module obeys.
import type { CostContext } from "@/lib/costs";
import { deriveOpportunities, type DeriveInput } from "../derive";
import { supplyDepth } from "./depth";

export async function topUp(
  c: CostContext,
  a: DeriveInput & { hasActiveAccess: boolean }
): Promise<{ added: number; unused: number }> {
  if (!a.hasActiveAccess) {
    const { unused } = await supplyDepth(a.siteId);
    return { added: 0, unused };
  }

  const { created } = await deriveOpportunities(c, a);
  const { unused } = await supplyDepth(a.siteId);
  logTopUp({ siteId: a.siteId, scanId: a.scanId, added: created.length, unused });
  return { added: created.length, unused };
}

function logTopUp(fields: {
  siteId: string;
  scanId: string;
  added: number;
  unused: number;
}): void {
  console.log(JSON.stringify({ event: "supply_topup", ...fields }));
}
