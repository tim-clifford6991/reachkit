// src/lib/account/provisioning/chase.ts — BUILD §13
//
// REQ-024 criterion 5, in full: fifteen minutes after a payment at which
// nobody has signed in, "that address is written to again with an `account`
// mail: it says the payment succeeded, carries a working sign-in link where
// the account is open or says it is not open yet where it is not, names one
// way to reach a person, and never asks for payment again."
//
// **It never asks for payment again.** No checkout URL, no price key, no
// purchase call is reachable from this file, and it imports nothing from
// `src/lib/account/checkout/**` — asserted, not remembered. A founder who
// has paid and is waiting must never be shown a buy button; that is the
// moment a person concludes they were charged for nothing.
//
// **Two arms, two mails.** Where the account is open a fresh link is
// issued and carried. Where it is not, the mail says so and carries none —
// never a link that does not work, and never a claim that the account is
// ready.
//
// **Stamped, so a tick that runs twice sends once.** The stamp is written
// after the send: a mail sent and not stamped is one duplicate at the next
// tick, and a mail stamped and not sent is a founder who is never written
// to at all.
import { sendEmail } from "@/lib/mail/send";
import { buildChaseWithLink, buildChaseWithoutLink } from "@/lib/mail/templates/account";
import { accountStore } from "../store";
import { issueSignInLink } from "./sign-in-link";

export type ChaseOutcome =
  | { chased: true; carriedLink: boolean }
  | { chased: false; because: "no_account" | "already_chased" | "signed_in" | "mail" | "store" };

export async function chaseSignIn(sessionId: string, now: Date = new Date()): Promise<ChaseOutcome> {
  const store = accountStore();
  const read = await store.accountByCheckoutSession(sessionId);
  if (!read.ok) return { chased: false, because: "store" };

  const account = read.account;
  if (account === null) {
    // No account against this payment. That is the 24-hour backstop's
    // subject, not this one's — and a chase mail here would have nothing
    // true to say about an account.
    return { chased: false, because: "no_account" };
  }
  // Re-checked at send time rather than trusted from the query: fifteen
  // minutes is long enough for somebody to have signed in since.
  if (account.first_signed_in_at !== null) return { chased: false, because: "signed_in" };
  if (account.sign_in_chased_at !== null) return { chased: false, because: "already_chased" };

  const link = await issueSignInLink({ userId: account.id, to: account.email });
  const mail = link.issued ? buildChaseWithLink({ href: link.url }) : buildChaseWithoutLink();

  const sent = await sendEmail({
    kind: "account",
    to: account.email,
    subject: mail.subject,
    blocks: mail.blocks,
  });
  if (!sent.sent) return { chased: false, because: "mail" };

  await store.stampSignInChased(account.id, now);
  return { chased: true, carriedLink: link.issued };
}
