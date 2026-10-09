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
  "draft.written-from.pack.claims": [
    "Read from public pages",
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
    "What this page says that the top results for its search and your own pages don’t.",
    { slots: {}, fixedBy: "issue 1143 (drafted)" },
  ],
  "draft.adds.none": [
    "Nothing yet. Everything on this page is already on your site or in the top results for its search.",
    { slots: {}, fixedBy: "issue 1143 (drafted)" },
  ],
  "draft.adds.business": ["About your business", { slots: {}, fixedBy: "issue 1143 (drafted)" }],
  "draft.adds.ask": [
    "This page is held until it says something only you can: a price, how you work, or a result you’ve had. Tell us one, then write the page again.",
    { slots: {}, fixedBy: "issue 1143 (drafted)" },
  ],
  "draft.adds.ask.action": ["Add it in Your business", { slots: {}, fixedBy: "issue 1143 (drafted)" }],
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

  // §4.6's info box, and its arms. The panel states the schedule sentence
  // beside the countdown, which carries the time; the phone bar has one
  // line, so it states the autopilot sentence with the time in it.
  "draft.do-nothing.schedule": [
    "Do nothing and it goes live on schedule. Stop it and it never publishes.",
    { slots: {}, fixedBy: "SPEC §7 2026-09-24" },
  ],
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
  // Issue 1364 (owner, 2026-10-09): the page screen opens with the page's
  // two numbers. *Difficulty* is the day panel's own word
  // (`calendar.why.difficulty`). **Drafted** (#759); the pull request names
  // both so the owner can correct them.
  "draft.numbers.volume.label": [
    "Searches a month",
    { slots: {}, fixedBy: "SPEC §7 2026-10-09 (drafted)" },
  ],
  "draft.numbers.difficulty.limit": [
    "your limit is {ceiling}",
    { slots: { ceiling: "text" }, fixedBy: "SPEC §7 2026-10-09 (drafted)" },
  ],
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
    "Back to the plan",
    { slots: {}, fixedBy: "SPEC §7 2026-09-20" },
  ],
  /** Issue 1196: a page pressed *Write it again*, while the draft tick has
   *  not written it yet. Drafted; the owner may correct it. */
  "draft.rewriting": [
    "We’re writing this page again. It’s ready within the hour, and this screen updates itself when it is.",
    { slots: {}, fixedBy: "issue 1196" },
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
    "Written {at} · ~{words} words",
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
    "This page",
    { slots: {}, fixedBy: "REQ-045 c4 · S16 (11a)" },
  ],
  "draft.checks.title": ["Checks", { slots: {}, fixedBy: "S16 (11a)" }],

  // SPEC §7 (2026-09-24, board R12-6-Page): the panel's live countdown to
  // the moment an autopilot page publishes, and the absolute time under it.
  // Three arms: more than a day away, less than a day, and the instant
  // passed while the screen was open (the job runs on its own clock).
  "draft.decide.goes-live-in": [
    "Goes live in",
    { slots: {}, fixedBy: "SPEC §7 2026-09-24" },
  ],
  "draft.decide.countdown.days": [
    "{d}d {h}h {m}m",
    { slots: { d: "text", h: "text", m: "text" }, fixedBy: "SPEC §7 2026-09-24" },
  ],
  "draft.decide.countdown": [
    "{h}h {m}m {s}s",
    { slots: { h: "text", m: "text", s: "text" }, fixedBy: "SPEC §7 2026-09-24" },
  ],
  "draft.decide.countdown.due": [
    "Any moment now",
    { slots: {}, fixedBy: "SPEC §7 2026-09-24" },
  ],

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
  // SPEC §7 (2026-09-20, #928) — "The page's checks say it is not a repeat
  // and name the closest existing page." The owner's own drafted sentence,
  // and the same one without its last clause for a closest page this page
  // does not link to: a post still in draft on their blog, or one on a host
  // we do not link into. A site whose index holds nothing keeps the line
  // above — there is no page to name and no number worth stating.
  "draft.checks.not-a-repeat": [
    "Not a repeat — checked against {n} pages you already have. The closest is “{title}”, and this page links to it.",
    { slots: { n: "text", title: "text" }, fixedBy: "SPEC §7 2026-09-20" },
  ],
  "draft.checks.not-a-repeat.unlinked": [
    "Not a repeat — checked against {n} pages you already have. The closest is “{title}”.",
    { slots: { n: "text", title: "text" }, fixedBy: "SPEC §7 2026-09-20" },
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
    "This figure is about a rival and the sentence carries no link to where it came from. Give it a source or take the number out.",
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
    "The page has to open with a short, plain answer to the question it targets — a paragraph, not a heading, a list or a question.",
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
  // The report's measurements, stated as facts a page may quote (SPEC §7,
  // 2026-10-03, issue 1163). Each is composed from stored figures only and
  // is sourced to the report's own address. Drafted; the owner corrects
  // the wording.
  "fact.report.score": [
    "ReachKit measured {domain} on {date} and gave it a Discoverability Score of {score} out of 100.",
    { slots: { domain: "text", date: "date", score: "text" }, fixedBy: "SPEC §7 (2026-10-03) · issue 1163 · drafted" },
  ],
  "fact.report.answers": [
    "On {date}, AI answers named {domain} for {count} of the {total} buyer questions they answered in ReachKit's measurement.",
    { slots: { domain: "text", date: "date", count: "text", total: "text" }, fixedBy: "SPEC §7 (2026-10-03) · issue 1163 · drafted" },
  ],
  "fact.report.rival": [
    "On {date}, AI answers cited {rival} for {count} of the {total} buyer questions they answered in ReachKit's measurement of {domain}.",
    { slots: { domain: "text", date: "date", rival: "text", count: "text", total: "text" }, fixedBy: "SPEC §7 (2026-10-03) · issue 1163 · drafted" },
  ],
  "fact.report.method": [
    "ReachKit's measurement of {domain} on {date} read Google's top ten results and the answers of {engines}; it does not measure Perplexity.",
    { slots: { domain: "text", date: "date", engines: "text" }, fixedBy: "SPEC §7 (2026-10-03) · issue 1163 · drafted" },
  ],
}) satisfies CopyPartition;
