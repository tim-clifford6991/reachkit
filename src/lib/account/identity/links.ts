// src/lib/account/identity/links.ts — BUILD §13
//
// Issue a single-use token, and redeem it exactly once.
//
// **This module applies no eligibility policy** (BP-061 decision 1: "this
// node issues, it does not decide"). Who may be sent a link, and what an
// address with no account is told, is `requestMagicLink`'s
// (`../provisioning/magic-link.ts`, issue #33) — which is also why nothing
// here imports `../billing/**` or reads a paid-through date. A lapsed
// customer signs in; gating issuance on access would lock them out of the
// one screen that lets them come back.
//
// **Issuing does not mail.** `../provisioning/sign-in-mail.ts` already owns
// the order "link first, then the mail that carries it, and never the mail
// without the link" for a sign-in; this module hands it a URL through the
// seam that file declared (`../provisioning/sign-in-link.ts`) and sends
// nothing of its own. The one mail composed in this directory is the
// `email_change` link's, in `email-change.ts`, for the same reason in
// reverse: that occasion has no other owner.
//
// **The newest link is the working one.** Issuing spends every live link
// for the same `(user_id, purpose)` before writing the new row — REQ-024
// criterion 4's "a founder who ... asks for a new sign-in link ... never to
// a dead end" — and `auth_links_one_live_idx` refuses the insert if that
// spend did not happen, so it is a precondition rather than a tidy-up.
//
// **Expired, spent and never-issued are one answer** (REQ-098 criterion 7).
// The arms below carry different `reason`s for the observability line
// BP-061 asks for and one and the same `lineKey`, so the screen says the
// same sentence and takes the same path whichever it was.
import { EMAIL_CHANGE_TTL_H, SIGNIN_LINK_TTL_H } from "@/lib/config/constants";
import { env } from "@/lib/config/env";
import { signInLinkPath } from "./addresses";
import { completeEmailChange } from "./email-change-complete";
import { deadLink, logLink, type IssuedLink, type RedeemedLink } from "./outcomes";
import { identityStore, type LinkPurpose } from "./store";
import { hashToken, mintToken, sameHash } from "./token";

const MS_PER_HOUR = 60 * 60 * 1000;

function ttlHoursFor(purpose: LinkPurpose): number {
  return purpose === "email_change" ? EMAIL_CHANGE_TTL_H : SIGNIN_LINK_TTL_H;
}

/** `NEXT_PUBLIC_APP_URL` is the one origin this product's links carry. The
 *  token rides in the path, as `/opt-out/{token}` already does. */
function urlFor(token: string): string {
  return new URL(signInLinkPath(token), env.NEXT_PUBLIC_APP_URL).toString();
}

/**
 * Mints a link and writes it. The plaintext is returned to the caller that
 * will mail it and is written nowhere — `auth_links` holds the SHA-256 and
 * has no column that could hold anything else.
 */
export async function issueLink(a: {
  userId: string;
  to: string;
  purpose: LinkPurpose;
  now?: Date;
}): Promise<IssuedLink> {
  const now = a.now ?? new Date();
  const store = identityStore();

  const superseded = await store.spendLive(a.userId, a.purpose, now);
  if (!superseded.ok) return { issued: false, reason: "vendor" };

  const { token, hash } = mintToken();
  const expiresAt = new Date(now.getTime() + ttlHoursFor(a.purpose) * MS_PER_HOUR);

  const written = await store.insertLink({
    tokenHash: hash,
    userId: a.userId,
    purpose: a.purpose,
    sentTo: a.to.trim().toLowerCase(),
    expiresAt,
  });
  if (!written.ok) return { issued: false, reason: "vendor" };

  logLink({ event: "auth_link_issued", userId: a.userId, purpose: a.purpose, outcome: "issued" });
  return { issued: true, url: urlFor(token), expiresAt, tokenHash: hash };
}

/**
 * Single use, enforced by one conditional statement (`spendLink`), so two
 * arrivals of one token cannot both become sessions however they interleave.
 * Writes no cookie: the route that called this sets it (`startSession`),
 * because only a Route Handler or a Server Function may.
 */
export async function redeemLink(token: string, now: Date = new Date()): Promise<RedeemedLink> {
  const store = identityStore();
  const hash = hashToken(token);

  const read = await store.link(hash);
  // An unreadable store answers exactly as an unknown token does. Any
  // answer that distinguished the two would distinguish a real token from
  // an invented one, which is the oracle criterion 7 exists to close.
  if (!read.ok || read.link === null) return deadLink("unknown", {});

  const link = read.link;
  // BP-061 `## NFR budget`: "Tokens are compared in constant time against
  // the stored hash." The lookup above is by primary key; this is the
  // comparison.
  if (!sameHash(link.token_hash, hash)) return deadLink("unknown", {});
  if (link.spent_at !== null) {
    return deadLink("spent", { userId: link.user_id, purpose: link.purpose });
  }
  if (new Date(link.expires_at).getTime() <= now.getTime()) {
    return deadLink("expired", { userId: link.user_id, purpose: link.purpose });
  }

  const spent = await store.spendLink(hash, now);
  if (!spent.ok) return deadLink("unknown", { userId: link.user_id, purpose: link.purpose });
  // Somebody — a second click, a mail scanner — got there first between the
  // read above and this statement. Spent is spent.
  if (!spent.spent) return deadLink("spent", { userId: link.user_id, purpose: link.purpose });

  if (link.purpose === "email_change") return completeEmailChange({ link, now });

  const site = await store.siteForAccount(link.user_id);
  // REQ-024 c5's column, stamped once: `stampFirstSignedIn` writes only
  // where it is still null, so a second sign-in does not move it and the
  // 15-minute chase keeps reading the first. Whether it stamped is also
  // what says where this customer is going next (REQ-024 c4).
  const stamp = await store.stampFirstSignedIn(link.user_id, now);

  logLink({
    event: "auth_link_redeemed",
    userId: link.user_id,
    purpose: link.purpose,
    outcome: "signed_in",
  });
  return {
    ok: true,
    purpose: link.purpose,
    userId: link.user_id,
    session: { userId: link.user_id, siteId: site.ok ? site.siteId : null, issuedAt: now },
    firstSignIn: stamp.ok && stamp.stamped,
  };
}
