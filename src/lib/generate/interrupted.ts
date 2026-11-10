// What the draft tick owes a `generating` row: a row no run is still writing is never left there.
import { TIMING } from "@/lib/config/constants";

/** A row a run saved and then stopped on is written again by the next tick, and stopped once older than this. */
export const REWRITE_WITHIN_MS = 90 * 60_000;

/** `rewrite` for the customer's restart and for a run that saved the row and stopped, once; `stop` for one that stopped twice. */
export function owedToRow(row: { readonly transitions: unknown; readonly created_at: string }, now: Date): "rewrite" | "stop" | null {
  const moves: unknown[] = Array.isArray(row.transitions) ? row.transitions : [];
  const last = moves[moves.length - 1] as { from?: unknown; to?: unknown } | null | undefined;
  if (last?.from === "needs_attention" && last?.to === "generating") return "rewrite";
  if (moves.length > 0) return null;
  // Inside the job's own ceiling a run may still be writing it.
  const age = now.getTime() - Date.parse(row.created_at);
  if (!(age > TIMING.jobsCeilingS * 1000)) return null;
  return age <= REWRITE_WITHIN_MS ? "rewrite" : "stop";
}
