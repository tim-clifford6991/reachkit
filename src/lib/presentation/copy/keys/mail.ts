// src/lib/presentation/copy/keys/mail.ts — BP-020 decision 5, WO-041
//
// The mail seam's sentences, BP-016 and BP-029. Two keys seeded (WO-041
// step 4): the opt-out confirmation and invalid-token lines. Empty value,
// owner-owed — no string is written here (constitution §1). BP-029 owns
// the opt-out surface and lives in src/lib/mail/leads/**, so this is
// already the right module for its two lines; no thirteenth partition is
// needed for them.
//
// 2026-09-04: the owner ruled on both (WO-041 `## Log`, this date's
// ruling) — filled verbatim, byte for byte. Neither is owner-owed any
// more.
import type { CopyPartition } from "../registry.ts";

export const MAIL_COPY = Object.freeze({
  "optout.confirmed": ["You’re unsubscribed. ReachKit won’t email you again — about this site or any other.", { slots: {}, fixedBy: "REQ-011 c3" }],
  "optout.invalid": ["That unsubscribe link isn’t valid any more. Reply to any ReachKit email with \"stop\" and we’ll stop by hand.", { slots: {}, fixedBy: "REQ-011 c3" }],

  // 2026-09-05, issue #30 (the mail seam, BUILD §12). Six keys the shell
  // and the whole-mail line need. Five are owner-owed and empty: every one
  // of them is a sentence the product speaks in its own voice, so none is
  // written here (constitution §1 / CLAUDE.md "never invent copy"). The
  // sixth is the product's own name, transcribed — not a sentence, on the
  // same footing as the em-dash and the removal address that two other
  // partitions transcribe. (Those two keys are not named here: issue #28's
  // `tests/app/scan-address/removal.test.tsx` asserts one of them appears
  // in exactly one file under `src/`, and a comment naming it is a second.)
  //
  // Note on the empty five: `copy()` throws on an owner-owed key, so a
  // mail that would carry one of these lines fails loudly at compose time
  // rather than shipping an empty line to a customer. That is the intended
  // behaviour and `tests/mail/shell/whole-mail-line.test.ts` asserts it,
  // written so it keeps discriminating once the owner fills them.
  "mail.shell.wordmark": ["ReachKit", { slots: {}, fixedBy: "§12" }],
  "mail.nothing_to_report": ["", { slots: {}, fixedBy: "§12" }],
  "mail.week_unmeasured": ["", { slots: { nextDue: "date" }, fixedBy: "§12" }],
  "mail.week_partly_measured": ["", { slots: { sections: "text" }, fixedBy: "§12" }],
  "mail.unsubscribe.label": ["", { slots: {}, fixedBy: "§12" }],
  "mail.optout.label": ["", { slots: {}, fixedBy: "§12" }],

  // 2026-09-05, issue #31 (lead capture, the giveaway page and the nurture
  // sequence, `BUILD.md` §4.2). Twenty-one keys, every one owner-owed and
  // empty: each is a sentence the product speaks in its own voice, so none
  // is written here (constitution §1 / CLAUDE.md "never invent copy").
  // `copy()` throws on an owner-owed key, so a mail or a response that
  // would carry one of these fails loudly rather than shipping a blank
  // line to a founder.
  //
  // The four `mail.firstPageUnavailable.<cause>` keys are named for the
  // four `FirstPageFailure` members verbatim: `FIRST_PAGE_UNAVAILABLE_COPY`
  // (`src/lib/mail/leads/giveaway.ts`) is a `Record` over that union, so a
  // cause with no key of its own is a compile error — which is what makes
  // REQ-010 criterion 7's "and why" enforceable rather than aspirational.

  // The page itself (REQ-010 c4).
  "mail.firstPage.subject": ["", { slots: {}, fixedBy: "REQ-010 c4" }],
  "mail.firstPage.target_search": ["", { slots: { query: "text" }, fixedBy: "REQ-010 c4" }],
  "mail.firstPage.volume_label": ["", { slots: {}, fixedBy: "REQ-010 c4" }],
  "mail.firstPage.volume_note": ["", { slots: {}, fixedBy: "REQ-010 c4" }],
  "mail.firstPage.first_of_n": ["", { slots: { pagesFound: "text" }, fixedBy: "REQ-010 c4" }],

  // The message that closes the request when no page is coming (c7), one
  // line per cause.
  "mail.firstPageUnavailable.subject": ["", { slots: {}, fixedBy: "REQ-010 c7" }],
  "mail.firstPageUnavailable.no-page-to-write": ["", { slots: {}, fixedBy: "REQ-010 c7" }],
  "mail.firstPageUnavailable.writing-failed": ["", { slots: {}, fixedBy: "REQ-010 c7" }],
  "mail.firstPageUnavailable.writing-refused": ["", { slots: {}, fixedBy: "REQ-010 c7" }],
  "mail.firstPageUnavailable.delivery-failed": ["", { slots: {}, fixedBy: "REQ-010 c7" }],

  // The three touches (c9). One subject and one line each; the touch is
  // carried by the key, never by a conditional inside a template.
  "mail.nurture.subject.1": ["", { slots: {}, fixedBy: "REQ-010 c9" }],
  "mail.nurture.subject.2": ["", { slots: {}, fixedBy: "REQ-010 c9" }],
  "mail.nurture.subject.3": ["", { slots: {}, fixedBy: "REQ-010 c9" }],
  "mail.nurture.body.1": ["", { slots: { domain: "text" }, fixedBy: "REQ-010 c9" }],
  "mail.nurture.body.2": ["", { slots: { domain: "text" }, fixedBy: "REQ-010 c9" }],
  "mail.nurture.body.3": ["", { slots: { domain: "text" }, fixedBy: "REQ-010 c9" }],

  // BUILD §4.3's setup reminder (REQ-025 c6). Three keys: the subject, the
  // one line asking them to finish, and the label on the sign-in link that
  // lands them back on the setup screen. Owner-owed as `''`, not as the
  // `TODO(copy)` marker the two setup *screens* use — DECISIONS 2026-09-05:
  // "mail keeps the throw (a mail never ships a placeholder)", and a
  // reminder that went out reading `TODO(copy)` would be worse than one
  // that did not go out.
  "mail.setupReminder.subject": ["", { slots: {}, fixedBy: "REQ-025 c6" }],
  "mail.setupReminder.body": ["", { slots: {}, fixedBy: "REQ-025 c6" }],
  "mail.setupReminder.action": ["", { slots: {}, fixedBy: "REQ-025 c6" }],

  // What `POST /api/lead` answers with. The adapter maps each arm of
  // `captureLead()` to one of these keys and never to a sentence of its
  // own or a vendor payload (REQ-003 c10, REQ-010 c1).
  "lead.accepted": ["", { slots: {}, fixedBy: "REQ-010 c1" }],
  "lead.invalid_address": ["", { slots: {}, fixedBy: "REQ-010 c1" }],
  "lead.unavailable": ["", { slots: {}, fixedBy: "REQ-003 c10" }],

  // The third arm of the opt-out page: the link is good and our store is
  // not. Telling the reader their link is invalid would be a false
  // statement about the one thing they came to do.
  "optout.unavailable": ["", { slots: {}, fixedBy: "REQ-010 c11" }],

  // 2026-09-06, issue #33 (Stripe, provisioning and the two backstops,
  // `BUILD.md` §13). Nine keys, every one owner-owed and empty. Empty and
  // not the `TODO(copy)` marker: the owner's 2026-09-05 ruling on #93 is
  // that fixture *screens* render the marker and "mail keeps the throw (a
  // mail never ships a placeholder)". Every line below is a sentence the
  // product speaks in its own voice, so none is written here.
  //
  // Two of the nine (`mail.account.reach_a_person`,
  // `mail.account.no_second_subscription`) carry obligations REQ-024
  // states in words rather than in structure — "names one way to reach a
  // person", "is told that it bought no second subscription" — and are
  // separate keys rather than clauses inside another line so that a mail
  // missing one fails to compose rather than shipping without it.

  // The sign-in link a completed payment sends (§13, REQ-024 c1).
  "mail.magicLink.subject": ["", { slots: {}, fixedBy: "REQ-024 c1" }],
  "mail.magicLink.body": ["", { slots: {}, fixedBy: "REQ-024 c1" }],
  "mail.magicLink.action": ["", { slots: {}, fixedBy: "REQ-024 c1" }],

  // The 15-minute chase (REQ-024 c5): the payment succeeded, and either a
  // working link or a written statement that the account is not open yet.
  // Two bodies, not one with a conditional: "here is your way in" and "we
  // are still opening it" are two different things to say.
  "mail.account.chase.subject": ["", { slots: {}, fixedBy: "REQ-024 c5" }],
  "mail.account.chase.link_ready": ["", { slots: {}, fixedBy: "REQ-024 c5" }],
  "mail.account.chase.not_open_yet": ["", { slots: {}, fixedBy: "REQ-024 c5" }],

  // The second-purchase mail (REQ-024 c3): what a founder whose second
  // purchase was charged is told.
  "mail.account.second_purchase.subject": ["", { slots: {}, fixedBy: "REQ-024 c3" }],
  "mail.account.no_second_subscription": ["", { slots: {}, fixedBy: "REQ-024 c3" }],

  // The one way to reach a person, named in every `account` mail REQ-024
  // requires it in (c3, c5). One key, so the address is written once.
  "mail.account.reach_a_person": ["", { slots: {}, fixedBy: "REQ-024 c5" }],
}) satisfies CopyPartition;
