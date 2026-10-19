// BUILD §7 — a month deep, out of evidence the pass already bought.
//
// §14's first compliance guardrail: "Volume follows supply (§7) — the
// anti-scaled-content-abuse control." Pursuing depth means deriving every
// opportunity the scan's own measurements support, and then stopping. It
// **buys nothing**: no extra SERP, no extra ranked-keywords call, no
// raised cap and no lowered winnability bar. Where the evidence runs out
// before a month of days does, the answer is a shorter calendar and a
// truthful line — never a padded month.
//
// Depth is a disclosure, never a gate. `stop: 'evidence_spent'` with
// `unused: 4` is a normal return; nothing here can hold setup, delay
// arrival, or change what the customer is released into. The only throw is
// a database error.
import { SUPPLY_TARGET_DEPTH } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { deriveOpportunities, type DeriveInput } from "../derive";
import { assessReadiness } from "../readiness";
import { refillSupply } from "./refill";

/** Why the pursuit stopped. The distribution of this across passes is the
 *  first place a systematic shortfall in yield becomes visible — which is
 *  the reason it is a value and not a log line. */
export type DepthStop = "target_met" | "evidence_spent" | "pass_ended_early";

export async function pursueDepth(
  c: CostContext,
  a: DeriveInput & { target?: number }
): Promise<{ unused: number; stop: DepthStop; created: number }> {
  const target = a.target ?? SUPPLY_TARGET_DEPTH;

  // The cap may already have been reached by the measurement stages that
  // ran before this one. Checked before the derivation rather than after,
  // so a pass that has no money left spends none here.
  if (c.capHit()) {
    // The refill spends nothing, so a pass out of money still takes it.
    const { unused, added } = await refillSupply({ ...a, spare: [], refused: [] });
    return { unused, stop: "pass_ended_early", created: added };
  }

  // One derivation, not a loop. The report is a fixed set of measurements
  // and the derivation is a total function of it: running it twice over
  // the same blob produces the same candidates, which the partial unique
  // index then refuses as duplicates. A loop here would buy nothing and
  // would spend a model call per turn.
  const { created, spare, refused } = await deriveOpportunities(c, a);
  // SPEC §6: depth is ready supply, so every open row has its answer before
  // it is counted.
  await assessReadiness(a.siteId, { at: a.report.verdict.measuredAt });
  // Issue 1549: two weeks of writable days, from what buyers asked, at 0¢.
  const refilled = await refillSupply({ ...a, spare, refused });
  const unused = refilled.unused;
  const made = created.length + refilled.added;

  const stop: DepthStop =
    unused >= target ? "target_met" : c.capHit() ? "pass_ended_early" : "evidence_spent";
  logDepth({ siteId: a.siteId, scanId: a.scanId, stop, unused, created: made });
  return { unused, stop, created: made };
}

function logDepth(fields: {
  siteId: string;
  scanId: string;
  stop: DepthStop;
  unused: number;
  created: number;
}): void {
  console.log(JSON.stringify({ event: "supply_depth", ...fields }));
}
