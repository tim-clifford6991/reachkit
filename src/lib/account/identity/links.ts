// src/lib/account/identity/links.ts — BUILD §13
//
// Issue a link, and redeem it — both through Supabase Auth (#468). No
// token is minted, stored or compared here: `generateLink` mints one inside
// Supabase and hands back its hash, and `verifyOtp` is the only thing that
// ever decides whether a hash is good.
//
// **This module applies no eligibility policy** (BP-061 decision 1: "this
// node issues, it does not decide"). Who may be sent a link, and what an
// address with no account is told, is `requestMagicLink`'s
// (`../provisioning/magic-link.ts`) — which is also why nothing here
// imports `../billing/**` or reads a paid-through date. A lapsed customer
// signs in; gating issuance on access would lock them out of the one
// screen that lets them come back.
//
// **Issuing does not mail.** `../provisioning/sign-in-mail.ts` owns the
// order "link first, then the mail that carries it, and never the mail
// without the link" for a sign-in; this module hands it a URL through the
// seam that file declared (`../provisioning/sign-in-link.ts`). Supabase's
// own mailer sends nothing: `generateLink` is the admin call that mails
// nobody.
//
// **The newest link is the working one** (REQ-024 c4). Supabase keeps one
// live token per user and token type and overwrites it on every
// `generateLink`, so the previous sign-in link stops working the moment a
// new one is minted. The `email_change` half is also held on our side:
// `users.pending_email_token_hash` names the one link the change waits on,
// and redemption refuses any other before it asks Supabase.
//
// **Expired, spent and never-issued are one answer** (REQ-098 criterion 7).
// The arms below carry different `reason`s for the observability line and
// one and the same `lineKey`, so the screen says the same sentence and
// takes the same path whichever it was.
import { EMAIL_CHANGE_TTL_H, SIGNIN_LINK_TTL_H } from "@/lib/config/constants";
import { env } from "@/lib/config/env";
import { confirmLinkPath, type ConfirmType } from "./addresses";
import { identityAuth, type CookieIO, type GeneratedLink } from "./auth";
import { completeEmailChange } from "./email-change-complete";
import { deadLink, logLink, type IssuedLink, type RedeemedLink } from "./outcomes";
import { identityStore, type LinkPurpose } from "./store";

const MS_PER_HOUR = 60 * 60 * 1000;

function ttlHoursFor(purpose: LinkPurpose): number {
  return purpose === "email_change" ? EMAIL_CHANGE_TTL_H : SIGNIN_LINK_TTL_H;
}

/**
 * Asks Supabase for a link and builds it on this product's own host. The
 * URL points at `/auth/confirm`, never at Supabase's `action_link`, so the
 * redemption — and the session cookie it sets — happens on our origin.
 */
export async function issueLink(a: {
  userId: string;
  to: string;
  purpose: LinkPurpose;
  now?: Date;
}): Promise<IssuedLink> {
  const now = a.now ?? new Date();
  const to = a.to.trim().toLowerCase();
  const auth = identityAuth();

  let generated: GeneratedLink;
  if (a.purpose === "sign_in") {
    generated = await auth.generateLink({ kind: "sign_in", email: to });
  } else {
    // An email change is minted against the address the account signs in
    // with now; Supabase moves it to `newEmail` only when this link is
    // verified (REQ-077 c2).
    const read = await identityStore().account(a.userId);
    if (!read.ok || read.account === null) return { issued: false, reason: "vendor" };
    generated = await auth.generateLink({
      kind: "email_change",
      email: read.account.email,
      newEmail: to,
    });
  }
  if (!generated.ok) return { issued: false, reason: "vendor" };

  // The link Supabase minted must be this account's. An address whose
  // `auth.users` row is not the account's own would sign in as somebody
  // else — refused, and said loudly, because it means the two tables
  // disagree about who owns an address.
  if (generated.userId !== a.userId) {
    logLink({ event: "auth_link_issued", userId: a.userId, purpose: a.purpose, outcome: "user_mismatch" });
    return { issued: false, reason: "vendor" };
  }

  logLink({ event: "auth_link_issued", userId: a.userId, purpose: a.purpose, outcome: "issued" });
  return {
    issued: true,
    url: new URL(confirmLinkPath(generated.tokenHash, generated.type), env.NEXT_PUBLIC_APP_URL).toString(),
    expiresAt: new Date(now.getTime() + ttlHoursFor(a.purpose) * MS_PER_HOUR),
    tokenHash: generated.tokenHash,
  };
}

function purposeOf(type: ConfirmType): LinkPurpose {
  return type === "email_change" ? "email_change" : "sign_in";
}

/**
 * Redeems a link. Single use is Supabase's: `verifyOtp` spends the token in
 * the statement that checks it. The session it issues is written through
 * `io`, which the route binds to its own redirect so the cookie rides on
 * the response that carries the customer onward.
 */
export async function redeemLink(
  io: CookieIO,
  link: { tokenHash: string; type: ConfirmType },
  now: Date = new Date()
): Promise<RedeemedLink> {
  const store = identityStore();
  const purpose = purposeOf(link.type);

  if (link.type === "email_change") {
    // The change this link belongs to must still be the one the account
    // is waiting on — not cancelled (REQ-077 c4), not replaced by a newer
    // request, not lapsed. Checked **before** Supabase is asked, because
    // verifying is what moves the address.
    const pending = await store.accountByPendingHash(link.tokenHash);
    if (!pending.ok || pending.account === null) return deadLink("unknown", { purpose });
    const account = pending.account;
    const sentAt =
      account.pending_email_sent_at === null ? Number.NaN : Date.parse(account.pending_email_sent_at);
    if (Number.isNaN(sentAt) || sentAt + EMAIL_CHANGE_TTL_H * MS_PER_HOUR <= now.getTime()) {
      return deadLink("expired", { userId: account.id, purpose });
    }

    const verified = await identityAuth().verifyLink(io, link);
    if (!verified.ok) return deadLink(verified.reason, { userId: account.id, purpose });
    if (verified.userId !== account.id) return deadLink("unknown", { userId: account.id, purpose });
    return completeEmailChange({ account, verified, now });
  }

  const verified = await identityAuth().verifyLink(io, link);
  if (!verified.ok) return deadLink(verified.reason, { purpose });

  // REQ-024 c5's column, stamped once: `stampFirstSignedIn` writes only
  // where it is still null, so a second sign-in does not move it and the
  // 15-minute chase keeps reading the first. Whether it stamped is also
  // what says where this customer is going next (REQ-024 c4).
  const stamp = await store.stampFirstSignedIn(verified.userId, now);

  logLink({ event: "auth_link_redeemed", userId: verified.userId, purpose, outcome: "signed_in" });
  return {
    ok: true,
    purpose,
    userId: verified.userId,
    firstSignIn: stamp.ok && stamp.stamped,
  };
}
