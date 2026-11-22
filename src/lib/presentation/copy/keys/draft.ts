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
//  - **Screen words (8).** The four claim words, the grounded block's
//    heading, the back link, the unsaved indicator and the not-found line;
//    #355 (ruling 11a) and #460 have written every one.
//
//  - **Owner-owed and empty (4) until #460.** Every *composed sentence* this screen
//    speaks: the two "if you do nothing" outcomes, the edited-since note,
//    and the line naming the do-not-claim entry that held the draft. Each
//    is read through the shell's `writtenLine`, which renders an empty
//    key as nothing (issue #9).
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
  "draft.action.edit": "Edit This Page",
  // SPEC §7 (2026-09-20, #908, issue #914) — "Screens and mail say *Stop
  // this page*. 'Veto' remains the internal word and the name of the
  // mechanism in this file." The key, the command, the column and the
  // route are all still `veto`; only what the customer reads changed.
  // In full here: this control stands on the page it acts on, and the
  // canvas reserves the short *Stop it* for the day panel's secondary row.
  "draft.action.veto": "Stop This Page",

  // SPEC §7 (2026-09-20, #908, issue #913) — "every action answers". The
  // two writes this screen offers say what became of the page. Drafts in
  // the registry's voice under issue 759's ruling; the owner may correct
  // them.
  //
  // Approve has two sentences and not one with an optional slot: a page
  // whose publish moment is known is told the moment, and a page whose
  // moment the screen does not hold is told the truth about that rather
  // than a blank where a time should be.
  "draft.answer.veto": "Stopped. This page won’t go live.",
  "draft.answer.refused": "That didn’t work, so the page is unchanged. Try again.",

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
  // What the profile items are, as against the quoted passages above them.
  // They carry no address because their source is the customer: they
  // confirmed every one on Settings › Your business.
  // A page written before the source was recorded beside the passage
  // (#927's first shape). The sentence is still what the page stands on, so
  // it is listed and said to be unsourced rather than dropped.
  // SPEC §7 (2026-10-04, D41 stage 2; issue 1252, drafted): the context
  // pack, readable under *Written from your business* — one fold, and a
  // label for each group inside it. The business facts already list above
  // the fold, so it holds the rest of what the writer was handed.
  // SPEC §7 (owner D59, 2026-10-06; issue 1287, drafted): each fact's age,
  // beside the fact — how long ago the page it stands on was read.
  // SPEC §7 (2026-09-29, D12; issue 1143): what the page says that neither
  // the top results for its search nor the customer's own pages say, and —
  // where a new page says too little of that — the one line that asks the
  // founder for the missing fact. Drafted under issue 759's ruling; the
  // owner corrects the wording.
  "draft.adds.title": "What This Page Adds",
  "draft.adds.lead": "What it says that the pages ranking today don’t.",
  "draft.adds.none": "Nothing yet. All of it is already on your site or in Google’s top results.",
  "draft.adds.business": "About your business",
  "draft.adds.ask": "We set this page aside. It added too little that’s new, so the next topic took its place.",
  // Links on this page (SPEC §7, 2026-10-10, issue 1391).
  "draft.links.title": "Links on This Page",
  "draft.links.lead": "Links to your service pages and to your other live pages.",
  "draft.links.site": "Your site",
  "draft.links.articles": "Your pages",
  "draft.links.sources": "Sources",
  "draft.links.why.buy": "Where a reader acts on this page: your pricing or product page.",
  "draft.links.why.main": "One of your site’s main pages.",
  "draft.links.why.cluster": "An earlier page of yours on the same subject.",
  "draft.links.why.known": "A page you already have on a close topic.",
  "draft.links.why.newer": "A newer page of yours. We updated this page to link it.",
  "draft.links.why.fact": "A fact on this page was read there.",
  "draft.links.why.source": "Linked for a figure or claim on this page.",
  "draft.links.why.written": "Linked in the text.",
  "draft.links.live": "Live",
  "draft.links.unchecked": "Could not be checked",
  "draft.links.pending": "Checked when the page goes live",
  "draft.links.removed": "Removed when the page went live",
  "draft.links.removed.site": "The address was gone, so the link was taken off. The sentence stayed.",
  "draft.links.removed.source": "The source was gone, so the claim it backed was taken out.",
  "draft.links.why.topic": "Its title or address shares “{words}” with this page’s topic.",

  // The two copy-out buttons' group name: they sit at the foot of the
  // Decide panel without a heading of their own (board R12-6-Page).
  "draft.copy.title": "Copy it out",
  "draft.copy.markdown": "Markdown",
  "draft.copy.html": "HTML",

  // §4.6's info box: the phone bar has one line, so it states the time.
  "draft.do-nothing.autopilot": "It goes live on its own at {at}. Edit or stop it until then.",

  // §4.6's two editor panes.
  "draft.editor.tab.markdown": "Markdown",
  "draft.editor.tab.preview": "Preview",

  // The four claim-check outcomes REQ-045 c3 requires to be stated in every
  // case, including the empty list. Each is a badge's word.
  "draft.claim.passed": "Claims checked",
  "draft.claim.failed": "Claim check failed",
  "draft.claim.outstanding": "Checking claims",
  "draft.claim.nothing-to-check": "No Never say list",
  // c11's own sentence. The entry itself renders beside it as a value, so
  // the customer is told which entry held the draft whether or not this
  // sentence has been written.
  "draft.claim.matched": "This page matches “{entry}” on your Never say list. It waits until the text changes.",

  // §4.6's grounded-fact block, its heading and — where the customer has
  // edited — the note that keeps the generated-content label from claiming
  // their words (REQ-093 c2's non-goal).
  // Issue 867 (owner, 2026-09-17): the founder edits a page without being
  // told what it is for. The block's own two sentences; its rows carry the
  // day panel's labels, so the two screens word one fact once. Drafted under
  // issue 759's ruling; the owner corrects the wording.
  // A Fix page has no market target: no search, no volume, no band. Its own
  // arm, rather than a block of blanks.
  "draft.target.fix": "This page fixes something on your site, so it has no search to win.",
  // Where the opportunity behind this draft is no longer readable — it was
  // purged, or the draft was written before the row carried its target.

  "draft.grounded.title": "Fact from your site",
  "draft.authorship.edited": "edited by you since {at}",

  // The back link §4.6 asks for, the unsaved indicator c7 asks for, and the
  // one written line an unknown draft id resolves to.
  "draft.back": "Back to This Week",
  /** Issue 1196: a page pressed *Write it again*, while the draft tick has
   *  not written it yet. Drafted; the owner may correct it. */
  "draft.rewriting": "We’re writing this page again. It’s ready within the hour, and this screen updates itself when it is.",
  // Under the chip of a page set aside for a newer standard.
  "draft.set-aside.standard": "Our page checks changed and this version no longer passed, so we set it aside. This week shows what goes live on its date.",
  "draft.unsaved": "Not saved. Your text is kept here; check your connection, then make any change to save it.",
  "draft.not-found": "This page isn’t here. It may have been stopped or replaced.",

  // S16's provenance line, under the title: roughly how long the page is.
  // When it was written is the day's timeline's, so it is not said twice.
  "draft.words": "About {words} words",

  // S16's right-hand rail: the two labels above its two blocks. The
  // controls under "Decide" are `draft.action.*` above; the rows under
  // "Checks" are `draft.checks.*` below.
  "draft.decide.title": "This page",
  "draft.checks.title": "Checks",

  // The rail's go-live line: an absolute time in the site's zone, and no clock.
  "draft.decide.goes-live": "Goes live",

  // SPEC §7 (2026-10-10, issue 1394): the Checks list. The headline is the
  // glance; the closed note under it holds every hard rule in plain words,
  // in three groups. Every number is a slot — the total is the length of
  // the rule list and the ceiling is `NEAR_DUPLICATE_MAX`.
  "draft.checks.headline": "Checks: {passed} of {total} passed",
  "draft.checks.count.fixed": "{n} fixed automatically",
  "draft.checks.status.skipped": "Not needed for this page",
  "draft.checks.status.failed": "Not passed",
  "draft.checks.rule.grounding": "States a fact read from your own site",
  "draft.checks.rule.traceable-numerals": "Every number traces to a source",
  "draft.checks.rule.rival-source": "Every figure about a competitor links to its source",
  "draft.checks.rule.no-invented-test": "No invented tests",
  "draft.checks.rule.no-invented-provenance": "No invented case studies",
  "draft.checks.rule.no-placeholder-cell": "No empty cell in a table",
  "draft.checks.rule.no-invented-people": "No invented people",
  "draft.checks.rule.no-unsourced-testimonial": "No review or quote without a source",
  "draft.checks.rule.do-not-claim": "Nothing on your Never say list",
  "draft.checks.rule.fit-claim": "No claim that your business does something it does not",
  "draft.checks.rule.honest-row": "Your business is in the comparison and does not rank itself first",
  "draft.checks.rule.rival-negative": "Nothing a competitor lacks unless a source says so",
  "draft.checks.rule.no-hidden-text": "No hidden text",
  "draft.checks.rule.no-machine-address": "No instructions aimed at AI",
  // A title's specific detail is tried for and never stops a page (SPEC §7, 2026-10-11): this row names what it stops on.
  "draft.checks.rule.title": "Title fits, and the heading matches",
  "draft.checks.rule.first-block-answers": "Answers its own question in the first lines",
  "draft.checks.rule.required-blocks": "Every section this kind of page needs is there",
  "draft.checks.rule.cites-market": "Links the outside sources it is built from",
  "draft.checks.rule.distinct-headings": "Each heading asks a different question",
  "draft.checks.rule.no-demo-text": "No menu or sample text from your site",
  "draft.checks.rule.standalone-lead": "Each section starts with a sentence that makes sense on its own",
  "draft.checks.rule.plain-prose": "Reads like a person wrote it: no stock phrases, few dashes, varied sentences",
  "draft.checks.rule.near-duplicate": "Not a repeat of a page you have ({percent}% at most)",
  // SPEC §7 (2026-09-20, #928) — "The page's checks say it is not a repeat
  // and name the closest existing page." The owner's own drafted sentence,
  // and the same one without its last clause for a closest page this page
  // does not link to: a post still in draft on their blog, or one on a host
  // we do not link into. A site whose index holds nothing keeps the line
  // above — there is no page to name and no number worth stating.
  "draft.checks.not-a-repeat": "Not a repeat of your {n} other pages. The closest is “{title}”, and this page links to it.",
  "draft.checks.not-a-repeat.unlinked": "Not a repeat of your {n} other pages. The closest is “{title}”.",

  // S17, the edit arm. The back link, the two state badges the read view's
  // claim badge cannot say (`draft.claim.outstanding` is the third), the
  // two save lines that are not `draft.unsaved`, the footnote under the two
  // panes, and the two controls that leave the editor.
  "draft.edit.back": "Back to the Page",
  "draft.edit.state.edited": "edited · checked again on save",
  "draft.edit.state.unsaved": "unsaved",
  "draft.edit.saving": "saving…",
  "draft.edit.saved": "Saved {at}",
  // One literal, not a concatenation: `registry.test.ts` reads every value
  // back out of this source verbatim, and `"a" + "b"` is not a string it
  // can find there.
  "draft.edit.footnote": "Saves as you type. Every save is checked again, and the page waits until it passes.",
  // #789: the founder edits the title and the meta description beside the
  // body, and is told when a saved edit breaks a page rule. Drafted (#759);
  // the owner corrects the wording.
  "draft.edit.title-label": "Title",
  "draft.edit.description-label": "Description in search results",
  "draft.edit.rules-held": "This edit breaks a page rule, so the page won’t go live until it passes. Your words are saved.",
  // #1180: a page the rules stopped, fixed by the founder, enters review
  // on a passing save. Drafted (#759); the owner corrects the wording.
  "draft.edit.entered-review": "Your edit passes every rule. This page now goes live on its own, on schedule.",
  "draft.edit.done": "Done Editing",
  "draft.edit.discard": "Discard Changes",

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
  "draft.editor.preview.lead": "As your readers will see it · updates as you type",
  "draft.editor.frame.desktop": "Desktop",
  "draft.editor.frame.phone": "Phone",
  /** The third pane on a phone: §7's "search-result description" as a
   *  reader meets it in a result. */
  "draft.editor.tab.search": "Search result",

  // The formatting bar. Seven controls, seven words — each the name of the
  // Markdown it writes, because a founder who can read the pane beside it
  // can read these.
  "draft.editor.format.title": "Formatting",
  "draft.editor.format.heading": "Heading",
  "draft.editor.format.bold": "Bold",
  "draft.editor.format.italic": "Italic",
  "draft.editor.format.link": "Link",
  "draft.editor.format.list": "List",
  "draft.editor.format.quote": "Quote",
  "draft.editor.format.table": "Table",
  /** The placeholder text each control writes when there is no selection to
   *  wrap. A word, so the founder can see where the cursor landed. */
  "draft.editor.format.placeholder.heading": "Heading",
  "draft.editor.format.placeholder.text": "text",
  "draft.editor.format.placeholder.label": "label",

  // The length count beside the description. §7 asks for "a length count",
  // and the count is a count: the viewer's own *In search results* card
  // renders the text and passes no verdict on it (#931), and a bar that
  // turned red at 160 would be this screen inventing a rule §8 does not
  // run.
  "draft.editor.description-count": "{n} characters",

  // What the rules say, live. The banner when nothing is broken is the
  // issue's own sentence; `draft.edit.rules-held` (above, #789) is still
  // the one that speaks for a *saved* break, and is unchanged.
  "draft.editor.rules-ok": "All your rules hold. Every save is checked again.",

  // One sentence per rule the editor can decide as the founder types — the
  // thirteen `marks.ts` runs. Each says what the page may not do and what
  // follows, in the second person, because the founder is the one who will
  // change it. None of them names the model or the rule's handle.
  "draft.editor.break.do-not-claim": "“{entry}” is on your Never say list. Your change is saved, but the page waits until you change this sentence.",
  "draft.editor.break.rival-source": "This competitor figure has no source link. Add a source, or take the number out.",
  "draft.editor.break.no-invented-people": "This quotes a named person. The page waits until you remove the name or the quote.",
  "draft.editor.break.no-unsourced-testimonial": "This reads like a customer review with no source. Add a source or remove it.",
  "draft.editor.break.honest-row": "This page compares businesses, so yours needs its own row. It can’t call itself “#1” or the best.",
  "draft.editor.break.no-hidden-text": "Some text here is hidden from readers. Every word must be visible to visitors.",
  "draft.editor.break.no-machine-address": "This text speaks to an AI assistant. Rewrite it for your reader.",
  "draft.editor.break.no-invented-test": "This says you tested something we can’t confirm. Remove the claim to continue.",
  "draft.editor.break.no-invented-provenance": "This adds an author, date or case study your site doesn’t show. Remove it to continue.",
  "draft.editor.break.traceable-numerals": "This number isn’t on your site and has no source link. Add a source or take it out.",
  "draft.editor.break.first-block-answers": "Start the page with a short, plain answer to its question. Use a paragraph, not a list or heading.",
  // SPEC §7 (D41 stage 4; issue 1252, drafted): the two checks stage 4
  // added. The first is marked as it is typed; the second is the save's,
  // which holds the site's demo phrases and menu lines.
  "draft.editor.break.no-placeholder-cell": "A table cell is empty or says “unknown”. Fill it with a fact, or remove that row or column.",
  "draft.editor.break.no-demo-text": "A sentence here is copied from your site’s menu or sample text. Remove it to continue.",
  // The sources list a page ends with (SPEC §7, 2026-09-29, *Two pools of
  // facts*; issue 1135): its heading, and what follows each linked page
  // title. Written into the page's own body, so a reader of the published
  // page meets them. Drafted; the owner corrects the wording.
  "body.sources.heading": "Sources",
  "body.sources.read": "read on {date}",
  // The comparison table code lays out on a listicle (SPEC §7, owner, D47;
  // issue 1258): the header over the options, the two criteria, and the
  // header of the one column a table has where an option's own page does not
  // state every criterion. Written into the page's own body. Drafted; the
  // owner corrects the wording.
  "body.table.option": "Option",
  "body.table.pricing": "Pricing",
  "body.table.does": "What it does",
  "body.table.stated": "What its own page says",
  // The line under that table (SPEC §7, owner, D52; issue 1267): the day the
  // options' pages were read. Drafted; the owner corrects the wording.
  "body.table.checked": "Prices last checked {date}.",
  // D56 (SPEC §7, owner, 2026-10-06; issue 1282): the pricing cell of a rival
  // whose own page says its price is agreed, not published, and the line
  // under a table whose prices are in more than one currency. Drafted; the
  // owner corrects the wording.
  "body.table.custom": "Custom pricing",
  "body.table.currencies": "Prices are shown in the currency each vendor publishes; none is converted.",
  // Issue 1508 (SPEC §7, 2026-10-18): the row of the product an alternatives
  // page lists alternatives to. It is compared against and is not counted.
  // Drafted; the owner corrects the wording.
  "body.table.baseline": "{name} (for comparison)",
  // The report's measurements, stated as facts a page may quote (SPEC §7,
  // 2026-10-03, issue 1163). Each is composed from stored figures only and
  // is sourced to the report's own address. Drafted; the owner corrects
  // the wording.
  "fact.report.score": "ReachKit measured {domain} on {date} and gave it a Visibility Score of {score} out of 100.",
  "fact.report.answers": "On {date}, AI answers mentioned {domain} for {count} of the {total} buyer searches they answered in ReachKit's measurement.",
  "fact.report.rival": "On {date}, AI answers linked to {rival} for {count} of the {total} buyer searches they answered in ReachKit's measurement of {domain}.",
  "fact.report.method": "ReachKit's measurement of {domain} on {date} read Google's first page and the answers of {engines}; it does not measure Perplexity.",

  // ── SPEC §4 (2026-10-10, issue 1395): why this topic, the topics set
  // aside, and the two sources a page is written from. Drafted.
  "draft.why.title": "Why This Page",

  // A live page's own screen, board PageDetail (canvas V22), and its Stop
  // as owner ruling R9 (2026-10-22) sets it: one press, the topic dropped
  // for good, Put it back for 7 days on a hosted page. Drafted (#759).
  "draft.live.since": "Live since {date}",
  "draft.live.new-tab": "(opens in a new tab)",
  "draft.live.week": "This Week in Google",
  "draft.live.place": "place for {search}",
  "draft.live.places": "{n} places",
  "draft.live.places.one": "one place",
  "draft.live.up": "Up {places} since {date}.",
  "draft.live.up.near": "Up {places} since {date}, {gap} from the first page.",
  "draft.live.down": "Down {places} since {date}.",
  "draft.live.same": "The same place as on {date}.",
  "draft.live.furthest": "{step} on {date}. Not in results yet.",
  "draft.live.visits": "{n} visits from Google in the last {days} days.",
  "draft.live.band": "shaded band: Google’s first page",
  "draft.live.chart": "Its place on Google, week by week",
  "draft.ladder.google": "On Google",
  "draft.ladder.ai": "In AI answers",
  "draft.ladder.live": "Live",
  "draft.ladder.found": "Found by Google",
  "draft.ladder.showing": "Showing on Google",
  "draft.ladder.first-page": "Google’s first page",
  "draft.ladder.read": "Read by AI",
  "draft.ladder.linked": "Linked by AI",
  "draft.ladder.visit": "Visit from AI",
  "draft.ladder.places": "place {from} → {to}",
  "draft.live.first-page": "First page",
  "draft.ladder.unmeasured": "not checked yet",
  "draft.ladder.not-yet": "not yet",
  "draft.next.title": "Next:",
  "draft.next.working": "working, so we leave it alone. If it slips, it gets an update.",
  "draft.next.climbing": "still climbing, so we leave it alone. If it slips, it gets an update.",
  "draft.next.not_moving": "it has stopped gaining, so a Monday check may pick it for an update.",
  "draft.next.too_early": "it’s too early to tell. We check it again every Monday.",
  "draft.next.unmeasured": "we check it on Google and in AI answers every Monday.",
  "draft.live.stop-note": "Stop takes this page off your site and drops its topic. Tomorrow’s page is not affected.",
  "draft.live.pause-lead": "To pause every page:",
  "draft.live.pause-link": "Settings › Pages",
  "draft.stop.done": "Stopped. This page is off your site.",
  "draft.stop.refused": "That didn’t work, so the page is still live. Try again.",
  "draft.stopped.badge": "Stopped",
  "draft.stopped.line": "Tomorrow’s page goes live as planned.",
  "draft.stopped.wordpress": "Your WordPress post was returned to draft. To bring it back, publish it in WordPress.",
  "draft.action.put-back": "Put It Back Live",
  "draft.put-back.until": "You can put it back until {date}.",
  "draft.put-back.done": "It’s back on your site.",
  "draft.put-back.refused": "That didn’t work, so the page is still off your site. Try again.",
  // The draft screen as board AppDraft draws it (canvas V22, issue 1748).
  // Drafted under issue 759's ruling; the owner corrects the wording.
  "draft.preview.caption": "Preview on your site",
  "draft.search-result.caption": "Google can choose other words.",
  "draft.checks.more": "and {n} more",
  "draft.checks.decided": "A page that fails a check on facts, honesty, spam or repeats doesn’t go live. The other checks show where a page could be better.",
  // Q6 (owner 2026-10-20, #1718): a stopped topic is dropped for good.
  "draft.decide.stop-note": "It won’t go live, and this topic is dropped. Other days are not affected.",
  "draft.rail.today": "Today, {time}",
  "draft.rail.day": "{day}, {time}",
  "draft.tabs.label": "About this page",
  "draft.tab.page": "Page",
  "draft.tab.checks": "Checks {passed}/{asked}",
  "draft.tab.checks.name": "Checks, {passed} of {asked} passed",
  "draft.tab.search": "In Search",
  "draft.tab.sources": "Sources",
  "draft.tab.adds": "What It Adds",
  "draft.tab.links": "Links",
  "draft.tab.doing": "How It’s Doing",
  "draft.why.fit.answer": "Fit: what you sell is the answer to this search",
  "draft.why.fit.helps": "Fit: what you sell helps with this search",
  "draft.search.query": "The search",
  "draft.search.volume": "Searched a month",
  "draft.search.rival": "Who answers it today",
  "draft.day.title": "This page’s day",
  "draft.day.written": "Written and checked",
  "draft.day.emailed": "Emailed to you",
  "draft.day.live": "Goes live on your site",
  "draft.day.reading": "First reading in Google and AI",
}) satisfies CopyPartition;
