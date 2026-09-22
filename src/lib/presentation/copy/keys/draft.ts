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
  // SPEC §7 (2026-09-20, #908, issue #914) — "Screens and mail say *Stop
  // this page*. 'Veto' remains the internal word and the name of the
  // mechanism in this file." The key, the command, the column and the
  // route are all still `veto`; only what the customer reads changed.
  // In full here: this control stands on the page it acts on, and the
  // canvas reserves the short *Stop it* for the day panel's secondary row.
  "draft.action.veto": [
    "Stop this page",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],

  // SPEC §7 (2026-09-20, #908, issue #913) — "every action answers". The
  // two writes this screen offers say what became of the page. Drafts in
  // the registry's voice under issue 759's ruling; the owner may correct
  // them.
  //
  // Approve has two sentences and not one with an optional slot: a page
  // whose publish moment is known is told the moment, and a page whose
  // moment the screen does not hold is told the truth about that rather
  // than a blank where a time should be.
  "draft.answer.approve": [
    "Approved. It goes live at {at}.",
    { slots: { at: "date" }, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "draft.answer.approve-next": [
    "Approved. It goes live at your next publishing time.",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "draft.answer.veto": [
    "Stopped. This page won’t go live.",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "draft.answer.refused": [
    "That didn’t go through. The page is as it was.",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],

  // §9's copy-out, "always shown" — the card the approved S16 draws it on,
  // its two controls and the chip that says whose the words are. The two
  // control words were "Copy as Markdown" / "Copy as HTML" until ruling 11a:
  // the set writes them as the formats they produce, and the card head above
  // them already says what the two buttons do.
  /* ── The page as it publishes (SPEC §7, 2026-09-20 · #931) ─────────────
     "The review screen shows the whole page exactly as readers and search
     engines receive it, in the customer's own page frame, with beside it:
     why this page; how it appears in search results; *written from your
     business* … what gets published … the checks."

     Every sentence below is **drafted** under the owner's 2026-09-16 ruling
     (#759), and four of them are #931's own proposed words taken verbatim.
     The rest are the row labels those four need to stand up.

     The frame itself needs **no key of its own**: it draws the page's own
     title, the customer's own name and their own address, and the one line
     of ours that used to sit inside it (the hosted byline) is not drawn at
     all — `PublishedPageView` says why a review screen holds no publication
     date to print. */
  "draft.published-view.lead": [
    "This is the whole page, exactly as your readers and search engines receive it.",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "draft.search-result.title": [
    "In search results",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "draft.written-from.title": [
    "Written from your business",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "draft.written-from.lead": [
    "Everything this page says about you, and where we read it.",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  // What the profile items are, as against the quoted passages above them.
  // They carry no address because their source is the customer: they
  // confirmed every one on Settings › Your business.
  "draft.written-from.profile": [
    "From your business profile",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  // A page written before the source was recorded beside the passage
  // (#927's first shape). The sentence is still what the page stands on, so
  // it is listed and said to be unsourced rather than dropped.
  "draft.written-from.source-unknown": [
    "Read from your site; the page wasn’t recorded",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "draft.publishes.title": [
    "What gets published",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "draft.publishes.address": [
    "Address",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "draft.publishes.title-row": [
    "Title",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  // A page in review has no address yet: the destination decides the path
  // when it publishes, and a host printed under *Address* would read as a
  // page that publishes at the site's root.
  "draft.publishes.address.pending": [
    "on {domain}, at a path set when it publishes",
    { slots: { domain: "text" }, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "draft.publishes.description": [
    "Description",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "draft.publishes.schema": [
    "Told to search engines",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  // Nothing declares an FAQ block where the body asks no question, so the
  // row names the one thing that is declared rather than "plus 0".
  "draft.publishes.schema.article": [
    "an article",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "draft.publishes.schema.value": [
    "an article, plus {n} questions and answers",
    { slots: { n: "text" }, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "draft.publishes.links": [
    "Links",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "draft.publishes.length": [
    "Length",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "draft.publishes.length.value": [
    "{n} characters",
    { slots: { n: "text" }, fixedBy: "SPEC §7 2026-09-20" },
  ],

  "draft.copy.title": [
    "Copy it out",
    { slots: {}, fixedBy: "BUILD §9 · S16 (11a)" },
  ],
  "draft.copy.note": [
    "yours, for any destination",
    { slots: {}, fixedBy: "REQ-045 c12 · S16 (11a)" },
  ],
  "draft.copy.markdown": [
    "Markdown",
    { slots: {}, fixedBy: "BUILD §9 · S16 (11a)" },
  ],
  "draft.copy.html": ["HTML", { slots: {}, fixedBy: "BUILD §9 · S16 (11a)" }],

  // §4.6's info box, and its two arms.
  "draft.do-nothing.title": [
    "What happens if you do nothing",
    { slots: {}, fixedBy: "BUILD §4.6" },
  ],
  "draft.do-nothing.autopilot": [
    "It publishes at {at} unless you stop it.",
    { slots: { at: "date" }, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "draft.do-nothing.copilot": [
    "Nothing publishes on its own.",
    { slots: {}, fixedBy: "REQ-045 c4" },
  ],

  // §4.6's two editor panes.
  "draft.editor.tab.markdown": [
    "Markdown",
    { slots: {}, fixedBy: "BUILD §4.6" },
  ],
  "draft.editor.tab.preview": ["Preview", { slots: {}, fixedBy: "BUILD §4.6" }],

  // The four claim-check outcomes REQ-045 c3 requires to be stated in every
  // case, including the empty list. Each is a badge's word.
  "draft.claim.passed": [
    "claim-checked",
    { slots: {}, fixedBy: "REQ-045 c3 · S16 (11a)" },
  ],
  "draft.claim.failed": [
    "claim check failed",
    { slots: {}, fixedBy: "REQ-045 c11" },
  ],
  "draft.claim.outstanding": [
    "claim check running",
    { slots: {}, fixedBy: "REQ-045 c9 · S17 (11a)" },
  ],
  "draft.claim.nothing-to-check": [
    "no never-claim list",
    { slots: {}, fixedBy: "REQ-045 c3" },
  ],
  // c11's own sentence. The entry itself renders beside it as a value, so
  // the customer is told which entry held the draft whether or not this
  // sentence has been written.
  "draft.claim.matched": [
    "This draft matches “{entry}” on your never-claim list, so it’s held until the text changes.",
    { slots: { entry: "text" }, fixedBy: "REQ-045 c11" },
  ],

  // §4.6's grounded-fact block, its heading and — where the customer has
  // edited — the note that keeps the generated-content label from claiming
  // their words (REQ-093 c2's non-goal).
  // Issue 867 (owner, 2026-09-17): the founder edits a page without being
  // told what it is for. The block's own two sentences; its rows carry the
  // day panel's labels, so the two screens word one fact once. Drafted under
  // issue 759's ruling; the owner corrects the wording.
  "draft.target.title": [
    "What this page is for",
    { slots: {}, fixedBy: "issue 867" },
  ],
  // A Fix page has no market target: no search, no volume, no band. Its own
  // arm, rather than a block of blanks.
  "draft.target.fix": [
    "This page fixes something on your site, so it has no search to win.",
    { slots: {}, fixedBy: "issue 867" },
  ],
  // Where the opportunity behind this draft is no longer readable — it was
  // purged, or the draft was written before the row carried its target.
  "draft.target.unknown": [
    "We can't show what this page is for — the work it came from is no longer on file.",
    { slots: {}, fixedBy: "issue 867" },
  ],

  "draft.grounded.title": [
    "Grounded fact",
    { slots: {}, fixedBy: "REQ-045 c2" },
  ],
  "draft.authorship.edited": [
    "edited by you since {at}",
    { slots: { at: "date" }, fixedBy: "REQ-045 c1" },
  ],

  // The back link §4.6 asks for, the unsaved indicator c7 asks for, and the
  // one written line an unknown draft id resolves to.
  "draft.back": [
    "← Back to the plan",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "draft.unsaved": [
    "could not save — your text is kept here; nothing unsaved publishes",
    { slots: {}, fixedBy: "REQ-045 c7 · S17 (11a)" },
  ],
  "draft.not-found": [
    "There is no draft at this address.",
    { slots: {}, fixedBy: "REQ-045 c1" },
  ],

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
  "draft.words": [
    "~{words} words",
    { slots: { words: "text" }, fixedBy: "S16 (11a)" },
  ],

  // S16's right-hand rail: the two labels above its two blocks. The
  // controls under "Decide" are `draft.action.*` above; the rows under
  // "Checks" are the four below.
  "draft.decide.title": [
    "Decide",
    { slots: {}, fixedBy: "REQ-045 c4 · S16 (11a)" },
  ],
  "draft.checks.title": ["Checks", { slots: {}, fixedBy: "S16 (11a)" }],

  // The four §8 hard rules S16 names, each as the sentence the set writes
  // for a rule that passed. A rule whose outcome this product has not
  // recorded draws no row at all (`checks.ts`), so none of these ever
  // stands for a check that did not run.
  "draft.checks.grounded": [
    "grounded — {facts} fact, {sources} source",
    {
      slots: { facts: "text", sources: "text" },
      fixedBy: "REQ-045 c2 · S16 (11a)",
    },
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
  "draft.edit.saving": [
    "saving…",
    { slots: {}, fixedBy: "REQ-045 c6 · S17 (11a)" },
  ],
  "draft.edit.saved": [
    "saved {at}",
    { slots: { at: "date" }, fixedBy: "REQ-045 c6 · S17 (11a)" },
  ],
  "draft.edit.footnote": [
    // One literal, not a concatenation: `registry.test.ts` reads every value
    // back out of this source verbatim, and `"a" + "b"` is not a string it
    // can find there.
    "Saves itself as you type. The grounded fact stays marked while it survives your edit; the page rules and the claim check re-run on every save and the page cannot publish until they pass.",
    { slots: {}, fixedBy: "REQ-045 c6, c8, c9 · S17 (11a) · issue 789" },
  ],
  // #789: the founder edits the title and the meta description beside the
  // body, and is told when a saved edit breaks a page rule. Drafted (#759);
  // the owner corrects the wording.
  "draft.edit.title-label": [
    "Title",
    { slots: {}, fixedBy: "SPEC §7 · issue 789" },
  ],
  "draft.edit.description-label": [
    "Meta description",
    { slots: {}, fixedBy: "SPEC §7 · issue 789" },
  ],
  "draft.edit.rules-held": [
    "Your edit breaks one of the page rules, so this page won’t publish until the text passes them. Your words are saved.",
    { slots: {}, fixedBy: "SPEC §7 · issue 789" },
  ],
  "draft.edit.done": [
    "Done editing",
    { slots: {}, fixedBy: "REQ-045 c5 · S17 (11a)" },
  ],
  "draft.edit.discard": [
    "Discard changes",
    { slots: {}, fixedBy: "REQ-045 c5 · S17 (11a)" },
  ],
}) satisfies CopyPartition;
