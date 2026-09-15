// src/lib/account/provisioning/magic-link.ts — SPEC §3, issue 718
//
// One request for a sign-in link, one answer — and never an access check.
//
// **The answer is the same whatever the address** (SPEC §3: "Sign-in copy
// is identical whatever the address, revealing nothing about who has an
// account"). An address with an account is mailed a link; an address with
// none is mailed nothing; and the caller is told exactly the same thing in
// both cases, in a shape with no member that could differ. Who has an
// account is a fact the sign-in screen must not be able to learn, so this
// function does not hand it one.
//
// It used to answer three ways — sent, "your payment is held and the
// account is opening", and "there is no account for that address" — which
// is an address oracle for anyone with a list of emails. The held-payment
// lookup went with it: a paid account is opened by the webhook, and its
// first link is mailed from there, not from this screen.
//
// **A lapsed customer is still sent a link.** Whether an account is paid up
// is not asked here or anywhere on this path: a lapsed customer signs in,
// sees their billing page and decides what to do. Gating this function on
// access would lock them out of the one screen that lets them come back —
// so this file imports nothing from `src/lib/account/billing/**`, and the
// eslint fence (`local/no-billing-internal-import`) makes that structural
// rather than remembered.
import { accountStore } from "../store";
import { sendSignInLink } from "./sign-in-mail";

/** The one answer every request gets. No member says whether a link left. */
export type MagicLinkAnswer = { readonly answered: true };

const ANSWERED: MagicLinkAnswer = Object.freeze({ answered: true });

export async function requestMagicLink(email: string): Promise<MagicLinkAnswer> {
  const address = email.trim().toLowerCase();

  const read = await accountStore().accountByEmail(address);
  if (read.ok && read.account !== null) {
    await sendSignInLink({ userId: read.account.id, email: read.account.email });
  }
  return ANSWERED;
}
