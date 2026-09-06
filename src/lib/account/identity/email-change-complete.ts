// src/lib/account/identity/email-change-complete.ts — BUILD §4.7
//
// The moment REQ-077 criterion 3 describes: "Given the link sent to the new
// address is used, when it succeeds, then only the new address can sign in,
// every mail ReachKit itself sends goes to it, and one `account` mail goes
// to the old address saying the account now signs in at a different address
// and this one no longer can."
//
// Four things happen, in this order and for these reasons:
//
// 1. **The address moves, the pending columns clear and every session
//    issued before now ends — in one statement.** One `update` of one row,
//    so there is no interval in which the address has moved but the pending
//    change is still standing, or in which the new address signs in and an
//    old device still holds a session. BP-061 decision 4 is why the last of
//    those is in the same statement as the first two: "The likeliest reason
//    to move an address is that the old one is no longer the customer's."
// 2. **Every unspent link for the account is spent.** After the move they
//    are links to an address that no longer signs in; a live one is a key
//    to a door that has been rehung. This follows the move rather than
//    preceding it — spending first and failing second would leave a
//    customer with no link and no change.
// 3. **A session is issued at the new address.** The customer proved it;
//    making them ask for a second link would be the dead end REQ-024 c4
//    forbids.
// 4. **One `account` mail goes to the old address.** If it fails, the
//    change still stands and the failure is recorded loudly and carried
//    back in the outcome — BP-061, verbatim: "reverting an address the
//    customer has already proved would lock them out of the account they
//    just moved." It is recorded rather than thrown for the same reason:
//    a throw here would answer the redemption with an error and leave the
//    customer holding a spent link and no session, on an account whose
//    address has already changed.
import { sendEmail } from "@/lib/mail/send";
import { buildAddressMoved } from "@/lib/mail/templates/account";
import { deadLink, logLink, type RedeemedLink } from "./outcomes";
import { identityStore, type AuthLinkRow } from "./store";

export async function completeEmailChange(a: {
  link: AuthLinkRow;
  now: Date;
}): Promise<RedeemedLink> {
  const store = identityStore();
  const { link, now } = a;

  // Read before the write, for one reason only: the old address, which is
  // about to stop being `users.email` and is the one address criterion 3's
  // mail must reach.
  const before = await store.account(link.user_id);
  if (!before.ok || before.account === null) {
    return deadLink("unknown", { userId: link.user_id, purpose: link.purpose });
  }
  const oldAddress = before.account.email;

  const moved = await store.completeChange({
    userId: link.user_id,
    newEmail: link.sent_to,
    at: now,
  });
  // `conflict` is another account having taken the address between the
  // request and this click. The link is already spent, and there is nothing
  // truthful to do but ask for another change.
  if (!moved.ok) return deadLink("unknown", { userId: link.user_id, purpose: link.purpose });

  await store.spendAll(link.user_id, now);
  const site = await store.siteForAccount(link.user_id);

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
      userId: link.user_id,
      purpose: link.purpose,
      outcome: notice.reason,
    });
  }

  logLink({
    event: "auth_link_redeemed",
    userId: link.user_id,
    purpose: link.purpose,
    outcome: "address_changed",
  });

  return {
    ok: true,
    purpose: link.purpose,
    userId: link.user_id,
    // The session is issued at the same instant the statement above ended
    // every earlier one, and `currentSession` compares with `<`, so this
    // session is not ended by the stamp that ended the others.
    session: { userId: link.user_id, siteId: site.ok ? site.siteId : null, issuedAt: now },
    // Never a first sign-in: an account cannot begin an email change from a
    // screen it has not signed in to reach.
    firstSignIn: false,
    noticeToOldAddress: notice.sent ? "sent" : "failed",
  };
}
