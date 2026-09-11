// src/lib/presentation/copy/keys/danger.ts — BP-020 decision 5, WO-041
//
// The destructive-action surfaces' sentences. No string was seeded here at
// WO-041. The block that owns each destructive-action
// surface fills this file and touches no other partition.
//
// 2026-09-05: issue #18 (BUILD §4.7) fills the danger zone Settings carries.
// The split is the same one `keys/settings.ts` states: a word or sentence
// §4.7 itself prints is transcribed verbatim; a sentence nothing in the spec
// writes is the owner's.
//
// The two consequence lines are the owner's half.
// §4.7 states the danger zone's standing promise — "pages are exported to
// you first, never silently destroyed" — and that line is transcribed below
// and rendered on the card at rest. What each of the two actions does to
// *this* customer, stated before it runs (REQ-078/REQ-079, issue #52), is a
// sentence no clause writes, so its words are the owner's. The two-step
// disclosure is structural: each key is a written line inside a step that
// exists regardless.
//
// 2026-09-10, issue #460: every sentence this partition still owed is now
// written — the owner approved the master's drafted set ("copy proposal
// approved", proposal sheet
// https://claude.ai/code/artifact/546f45a0-a996-4d25-b85e-fb03fda7b102)
// and the strings land here byte for byte. The values that approval names
// are the owner's; nothing here is composed.
import type { CopyPartition } from "../registry.ts";

export const DANGER_COPY = Object.freeze({
  "danger.zone.title": ["Danger zone", { slots: {}, fixedBy: "BUILD §4.7" }],
  "danger.unpublish-all": ["unpublish all", { slots: {}, fixedBy: "BUILD §4.7" }],
  "danger.delete-account": ["delete account", { slots: {}, fixedBy: "BUILD §4.7" }],
  // §4.7 verbatim, including its lower-case opening.
  "danger.export-first": [
    "pages are exported to you first, never silently destroyed",
    { slots: {}, fixedBy: "BUILD §4.7" },
  ],
  // 2026-09-07, issue #259: both were the empty value and rendered as
  // nothing. The screen rule has no exceptions (#242, #255) — an owed
  // sentence renders the marker wherever it is owed — and these two are the
  // sentence REQ-079 c1 puts *between* a press and a destroyed page, so a
  // customer reading nothing there is the worst place in the product for
  // this family to have kept its exception.
  "danger.unpublish-all.consequence": ["Takes every page down at every destination and switches publishing off. Your account, your drafts and your plan stay, and you can switch publishing on again later. Your pages are exported to you first.", { slots: {}, fixedBy: "REQ-079 c1" }],
  "danger.delete-account.consequence": ["Takes every page down, ends the plan at once with no further charge, and closes the account for good — it does not survive this. Your pages are exported to you first.", { slots: {}, fixedBy: "REQ-079 c1" }],

  // Issue #52 — the three lines the danger zone's own outcomes are told in.
  // The words are the owner's: REQ-079 states what each must convey and no
  // clause writes them.
  //
  // c3, the refusal: "if it cannot be produced, or they do not take it, the
  // action does not proceed and says why."
  "danger.export-failed": ["Your export wasn’t taken in full, so the action didn’t run.", { slots: {}, fixedBy: "REQ-079 c3" }],
  // c4's last clause, the two arms of what an unpublish-everything run
  // leaves behind: "the pages at any destination that could not be reached
  // are listed as still live with one written line saying so", and the line
  // for a run that left none.
  "danger.some-still-live": ["Some pages are still live: their destination couldn’t be reached. They are listed below.", { slots: {}, fixedBy: "REQ-079 c4" }],
  "danger.all-taken-down": ["Every page is down. Nothing is still live at any destination.", { slots: {}, fixedBy: "REQ-079 c4" }],

  // 2026-09-07, issue #259 — the sentences the ticket-and-download
  // handshake speaks, now that a screen reaches it. Every one is a
  // *screen's*.
  //
  // REQ-079 c3's two gates, in the order the criterion states them.
  // `export-taken` says only that the archive left this process, which is
  // the strongest claim anything on this side can make — `markExportTaken`
  // is stamped after the last byte, and nothing here can know the customer
  // holds the file.
  "danger.export-take": ["Take your export first", { slots: {}, fixedBy: "REQ-079 c3" }],
  // No slots: `danger_tickets` keeps the stamp and not the archive's name
  // or its page count, so the line says the archive left and no more. A
  // slot naming a file this side cannot re-derive would be a sentence the
  // screen could not fill.
  "danger.export-taken": ["Export handed over", { slots: {}, fixedBy: "REQ-079 c3" }],

  // c2's typed confirmation. The label and the placeholder are one key —
  // the `/signin` precedent — and `{word}` is what the customer must type.
  "danger.type-to-confirm": ["Type “{word}” to confirm", { slots: { word: "text" }, fixedBy: "REQ-079 c2" }],

  /* The word itself, one key per action (owner ruling, 2026-09-07).
   *
   * **The customer types the words §4.7 prints, never the engine's tag.**
   * `confirmationFor(action)` answers `delete_account` / `unpublish_all` —
   * an internal identifier with an underscore in it — and stays engine-
   * internal. What the customer reads in `{word}` and types into the field
   * is this registry value, and the comparison is against this value on
   * both sides, trimmed and case-insensitively.
   *
   * Two keys and not one with the action interpolated: they are two words
   * the owner writes, and a single key with a slot would make the product's
   * two most destructive confirmations share one sentence. */
  "danger.confirm-word.unpublish-all": ["unpublish all", { slots: {}, fixedBy: "REQ-079 c2" }],
  "danger.confirm-word.delete-account": ["delete account", { slots: {}, fixedBy: "REQ-079 c2" }],

  /* What a refused handshake leaves behind, and what a completed one took.
   *
   * `nothing-changed` is c3's other half said plainly: the action did not
   * proceed, so no page came down, no account went and no subscription
   * ended. It is a second sentence beside `export-failed` because that one
   * says *why* and this one says *what is still true*, and a customer
   * reading only the first cannot tell whether their pages survived.
   *
   * `taken-down-count` carries c5's switch: a run that took pages down also
   * switches publishing off, and it stays off until the customer switches
   * it on themselves. The count is the run's own `takenDown`. */
  "danger.nothing-changed": ["Nothing changed: your pages, your account and your plan are as they were.", { slots: {}, fixedBy: "REQ-079 c3" }],
  "danger.taken-down-count": [
    "Pages taken down: {pages}. Publishing is now off and stays off until you switch it on.",
    { slots: { pages: "text" }, fixedBy: "REQ-079 c4 · c5" },
  ],
}) satisfies CopyPartition;
