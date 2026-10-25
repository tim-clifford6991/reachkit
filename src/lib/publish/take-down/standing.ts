// SPEC §7 — a live page its customer took down, read off the draft's transitions: §9's `published → unpublished` with
// the customer as actor and reason `take_down`. Nothing else is stored, so the put-back window, its guard, the rechecks
// and the refresh planner cannot disagree. Pure: the machine's guard reads it.
import { TAKE_DOWN, TOPIC_REST_DAYS } from "@/lib/config/constants";
import type { State, TransitionRecord, UnpublishOutcome } from "../types";

/** The reason a customer's take-down is recorded under. */
export const TAKE_DOWN_REASON = "take_down";
/** The reason the customer's put-back is recorded under. */
export const PUT_BACK_REASON = "put_back";

const DAY_MS = 86_400_000;

function asRecords(transitions: unknown): readonly Partial<TransitionRecord>[] {
  return Array.isArray(transitions) ? (transitions as Partial<TransitionRecord>[]) : [];
}

function isTakeDown(record: Partial<TransitionRecord> | undefined): boolean {
  return record?.to === "unpublished" && record.reason === TAKE_DOWN_REASON && record.actor?.kind === "customer";
}

/** Whether the customer ever took this page down, put back since or not; such a page is never refreshed or re-checked. */
export function takenDownByCustomer(transitions: unknown): boolean {
  return asRecords(transitions).some(isTakeDown);
}

/** `TAKE_DOWN.PUT_BACK_DAYS` after a last move that is the customer's take-down; otherwise `null`. */
export function putBackUntil(transitions: unknown): Date | null {
  const records = asRecords(transitions);
  const last = records[records.length - 1];
  if (!isTakeDown(last) || typeof last?.at !== "string") return null;
  const at = Date.parse(last.at);
  return Number.isNaN(at) ? null : new Date(at + TAKE_DOWN.PUT_BACK_DAYS * DAY_MS);
}

/** Whether a put-back is open at `now`. */
export function canPutBack(transitions: unknown, now: Date): boolean {
  const until = putBackUntil(transitions);
  return until !== null && now.getTime() < until.getTime();
}

/** The outcomes after which the page can stand at the same address again: hosted only, since re-publishing a WordPress
 *  post is a call ADR-084 decision 1 keeps out of that client. */
export const RESTORABLE: readonly UnpublishOutcome[] = Object.freeze(["removed"] as const);

/** What the page's own screen draws: a live page with *Stop this page*, or
 *  one its customer stopped, with *Put it back* while the window is open on
 *  a hosted page; `null` for any other page. */
export type TakeDownStanding =
  | { kind: "live" }
  | { kind: "stopped"; wordpress: boolean; putBackUntil: Date | null }
  | null;

export function takeDownStanding(a: {
  state: State;
  transitions: unknown;
  /** Whether a publication of this draft is live at an address. */
  live: boolean;
  unpublishOutcome: UnpublishOutcome | null;
  now: Date;
}): TakeDownStanding {
  if (a.state === "published") return a.live ? { kind: "live" } : null;
  const records = asRecords(a.transitions);
  if (a.state !== "unpublished" || !isTakeDown(records[records.length - 1])) return null;
  const until = putBackUntil(a.transitions);
  const open = a.unpublishOutcome !== null && RESTORABLE.includes(a.unpublishOutcome) && until !== null && a.now.getTime() < until.getTime();
  return { kind: "stopped", wordpress: a.unpublishOutcome === "returned_to_draft", putBackUntil: open ? until : null };
}

/** The topics of pages the system withdrew rest for `TOPIC_REST_DAYS`, as a stopped draft's do (D26); the page is
 *  down whether or not the rows could be written. */
export async function restWithdrawn(
  deps: { rest: (draftIds: readonly string[], until: Date) => Promise<void> },
  draftIds: readonly string[],
  at: Date
): Promise<void> {
  try {
    await deps.rest(draftIds, new Date(at.getTime() + TOPIC_REST_DAYS * 86_400_000));
  } catch (error) {
    console.log(JSON.stringify({ event: "withdrawn_topic_rest_failed", draftIds, because: String(error) }));
  }
}
