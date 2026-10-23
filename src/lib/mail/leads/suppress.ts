// BUILD §4.2 — the address-wide suppression store.
//
// **Read ADR-042 before unifying this with the notification toggles.**
// This store is keyed by an email address and reaches exactly the kinds
// whose register row says `stoppable: 'opt-out'` — today, the nurture
// sequence. `users.notify` is keyed by a user and reaches the three
// recurring mails. They overlap in no row. Merging them has one obvious
// default — an address-keyed suppression suppresses that address — and
// that default takes a magic-link customer's sign-in mail away, silently,
// discovered when they cannot get back in. This module never reads and
// never writes `users.notify`, and imports nothing that does.
//
// **Read ADR-041 before adding a suppression check to the giveaway.** An
// address on this store that submits the capture control for a *different*
// domain still receives that domain's page. `first-page` and
// `first-page-unavailable` are `stoppable: false`, so the send seam does
// not consult this store for them at all — the check exists in one place
// and reaches exactly the follow-up. An opt-out here stops what comes
// next; it does not refuse a page the person has just asked for.
//
// **Why the write order is what it is.** A suppression must both record
// the address and stop the sequences already running for it, and this
// client has no transaction. So the suppression is written **first**: with
// it in place every nurture send is refused at the seam (the store is
// consulted immediately before the vendor call), and the sequence rows are
// then converged to `stopped`. A failure between the two leaves rows
// reading `running` that can send nothing, which is a stale label; the
// reverse order would leave an address with no suppression row and no
// running sequences — and the next delivery would start a fresh one. The
// job's own send step re-reads this store and stops any row it finds
// suppressed, so the label converges on the next invocation.
import { leadStore, type SuppressionCause } from "./store";

/** Three answers, not two. A boolean would have to call an unreadable
 *  store "not suppressed", which is the one answer that mails a person who
 *  opted out — and it is exactly what the send seam's `SuppressionReader`
 *  port refuses to accept. BP-029 declares `isSuppressed(): Promise<boolean>`;
 *  the seam that consumes it (§12, issue #30) was built to a three-answer
 *  port, and this follows the consumer. */
export type SuppressionAnswer = "send" | "suppressed" | "unreadable";

export async function suppressionState(email: string): Promise<SuppressionAnswer> {
  const read = await leadStore().isSuppressed(normaliseAddress(email));
  if (!read.ok) return "unreadable";
  return read.suppressed ? "suppressed" : "send";
}

/** One address, one identity. Every read and every write in this feature
 *  goes through here, so a mixed-case address can never become a second,
 *  unsuppressed person. */
export function normaliseAddress(email: string): string {
  return email.trim().toLowerCase();
}

/** Ends every running and every waiting sequence for the address and
 *  blocks every future one. Releases nothing — REQ-010 criterion 12's last
 *  sentence: a sequence ended by a subscribe or an opt-out releases the
 *  ones waiting behind it into `stopped`, never into `running`. */
export async function suppressAddress(
  email: string,
  cause: SuppressionCause
): Promise<{ suppressed: true; stopped: number } | { suppressed: false }> {
  const address = normaliseAddress(email);
  const store = leadStore();

  const written = await store.addSuppression(address, cause);
  if (!written.ok) return { suppressed: false };

  const stopped = await stopSequencesFor(address);
  console.log(
    JSON.stringify({
      event: "lead_suppressed",
      cause,
      stopped,
      rule: "REQ-010 c11/c10 — address-wide, follow-up only (ADR-041, ADR-042)",
    })
  );
  return { suppressed: true, stopped };
}

/** Every sequence that has not already reached a terminal state, set to
 *  `stopped`. `finished` and `dropped` are left alone: they are terminal
 *  and rewriting them would erase why they ended. */
async function stopSequencesFor(address: string): Promise<number> {
  const store = leadStore();
  const read = await store.leadsForAddress(address);
  if (!read.ok) return 0;

  let stopped = 0;
  for (const lead of read.leads) {
    if (lead.sequence_state !== "waiting" && lead.sequence_state !== "running") continue;
    const patched = await store.patchLead(lead.id, {
      sequence_state: "stopped",
      next_touch_at: null,
    });
    if (patched.ok) stopped += 1;
  }
  return stopped;
}

/** How many follow-ups the address's latest report already had, so the opt-out
 *  page can say which were sent; null when the store cannot be read. */
export async function followUpsSentTo(email: string): Promise<number | null> {
  const read = await leadStore().leadsForAddress(normaliseAddress(email));
  if (!read.ok) return null;
  let latest: { started: string; sent: number } | null = null;
  for (const lead of read.leads) {
    const started = lead.sequence_started_at;
    if (started !== null && (latest === null || started > latest.started)) {
      latest = { started, sent: lead.touch_count };
    }
  }
  return latest?.sent ?? 0;
}
