// SPEC §7 (D41 stage 4) — the one fix call, or why it was not made: a page the budget or the clock left without it
// is stopped for that, not for its rules, and the day says so.
import { PIPELINE } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import type { Measured } from "@/lib/measure/measured";

/** Why a page stopped as written had no fix call: the cap or the day's budget refused it, or the job had no time
 *  left for it. */
export type FixStop = "budget" | "time";

/** The fix call where the money and the time allow it, and why not where they did not. A futile call is skipped
 *  with no stop: the page is stopped for its rules. */
export async function tryFix<T>(
  c: CostContext,
  a: { futile: boolean; startedAt: number; call: () => Promise<Measured<T>> }
): Promise<{ again: Measured<T> | null; stop: FixStop | null }> {
  const before: FixStop | null = a.futile ? null : c.capHit() ? "budget" : Date.now() - a.startedAt < PIPELINE.fixBeforeMs ? null : "time";
  const again = a.futile || before !== null ? null : await a.call();
  // `not_attempted` is the ledger refusing the call's reservation.
  return { again, stop: again?.kind === "unmeasured" && again.reason === "not_attempted" ? "budget" : before };
}
