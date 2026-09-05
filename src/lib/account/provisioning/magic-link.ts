// src/lib/account/provisioning/magic-link.ts — §13, REQ-098 c3, REQ-020 c4 (issue #19)
//
// **The declared sign-in-link seam, and nothing behind it yet.** §1's
// "magic-link auth" and §13's "send magic link → /setup". Issue #35 builds
// the identity half — `auth_links`, `issueLink`, `redeemLink`,
// `currentSession`, `signOut` — and this function's body with it. The
// signature below is BP-032's, verbatim: one function, three branches,
// "because they are three answers to one request".
//
// **No section marker, deliberately** — same reason as
// `src/lib/account/checkout/session.ts`: the drift audit reads such a
// citation as "built", and no link is sent from here. #35 adds it with
// the body.
//
// **The stub throws; it never answers `{ sent: true }`.** Reporting a link
// as sent when no mail left the process is the one answer this screen must
// never give (REQ-098 c3), so the seam refuses rather than guesses.

/** BP-032, verbatim. Never consults access: a customer past their
 *  paid-through date is sent a link and can sign in (REQ-076 c5, REQ-020
 *  c4). Each `lineKey` names the copy key whose sentence the sign-in screen
 *  speaks for that branch. */
export type MagicLinkAnswer =
  | { sent: true }
  | { sent: false; answer: "payment_held_account_opening"; lineKey: "signin.payment_held" }
  | { sent: false; answer: "no_account"; lineKey: "signin.no_account" };

export class MagicLinkNotImplementedError extends Error {
  constructor() {
    super(
      "requestMagicLink is declared, not implemented: the identity half is issue #35. " +
        "No sign-in link was issued and no mail was sent."
    );
    this.name = "MagicLinkNotImplementedError";
  }
}

/**
 * Answers one sign-in request for `email`.
 *
 * Throws `MagicLinkNotImplementedError` until issue #35 supplies the body.
 */
export async function requestMagicLink(email: string): Promise<MagicLinkAnswer> {
  // Named and discarded, deliberately: this file must not read, log or
  // store the address it is given — an address is exactly the fact this
  // seam's own policy exists to keep quiet about (REQ-020 criterion 5).
  void email;
  throw new MagicLinkNotImplementedError();
}
