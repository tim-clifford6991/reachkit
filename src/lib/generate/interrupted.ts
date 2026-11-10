// What the draft tick owes a `generating` row: a row no run is still writing is never left there.

/** Longer than a run's `write` → `review` gap, its step retries and its queue included, so a live run's row is not taken. */
export const RUN_FLOOR_MS = 2 * 60 * 60_000;

/** The `drafts.meta` key the tick sets before its one automatic rewrite, so a second interruption stops the row. */
export const REWRITTEN = "rewrittenAfterStop";

interface WaitingRow {
  readonly transitions?: unknown;
  readonly created_at: string;
}

/** The customer's restart, or a row with no moves older than any live run. */
export function waitingForRun(row: WaitingRow, now: Date): "restart" | "interrupted" | null {
  const moves: unknown[] = Array.isArray(row.transitions) ? row.transitions : [];
  const last = moves[moves.length - 1] as { from?: unknown; to?: unknown } | null | undefined;
  if (last?.from === "needs_attention" && last?.to === "generating") return "restart";
  if (moves.length > 0) return null;
  return now.getTime() - Date.parse(row.created_at) > RUN_FLOOR_MS ? "interrupted" : null;
}

/** `rewrite` a restart; `mark` (then rewrite) an interrupted row once while its date is still to come; else `stop`. */
export function owedToRow(
  row: WaitingRow & { readonly meta: unknown; readonly scheduled_for: string | null },
  now: Date,
  zone: string | null | undefined
): "rewrite" | "mark" | "stop" | null {
  const waiting = waitingForRun(row, now);
  if (waiting !== "interrupted") return waiting === "restart" ? "rewrite" : null;
  if (REWRITTEN in carriedMark(row.meta)) return "stop";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: zone ?? "UTC" }).format(now);
  return row.scheduled_for !== null && row.scheduled_for < today ? "stop" : "mark";
}

/** The mark, kept through a rewrite that replaces `meta`. */
export function carriedMark(meta: unknown): Record<string, unknown> {
  return typeof meta === "object" && meta !== null && REWRITTEN in meta ? { [REWRITTEN]: (meta as Record<string, unknown>)[REWRITTEN] } : {};
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
