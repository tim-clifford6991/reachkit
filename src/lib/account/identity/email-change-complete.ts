// src/lib/account/identity/email-change-complete.ts — BUILD §4.7
//
// The moment REQ-077 criterion 3 describes: "Given the link sent to the new
// address is used, when it succeeds, then only the new address can sign in,
// every mail ReachKit itself sends goes to it, and one `account` mail goes
// to the old address saying the account now signs in at a different address
// and this one no longer can."
//
// By the time this runs Supabase has verified the link and moved
// `auth.users.email` — it moves it on that token and on no other, which is
// what keeps criterion 2's "the old address keeps working until that link
// is used" (#468). Three things follow, in this order:
//
// 1. **The address is mirrored into `users.email` and the pending columns
//    clear — in one statement.** Every mail ReachKit sends reads
//    `users.email`, so the mirror is what makes "every mail goes to it"
//    true.
// 2. **Every other session ends** (BP-061 decision 4: "The likeliest reason
//    to move an address is that the old one is no longer the customer's").
//    `signOut(…, "others")` with the session this redemption just issued,
//    so the customer who proved the address stays signed in and nobody
//    else does. A sign-in link still live from before the move is spent the
//    same way: one is minted and sent to nobody, which Supabase's
//    one-token-per-type rule makes the end of the old one.
// 3. **One `account` mail goes to the old address.** If it fails, the
//    change still stands and the failure is recorded loudly and carried
//    back in the outcome — BP-061, verbatim: "reverting an address the
//    customer has already proved would lock them out of the account they
//    just moved."
import { sendEmail } from "@/lib/mail/send";
import { buildAddressMoved } from "@/lib/mail/templates/account";
import { identityAuth } from "./auth";
import { deadLink, logLink, type RedeemedLink } from "./outcomes";
import { identityStore, type IdentityAccountRow } from "./store";

export async function completeEmailChange(a: {
  account: IdentityAccountRow;
  verified: { userId: string; email: string | null; accessToken: string };
  now: Date;
}): Promise<RedeemedLink> {
  const { account, verified } = a;
  const purpose = "email_change" as const;
  const newEmail = account.pending_email;
  const oldAddress = account.email;

  // Supabase answered, but did not move the address to the one this
  // account was waiting on — a project with "Secure email change" still on
  // wants a second link to the old address first. Nothing is mirrored,
  // because nothing moved.
  if (newEmail === null || (verified.email ?? "").toLowerCase() !== newEmail.toLowerCase()) {
    logLink({ event: "email_change_not_moved", userId: account.id, purpose, outcome: "unknown" });
    return deadLink("unknown", { userId: account.id, purpose });
  }

  const moved = await identityStore().completeChange({ userId: account.id, newEmail });
  if (!moved.ok) {
    // Supabase moved the address and the mirror did not land: the two
    // tables disagree about where this account signs in. Loud, because a
    // person has to reconcile it.
    logLink({ event: "email_change_mirror_failed", userId: account.id, purpose, outcome: "store" });
    return deadLink("unknown", { userId: account.id, purpose });
  }

  const ended = await identityAuth().signOutEverywhere(verified.accessToken, "others");
  if (!ended.ok) {
    logLink({ event: "email_change_other_sessions_kept", userId: account.id, purpose, outcome: "vendor" });
  }

  // A sign-in link still live from before the move was mailed to the old
  // address, and must not sign it in (REQ-077 c3: "only the new address can
  // sign in"). Supabase keeps one live sign-in token per user and replaces
  // it on every `generateLink`, so minting one — sent to nobody — is what
  // spends it.
  const superseded = await identityAuth().generateLink({ kind: "sign_in", email: newEmail });
  if (!superseded.ok) {
    logLink({ event: "email_change_old_links_kept", userId: account.id, purpose, outcome: "vendor" });
  }

  const mail = buildAddressMoved();
  const notice = await sendEmail({
    kind: "account",
    to: oldAddress,
    subject: mail.subject,
    blocks: mail.blocks,
  });
  if (!notice.sent) {
    logLink({
      event: "email_change_notice_not_sent",
      userId: account.id,
      purpose,
      outcome: notice.reason,
    });
  }

  logLink({ event: "auth_link_redeemed", userId: account.id, purpose, outcome: "address_changed" });

  return {
    ok: true,
    purpose,
    userId: account.id,
    // Never a first sign-in: an account cannot begin an email change from a
    // screen it has not signed in to reach.
    firstSignIn: false,
    noticeToOldAddress: notice.sent ? "sent" : "failed",
  };
}
