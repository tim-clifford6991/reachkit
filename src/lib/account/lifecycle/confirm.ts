// BUILD §4.7 — the one entry point to either irreversible action.
//
// REQ-079 criterion 2: "Given the customer starts either action, when they
// have not explicitly confirmed it, then nothing is unpublished, deleted or
// cancelled." Criterion 3: "if it cannot be produced, or they do not take
// it, the action does not proceed and says why."
//
// **Five refusals, and each one leaves everything as it was.** No ticket; a
// ticket whose archive never left this process; an expired ticket; a spent
// one; and a typed confirmation that does not match the action being
// confirmed. Every one of them returns before a single call into
// `unpublishEverything` or `deleteAccount`, which is why the guard is one
// function above both arms rather than a check inside each.
//
// **There is no other way in.** Nothing else in this product calls
// `unpublishEverything` or `deleteAccount`, and neither takes a ticket-free
// path of its own: a caller that wanted to skip the guard would have to
// import a module this one does not re-export.
//
// The ticket is spent **before** the action runs, so a second confirmation
// arriving while the first is still working is refused as `spent` rather
// than running the action twice. Unpublishing is idempotent per publication
// and deletion is a stamp written once, so the cost of that ordering is a
// confirmation that must be re-begun if the run fails — and the alternative
// is two runs against one customer's pages.
import { DANGER_ZONE, isDangerAction, type DangerAction } from "./danger-zone";
import { deleteAccount, type DeleteAccountResult } from "./delete-account";
import { lifecycleStore } from "./store";
import { unpublishEverything, type UnpublishAllResult } from "./unpublish-all";

export type DangerRefusal =
  | "no_ticket"
  | "export_not_taken"
  | "expired"
  | "spent"
  | "not_confirmed"
  | "store";

export type ConfirmDangerAction =
  | { ok: true; action: "unpublish_all"; result: UnpublishAllResult }
  | { ok: true; action: "delete_account"; result: DeleteAccountResult }
  | { ok: false; reason: DangerRefusal };

/** What the customer must type. The action's own name, which is also the
 *  word the control is offered under (§4.7 prints exactly two), so the two
 *  words a customer reads are the two the spec writes and no third one is
 *  minted here. */
export function confirmationFor(action: DangerAction): string {
  return action;
}

export async function confirmDangerAction(a: {
  ticket: string;
  typedConfirmation: string;
  now?: Date;
}): Promise<ConfirmDangerAction> {
  const now = a.now ?? new Date();
  const store = lifecycleStore();

  const read = await store.ticket(a.ticket);
  if (!read.ok) return { ok: false, reason: "store" };
  const ticket = read.ticket;
  if (ticket === null) return { ok: false, reason: "no_ticket" };
  if (!isDangerAction(ticket.action)) return { ok: false, reason: "no_ticket" };

  if (ticket.spent_at !== null) return { ok: false, reason: "spent" };
  if (new Date(ticket.expires_at).getTime() <= now.getTime()) {
    return { ok: false, reason: "expired" };
  }
  // Criterion 3's other half: an archive that was never taken is not an
  // archive the customer has, so the action does not proceed.
  if (ticket.taken_at === null) return { ok: false, reason: "export_not_taken" };
  if (a.typedConfirmation !== confirmationFor(ticket.action)) {
    return { ok: false, reason: "not_confirmed" };
  }

  const site = await store.site(ticket.site_id);
  if (!site.ok || site.site === null) return { ok: false, reason: "store" };

  const spent = await store.stampTicketSpent(a.ticket, now);
  if (!spent.ok) return { ok: false, reason: "store" };

  switch (ticket.action) {
    case "unpublish_all": {
      const run = await unpublishEverything({
        siteId: ticket.site_id,
        userId: site.site.user_id,
        now,
      });
      if (!run.ok) return { ok: false, reason: "store" };
      return { ok: true, action: "unpublish_all", result: run.result };
    }
    case "delete_account": {
      const run = await deleteAccount({ siteId: ticket.site_id, now });
      if (!run.ok) return { ok: false, reason: "store" };
      return { ok: true, action: "delete_account", result: run.result };
    }
    default: {
      // Closed over `DANGER_ZONE`'s two members: a third action added to the
      // constant stops this file compiling rather than falling through to a
      // silent no-op.
      const _never: never = ticket.action;
      return _never;
    }
  }
}

/** Re-exported so a caller holds one import for the closed offer and the
 *  one function that acts on it. */
export { DANGER_ZONE, type DangerAction };
