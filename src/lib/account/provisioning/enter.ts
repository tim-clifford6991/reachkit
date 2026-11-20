// src/lib/account/provisioning/enter.ts — SPEC §3 Checkout lands signed in
//
// After Stripe Checkout, the buyer is sent to `/auth/checkout` with the
// session id. This is what that route runs: open the account if the
// webhook has not already, then sign them in and say whether setup is
// still ahead.
//
// **The webhook remains the provisioning path.** This calls the same
// `provisionFromPayment` it does, so a race is a replay, not a second
// account. Signing in here is what "redirected directly to onboarding"
// means — the magic-link mail is for later visits, not this one.
//
// **It signs in once, soon after paying.** The id outlives the visit, in
// browser history and Stripe's dashboard, so a later visit, or one after
// the account's first sign-in, is `spent` and asks for a mailed link.
import { issueLink, redeemLink, type CookieIO } from "../identity";
import { accountStore } from "../store";
import { provisionFromPayment } from "./provision";

export type EnterAfterPayment =
  | { ok: true }
  | { ok: false; because: "not_paid" | "no_account" | "no_session" | "spent" };

/** How long after the account opens its checkout return still signs it in. */
const RETURN_WINDOW_MS = 60 * 60 * 1000;

export async function enterAfterPayment(
  sessionId: string,
  io: CookieIO,
  now: Date = new Date()
): Promise<EnterAfterPayment> {
  const provisioned = await provisionFromPayment(sessionId);
  if (provisioned.userId === null) return { ok: false, because: "not_paid" };

  const read = await accountStore().accountByCheckoutSession(sessionId);
  if (!read.ok || read.account === null) return { ok: false, because: "no_account" };
  const { first_signed_in_at, created_at } = read.account;
  if (first_signed_in_at !== null || Date.parse(created_at) + RETURN_WINDOW_MS <= now.getTime()) {
    return { ok: false, because: "spent" };
  }

  const issued = await issueLink({
    userId: provisioned.userId,
    to: read.account.email,
    purpose: "sign_in",
  });
  if (!issued.issued) return { ok: false, because: "no_session" };

  const redeemed = await redeemLink(io, {
    tokenHash: issued.tokenHash,
    type: "magiclink",
    userId: provisioned.userId,
  });
  if (!redeemed.ok) return { ok: false, because: "no_session" };
  // Another visit or a mailed link signed in first; its cookie is never written.
  if (!redeemed.firstSignIn) return { ok: false, because: "spent" };

  return { ok: true };
}
