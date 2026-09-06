// src/lib/presentation/copy/keys/signin.ts — REQ-098, REQ-020 c4 (issue #19)
//
// The sign-in screen's sentences — the thirteenth partition, added under the
// same rule `offer.ts` records for the twelfth (see its header): BP-020
// decision 5 named eleven partitions before the seven BP-001-owned surfaces
// existed, and the sign-in screen's sentences have no module in that list.
// Declared here, where the partition list is written once anyway, so
// `registry.ts` keeps exactly one author.
//
// **Six values are filled; five are owner-owed and empty.** The six are not
// this file's invention: REQ-098 criterion 2 states them *verbatim* — "then
// it carries these strings verbatim: the heading …; the body …; the email
// input's placeholder …; the submit control's label …; and beneath that
// control the line 'New to ReachKit? Start a free scan →'" — and REQ-098's
// own rationale records them as the owner's transcription from the live
// page. Transcribing an approved requirement's own quoted string is the
// footing `unmeasured.dash` ("—", REQ-004 c2) and `mail.shell.wordmark`
// ("ReachKit") already stand on. Byte note, flagged rather than silently
// normalised: REQ-098 c2 writes "we'll" with U+0027 APOSTROPHE, where the
// owner's 2026-09-04 ruling sheet declares U+2019 as the convention. The
// requirement's own bytes are what is transcribed here; the owner may
// normalise it in one line.
//
// The five remaining values are the ones REQ-098's third open question names
// as "written nowhere" — the link-sent line (c3), REQ-020 criterion 4's two
// answers (already booked against `signin.payment_held` and
// `signin.no_account` by BP-032's `requestMagicLink`), the malformed-address
// line (c6) and the dead-link line (c7, BP-061's `redeemLink` lineKey). Each
// carries `CLAUDE.md`'s `TODO(copy)` marker rather than the empty value, on
// exactly the ground issue #13 records for `offer.cancel_self_service`: an
// empty value makes `copy()` throw, which takes the whole screen down and
// hides the four arms that *are* finished from the review the owner has to
// do to write the fifth. Renderable is not invisible — `AWAITING_COPY`
// counts them, and none is a sentence anyone wrote.
//
// The line the field's visible *label* renders is not among criterion 2's
// six: the requirement fixes the placeholder and says nothing about a
// label, and `Input` requires one with no default (BP-018 decision 2). The
// surface reuses `signin.field.placeholder` for both, exactly as
// `src/app/(public)/page.tsx` reuses `landing.field.label` for both, and no
// seventh key is minted here to hold a sentence nobody has written.
import type { CopyPartition } from "../registry.ts";

export const SIGNIN_COPY = Object.freeze({
  "signin.heading": ["Welcome back", { slots: {}, fixedBy: "REQ-098 c2" }],
  "signin.body": [
    "Enter the email you paid with and we'll send you a sign-in link. No password — accounts are created by payment, never by a signup form.",
    { slots: {}, fixedBy: "REQ-098 c2" },
  ],
  "signin.field.placeholder": ["you@company.com", { slots: {}, fixedBy: "REQ-098 c2" }],
  "signin.submit.label": ["Send my link", { slots: {}, fixedBy: "REQ-098 c2" }],
  // Criterion 2's last string is one line with a link inside it — "New to
  // ReachKit? Start a free scan →", "whose 'Start a free scan →' is a
  // link". Two keys, because one of the two halves is an anchor and the
  // other is not; concatenated with a single space they are the line the
  // criterion quotes, byte for byte.
  "signin.new.prompt": ["New to ReachKit?", { slots: {}, fixedBy: "REQ-098 c2" }],
  "signin.new.link": ["Start a free scan →", { slots: {}, fixedBy: "REQ-098 c2" }],

  // Awaiting copy (REQ-098 open question 3): the marker renders, so the arm
  // that speaks each line is visible and reviewable, and the sentence is
  // still the owner's to write.
  "signin.link_sent": ["TODO(copy)", { slots: {}, fixedBy: "REQ-098 c3" }],
  "signin.payment_held": ["TODO(copy)", { slots: {}, fixedBy: "REQ-020 c4" }],
  "signin.no_account": ["TODO(copy)", { slots: {}, fixedBy: "REQ-020 c4" }],
  "signin.address.invalid": ["TODO(copy)", { slots: {}, fixedBy: "REQ-098 c6" }],
  "signin.link_dead": ["TODO(copy)", { slots: {}, fixedBy: "REQ-098 c7" }],
}) satisfies CopyPartition;
