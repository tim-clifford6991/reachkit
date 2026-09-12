// src/lib/presentation/copy/keys/draft.ts — BP-020 decision 5, WO-041
//
// The draft view's sentences. Empty until 2026-09-06; issue #17 (BUILD
// §4.6's draft view) fills it and touches no other partition.
//
// Twenty keys until issue #355, in three standings — the same three the
// registry already distinguishes, applied by one rule rather than by taste.
// #355 adds nineteen and corrects two, all of them ruled: the approved
// screen set draws S16 and S17 in full and ruling 11a of 2026-09-08 makes
// its unbracketed strings approved copy as written. Nothing in this
// partition is bracketed in the set, so nothing #355 adds is owed —
// the rail's two labels, the four check sentences, the written line's two
// arms, and S17's nine. The two corrections are `draft.copy.markdown` and
// `.html`, which said "Copy as Markdown"/"Copy as HTML" and now say the
// two formats, under a card head that already says what the pair does.
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
//  - **Awaiting copy (8), value `TODO(copy)` until filled.** `CLAUDE.md`'s
//    standing rule,
//    and the standing DECISIONS 2026-09-05 gives a key "a screen must render
//    something for": a badge with no word, a link with no label and an
//    indicator that says nothing are each worse than a visibly unwritten
//    one. The four claim words, the grounded block's heading, the back
//    link, the unsaved indicator and the not-found line were all of that
//    kind; #355 (ruling 11a) and #460 have written every one.
//
//  - **Owner-owed and empty (4) until #460.** Every *composed sentence* this screen
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
//
// 2026-09-10, issue #460: every sentence this partition still owed is now
// written — the owner approved the master's drafted set ("copy proposal
// approved", proposal sheet
// https://claude.ai/code/artifact/546f45a0-a996-4d25-b85e-fb03fda7b102) and
// the strings land here byte for byte. The values named in the approval
// file are the owner's; nothing here is composed.
import type { CopyPartition } from "../registry.ts";

export const DRAFT_COPY = Object.freeze({
  // §4.6's three controls, over the declared publishing interface.
  "draft.action.approve": ["Approve", { slots: {}, fixedBy: "BUILD §4.6" }],
  "draft.action.edit": ["Edit", { slots: {}, fixedBy: "BUILD §4.6" }],
  "draft.action.veto": ["Veto", { slots: {}, fixedBy: "BUILD §4.6" }],

  // §9's copy-out, "always shown" — the card the approved S16 draws it on,
  // its two controls and the chip that says whose the words are. The two
  // control words were "Copy as Markdown" / "Copy as HTML" until ruling 11a:
  // the set writes them as the formats they produce, and the card head above
  // them already says what the two buttons do.
  "draft.copy.title": ["Copy it out", { slots: {}, fixedBy: "BUILD §9 · S16 (11a)" }],
  "draft.copy.note": [
    "yours, for any destination",
    { slots: {}, fixedBy: "REQ-045 c12 · S16 (11a)" },
  ],
  "draft.copy.markdown": ["Markdown", { slots: {}, fixedBy: "BUILD §9 · S16 (11a)" }],
  "draft.copy.html": ["HTML", { slots: {}, fixedBy: "BUILD §9 · S16 (11a)" }],

  // §4.6's info box, and its two arms.
  "draft.do-nothing.title": [
    "What happens if you do nothing",
    { slots: {}, fixedBy: "BUILD §4.6" },
  ],
  "draft.do-nothing.autopilot": ["It publishes at {at} unless you veto it.", { slots: { at: "date" }, fixedBy: "REQ-045 c4" }],
  // Minted and empty since §7 (2026-09-11): the mode it speaks for is one
  // no customer can be in, so the arm survives in the machine's types and
  // the sentence is withdrawn from the product.
  "draft.do-nothing.copilot": ["", { slots: {}, fixedBy: "REQ-045 c4 · §7" }],

  // §4.6's two editor panes.
  "draft.editor.tab.markdown": ["Markdown", { slots: {}, fixedBy: "BUILD §4.6" }],
  "draft.editor.tab.preview": ["Preview", { slots: {}, fixedBy: "BUILD §4.6" }],

  // The four claim-check outcomes REQ-045 c3 requires to be stated in every
  // case, including the empty list. Each is a badge's word.
  "draft.claim.passed": ["claim-checked", { slots: {}, fixedBy: "REQ-045 c3 · S16 (11a)" }],
  "draft.claim.failed": ["claim check failed", { slots: {}, fixedBy: "REQ-045 c11" }],
  "draft.claim.outstanding": [
    "claim check running",
    { slots: {}, fixedBy: "REQ-045 c9 · S17 (11a)" },
  ],
  "draft.claim.nothing-to-check": ["no never-claim list", { slots: {}, fixedBy: "REQ-045 c3" }],
  // c11's own sentence. The entry itself renders beside it as a value, so
  // the customer is told which entry held the draft whether or not this
  // sentence has been written.
  "draft.claim.matched": ["This draft matches “{entry}” on your never-claim list, so it’s held until the text changes.", { slots: { entry: "text" }, fixedBy: "REQ-045 c11" }],

  // §4.6's grounded-fact block, its heading and — where the customer has
  // edited — the note that keeps the generated-content label from claiming
  // their words (REQ-093 c2's non-goal).
  "draft.grounded.title": ["Grounded fact", { slots: {}, fixedBy: "REQ-045 c2" }],
  "draft.authorship.edited": ["edited by you since {at}", { slots: { at: "date" }, fixedBy: "REQ-045 c1" }],

  // The back link §4.6 asks for, the unsaved indicator c7 asks for, and the
  // one written line an unknown draft id resolves to.
  "draft.back": ["← Back to calendar", { slots: {}, fixedBy: "BUILD §4.6 · S16 (11a)" }],
  "draft.unsaved": [
    "could not save — your text is kept here; nothing unsaved publishes",
    { slots: {}, fixedBy: "REQ-045 c7 · S17 (11a)" },
  ],
  "draft.not-found": ["There is no draft at this address.", { slots: {}, fixedBy: "REQ-045 c1" }],

  // S16's provenance line, under the title: when the page was written and
  // roughly how long it is. Two arms, because the first fact can be absent
  // — a draft row carries its `created_at`, but a view assembled from facts
  // that record none states the length alone rather than a stand-in date.
  // The tilde is the set's own: a word count is a count of words, not of
  // what a destination will render.
  "draft.written": [
    "draft written {at} · ~{words} words",
    { slots: { at: "date", words: "text" }, fixedBy: "S16 (11a)" },
  ],
  "draft.words": ["~{words} words", { slots: { words: "text" }, fixedBy: "S16 (11a)" }],

  // S16's right-hand rail: the two labels above its two blocks. The
  // controls under "Decide" are `draft.action.*` above; the rows under
  // "Checks" are the four below.
  "draft.decide.title": ["Decide", { slots: {}, fixedBy: "REQ-045 c4 · S16 (11a)" }],
  "draft.checks.title": ["Checks", { slots: {}, fixedBy: "S16 (11a)" }],

  // The four §8 hard rules S16 names, each as the sentence the set writes
  // for a rule that passed. A rule whose outcome this product has not
  // recorded draws no row at all (`checks.ts`), so none of these ever
  // stands for a check that did not run.
  "draft.checks.grounded": [
    "grounded — {facts} fact, {sources} source",
    { slots: { facts: "text", sources: "text" }, fixedBy: "REQ-045 c2 · S16 (11a)" },
  ],
  "draft.checks.do-not-claim": [
    "no claim from your do-not-claim list",
    { slots: {}, fixedBy: "REQ-045 c3 · S16 (11a)" },
  ],
  "draft.checks.near-duplicate": [
    "near-duplicate gate passed",
    { slots: {}, fixedBy: "BUILD §8 · S16 (11a)" },
  ],
  "draft.checks.no-invented-author": [
    "no invented author",
    { slots: {}, fixedBy: "BUILD §8 · S16 (11a)" },
  ],

  // S17, the edit arm. The back link, the two state badges the read view's
  // claim badge cannot say (`draft.claim.outstanding` is the third), the
  // two save lines that are not `draft.unsaved`, the footnote under the two
  // panes, and the two controls that leave the editor.
  "draft.edit.back": [
    "← Back to the draft",
    { slots: {}, fixedBy: "REQ-045 c5 · S17 (11a)" },
  ],
  "draft.edit.state.edited": [
    "edited · re-check on save",
    { slots: {}, fixedBy: "REQ-045 c9 · S17 (11a)" },
  ],
  "draft.edit.state.unsaved": [
    "unsaved",
    { slots: {}, fixedBy: "REQ-045 c7 · S17 (11a)" },
  ],
  "draft.edit.saving": ["saving…", { slots: {}, fixedBy: "REQ-045 c6 · S17 (11a)" }],
  "draft.edit.saved": [
    "saved {at}",
    { slots: { at: "date" }, fixedBy: "REQ-045 c6 · S17 (11a)" },
  ],
  "draft.edit.footnote": [
    // One literal, not a concatenation: `registry.test.ts` reads every value
    // back out of this source verbatim, and `"a" + "b"` is not a string it
    // can find there.
    "Saves itself as you type. The grounded fact stays marked while it survives your edit; the claim check re-runs on every save and the page cannot publish until it passes.",
    { slots: {}, fixedBy: "REQ-045 c6, c8, c9 · S17 (11a)" },
  ],
  "draft.edit.done": ["Done editing", { slots: {}, fixedBy: "REQ-045 c5 · S17 (11a)" }],
  "draft.edit.discard": [
    "Discard changes",
    { slots: {}, fixedBy: "REQ-045 c5 · S17 (11a)" },
  ],
}) satisfies CopyPartition;
