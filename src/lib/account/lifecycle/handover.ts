// BUILD §4.7 — the export handover: nothing is destroyed before it is
// handed back.
//
// REQ-079 criterion 3: "Given the customer confirms either action, when it
// runs, then an export of their pages is produced and downloaded by them
// before anything is unpublished or deleted; if it cannot be produced, or
// they do not take it, the action does not proceed and says why."
//
// **Nothing in this file unpublishes, deletes or cancels anything.** It
// builds the archive, and — only if the archive exists — writes one
// `danger_tickets` row. A begin whose archive was never taken leaves the
// account exactly as it was: the ticket authorises nothing by itself, and
// `confirmDangerAction` refuses one whose `taken_at` is null.
//
// **A failed export issues no ticket, and there is no way round it.** No
// override, no "delete anyway", no support path in this module: the export
// is the only recovery path REQ-079's non-goals leave, which is why
// criterion 3 puts it first.
//
// **What a taken ticket can prove, and what it cannot.** `markExportTaken`
// is called by the download route after the last byte has been written to
// the response without error. The strongest available claim is "the whole
// archive left our process for this customer's session" — never "the
// customer holds the file", which nothing on this side can know. No test
// here claims more.
import { DANGER_TICKET_TTL_MINUTES } from "@/lib/config/constants";
import { exportEverything, type ExportFailure } from "../export";
import type { DangerAction } from "./danger-zone";
import { lifecycleStore } from "./store";

const MS_PER_MINUTE = 60 * 1000;

/** The one written line a refused begin is told in (REQ-079 c3). The
 *  sentence is the owner's; this module names the key. */
export const DANGER_EXPORT_FAILED = "danger.export-failed" as const;

export type BeginDangerAction =
  | { ok: true; ticket: string; archive: ReadableStream<Uint8Array>; filename: string; pages: number }
  | { ok: false; reason: ExportFailure | "store"; lineKey: typeof DANGER_EXPORT_FAILED };

export async function beginDangerAction(a: {
  siteId: string;
  action: DangerAction;
  now?: Date;
}): Promise<BeginDangerAction> {
  const now = a.now ?? new Date();

  // The archive first, always. A store that will not take the ticket costs
  // the customer a retry; a ticket written before the archive exists is the
  // shape in which an action runs against a customer who was handed
  // nothing.
  const archive = await exportEverything(a.siteId);
  if (!archive.ok) return { ok: false, reason: archive.reason, lineKey: DANGER_EXPORT_FAILED };

  const ticket = crypto.randomUUID();
  const written = await lifecycleStore().insertTicket({
    ticket,
    siteId: a.siteId,
    action: a.action,
    expiresAt: new Date(now.getTime() + DANGER_TICKET_TTL_MINUTES * MS_PER_MINUTE),
  });
  if (!written.ok) return { ok: false, reason: "store", lineKey: DANGER_EXPORT_FAILED };

  return {
    ok: true,
    ticket,
    archive: archive.archive,
    filename: archive.filename,
    pages: archive.pages,
  };
}

/**
 * The archive left this process, whole.
 *
 * Idempotent: the stamp is written only where none is there, so a second
 * call records nothing and the moment kept is the first one.
 */
export async function markExportTaken(ticket: string, now?: Date): Promise<void> {
  await lifecycleStore().stampTicketTaken(ticket, now ?? new Date());
}
