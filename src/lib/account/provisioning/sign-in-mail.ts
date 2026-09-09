// src/lib/account/provisioning/sign-in-mail.ts — BUILD §13
//
// Issue the link, then send the mail that carries it — in that order, and
// never the mail without the link.
//
// §13 ends "send magic link → /setup", and REQ-024 criterion 1 puts 60
// seconds on it. Both halves are here in one place because the failure they
// guard against is sending one without the other: a `magic-link` mail whose
// action points nowhere is worse than a late mail, because the founder
// spends their one attempt on it.
//
// So: no link, no mail, and the outcome says which. The 15-minute chase
// (`chase.ts`) is what covers the gap, and it is written for both states.
import { sendEmail } from "@/lib/mail/send";
import { buildMagicLink } from "@/lib/mail/templates/magic-link";
import { wireSignInLinkIssuer } from "../identity/wire";
import { issueSignInLink } from "./sign-in-link";

export type SignInMailOutcome =
  | { sent: true }
  | { sent: false; because: "no_link" | "mail" };

export async function sendSignInLink(a: {
  userId: string;
  email: string;
}): Promise<SignInMailOutcome> {
  // Issue #35 fills the port declared below. Wiring here, and not only at
  // some entry point's module load, is the same move
  // `src/lib/mail/leads/**` makes with its own seam: idempotent, so no
  // caller has to remember it and no ordering of imports can leave a paid
  // customer's link unissued.
  wireSignInLinkIssuer();

  const link = await issueSignInLink({ userId: a.userId, to: a.email });
  if (!link.issued) {
    // Recorded loudly: an account is open and its owner has no way in yet.
    console.warn(JSON.stringify({ event: "sign_in_link_not_issued", reason: link.reason }));
    return { sent: false, because: "no_link" };
  }

  const mail = buildMagicLink({ href: link.url, address: a.email });
  const result = await sendEmail({
    kind: "magic-link",
    to: a.email,
    subject: mail.subject,
    blocks: mail.blocks,
    reason: mail.reason,
  });
  return result.sent ? { sent: true } : { sent: false, because: "mail" };
}
