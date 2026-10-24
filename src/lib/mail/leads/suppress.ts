// BUILD §4.2 — the address-wide suppression store. It reaches only kinds registered `stoppable: 'opt-out'` and never reads or writes `users.notify`.
// Read ADR-042 before unifying it with the notification toggles: an address-keyed stop would silently take a customer's sign-in mail away.
// Read ADR-041 before checking it in the giveaway: `first-page` kinds are `stoppable: false`, so an opt-out never refuses a page just asked for.
// With no transaction, the suppression is written before sequences are stopped: a failure between leaves `running` rows the seam refuses,
// while the reverse would leave no suppression and let the next delivery start a fresh sequence. The send step converges the label.
import { leadStore, type SuppressionCause } from "./store";

/** Three answers, not a boolean: a boolean would call an unreadable store "not suppressed" and mail someone who opted out. */
export type SuppressionAnswer = "send" | "suppressed" | "unreadable";

export async function suppressionState(email: string): Promise<SuppressionAnswer> {
  const read = await leadStore().isSuppressed(normaliseAddress(email));
  if (!read.ok) return "unreadable";
  return read.suppressed ? "suppressed" : "send";
}

/** One address, one identity. Every read and every write in this feature goes through here, so a mixed-case address can never become a second, unsuppressed person. */
export function normaliseAddress(email: string): string {
  return email.trim().toLowerCase();
}

/** Ends every running and waiting sequence for the address and blocks future ones; waiting ones go to `stopped`, never `running` (criterion 12). */
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

/** Every non-terminal sequence set to `stopped`; `finished` and `dropped` keep why they ended. */
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
