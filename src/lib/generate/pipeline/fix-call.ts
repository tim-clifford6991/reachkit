// SPEC §7 (D41 stage 4) — the one fix call, or why it was not made: a page the budget or the clock left without it
// is stopped for that, not for its rules, and the day says so.
import { PIPELINE } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { measured, type Measured } from "@/lib/measure/measured";
import type { PageParts } from "./write";

/** Why a page stopped as written had no fix call: the cap or the day's budget refused it, or the job had no time
 *  left for it. */
export type FixStop = "budget" | "time";

/** The `drafts.meta` key holding the saved write's parts while the run's `fix` step owes the page its fix call. */
export const FIX_OWED = "fixOwed";

/** The fix call where the money and the time allow it, and why not where they did not. A futile call is skipped
 *  with no stop: the page is stopped for its rules. Its time runs from the saved write's start (`writtenAt`); where
 *  the step (`startedAt`) has no room left for it and the run has a `fix` step (`owe`), it is `owed` to that step. */
export async function tryFix<T>(
  c: CostContext,
  a: { futile: boolean; startedAt: number; writtenAt?: number; owe?: boolean; call: () => Promise<Measured<T>> }
): Promise<{ again: Measured<T> | null; stop: FixStop | null; owed?: true }> {
  const late = Date.now() - a.startedAt >= PIPELINE.fixBeforeMs;
  const before: FixStop | null = a.futile ? null : c.capHit() ? "budget" : Date.now() - (a.writtenAt ?? a.startedAt) >= PIPELINE.fixBeforeMs || (late && !a.owe) ? "time" : null;
  if (!a.futile && before === null && late) return { again: null, stop: null, owed: true };
  const again = a.futile || before !== null ? null : await a.call();
  // `not_attempted` is the ledger refusing the call's reservation.
  return { again, stop: again?.kind === "unmeasured" && again.reason === "not_attempted" ? "budget" : before };
}

/** On the `fix` step, the parts the write step saved, so the write is never bought again; `null` where none are held. */
export function owedParts(meta: unknown): Measured<PageParts> | null {
  const parts = (meta as Record<string, unknown> | null)?.[FIX_OWED];
  return typeof parts === "object" && parts !== null ? measured(parts as PageParts, new Date()) : null;
}
