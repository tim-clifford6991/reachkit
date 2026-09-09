// src/lib/presentation/copy/keys/draft.ts — BP-020 decision 5, WO-041
//
// The draft view's sentences. Empty until 2026-09-06; issue #17 (BUILD
// §4.6's draft view) fills it and touches no other partition.
//
// Twenty keys, in three standings — the same three the registry already
// distinguishes, applied by one rule rather than by taste:
//
//  - **Ruled (8).** Every one is a transcription of a word or a phrase
//    `BUILD.md` §4.6 or §9 itself prints, on the same footing as the twenty
//    `calendar.*` values issue #16 transcribed (constitution rule 1.2:
//    copying a recorded owner ruling is not inventing one). Nothing here is
//    composed:
//
//      `draft.action.*`        — §4.6's own three controls, named there:
//                                "Approve/Edit/Veto".
//      `draft.copy.*`          — §9's "Everything else = copy as
//                                Markdown/HTML (always shown)", read as the
//                                two controls that clause describes.
//      `draft.do-nothing.title`— §4.6's own quoted phrase: the "what happens
//                                if you do nothing" info box, sentence-cased.
//      `draft.editor.tab.*`    — §4.6's two panes, named there: "Edit =
//                                Markdown textarea with a live preview pane".
//
//  - **Awaiting copy (8), value `TODO(copy)`.** `CLAUDE.md`'s standing rule,
//    and the standing DECISIONS 2026-09-05 gives a key "a screen must render
//    something for": a badge with no word, a link with no label and an
//    indicator that says nothing are each worse than a visibly unwritten
//    one. The four claim words, the grounded block's heading, the back
//    link, the unsaved indicator and the not-found line are all of that
//    kind.
//
//  - **Owner-owed and empty (4).** Every *composed sentence* this screen
//    speaks: the two "if you do nothing" outcomes, the edited-since note,
//    and the line naming the do-not-claim entry that held the draft. Each
//    is read through the shell's `writtenLine`, which renders an owner-owed
//    key as nothing (issue #9) — a marker is the wrong standing for a
//    sentence a customer would otherwise read as product copy (issue #15's
//    rule, unchanged).
//
// The values customer-facing here that are *not* keys are values, not
// voice: the source URL, the date it was read, the matched entry's own
// text and the body itself. §2.3 covers them (mono), the registry does not.
import type { CopyPartition } from "../registry.ts";

export const DRAFT_COPY = Object.freeze({
  // §4.6's three controls, over the declared publishing interface.
  "draft.action.approve": ["Approve", { slots: {}, fixedBy: "BUILD §4.6" }],
  "draft.action.edit": ["Edit", { slots: {}, fixedBy: "BUILD §4.6" }],
  "draft.action.veto": ["Veto", { slots: {}, fixedBy: "BUILD §4.6" }],

  // §9's copy-out, "always shown".
  "draft.copy.markdown": ["Copy as Markdown", { slots: {}, fixedBy: "BUILD §9" }],
  "draft.copy.html": ["Copy as HTML", { slots: {}, fixedBy: "BUILD §9" }],

  // §4.6's info box, and its two arms.
  "draft.do-nothing.title": [
    "What happens if you do nothing",
    { slots: {}, fixedBy: "BUILD §4.6" },
  ],
  "draft.do-nothing.autopilot": ["", { slots: { at: "date" }, fixedBy: "REQ-045 c4" }],
  "draft.do-nothing.copilot": ["", { slots: {}, fixedBy: "REQ-045 c4" }],

  // §4.6's two editor panes.
  "draft.editor.tab.markdown": ["Markdown", { slots: {}, fixedBy: "BUILD §4.6" }],
  "draft.editor.tab.preview": ["Preview", { slots: {}, fixedBy: "BUILD §4.6" }],

  // The four claim-check outcomes REQ-045 c3 requires to be stated in every
  // case, including the empty list. Each is a badge's word.
  "draft.claim.passed": ["claim-checked", { slots: {}, fixedBy: "REQ-045 c3 · UI-SPEC S16 (11a)" }],
  "draft.claim.failed": ["TODO(copy)", { slots: {}, fixedBy: "REQ-045 c11" }],
  "draft.claim.outstanding": [
    "claim check running",
    { slots: {}, fixedBy: "REQ-045 c9 · UI-SPEC S17 (11a)" },
  ],
  "draft.claim.nothing-to-check": ["TODO(copy)", { slots: {}, fixedBy: "REQ-045 c3" }],
  // c11's own sentence. The entry itself renders beside it as a value, so
  // the customer is told which entry held the draft whether or not this
  // sentence has been written.
  "draft.claim.matched": ["", { slots: { entry: "text" }, fixedBy: "REQ-045 c11" }],

  // §4.6's grounded-fact block, its heading and — where the customer has
  // edited — the note that keeps the generated-content label from claiming
  // their words (REQ-093 c2's non-goal).
  "draft.grounded.title": ["TODO(copy)", { slots: {}, fixedBy: "REQ-045 c2" }],
  "draft.authorship.edited": ["", { slots: { at: "date" }, fixedBy: "REQ-045 c1" }],

  // The back link §4.6 asks for, the unsaved indicator c7 asks for, and the
  // one written line an unknown draft id resolves to.
  "draft.back": ["← Back to calendar", { slots: {}, fixedBy: "BUILD §4.6 · UI-SPEC S16 (11a)" }],
  "draft.unsaved": [
    "could not save — your text is kept here; nothing unsaved publishes",
    { slots: {}, fixedBy: "REQ-045 c7 · UI-SPEC S17 (11a)" },
  ],
  "draft.not-found": ["TODO(copy)", { slots: {}, fixedBy: "REQ-045 c1" }],
}) satisfies CopyPartition;
