// BUILD §2.5 — the sign-in prompt's sentences.
// src/lib/presentation/copy/keys/signin.ts — REQ-098, boards AuthSignIn, AuthCheckEmail, AuthExpired, AuthConfirm.
//
// What REQ-098 c2 fixes verbatim, and where canvas v36 cut it, is in
// docs/spec/decisions/2026-11-01-2268.md. Every address gets the same
// answer, `signin.link_requested` (SPEC §3).
import type { CopyPartition } from "../registry.ts";

export const SIGNIN_COPY = Object.freeze({
  "signin.heading": ["Welcome back", { slots: {}, fixedBy: "REQ-098 c2" }],
  "signin.body": [
    "Enter the email you paid with. We’ll send you a sign-in link.",
    { slots: {}, fixedBy: "board AuthSignIn" },
  ],
  "signin.field.label": ["Your email", { slots: {}, fixedBy: "issue 1574" }],
  "signin.field.placeholder": ["you@example.com", { slots: {}, fixedBy: "REQ-098 c2" }],
  /** Changed 2026-09-21 (#937): "Send my link" → the board's own word,
   *  which says which link. Drafted (#759). */
  "signin.submit.label": ["Send my sign-in link", { slots: {}, fixedBy: "issue 937" }],

  // REQ-098 open question 3's five lines — the owner's approved sentences
  // (2026-09-10, #459).
  // SPEC §3 (issue 718): one line for every address, saying nothing about
  // whether it has an account. It replaces the three answers this screen
  // used to give (link sent, payment held, no account), which told a
  // stranger who had an account. Owner-owed.
  "signin.link_requested": [
    "If that address has an account, a sign-in link is on its way.",
    { slots: {}, fixedBy: "issue 718" },
  ],
  "signin.address.invalid": ["That doesn’t look like an email address. Check it and try again.", { slots: {}, fixedBy: "REQ-098 c6" }],
  "signin.link_dead": [
    "Links work for 24 hours, and only the newest one works. Nothing in your account changed.",
    { slots: {}, fixedBy: "REQ-098 c7 · board AuthExpired" },
  ],

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
  "signin.sent.head": ["Check your inbox", { slots: {}, fixedBy: "REQ-098 c3" }],
  "signin.sent.to": ["Sent to", { slots: {}, fixedBy: "REQ-098 c3 · board AuthCheckEmail" }],
  "signin.sent.subject": ["Subject", { slots: {}, fixedBy: "board AuthCheckEmail · issue 2268" }],
  "signin.sent.until": ["Works until", { slots: {}, fixedBy: "board AuthCheckEmail · issue 2268" }],
  // `{time}` is the send time plus `SIGNIN_LINK_TTL_H`, on the reader's clock.
  "signin.sent.until.time": ["Tomorrow, {time}", { slots: { time: "text" }, fixedBy: "board AuthCheckEmail · issue 2268" }],
  /** Changed 2026-09-21 (#937). "Send another link" named the wrong act:
   *  the control returns to the empty field, and the reason a reader
   *  presses it is that they typed the wrong address — a second link to
   *  the same place is not what they want. The board says so. Drafted
   *  (#759). */
  "signin.sent.resend": ["Use a different email", { slots: {}, fixedBy: "issue 937" }],
  "signin.expired.head": ["This link no longer works", { slots: {}, fixedBy: "REQ-098 c7" }],
  "signin.expired.submit": ["Send a new link", { slots: {}, fixedBy: "REQ-098 c7" }],
  "signin.expired.field": ["The email you paid with", { slots: {}, fixedBy: "board AuthExpired · issue 2268" }],
  // The page a link lands on: one press spends it (board AuthConfirm).
  "signin.confirm.head": ["Sign in to ReachKit", { slots: {}, fixedBy: "board AuthConfirm · issue 2099" }],
  "signin.confirm.submit": ["Sign in", { slots: {}, fixedBy: "board AuthConfirm · issue 2099" }],
  "signin.confirm.line": ["Press the button to finish.", { slots: {}, fixedBy: "board AuthConfirm · issue 2099" }],
  "signin.confirm.change.head": ["Confirm your new email", { slots: {}, fixedBy: "board AuthConfirm · issue 2099" }],
  "signin.confirm.change.submit": ["Confirm", { slots: {}, fixedBy: "board AuthConfirm · issue 2099" }],

  /** Under the sent facts: before a reader goes looking in a spam folder. */
  "signin.sent.terms": [
    "Not there in a minute? Check your spam folder.",
    { slots: {}, fixedBy: "board AuthCheckEmail" },
  ],
}) satisfies CopyPartition;
