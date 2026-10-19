// SPEC §7 (issue 1532) — a live page its customer took down, read off the
// draft's own transitions.
//
// A take-down is §9's `published → unpublished` with the customer as actor
// and the reason `take_down`. Nothing else is stored for it: the record of
// the move is the fact, so the put-back window, the guard on its edge, the
// rechecks and the refresh planner all read the same record and cannot
// disagree about which page the customer took down. Pure, and the leaf the
// machine's guard reads, so it reaches no database.
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

/** Whether the customer ever took this page down — put back since or not.
 *  The system leaves such a page to them: it is never refreshed or
 *  re-checked again. */
export function takenDownByCustomer(transitions: unknown): boolean {
  return asRecords(transitions).some(isTakeDown);
}

/** Until when the page can be put back: its last move is the customer's
 *  take-down, and the window runs `TAKE_DOWN.PUT_BACK_DAYS` from it.
 *  `null` where the last move is anything else. */
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

/** The outcomes after which the same page can stand at the same address
 *  again: the hosted row. A WordPress post returned to draft is not among
 *  them — publishing it again is a call ADR-084 Decision 1 keeps out of
 *  that client, pending the owner (issue 1532). */
export const RESTORABLE: readonly UnpublishOutcome[] = Object.freeze(["removed"] as const);

/** What the page's own screen offers: *Take down* on a live page, *Put back*
 *  inside the window, nothing otherwise. */
export type TakeDownStanding = { kind: "take_down" } | { kind: "put_back"; until: Date } | null;

export function takeDownStanding(a: {
  state: State;
  transitions: unknown;
  /** Whether a publication of this draft is live at an address. */
  live: boolean;
  unpublishOutcome: UnpublishOutcome | null;
  now: Date;
}): TakeDownStanding {
  if (a.state === "published") return a.live ? { kind: "take_down" } : null;
  if (a.state !== "unpublished" || a.unpublishOutcome === null || !RESTORABLE.includes(a.unpublishOutcome)) return null;
  const until = putBackUntil(a.transitions);
  return until !== null && a.now.getTime() < until.getTime() ? { kind: "put_back", until } : null;
}

/** Issue 1549: the topics of pages the system withdrew rest for
 *  `TOPIC_REST_DAYS`, as a stopped draft's do (D26). The page is down
 *  whether or not the rows could be written. */
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
