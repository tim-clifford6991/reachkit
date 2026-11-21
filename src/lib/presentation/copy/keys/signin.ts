// BUILD §2.5 — the sign-in prompt's sentences.
// src/lib/presentation/copy/keys/signin.ts — REQ-098, boards AuthSignIn, AuthCheckEmail, AuthExpired.
//
// What REQ-098 c2 fixes verbatim, and where canvas v36 cut it, is in
// docs/SPEC.md §3 Sign-in board. Every address gets the same
// answer, `signin.link_requested` (SPEC §3).
import type { CopyPartition } from "../registry.ts";

export const SIGNIN_COPY = Object.freeze({
  "signin.heading": "Welcome Back",
  "signin.body": "Enter the email you paid with. We’ll send you a sign-in link.",
  // A return from Checkout that could not sign the buyer in: true whether or not the payment went through.
  "signin.checkout_return": "If you paid, your sign-in link is on its way to your email. Please don’t pay again; ask for a new link below.",
  // A return whose account is open but could not be signed in: the payment is known to have gone through.
  "signin.checkout_paid": "Your payment went through and your account is ready. Ask for a sign-in link below.",
  "signin.field.label": "Your email",
  "signin.field.placeholder": "you@example.com",
  /** Changed 2026-09-21 (#937): "Send my link" → the board's own word,
   *  which says which link. Drafted (#759). */
  "signin.submit.label": "Send My Sign-In Link",

  // REQ-098 open question 3's five lines — the owner's approved sentences
  // (2026-09-10, #459).
  // SPEC §3 (issue 718): one line for every address, saying nothing about
  // whether it has an account. It replaces the three answers this screen
  // used to give (link sent, payment held, no account), which told a
  // stranger who had an account. Owner-owed.
  "signin.link_requested": "If that address has an account, a sign-in link is on its way.",
  "signin.address.invalid": "That doesn’t look like an email address. Check it and try again.",
  "signin.link_dead": "Links work for 24 hours, and only the newest one works. Nothing in your account changed.",

  // ── The two answered arms (UI-SPEC S9, issue #373) ───────────────────
  //
  // The approved set draws the left panel three ways: the request form, a
  // **sent** arm and an **expired** arm. Each answered arm is a chip, a
  // head, the line the answer already had, and one control back to the
  // form — so the five lines above keep their jobs and only the frame
  // around them is new.
  //
  // The two heads and the two controls are the owner's approved sentences
  // (2026-09-10, #459). The address beside `signin.sent.to` is what the
  // visitor typed, echoed back, never one this screen looked up.
  "signin.sent.head": "Check Your Inbox",
  "signin.sent.to": "Sent to",
  "signin.sent.subject": "Subject",
  "signin.sent.until": "Works until",
  // `{time}` is the send time plus `SIGNIN_LINK_TTL_H`, on the reader's clock.
  "signin.sent.until.time": "Tomorrow, {time}",
  /** Changed 2026-09-21 (#937). "Send another link" named the wrong act:
   *  the control returns to the empty field, and the reason a reader
   *  presses it is that they typed the wrong address — a second link to
   *  the same place is not what they want. The board says so. Drafted
   *  (#759). */
  "signin.sent.resend": "Use a Different Email",
  "signin.expired.head": "This Link No Longer Works",
  "signin.expired.submit": "Send a New Link",
  "signin.expired.field": "The email you paid with",
  // A link opened by a scanner or a prefetch is left unspent, so the line says it still works.
  "signin.link_open": "Your link is still good. Enter your email and we'll send one that opens straight in here.",

  /** Under the sent facts: before a reader goes looking in a spam folder. */
  "signin.sent.terms": "Not there in a minute? Check your spam folder.",
}) satisfies CopyPartition;
