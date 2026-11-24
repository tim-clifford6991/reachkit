// What the draft tick owes a `generating` row: a row no run is still writing is never left there.
/** Longer than a run's `write` → `review` gap, its step retries and its queue included, so a live run's row is not taken. */
export const RUN_FLOOR_MS = 2 * 60 * 60_000;

/** The `drafts.meta` key set at a restart's first `research_pending`: its 2 hours run from there, never from a wait in line. */
export const ASKED = "restartAskedAt";

interface WaitingRow {
  readonly transitions?: unknown;
  readonly created_at: string;
}

/** The customer's restart, or a row with no moves older than any live run. */
export function waitingForRun(row: WaitingRow, now: Date): "restart" | "interrupted" | null {
  const last = lastMove(row);
  if (last?.from === "needs_attention" && last?.to === "generating") return "restart";
  if (last !== undefined) return null;
  return now.getTime() - Date.parse(row.created_at) > RUN_FLOOR_MS ? "interrupted" : null;
}

function lastMove(row: WaitingRow): { from?: unknown; to?: unknown; at?: unknown } | null | undefined {
  return Array.isArray(row.transitions) ? row.transitions.at(-1) : undefined;
}

/** `rewrite` a restart until a run's floor after its first ask, then `stop`; an interrupted row is stopped like any stopped page. */
export function owedToRow(row: WaitingRow & { readonly meta: unknown }, now: Date): "rewrite" | "stop" | "interrupted" | null {
  const waiting = waitingForRun(row, now);
  if (waiting === "restart") return now.getTime() - askedAt(row) > RUN_FLOOR_MS ? "stop" : "rewrite";
  return waiting;
}

/** This restart's first ask; a key left by an earlier restart, older than the last move, is not this one's. */
function askedAt(row: WaitingRow & { readonly meta: unknown }): number {
  const at = Date.parse(String(carriedMark(row.meta)[ASKED]));
  return at >= Date.parse(String(lastMove(row)?.at)) ? at : NaN;
}

/** The row's `meta` with this restart's first ask recorded, or null where it already is. */
export function withFirstAsk(row: WaitingRow & { readonly meta: unknown }, now: Date): Record<string, unknown> | null {
  return Number.isNaN(askedAt(row)) ? { ...(typeof row.meta === "object" && row.meta !== null ? row.meta : {}), [ASKED]: now.toISOString() } : null;
}

/** The restart's first ask, kept through a rewrite that replaces `meta`. */
export function carriedMark(meta: unknown): Record<string, unknown> {
  const kept = typeof meta === "object" && meta !== null ? (meta as Record<string, unknown>) : {};
  return ASKED in kept ? { [ASKED]: kept[ASKED] } : {};
}
