// src/lib/account/identity/email-change.ts — BUILD §4.7
//
// What the account card reads, and the two halves of moving the address an
// account signs in with: starting a change, and calling one off.
//
// **`users.email` is not in any statement this file sends.** REQ-077
// criterion 2: "a sign-in link is sent to it and the old address keeps
// working until that link is used". Beginning a change writes the three
// pending columns and issues a link; the address itself moves in
// `email-change-complete.ts`, inside the redemption, and nowhere else. A
// customer who mistypes one character and never clicks is untouched, and
// the change lapses on its own (criterion 4).
//
// **The in-use check reads both columns, through `dbAdmin()`.** An address
// is taken if any account signs in with it *or* is waiting on it — and a
// tombstoned account inside its 30-day window counts, because ADR-051 point
// 5 leaves that row present but hidden and a support action can bring it
// back. `identityStore().addressTaken` is that read; the partial unique
// index closes only the narrower pending-against-pending race.
//
// **Validity is a syntactic check plus a deliverability attempt** (BP-061):
// no MX probe and no disposable-domain list. The deliverability attempt is
// the mail itself, and a send that does not leave takes the pending change
// back out with it — a customer must never be shown a change awaiting a
// link that was never sent.
//
// **A third refusal the blueprint does not print.** BP-061's interface has
// `in_use` and `invalid`. A store or a mail vendor that is down is neither,
// and answering "that address is not valid" when the address is fine is a
// false statement about the one thing the customer came here to do — the
// same reason `applyOptOutToken` ships an `unavailable` arm beside its
// `invalid` one. So there are three, and the third says what is true.
//
// **The card never returns an invoice address** (REQ-076 c2, restated by
// REQ-077 c1): invoices and receipts go to the address held in the billing
// portal and are changed there. This module holds no billing import at all,
// which is what makes that structural — `local/no-billing-internal-import`
// would fail the build if one appeared.
import { z } from "zod";
import { EMAIL_CHANGE_TTL_H } from "@/lib/config/constants";
import { sendEmail } from "@/lib/mail/send";
import { buildMagicLink } from "@/lib/mail/templates/magic-link";
import { issueLink } from "./links";
import { logLink } from "./outcomes";
import { ACCOUNT_NOTE_KEYS } from "./notes";
import { identityStore } from "./store";

const MS_PER_HOUR = 60 * 60 * 1000;

const address = z.email();

/** REQ-077 criterion 1's two written lines, in the order the criterion
 *  names them. Declared in `./notes.ts` and re-exported here so every
 *  caller keeps its spelling: the account card and its fixture read the
 *  same two keys, and neither can afford this file's import graph — see
 *  that file's header (#134). */
export { ACCOUNT_NOTE_KEYS };

export interface AccountCard {
  readonly name: string | null;
  readonly email: string;
  /** The change awaiting confirmation, or `null`. A change past its window
   *  reads `null` here and is never written away by a sweeper: ADR-030's
   *  rule — a pending change is computed, never stored as a state — applies
   *  to its lapse as much as to its existence. */
  readonly pending: { email: string; expiresAt: Date } | null;
  readonly noteKeys: typeof ACCOUNT_NOTE_KEYS;
}

export type BeginEmailChange =
  | { ok: true; expiresAt: Date }
  | { ok: false; reason: "in_use"; lineKey: "settings.account.email-in-use" }
  | { ok: false; reason: "invalid"; lineKey: "settings.account.email-invalid" }
  | { ok: false; reason: "unavailable"; lineKey: "settings.account.email-change-unavailable" };

export async function accountCard(
  userId: string,
  now: Date = new Date()
): Promise<AccountCard | null> {
  const read = await identityStore().account(userId);
  if (!read.ok || read.account === null) return null;

  const row = read.account;
  return {
    name: row.name,
    email: row.email,
    pending: pendingOf(row.pending_email, row.pending_email_sent_at, now),
    noteKeys: ACCOUNT_NOTE_KEYS,
  };
}

function pendingOf(
  pendingEmail: string | null,
  sentAt: string | null,
  now: Date
): { email: string; expiresAt: Date } | null {
  if (pendingEmail === null || sentAt === null) return null;
  const expiresAt = new Date(new Date(sentAt).getTime() + EMAIL_CHANGE_TTL_H * MS_PER_HOUR);
  // Lapsed: the link expired, so the change is over and the account is
  // unchanged (REQ-077 c4). Nothing is written to say so — there is nothing
  // to write, because `users.email` never moved.
  if (expiresAt.getTime() <= now.getTime()) return null;
  return { email: pendingEmail, expiresAt };
}

/**
 * REQ-077 criterion 2. Sends a link to the new address and changes nothing
 * else. A second call replaces the pending address rather than adding one:
 * `issueLink` spends the live `email_change` token first, and the three
 * columns are overwritten, so there is at most one change in flight.
 */
export async function beginEmailChange(
  userId: string,
  next: string,
  now: Date = new Date()
): Promise<BeginEmailChange> {
  const candidate = next.trim().toLowerCase();
  if (!address.safeParse(candidate).success) {
    return { ok: false, reason: "invalid", lineKey: "settings.account.email-invalid" };
  }

  const store = identityStore();

  const taken = await store.addressTaken(candidate);
  if (!taken.ok) {
    return { ok: false, reason: "unavailable", lineKey: "settings.account.email-change-unavailable" };
  }
  // Their own current address is taken — by them. Answered as in use,
  // because it is, and because a change to the address you already have is
  // a change to nothing.
  if (taken.taken) {
    return { ok: false, reason: "in_use", lineKey: "settings.account.email-in-use" };
  }

  const issued = await issueLink({ userId, to: candidate, purpose: "email_change", now });
  if (!issued.issued) {
    return { ok: false, reason: "unavailable", lineKey: "settings.account.email-change-unavailable" };
  }

  const written = await store.writePending({
    userId,
    pendingEmail: candidate,
    tokenHash: issued.tokenHash,
    sentAt: now,
  });
  if (!written.ok) {
    await store.spendLive(userId, "email_change", now);
    return written.conflict === true
      ? { ok: false, reason: "in_use", lineKey: "settings.account.email-in-use" }
      : { ok: false, reason: "unavailable", lineKey: "settings.account.email-change-unavailable" };
  }

  const mail = buildMagicLink({ href: issued.url });
  const sent = await sendEmail({
    kind: "magic-link",
    to: candidate,
    subject: mail.subject,
    blocks: mail.blocks,
  });
  if (!sent.sent) {
    // The deliverability attempt failed. Take the pending change back out
    // rather than leave a customer looking at an address awaiting a link
    // that is not coming.
    await store.clearPending(userId);
    await store.spendLive(userId, "email_change", now);
    logLink({
      event: "email_change_link_not_sent",
      userId,
      purpose: "email_change",
      outcome: sent.reason,
    });
    return { ok: false, reason: "unavailable", lineKey: "settings.account.email-change-unavailable" };
  }

  logLink({
    event: "email_change_begun",
    userId,
    purpose: "email_change",
    outcome: "link_sent",
  });
  return { ok: true, expiresAt: issued.expiresAt };
}

/**
 * REQ-077 criterion 4. Clears all three pending columns and spends the live
 * token, so the link in the customer's inbox stops working the moment they
 * cancel. The account is unchanged — it never changed.
 */
export async function cancelEmailChange(userId: string, now: Date = new Date()): Promise<void> {
  const store = identityStore();
  await store.spendLive(userId, "email_change", now);
  await store.clearPending(userId);
  logLink({ event: "email_change_cancelled", userId, purpose: "email_change", outcome: "cleared" });
}
