// BUILD §9 · SPEC §7 — the veto window, opened and closed by the clock: "An untouched draft publishes at window end on
// their domain." Each move is one call into the module that owns the rule.
// Opening (`enterReview`) is the draft tick's after a passing generation: stamp the deadline before the move, since the
// telling reads it, then enter review and tell the customer through `sendDraftReadyMail`.
// Closing (`dueApprovals`) is the hourly tick's: a told, publishable, due page is approved by the system and handed on;
// the claim re-asks every guard, so a held page is offered again next hour, as a due retry is (`./due.ts`).
// `publishDueAt` names the moment for one `publish/execute`, which re-enters through `dueApproval`; the tick is the backstop.
// An untold page is never approved by a clock (REQ-057 c8): it stays in review, where the customer can still stop it.
import { VETO } from "@/lib/config/constants";
import { localClock } from "@/lib/scan/weekly/week";
import { publishDb, type PublishQuery } from "../db";
import { publishDateAtOrAfter } from "../settings/clock";
import { settingsOf } from "../settings/pair";
import { machineDraftFor, transition } from "../machine";
import { becomesPublishable } from "../publishable/predicate";
import { customerTold, publishableAndDue } from "../publishable/rule";
import type { Actor, DestinationKind } from "../types";

/** One page ready for its attempt, shaped as a due retry is. */
export interface DueApproval {
  readonly draftId: string;
  readonly destinationId: string;
}

export type ReviewEntry =
  | { readonly kind: "told" }
  /** The page is in review and its window is open, but the draft-ready
   *  mail did not leave. The page is held by `customer_told` until it does. */
  | { readonly kind: "untold"; readonly reason: string }
  | { readonly kind: "not_entered"; readonly reason: "no_draft" | "not_generating" | "hard_rules" | "no_destination" | "moved" };

const MS_PER_HOUR = 3_600_000;

const OPENED_BY: Actor = { kind: "system", job: "draft/generate" };
const CLOSED_BY: Actor = { kind: "system", job: "publish/execute" };

interface DestinationRow {
  id: string;
  site_id: string;
  kind: DestinationKind;
}

/** The site's live destination — at most one, by the partial unique index. */
async function liveDestination(siteId: string): Promise<DestinationRow | null> {
  const { data, error } = await publishDb()
    .from<DestinationRow>("destinations")
    .select("id, site_id, kind")
    .eq("site_id", siteId)
    .is("deleted_at", null)
    .limit(1);
  if (error !== null || data === null) return null;
  return data[0] ?? null;
}

/** `generating → in_review`, with its window and its telling; any other state is left. With a customer as `by`, it
 *  opens from `needs_attention` (SPEC §7): their edit of a stopped page passed every hard rule. */
export async function enterReview(a: { draftId: string; at: Date; by?: Actor }): Promise<ReviewEntry> {
  const by = a.by ?? OPENED_BY;
  const from = by.kind === "customer" ? "needs_attention" : "generating";
  const draft = await machineDraftFor(a.draftId);
  if (draft === null) return { kind: "not_entered", reason: "no_draft" };
  if (draft.state !== from) return { kind: "not_entered", reason: "not_generating" };
  // The edge has no guard; the battery's record is the condition.
  if (!draft.hardRulesPassed) return { kind: "not_entered", reason: "hard_rules" };

  // The telling names the destination; with none there is nothing true to tell.
  const destination = await liveDestination(draft.siteId);
  if (destination === null) return { kind: "not_entered", reason: "no_destination" };

  const hours = draft.governing.vetoHours > 0 ? draft.governing.vetoHours : VETO.defaultHours;
  const deadline = new Date(a.at.getTime() + hours * MS_PER_HOUR);
  const stamped = await publishDb()
    .from<{ id: string }>("drafts")
    .update({ veto_deadline: deadline.toISOString() })
    .eq("id", a.draftId)
    .eq("state", from);
  if (stamped.error !== null) {
    throw new Error(`publish/window: could not stamp the veto deadline: ${stamped.error.message}`);
  }

  // The day it goes out untouched, the only date its row may carry; with no zone, the deadline's UTC date.
  const publishes =
    draft.governing.timezone === null
      ? localClock(deadline, "UTC").date
      : publishDateAtOrAfter(deadline, settingsOf(draft.governing));
  await takeDate(a.draftId, publishes);

  const moved = await transition(a.draftId, "in_review", by, { at: a.at });
  if (!moved.ok) return { kind: "not_entered", reason: "moved" };

  const { sendDraftReadyMail } = await import("@/lib/mail/draft-ready");
  const told = await sendDraftReadyMail({ draftId: a.draftId, destination: destination.kind, at: a.at });
  return told.sent || told.reason === "preference-off" ? { kind: "told" } : { kind: "untold", reason: told.reason };
}

const MS_PER_DAY = 24 * MS_PER_HOUR;
const UNIQUE_VIOLATION = "23505";

const isoDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** The row takes its publish day `from`, or the first later date no page of the site holds: an undated row (its date
 *  went to a replacement, SPEC §7 D26) or one dated before its new window ends. A row at `from` or later keeps its date. */
async function takeDate(draftId: string, from: string): Promise<void> {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const dayBefore = isoDate(start - MS_PER_DAY);
  const undatedOrTooEarly = [
    (rows: PublishQuery<{ id: string }>) => rows.is("scheduled_for", null),
    (rows: PublishQuery<{ id: string }>) => rows.lte("scheduled_for", dayBefore),
  ];
  dates: for (let day = 0; day < 31; day++) {
    const date = isoDate(start + day * MS_PER_DAY);
    for (const only of undatedOrTooEarly) {
      const taken = await only(
        publishDb().from<{ id: string }>("drafts").update({ scheduled_for: date }).eq("id", draftId)
      );
      if (taken.error === null) continue;
      if (taken.error.code !== UNIQUE_VIOLATION) {
        throw new Error(`publish/window: could not date the page: ${taken.error.message}`);
      }
      continue dates;
    }
    return;
  }
}

interface WaitingRow {
  id: string;
  site_id: string;
  state: string;
  veto_deadline: string | null;
}

/** Pages due now: in review with the window run out (approved here) or approved, each told and publishable and due. */
export async function dueApprovals(now: Date): Promise<readonly DueApproval[]> {
  const waiting = await publishDb()
    .from<WaitingRow>("drafts")
    .select("id, site_id, state, veto_deadline")
    .in("state", ["in_review", "approved"]);
  if (waiting.error !== null) {
    throw new Error(`publish/window: could not read the pages in review: ${waiting.error.message}`);
  }

  const due: DueApproval[] = [];
  const rows = waiting.data ?? [];
  for (const row of rows) {
    const page = await approveIfDue(row, now);
    if (page !== null) due.push(page);
  }

  console.log(JSON.stringify({ event: "publish_window_sweep", waiting: rows.length, due: due.length }));
  return due;
}

/** One waiting page, approved if its window ran out and handed back when due; otherwise `null`. */
async function approveIfDue(row: WaitingRow, now: Date): Promise<DueApproval | null> {
  // The cheap test before a per-page read.
  if (row.state === "in_review" && (row.veto_deadline === null || new Date(row.veto_deadline) > now)) return null;

  const draft = await machineDraftFor(row.id);
  if (draft === null || draft.state !== row.state) return null;
  if (!customerTold(draft) || !publishableAndDue(draft, now)) return null;

  const destination = await liveDestination(row.site_id);
  // Disconnected since it was told: it returns once the customer reconnects.
  if (destination === null) return null;

  if (draft.state === "in_review") {
    const approved = await transition(row.id, "approved", CLOSED_BY, { at: now });
    if (!approved.ok) return null;
  }
  return { draftId: row.id, destinationId: destination.id };
}

/** The sweep's read for one page, asked by a scheduled `publish/execute`, with the same conditions and approval. */
export async function dueApproval(draftId: string, now: Date): Promise<DueApproval | null> {
  const { data, error } = await publishDb()
    .from<WaitingRow>("drafts")
    .select("id, site_id, state, veto_deadline")
    .eq("id", draftId)
    .in("state", ["in_review", "approved"])
    .limit(1);
  if (error !== null) {
    throw new Error(`publish/window: could not read the page in review: ${error.message}`);
  }
  const row = data?.[0];
  return row === undefined ? null : approveIfDue(row, now);
}

/** The moment a page's attempt falls due, and where it goes. */
export interface PublishDue {
  readonly draftId: string;
  readonly destinationId: string;
  readonly at: Date;
}

/** When a page first becomes publishable and due, or `null` with no such moment or nowhere to go; reads only. */
export async function publishDueAt(draftId: string): Promise<PublishDue | null> {
  const draft = await machineDraftFor(draftId);
  if (draft === null || (draft.state !== "in_review" && draft.state !== "approved")) return null;
  const answer = becomesPublishable(draft);
  if (!answer.publishable) return null;
  const destination = await liveDestination(draft.siteId);
  if (destination === null) return null;
  return { draftId, destinationId: destination.id, at: answer.at };
}
