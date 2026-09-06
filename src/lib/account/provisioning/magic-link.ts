// src/lib/account/provisioning/magic-link.ts — BUILD §13
//
// One request for a sign-in link, three answers, each in its own written
// line — and never an access check.
//
// REQ-020 criterion 4 is emphatic about who is *not* in the "no account"
// branch: "never a customer whose account exists and whose paid-through
// date has passed, who is still sent a link and can still sign in". A
// lapsed customer signs in, sees their billing page and decides what to do.
// Gating this function on access would lock them out of the one screen that
// lets them come back — so this file imports nothing from
// `src/lib/account/billing/**`, and the eslint fence
// (`local/no-billing-internal-import`) makes that structural rather than
// remembered.
//
// **The three answers are three lines, not one line with a variable.** A
// held payment and an unknown address are different facts about a person's
// standing with this product, and telling them apart is the difference
// between "your money arrived, we are opening it" and "we have never heard
// of you". `signin.payment_held` and `signin.no_account` are distinct keys
// for exactly that reason.
//
// **Nothing is said about an address until one is given.** This function's
// only input is the address; there is no path by which it reports on any
// other (REQ-020 c5).
import { accountStore } from "../store";
import { sendSignInLink } from "./sign-in-mail";
import { heldPaymentFor } from "./held-payment";

/** Three answers to one request. Each `lineKey` names the copy key whose
 *  sentence the sign-in screen speaks for that branch. */
export type MagicLinkAnswer =
  | { sent: true }
  | { sent: false; answer: "payment_held_account_opening"; lineKey: "signin.payment_held" }
  | { sent: false; answer: "no_account"; lineKey: "signin.no_account" };

export async function requestMagicLink(email: string): Promise<MagicLinkAnswer> {
  const address = email.trim().toLowerCase();

  const read = await accountStore().accountByEmail(address);
  if (read.ok && read.account !== null) {
    // An account exists. Whether it is paid up is not asked, here or
    // anywhere on this path.
    await sendSignInLink({ userId: read.account.id, email: read.account.email });
    return { sent: true };
  }

  // No account. Either their payment is with us and the account is being
  // opened, or we have never heard of this address. An unreadable store
  // takes the second branch rather than the first: claiming to hold
  // somebody's payment when we cannot see whether we do is the one thing
  // neither line may say wrongly.
  const held = await heldPaymentFor(address);
  return held
    ? { sent: false, answer: "payment_held_account_opening", lineKey: "signin.payment_held" }
    : { sent: false, answer: "no_account", lineKey: "signin.no_account" };
}
