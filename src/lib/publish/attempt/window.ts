// BUILD §9 · SPEC §7 — the veto window, opened and closed by the clock
// (issue 709).
//
// SPEC §7: "Autopilot only: generate → veto → publish", and its Done when:
// "An untouched draft publishes at window end on their domain." Every piece
// of that sentence was built — the machine's edges, the publishable rule,
// the telling and its mail (#174), the claim and the delivery — and nothing
// took a page through them: the pipeline writes a row in `generating` and
// stops, and no job moved it on. These are the two moves that were missing,
// and each is one call into the module that owns the rule.
//
// **Opening the window** (`enterReview`) is the evening tick's, right after
// a generation that passed: the deadline is stamped, the page enters
// review, and the customer is told through `sendDraftReadyMail` — which
// mints the one stop link and records the telling the `customer_told` guard
// reads. The deadline is written before the move, because the telling
// names the moment the page publishes and reads it off the row.
//
// **Closing it** (`dueApprovals`) is the hourly publish tick's. A page in
// review whose window has run out, that the customer was told about on the
// pair in force, and that is publishable and due now, is approved by the
// system; it and every approved page that is due are handed back addressed
// the way `publishApproved()` takes them. The claim then re-asks every
// guard on `approved → publishing` at the moment of the attempt, so nothing
// here is a second copy of the switch, the ceilings or the destination: a
// page those hold is offered, held there, and offered again next hour —
// exactly as a due retry is (`./due.ts`).
//
// **Scheduling the attempt** (`publishDueAt`, issue #790) names the moment a
// page in review or approved first becomes publishable and due, and the
// destination it goes to — so the engine can send one `publish/execute`
// for that moment instead of leaving the page to the next hourly sweep.
// The event re-enters through `dueApproval`, the one-page form of the
// sweep's read, so a delivered event and the tick are the same attempt and
// the tick stays the backstop for any event that was lost.
//
// **An untold page is never approved by a clock.** REQ-057 c8: no page
// publishes without the customer having been told on the pair it publishes
// under. The guard would hold it at the claim anyway; not approving it here
// keeps a page nobody told about in review, where the customer can still
// see and stop it.
import { VETO } from "@/lib/config/constants";
import { publishDb } from "../db";
import { machineDraftFor, transition } from "../machine";
import { becomesPublishable } from "../publishable/predicate";
import { customerTold, publishableAndDue } from "../publishable/rule";
import type { Actor, DestinationKind } from "../types";

/** One page ready for its attempt, addressed the way `publishApproved()`
 *  takes it — the same shape a due retry has. */
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

/**
 * `generating → in_review`, with the window it opens and the telling it
 * owes. Called once per passing generation; a page anywhere but
 * `generating` is left where it is.
 */
export async function enterReview(a: { draftId: string; at: Date }): Promise<ReviewEntry> {
  const draft = await machineDraftFor(a.draftId);
  if (draft === null) return { kind: "not_entered", reason: "no_draft" };
  if (draft.state !== "generating") return { kind: "not_entered", reason: "not_generating" };
  // The edge carries no guard of its own; the battery's record is the
  // condition, and only the run that put the page through it may write it.
  if (!draft.hardRulesPassed) return { kind: "not_entered", reason: "hard_rules" };

  // The telling names the destination the page goes to. A site with none
  // has nowhere to publish and nothing true to be told.
  const destination = await liveDestination(draft.siteId);
  if (destination === null) return { kind: "not_entered", reason: "no_destination" };

  const hours = draft.governing.vetoHours > 0 ? draft.governing.vetoHours : VETO.defaultHours;
  const deadline = new Date(a.at.getTime() + hours * MS_PER_HOUR);
  const stamped = await publishDb()
    .from<{ id: string }>("drafts")
    .update({ veto_deadline: deadline.toISOString() })
    .eq("id", a.draftId)
    .eq("state", "generating");
  if (stamped.error !== null) {
    throw new Error(`publish/window: could not stamp the veto deadline: ${stamped.error.message}`);
  }

  const moved = await transition(a.draftId, "in_review", OPENED_BY, { at: a.at });
  if (!moved.ok) return { kind: "not_entered", reason: "moved" };

  const { sendDraftReadyMail } = await import("@/lib/mail/draft-ready");
  const told = await sendDraftReadyMail({ draftId: a.draftId, destination: destination.kind, at: a.at });
  return told.sent ? { kind: "told" } : { kind: "untold", reason: told.reason };
}

interface WaitingRow {
  id: string;
  site_id: string;
  state: string;
  veto_deadline: string | null;
}

/**
 * The pages whose attempt is due now: in review with the window run out
 * (approved here), or already approved. Each is publishable and due by the
 * rule the claim's own guard reads, and was told on the pair in force.
 */
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

/** One waiting page: approved here if its window has run out, and handed
 *  back when its attempt is due now. `null` for anything else. */
async function approveIfDue(row: WaitingRow, now: Date): Promise<DueApproval | null> {
  // The window is still open: the cheap test first, before a per-page read.
  if (row.state === "in_review" && (row.veto_deadline === null || new Date(row.veto_deadline) > now)) return null;

  const draft = await machineDraftFor(row.id);
  if (draft === null || draft.state !== row.state) return null;
  if (!customerTold(draft) || !publishableAndDue(draft, now)) return null;

  const destination = await liveDestination(row.site_id);
  // Disconnected since it was told: nothing to address the attempt to,
  // and it returns to the tick the moment the customer reconnects.
  if (destination === null) return null;

  if (draft.state === "in_review") {
    const approved = await transition(row.id, "approved", CLOSED_BY, { at: now });
    if (!approved.ok) return null;
  }
  return { draftId: row.id, destinationId: destination.id };
}

/**
 * The sweep's read for one page — what a scheduled `publish/execute` asks
 * when it arrives. The same conditions, the same approval at window end,
 * and the same `null` for a page that is not due, was stopped, or has
 * already gone out.
 */
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

/**
 * When a page in review or approved first becomes publishable and due, by
 * the rule the claim's own guard reads — or `null` where it has no such
 * moment yet (copilot without an approval, no zone, a claim re-check) or
 * nowhere to go. Reads only; the attempt at that moment re-asks every guard.
 */
export async function publishDueAt(draftId: string): Promise<PublishDue | null> {
  const draft = await machineDraftFor(draftId);
  if (draft === null || (draft.state !== "in_review" && draft.state !== "approved")) return null;
  const answer = becomesPublishable(draft);
  if (!answer.publishable) return null;
  const destination = await liveDestination(draft.siteId);
  if (destination === null) return null;
  return { draftId, destinationId: destination.id, at: answer.at };
}
