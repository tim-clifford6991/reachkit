// What the draft tick owes a `generating` row: a row no run is still writing is never left there.

/** Longer than a run's `write` → `review` gap, its step retries and its queue included, so a live run's row is not taken. */
export const RUN_FLOOR_MS = 2 * 60 * 60_000;

/** The `drafts.meta` key the tick sets before its one automatic rewrite, so a second interruption stops the row. */
export const REWRITTEN = "rewrittenAfterStop";

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

/** `rewrite` a restart until a run's floor after its first ask, then `stop`; `mark` (then rewrite) an interrupted row once while its date is still to come; else `stop`. */
export function owedToRow(
  row: WaitingRow & { readonly meta: unknown; readonly scheduled_for: string | null },
  now: Date,
  zone: string | null | undefined
): "rewrite" | "mark" | "stop" | null {
  const waiting = waitingForRun(row, now);
  if (waiting === "restart") return now.getTime() - askedAt(row) > RUN_FLOOR_MS ? "stop" : "rewrite";
  if (waiting !== "interrupted") return null;
  if (REWRITTEN in carriedMark(row.meta)) return "stop";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: zone ?? "UTC" }).format(now);
  return row.scheduled_for !== null && row.scheduled_for < today ? "stop" : "mark";
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

/** The marks, kept through a rewrite that replaces `meta`. */
export function carriedMark(meta: unknown): Record<string, unknown> {
  const kept = typeof meta === "object" && meta !== null ? (meta as Record<string, unknown>) : {};
  return Object.fromEntries([REWRITTEN, ASKED].filter((key) => key in kept).map((key) => [key, kept[key]]));
}

export interface DecidedDay {
  publish_date: string;
  decided_at: string | null;
}

/** The earliest day decided `drafted` before the rewrite began, still to come, before the row's date and held by no page. */
export function emptyDraftedDay(days: readonly DecidedDay[], held: ReadonlySet<string>, today: string, before: string, markedAt: string): string | null {
  const open = days.filter((d) => d.publish_date >= today && d.publish_date < before && !held.has(d.publish_date));
  return open.filter((d) => d.decided_at !== null && Date.parse(d.decided_at) <= Date.parse(markedAt)).map((d) => d.publish_date).sort()[0] ?? null;
}
