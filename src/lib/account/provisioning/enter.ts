// src/lib/account/provisioning/enter.ts — SPEC.md §3 (2026-09-14)
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
import { issueLink, redeemLink, type CookieIO } from "../identity";
import { accountStore } from "../store";
import { provisionFromPayment } from "./provision";

export type EnterAfterPayment =
  | { ok: true; firstSignIn: boolean }
  | { ok: false; because: "not_paid" | "no_account" | "no_session" };

export async function enterAfterPayment(sessionId: string, io: CookieIO): Promise<EnterAfterPayment> {
  const provisioned = await provisionFromPayment(sessionId);
  if (provisioned.userId === null) return { ok: false, because: "not_paid" };

  const read = await accountStore().accountByCheckoutSession(sessionId);
  if (!read.ok || read.account === null) return { ok: false, because: "no_account" };

  const issued = await issueLink({
    userId: provisioned.userId,
    to: read.account.email,
    purpose: "sign_in",
  });
  if (!issued.issued) return { ok: false, because: "no_session" };

  const redeemed = await redeemLink(io, { tokenHash: issued.tokenHash, type: "magiclink" });
  if (!redeemed.ok) return { ok: false, because: "no_session" };

  return { ok: true, firstSignIn: redeemed.firstSignIn };
}
