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
// written — the owner approved the drafted set ("copy proposal
// approved", proposal sheet
// https://claude.ai/code/artifact/546f45a0-a996-4d25-b85e-fb03fda7b102) and
// the strings land here byte for byte. The values named in the approval
// file are the owner's; nothing here is composed.
import type { CopyPartition } from "../registry.ts";

export const DRAFT_COPY = Object.freeze({
  // §4.6's three controls, over the declared publishing interface.
  "draft.action.edit": ["Edit this page", { slots: {}, fixedBy: "BUILD §4.6" }],
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
  "draft.search-result.title": [
    "In search results",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "draft.written-from.title": [
    "Written from your business",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "draft.written-from.lead": [
    "The facts this page uses, each with the page of your site it came from.",
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
  // SPEC §7 (2026-10-04, D41 stage 2; issue 1252, drafted): the context
  // pack, readable under *Written from your business* — one fold, and a
  // label for each group inside it. The business facts already list above
  // the fold, so it holds the rest of what the writer was handed.
  "draft.written-from.pack.title": [
    "Everything this page was written from",
    { slots: {}, fixedBy: "issue 1252 (drafted)" },
  ],
  "draft.written-from.pack.question": [
    "The question it answers",
    { slots: {}, fixedBy: "issue 1252 (drafted)" },
  ],
  "draft.written-from.pack.claims.read": [
    "read {at}",
    { slots: { at: "text" }, fixedBy: "issue 1252 (drafted)" },
  ],
  // SPEC §7 (owner D59, 2026-10-06; issue 1287, drafted): each fact's age,
  // beside the fact — how long ago the page it stands on was read.
  "draft.written-from.age.today": ["read today", { slots: {}, fixedBy: "issue 1287 (drafted)" }],
  "draft.written-from.age.one": ["read 1 day ago", { slots: {}, fixedBy: "issue 1287 (drafted)" }],
  "draft.written-from.age.days": [
    "read {days} days ago",
    { slots: { days: "text" }, fixedBy: "issue 1287 (drafted)" },
  ],
  "draft.written-from.pack.pages": [
    "Your pages it knew about",
    { slots: {}, fixedBy: "issue 1252 (drafted)" },
  ],
  "draft.written-from.pack.pages.more": [
    "and {n} more",
    { slots: { n: "text" }, fixedBy: "issue 1252 (drafted)" },
  ],
  "draft.written-from.pack.never-claim": [
    "Never claimed",
    { slots: {}, fixedBy: "issue 1252 (drafted)" },
  ],
  "draft.written-from.pack.missing": [
    "What was missing",
    { slots: {}, fixedBy: "issue 1252 (drafted)" },
  ],
  // SPEC §7 (2026-09-29, D12; issue 1143): what the page says that neither
  // the top results for its search nor the customer's own pages say, and —
  // where a new page says too little of that — the one line that asks the
  // founder for the missing fact. Drafted under issue 759's ruling; the
  // owner corrects the wording.
  "draft.adds.title": ["What this page adds", { slots: {}, fixedBy: "issue 1143 (drafted)" }],
  "draft.adds.lead": [
    "What it says that the pages ranking today don’t.",
    { slots: {}, fixedBy: "issue 1143 (drafted)" },
  ],
  "draft.adds.none": [
    "Nothing yet. Everything on this page is already on your site or in the top results for its search.",
    { slots: {}, fixedBy: "issue 1143 (drafted)" },
  ],
  "draft.adds.business": ["About your business", { slots: {}, fixedBy: "issue 1143 (drafted)" }],
  "draft.adds.ask": [
    "We set this page aside. It said too little that isn’t already on your site or in the top results for its search, so it wasn’t published and the next topic took its place.",
    { slots: {}, fixedBy: "issue 1143 (drafted)" },
  ],
  // Links on this page (SPEC §7, 2026-10-10, issue 1391).
  "draft.links.title": ["Links on this page", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "draft.links.lead": ["Links to your service pages and to your other live pages.", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "draft.links.site": ["Your site", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "draft.links.articles": ["Your articles", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "draft.links.sources": ["Sources", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "draft.links.why.buy": ["Where a reader acts on this page: your pricing or product page.", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "draft.links.why.main": ["One of your site’s main pages.", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "draft.links.why.cluster": ["An earlier article of yours on the same subject.", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "draft.links.why.known": ["An article you already have on a near topic.", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "draft.links.why.newer": ["A newer article of yours. This page was updated to link it.", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "draft.links.why.fact": ["A fact on this page was read there.", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "draft.links.why.source": ["Linked for a figure or claim on this page.", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "draft.links.why.written": ["Linked in the text.", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "draft.links.live": ["Live", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "draft.links.unchecked": ["Could not be checked", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "draft.links.pending": ["Checked when the page publishes", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "draft.links.removed": ["Removed when the page published", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "draft.links.removed.site": ["The address was gone, so the link was taken off. The sentence stayed.", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "draft.links.removed.source": ["The source was gone, so the claim it backed was taken out.", { slots: {}, fixedBy: "issue 1391 (drafted)" }],
  "draft.links.why.topic": ["Its title or address shares “{words}” with this page’s topic.", { slots: { words: "text" }, fixedBy: "issue 1391 (drafted)" }],

  // The two copy-out buttons' group name: they sit at the foot of the
  // Decide panel without a heading of their own (board R12-6-Page).
  "draft.copy.title": [
    "Copy it out",
    { slots: {}, fixedBy: "BUILD §9 · S16 (11a)" },
  ],
  "draft.copy.markdown": [
    "Markdown",
    { slots: {}, fixedBy: "BUILD §9 · S16 (11a)" },
  ],
  "draft.copy.html": ["HTML", { slots: {}, fixedBy: "BUILD §9 · S16 (11a)" }],

  // §4.6's info box: the phone bar has one line, so it states the time.
  "draft.do-nothing.autopilot": [
    "It goes live on its own at {at}. Edit or stop it until then.",
    { slots: { at: "date" }, fixedBy: "SPEC §7 2026-09-20" },
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
    "Claim-checked",
    { slots: {}, fixedBy: "REQ-045 c3 · S16 (11a)" },
  ],
  "draft.claim.failed": [
    "Claim check failed",
    { slots: {}, fixedBy: "REQ-045 c11" },
  ],
  "draft.claim.outstanding": [
    "Checking claims",
    { slots: {}, fixedBy: "REQ-045 c9 · S17 (11a)" },
  ],
  "draft.claim.nothing-to-check": [
    "No never-claim list",
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
  // A Fix page has no market target: no search, no volume, no band. Its own
  // arm, rather than a block of blanks.
  "draft.target.fix": [
    "This page fixes something on your site, so it has no search to win.",
    { slots: {}, fixedBy: "issue 867" },
  ],
  // Where the opportunity behind this draft is no longer readable — it was
  // purged, or the draft was written before the row carried its target.
  "draft.target.unknown": [
    "We can’t show what this page is for. The work it came from is no longer on file.",
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
    "Back to Plan",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  /** Issue 1196: a page pressed *Write it again*, while the draft tick has
   *  not written it yet. Drafted; the owner may correct it. */
  "draft.rewriting": [
    "We’re writing this page again. It’s ready within the hour, and this screen updates itself when it is.",
    { slots: {}, fixedBy: "issue 1196" },
  ],
  "draft.unsaved": [
    "could not save. Your text is kept here; nothing unsaved publishes",
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
    "Written {at} · about {words} words",
    { slots: { at: "date", words: "text" }, fixedBy: "S16 (11a)" },
  ],
  "draft.words": [
    "about {words} words",
    { slots: { words: "text" }, fixedBy: "S16 (11a)" },
  ],

  // S16's right-hand rail: the two labels above its two blocks. The
  // controls under "Decide" are `draft.action.*` above; the rows under
  // "Checks" are `draft.checks.*` below.
  "draft.decide.title": [
    "This page",
    { slots: {}, fixedBy: "REQ-045 c4 · S16 (11a)" },
  ],
  "draft.checks.title": ["Checks", { slots: {}, fixedBy: "S16 (11a)" }],

  // The rail's go-live line: an absolute time in the site's zone, and no clock.
  "draft.decide.goes-live": [
    "Goes live {at}. Nothing is needed from you.",
    { slots: { at: "date" }, fixedBy: "issue 1574" },
  ],

  // SPEC §7 (2026-10-10, issue 1394): the Checks list. The headline is the
  // glance; the closed note under it holds every hard rule in plain words,
  // in three groups. Every number is a slot — the total is the length of
  // the rule list and the ceiling is `NEAR_DUPLICATE_MAX`.
  "draft.checks.headline": [
    "Checks: {passed} of {total} passed",
    { slots: { passed: "text", total: "text" }, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.count.fixed": [
    "{n} fixed automatically",
    { slots: { n: "text" }, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.count.skipped": [
    "{n} not needed for this page",
    { slots: { n: "text" }, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.count.failed": [
    "{n} not passed",
    { slots: { n: "text" }, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.status.skipped": [
    "Not needed for this page",
    { slots: {}, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.status.failed": [
    "Not passed",
    { slots: {}, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.rule.grounding": [
    "States a fact read from your own site",
    { slots: {}, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.rule.traceable-numerals": [
    "Every number traces to a source",
    { slots: {}, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.rule.rival-source": [
    "Every figure about a competitor links to its source",
    { slots: {}, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.rule.no-invented-test": [
    "No invented tests",
    { slots: {}, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.rule.no-invented-provenance": [
    "No invented case studies",
    { slots: {}, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.rule.no-placeholder-cell": [
    "No empty cell in a table",
    { slots: {}, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.rule.no-invented-people": [
    "No invented people",
    { slots: {}, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.rule.no-unsourced-testimonial": [
    "No review or quote without a source",
    { slots: {}, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.rule.do-not-claim": [
    "Nothing on your never-claim list",
    { slots: {}, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.rule.fit-claim": [
    "No claim that your business does something it does not",
    { slots: {}, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.rule.honest-row": [
    "Your business is in the comparison and does not rank itself first",
    { slots: {}, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.rule.rival-negative": [
    "Nothing a competitor lacks unless a source says so",
    { slots: {}, fixedBy: "SPEC §7 2026-10-17 · issue 1485 · drafted" },
  ],
  "draft.checks.rule.no-hidden-text": [
    "No hidden text",
    { slots: {}, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.rule.no-machine-address": [
    "No instructions aimed at AI",
    { slots: {}, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  // A title's specific detail is tried for and never stops a page (SPEC §7,
  // 2026-10-11), so this row names only what the rule does stop a page on.
  "draft.checks.rule.title": [
    "Title fits, and the heading matches",
    { slots: {}, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.rule.first-block-answers": [
    "Answers its own question in the first lines",
    { slots: {}, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.rule.required-blocks": [
    "Every section this kind of page needs is there",
    { slots: {}, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.rule.cites-market": [
    "Links the outside sources it is built from",
    { slots: {}, fixedBy: "SPEC §7 2026-10-17 · issue 1486 · drafted" },
  ],
  "draft.checks.rule.distinct-headings": [
    "Each heading asks a different question",
    { slots: {}, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.rule.no-demo-text": [
    "No menu or sample text from your site",
    { slots: {}, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  "draft.checks.rule.plain-prose": [
    "Reads like a person wrote it: no stock phrases, few dashes, varied sentences",
    { slots: {}, fixedBy: "SPEC §7 2026-10-10 · issue 1390 · drafted" },
  ],
  "draft.checks.rule.near-duplicate": [
    "Not a repeat of a page you have ({percent}% at most)",
    { slots: { percent: "text" }, fixedBy: "SPEC §7 2026-10-10 · issue 1394 · drafted" },
  ],
  // SPEC §7 (2026-09-20, #928) — "The page's checks say it is not a repeat
  // and name the closest existing page." The owner's own drafted sentence,
  // and the same one without its last clause for a closest page this page
  // does not link to: a post still in draft on their blog, or one on a host
  // we do not link into. A site whose index holds nothing keeps the line
  // above — there is no page to name and no number worth stating.
  "draft.checks.not-a-repeat": [
    "Not a repeat: checked against {n} pages you already have. The closest is “{title}”, and this page links to it.",
    { slots: { n: "text", title: "text" }, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "draft.checks.not-a-repeat.unlinked": [
    "Not a repeat: checked against {n} pages you already have. The closest is “{title}”.",
    { slots: { n: "text", title: "text" }, fixedBy: "SPEC §7 2026-09-20" },
  ],

  // S17, the edit arm. The back link, the two state badges the read view's
  // claim badge cannot say (`draft.claim.outstanding` is the third), the
  // two save lines that are not `draft.unsaved`, the footnote under the two
  // panes, and the two controls that leave the editor.
  "draft.edit.back": [
    "Back to the page",
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
    "Saved {at}",
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
    "Description in search results",
    { slots: {}, fixedBy: "SPEC §7 · issue 789" },
  ],
  "draft.edit.rules-held": [
    "Your edit breaks one of the page rules, so this page won’t publish until the text passes them. Your words are saved.",
    { slots: {}, fixedBy: "SPEC §7 · issue 789" },
  ],
  // #1180: a page the rules stopped, fixed by the founder, enters review
  // on a passing save. Drafted (#759); the owner corrects the wording.
  "draft.edit.entered-review": [
    "Your edit passes every rule. This page now goes live on its own, on schedule.",
    { slots: {}, fixedBy: "SPEC §7 · issue 1180" },
  ],
  "draft.edit.done": [
    "Done editing",
    { slots: {}, fixedBy: "REQ-045 c5 · S17 (11a)" },
  ],
  "draft.edit.discard": [
    "Discard changes",
    { slots: {}, fixedBy: "REQ-045 c5 · S17 (11a)" },
  ],

  // ── the editor, SPEC §7's own (2026-09-20, #908; issue 932) ───────────
  //
  // "Text on the left, the live page on the right, a desktop/phone switch,
  // a formatting bar, title and search-result description with a length
  // count. A sentence that breaks a hard rule or matches the never-claim
  // list is marked where it stands as it is typed."
  //
  // Three of the sentences below are the issue's own drafted wording and
  // land byte for byte: `draft.editor.preview.lead`,
  // `draft.editor.rules-ok` and `draft.editor.break.do-not-claim`.
  // Everything else here is drafted by me under the 2026-09-16 ruling
  // (#759) and named in the pull request for the owner to correct.

  // The pane the live page stands in, and the two frames it is drawn in.
  "draft.editor.preview.lead": [
    "As your readers will see it · updates as you type",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],
  "draft.editor.frame.desktop": [
    "Desktop",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],
  "draft.editor.frame.phone": [
    "Phone",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],
  /** The third pane on a phone: §7's "search-result description" as a
   *  reader meets it in a result. */
  "draft.editor.tab.search": [
    "Search result",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],

  // The formatting bar. Seven controls, seven words — each the name of the
  // Markdown it writes, because a founder who can read the pane beside it
  // can read these.
  "draft.editor.format.title": [
    "Formatting",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],
  "draft.editor.format.heading": [
    "Heading",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],
  "draft.editor.format.bold": ["Bold", { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" }],
  "draft.editor.format.italic": [
    "Italic",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],
  "draft.editor.format.link": ["Link", { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" }],
  "draft.editor.format.list": ["List", { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" }],
  "draft.editor.format.quote": [
    "Quote",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],
  "draft.editor.format.table": [
    "Table",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],
  /** The placeholder text each control writes when there is no selection to
   *  wrap. A word, so the founder can see where the cursor landed. */
  "draft.editor.format.placeholder.heading": [
    "Heading",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],
  "draft.editor.format.placeholder.text": [
    "text",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],
  "draft.editor.format.placeholder.label": [
    "label",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],

  // The length count beside the description. §7 asks for "a length count",
  // and the count is a count: the viewer's own *In search results* card
  // renders the text and passes no verdict on it (#931), and a bar that
  // turned red at 160 would be this screen inventing a rule §8 does not
  // run.
  "draft.editor.description-count": [
    "{n} characters",
    { slots: { n: "text" }, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],

  // What the rules say, live. The banner when nothing is broken is the
  // issue's own sentence; `draft.edit.rules-held` (above, #789) is still
  // the one that speaks for a *saved* break, and is unchanged.
  "draft.editor.rules-ok": [
    "All your rules hold. Every save is checked again.",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],

  // One sentence per rule the editor can decide as the founder types — the
  // thirteen `marks.ts` runs. Each says what the page may not do and what
  // follows, in the second person, because the founder is the one who will
  // change it. None of them names the model or the rule's handle.
  "draft.editor.break.do-not-claim": [
    "“{entry}” is on your never-claim list. Your change is saved, but the page is held from going live until this sentence changes.",
    { slots: { entry: "text" }, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],
  "draft.editor.break.rival-source": [
    "This figure is about a competitor and the sentence carries no link to where it came from. Give it a source or take the number out.",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],
  "draft.editor.break.no-invented-people": [
    "This quotes a named person. ReachKit never puts words in someone’s mouth, so the page is held until the name or the quotation goes.",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],
  "draft.editor.break.no-unsourced-testimonial": [
    "This reads as a customer testimonial with nothing to back it. The page is held until it is sourced or removed.",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],
  "draft.editor.break.honest-row": [
    "This page compares your market, so your business needs its own row in the comparison table, and the page cannot call it “#1” or the best. Say who it suits and why instead.",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-29, D20) · issue 1136" },
  ],
  "draft.editor.break.no-hidden-text": [
    "Something here would reach a search engine but not a reader. Every word on the page has to be a word a visitor can read.",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],
  "draft.editor.break.no-machine-address": [
    "This looks like it is addressed to an AI assistant rather than to a reader. The page is held until it speaks to the person reading it.",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],
  "draft.editor.break.no-invented-test": [
    "This claims you tested or tried something. ReachKit cannot stand that up, so the page is held until the claim goes.",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],
  "draft.editor.break.no-invented-provenance": [
    "This gives the page an author, a date or a case study that nothing on your site records. The page is held until it goes.",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],
  "draft.editor.break.traceable-numerals": [
    "Nothing read from your site carries this number, and the sentence links to nowhere a reader could check it. Source it or take it out.",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],
  "draft.editor.break.first-block-answers": [
    "The page has to open with a short, plain answer to the question it targets: a paragraph, not a heading, a list or a question.",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-20) · issue 932" },
  ],
  // SPEC §7 (D41 stage 4; issue 1252, drafted): the two checks stage 4
  // added. The first is marked as it is typed; the second is the save's,
  // which holds the site's demo phrases and menu lines.
  "draft.editor.break.no-placeholder-cell": [
    "A table cell here is empty or only says a value isn’t known. Fill it with a fact, or take the row or column out.",
    { slots: {}, fixedBy: "issue 1252 (drafted)" },
  ],
  "draft.editor.break.no-demo-text": [
    "A sentence here is copied from your site’s menu or demo, not from what your business says. The page is held until it goes.",
    { slots: {}, fixedBy: "issue 1252 (drafted)" },
  ],
  // The sources list a page ends with (SPEC §7, 2026-09-29, *Two pools of
  // facts*; issue 1135): its heading, and what follows each linked page
  // title. Written into the page's own body, so a reader of the published
  // page meets them. Drafted; the owner corrects the wording.
  "body.sources.heading": [
    "Sources",
    { slots: {}, fixedBy: "SPEC §7 (2026-09-29) · issue 1135 · drafted" },
  ],
  "body.sources.read": [
    "read on {date}",
    { slots: { date: "date" }, fixedBy: "SPEC §7 (2026-09-29) · issue 1135 · drafted" },
  ],
  // The comparison table code lays out on a listicle (SPEC §7, owner, D47;
  // issue 1258): the header over the options, the two criteria, and the
  // header of the one column a table has where an option's own page does not
  // state every criterion. Written into the page's own body. Drafted; the
  // owner corrects the wording.
  "body.table.option": [
    "Option",
    { slots: {}, fixedBy: "SPEC §7 (D47) · issue 1258 · drafted" },
  ],
  "body.table.pricing": [
    "Pricing",
    { slots: {}, fixedBy: "SPEC §7 (D47) · issue 1258 · drafted" },
  ],
  "body.table.does": [
    "What it does",
    { slots: {}, fixedBy: "SPEC §7 (D47) · issue 1258 · drafted" },
  ],
  "body.table.stated": [
    "What its own page says",
    { slots: {}, fixedBy: "SPEC §7 (D47) · issue 1258 · drafted" },
  ],
  // The line under that table (SPEC §7, owner, D52; issue 1267): the day the
  // options' pages were read. Drafted; the owner corrects the wording.
  "body.table.checked": [
    "Prices last checked {date}.",
    { slots: { date: "date" }, fixedBy: "SPEC §7 (D52) · issue 1267 · drafted" },
  ],
  // D56 (SPEC §7, owner, 2026-10-06; issue 1282): the pricing cell of a rival
  // whose own page says its price is agreed, not published, and the line
  // under a table whose prices are in more than one currency. Drafted; the
  // owner corrects the wording.
  "body.table.custom": [
    "Custom pricing",
    { slots: {}, fixedBy: "SPEC §7 (D56) · issue 1282 · drafted" },
  ],
  "body.table.currencies": [
    "Prices are shown in the currency each vendor publishes; none is converted.",
    { slots: {}, fixedBy: "SPEC §7 (D56) · issue 1282 · drafted" },
  ],
  // Issue 1508 (SPEC §7, 2026-10-18): the row of the product an alternatives
  // page lists alternatives to. It is compared against and is not counted.
  // Drafted; the owner corrects the wording.
  "body.table.baseline": [
    "{name} (for comparison)",
    { slots: { name: "text" }, fixedBy: "SPEC §7 (2026-10-18) · issue 1508 · drafted" },
  ],
  // The report's measurements, stated as facts a page may quote (SPEC §7,
  // 2026-10-03, issue 1163). Each is composed from stored figures only and
  // is sourced to the report's own address. Drafted; the owner corrects
  // the wording.
  "fact.report.score": [
    "ReachKit measured {domain} on {date} and gave it a Visibility Score of {score} out of 100.",
    { slots: { domain: "text", date: "date", score: "text" }, fixedBy: "SPEC §7 (2026-10-03) · issue 1163 · drafted" },
  ],
  "fact.report.answers": [
    "On {date}, AI answers mentioned {domain} for {count} of the {total} buyer searches they answered in ReachKit's measurement.",
    { slots: { domain: "text", date: "date", count: "text", total: "text" }, fixedBy: "SPEC §7 (2026-10-03) · issue 1163 · drafted" },
  ],
  "fact.report.rival": [
    "On {date}, AI answers linked to {rival} for {count} of the {total} buyer searches they answered in ReachKit's measurement of {domain}.",
    { slots: { domain: "text", date: "date", rival: "text", count: "text", total: "text" }, fixedBy: "SPEC §7 (2026-10-03) · issue 1163 · drafted" },
  ],
  "fact.report.method": [
    "ReachKit's measurement of {domain} on {date} read Google's first page and the answers of {engines}; it does not measure Perplexity.",
    { slots: { domain: "text", date: "date", engines: "text" }, fixedBy: "SPEC §7 (2026-10-03) · issue 1163 · drafted" },
  ],

  // ── SPEC §4 (2026-10-10, issue 1395): why this topic, the topics set
  // aside, and the two sources a page is written from. Drafted.
  "draft.why.title": [
    "Why this page",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "draft.why.fit.answer": [
    "Fit: what you sell is the answer to this search",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "draft.why.fit.helps": [
    "Fit: what you sell helps with this search",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "draft.set-aside.covered": [
    "Already covered by your site: {n}",
    { slots: { n: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "draft.set-aside.too-hard": [
    "Too hard for a site your size, for now: {n}",
    { slots: { n: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "draft.set-aside.low-fit": [
    "A poor fit for your business: {n}",
    { slots: { n: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "draft.set-aside.resting": [
    "Resting after a stopped page: {n}",
    { slots: { n: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "draft.written-from.counts": [
    "Facts from your site: {site} · Market sources: {market}",
    { slots: { site: "text", market: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "draft.written-from.site": [
    "From your site",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "draft.written-from.market": [
    "From market research",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],

  // A live page's own screen, board PageDetail (canvas V22), and its Stop
  // as owner ruling R9 (2026-10-22) sets it: one press, the topic dropped
  // for good, Put it back for 7 days on a hosted page. Drafted (#759).
  "draft.live.since": ["Live since {date}", { slots: { date: "date" }, fixedBy: "issue 1749 (drafted)" }],
  "draft.live.new-tab": ["(opens in a new tab)", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.live.week": ["This week in Google", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.live.place": ["place for {search}", { slots: { search: "text" }, fixedBy: "issue 1749 (drafted)" }],
  "draft.live.places": ["{n} places", { slots: { n: "text" }, fixedBy: "issue 1749 (drafted)" }],
  "draft.live.places.one": ["one place", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.live.up": ["Up {places} since {date}.", { slots: { places: "text", date: "date" }, fixedBy: "issue 1749 (drafted)" }],
  "draft.live.up.near": ["Up {places} since {date}, {gap} from the first page.", { slots: { places: "text", date: "date", gap: "text" }, fixedBy: "issue 1749 (drafted)" }],
  "draft.live.down": ["Down {places} since {date}.", { slots: { places: "text", date: "date" }, fixedBy: "issue 1749 (drafted)" }],
  "draft.live.same": ["The same place as on {date}.", { slots: { date: "date" }, fixedBy: "issue 1749 (drafted)" }],
  "draft.live.furthest": ["{step} on {date}. Not in results yet.", { slots: { step: "text", date: "date" }, fixedBy: "issue 1749 (drafted)" }],
  "draft.live.visits": ["{n} visits from Google in the last {days} days. Read {date}.", { slots: { n: "text", days: "text", date: "date" }, fixedBy: "issue 1749 (drafted)" }],
  "draft.live.band": ["shaded band: Google’s first page", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.live.chart": ["Its place on Google, week by week", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.ladder.google": ["On Google", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.ladder.ai": ["In AI answers", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.ladder.live": ["Live", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.ladder.found": ["Found by Google", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.ladder.showing": ["Showing in results", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.ladder.first-page": ["First page", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.ladder.read": ["Read by AI", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.ladder.linked": ["Linked by AI", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.ladder.visit": ["Visit from AI", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.ladder.places": ["place {from} → {to}", { slots: { from: "text", to: "text" }, fixedBy: "issue 1749 (drafted)" }],
  "draft.ladder.unmeasured": ["not measured", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.ladder.not-yet": ["not yet", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.next.title": ["What happens next:", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.next.working": ["it is working, so we leave it alone. If it starts losing places, it gets an update that closes the gap to the pages above it. Nothing is needed from you.", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.next.climbing": ["it is still climbing, so we leave it alone. If it starts losing places, it gets an update that closes the gap to the pages above it. Nothing is needed from you.", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.next.not_moving": ["it has stopped gaining. If it starts losing places, it gets an update that closes the gap to the pages above it. Nothing is needed from you.", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.next.too_early": ["it is too early to tell, so we leave it alone and read it again every Monday. Nothing is needed from you.", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.next.unmeasured": ["we read it in Google and AI answers every Monday. Nothing is needed from you.", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.live.open": ["Open the live page →", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.live.controls": ["Your controls", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.live.runs": ["This page runs by itself. You can still change it.", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.live.stop-note": ["Stopping takes this page off your site and drops the topic. Tomorrow’s page is not affected. To pause every page, use", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.live.pause-link": ["Settings › Publishing", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.stop.done": ["Stopped. This page is off your site.", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.stop.refused": ["Not stopped yet. That didn’t go through, so the page is still live. Try again.", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.stopped.badge": ["Stopped", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.stopped.line": ["Tomorrow’s page goes live as planned.", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.stopped.wordpress": ["Your WordPress post was returned to draft. To bring it back, publish it in WordPress.", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.action.put-back": ["Put it back", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.put-back.until": ["You can put it back until {date}.", { slots: { date: "date" }, fixedBy: "issue 1749 (drafted)" }],
  "draft.put-back.done": ["It’s back on your site.", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  "draft.put-back.refused": ["Not put back yet. That didn’t go through, so the page is still off your site. Try again.", { slots: {}, fixedBy: "issue 1749 (drafted)" }],
  // The draft screen as board AppDraft draws it (canvas V22, issue 1748).
  // Drafted under issue 759's ruling; the owner corrects the wording.
  "draft.preview.caption": [
    "Preview, as it will look on your site. Goes live {at}.",
    { slots: { at: "date" }, fixedBy: "issue 1748 (drafted)" },
  ],
  "draft.preview.caption.plain": ["Preview, as it will look on your site.", { slots: {}, fixedBy: "issue 1748 (drafted)" }],
  "draft.search.title": ["The search and who answers it", { slots: {}, fixedBy: "issue 1748 (drafted)" }],
  "draft.search.query": ["The search", { slots: {}, fixedBy: "issue 1748 (drafted)" }],
  "draft.search.volume": ["Searched a month", { slots: {}, fixedBy: "issue 1748 (drafted)" }],
  "draft.search.rival": ["Who answers it today", { slots: {}, fixedBy: "issue 1748 (drafted)" }],
  "draft.search-result.caption": [
    "An example of how Google may show it. Google can choose other words.",
    { slots: {}, fixedBy: "issue 1748 (drafted)" },
  ],
  "draft.checks.all-passed": ["All passed", { slots: {}, fixedBy: "issue 1748 (drafted)" }],
  "draft.checks.more": ["and {n} more", { slots: { n: "text" }, fixedBy: "issue 1748 (drafted)" }],
  "draft.checks.decided": [
    "How we decided: a page that fails a check twice is held back and never goes live.",
    { slots: {}, fixedBy: "issue 1748 (drafted)" },
  ],
  // Q6 (owner 2026-10-20, #1718): a stopped topic is dropped for good.
  "draft.decide.stop-note": [
    "It won’t go live, and this topic is dropped. Tomorrow’s page is not affected.",
    { slots: {}, fixedBy: "issue 1748 (drafted)" },
  ],
  "draft.day.title": ["This page’s day", { slots: {}, fixedBy: "issue 1748 (drafted)" }],
  "draft.day.written": ["Written and checked", { slots: {}, fixedBy: "issue 1748 (drafted)" }],
  "draft.day.emailed": ["Emailed to you", { slots: {}, fixedBy: "issue 1748 (drafted)" }],
  "draft.day.live": ["Goes live on your site", { slots: {}, fixedBy: "issue 1748 (drafted)" }],
  "draft.day.reading": ["First reading in Google and AI", { slots: {}, fixedBy: "issue 1748 (drafted)" }],
}) satisfies CopyPartition;
