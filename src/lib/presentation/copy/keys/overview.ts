// src/lib/presentation/copy/keys/overview.ts — Overview's sentences, in the registry's voice.
import type { CopyPartition } from "../registry.ts";

export const OVERVIEW_COPY = Object.freeze({
  "place.overview.weekly-presence.chart": [
    "No Monday check yet. The line starts with the first one.",
    { law: "no-presence-yet", slots: {} },
  ],
  "place.overview.weekly-presence.week": [
    "Not checked this week yet. Next check: Monday.",
    { law: "no-presence-yet", slots: {} },
  ],
  "place.overview.weekly-presence.partial-week": [
    "Part of this week wasn’t checked. What was checked shows its date.",
    { law: "no-presence-yet", slots: {} },
  ],
  // ── The tiles.
  "overview.tile.ai-answers.label": ["AI", { slots: {} }],
  // The set's own two lines on the pages tile, both unbracketed and so
  // approved (11a): the badge beside the count, and the dim line under it.
  // Both numbers are slots — the ranking count is measured and the three
  // weeks are `TOO_EARLY_WEEKS`, which is a pin and is never re-written.
  "overview.tile.pages.ranking": [
    "{count} already showing on Google",
    { slots: { count: "text" } },
  ],

  // §4.5's "goal: 6", with the number left to `GOAL_VALUES`.
  "overview.delta.up": ["▲", { slots: {} }],
  "overview.delta.down": ["▼", { slots: {} }],

  // ── How far ahead each rival is.
  "overview.rivals.title": ["How Far Ahead Competitors Are", { slots: {} }],
  "overview.rivals.spark.label": [
    "How far ahead {rival} is",
    { slots: { rival: "text" } },
  ],
  "overview.rivals.ratio": ["{ratio}× your size", { slots: { ratio: "text" } }],
  "overview.rivals.from": [
    "from {ratio}×",
    { slots: { ratio: "text" } },
  ],
  "overview.rivals.flat": [
    "no clear change",
    { slots: {} },
  ],
  "overview.rivals.ahead.sub": [
    "Moves over months, not weeks.",
    { slots: {} },
  ],
  "overview.rivals.ahead.size": [
    "Size is how many searches a site shows up for.",
    { slots: {} },
  ],
  "overview.rivals.line.shrinking": [
    "A line going down means the gap is closing.",
    { slots: {} },
  ],
  // §6.6's own "render the rivals' absolute numbers with `you: 0`" — the
  // word that names whose number the cold-start arm shows beside the rivals'.
  "overview.rivals.you": ["you", { slots: {} }],
  // The cold-start arm's line, and the one key on this screen whose value is
  // constrained by what it must **not** say: nothing is shrinking yet, so it
  // can never be `overview.rivals.line.shrinking` (REQ-041 c9).
  "overview.rivals.line.absolute": ["Each line is a competitor’s own count beside yours.", { slots: {} }],
  // The week-0 arm's one line, in place of the rows: nothing has been
  // sized yet, and the card says when it will be rather than drawing three
  // empty plots.
  "overview.rivals.line.week-zero": [
    "Shown after the first Monday check, {due}.",
    { slots: { due: "date" } },
  ],

  // #793: the deep pass sized the rivals, so week 0 draws their rows from
  // it and says so. Drafted (#759); the owner corrects the wording.
  "overview.rivals.line.starting": [
    "Starting sizes from your first check, {on}. Updated every Monday from {due}.",
    { slots: { on: "date", due: "date" } },
  ],

  // ── REQ-096 c6 as right-sized by issue 858 (owner walk, 2026-09-17): the
  // far rivals the customer tracks are market leaders on one secondary line,
  // never "your rivals" and never leading the card. The line names them and
  // says why they are apart; it does not name a replacement or suggest
  // removing them — the customer changes the set from the competitors card.
  // Drafted (issue 759); the owner corrects the wording.
  "overview.rivals.leaders": [
    "Far larger sites, like {rivals}, are left out.",
    { slots: { rivals: "text" } },
  ],
  // The same sentence for the Rivals tab, where the line sits under bars
  // that **do** show the leaders (owner ruling, 2026-09-21, #983). On the
  // Overview the card is the gap card and nothing else, so "they aren't
  // shown as your rivals" is true there; on the tab the first-page and
  // answer-engine cards above it name every one of them, and the same
  // sentence read as a contradiction of what the reader could see.
  //
  // Two keys and not one sentence with a slot: what differs is the clause
  // that says *where* they are left out, and a slot that carried a clause
  // would be a sentence assembled at the call site. The owner's draft, used
  // as written, with the existing key's slot name — the two take the same
  // vars, which is what lets the one module fill either.
  "overview.rivals.none-reachable": [
    "None of the competitors you track is within reach yet. Add one closer to your size.",
    { slots: {} },
  ],
  // The one control c6 allows, and the whole of it. Never "remove".
  "overview.rivals.leaders.swap": ["Change Your Competitors", { slots: {} }],

  // ── This week.
  "overview.week.title": ["This Week", { slots: {} }],
  // SPEC §4 (2026-09-20, #914): *Plan* is the calendar's on-screen name;
  // the key still says where the link goes.
  "overview.week.calendar-link": ["See Why Each Page →", { slots: {} }],
  "overview.week.day.done": ["done", { slots: {} }],
  "overview.week.day.today": ["today", { slots: {} }],
  "overview.week.day.to-come": ["next", { slots: {} }],

  // ── The alerts, and the one remainder line.
  // A page in review is the next page of the daily autopilot, not something
  // to read before it can go out (owner 2026-10-09, issue 1362).
  "overview.alert.pending-veto": ["{title} goes live on its own", { slots: { title: "text" } }],
  "overview.alert.pending-veto.action": ["Read or Edit", { slots: {} }],
  "overview.alert.needs-you": ["{title} needs you before it can go out", { slots: { title: "text" } }],
  // "Reconnect" is unbracketed in the approved set (ruling 11a) — the word
  // on the accent panel's outline pill. The alert's own title and the line
  // saying what broke are bracketed there; their words below are the
  // owner's (#460).
  "overview.alert.needs-you.action": ["Reconnect WordPress", { slots: {} }],
  // The cause: "[cause line — owner's]" in the set, written by the owner
  // (#460). One short line
  // under the title, never a paragraph (§2.5's dim line).
  "overview.alert.needs-you.cause": ["We couldn’t put this page on your site.", { slots: {} }],
  // Issue 880: the word for a page that is not waiting on a destination —
  // one the writing rules stopped, or a step that could not run. It is read
  // and resolved on the page itself, which is where this alert already
  // points; "Reconnect" above is for a delivery the founder must fix.
  // Drafted under issue 759's ruling. The cause line for each of the five
  // causes is `publish.needs-you.*`, stated from the page's own record.
  "overview.alert.needs-you.read": ["Read the Page", { slots: {} }],
  // The veto panel's own line, unbracketed in the set and therefore
  // approved. `left` is how long the window has to run, from the draft's
  // own stored `veto_deadline` (issue 794) — never a number typed here.
  "overview.alert.pending-veto.due": [
    "goes live in {left} unless you stop it",
    { slots: { left: "text" } },
  ],
  // A page in review with no veto window running: nothing publishes it on
  // a clock, so the line states no countdown. Drafted (issue 794); the
  // owner corrects the wording.
  "overview.alert.pending-veto.no-window": [
    "has no go-live time yet",
    { slots: {} },
  ],
  "overview.alert.overflow": ["{remaining} more in This week.", { slots: { remaining: "text" } }],
  // A technical issue the customer fixes (SPEC §9, #572): its title is the
  // check's own, its line the severity word. The control's word and the
  // count of the issues not shown are owner-owed.
  "overview.alert.site-issue.action": ["See the Fix", { slots: {} }],
  "overview.alert.site-issue.overflow": [
    "{remaining} more in Site fixes.",
    { slots: { remaining: "text" } },
  ],
  /* ── Technical issues, the account's view of the checks it fixes (issue 1550, drafted) */
  "overview.issues.title": ["Site Fixes", { slots: {} }],
  "overview.issues.lead": ["Optional. Whoever runs your website can make them; ReachKit can’t.", { slots: {} }],
  "overview.issues.found": ["Found {date}.", { slots: { date: "text" } }],
  "overview.issues.empty": ["Nothing on your site needs fixing. We check again on Monday.", { slots: {} }],
  "overview.issues.unscanned": ["Your site hasn’t been checked yet. What the first check finds shows here.", { slots: {} }],
  "overview.issues.unreadable": ["This list didn’t load. Try again in a minute.", { slots: {} }],
  "overview.issues.site": ["Applies to the whole site.", { slots: {} }],
  "overview.issues.seconds": ["{seconds} s", { slots: { seconds: "text" } }],
  "overview.issues.slow-note": ["Each took {seconds} seconds or more, twice.", { slots: { seconds: "text" } }],
  "overview.issues.read": ["Your site, {count} pages read", { slots: { count: "text" } }],
  "overview.issues.fine": ["pages with nothing to fix", { slots: {} }],
  "overview.issues.affected": ["{pages} pages have a problem.", { slots: { pages: "text" } }],
  "overview.issues.affected.one-page": ["One page has a problem.", { slots: {} }],
  "overview.issues.ours": ["Your ReachKit pages are checked before they go live.", { slots: {} }],
  "overview.issues.share": ["{count} of {over}", { slots: { count: "text", over: "text" } }],
  "overview.issues.share.unit": ["pages", { slots: {} }],
  "overview.issues.fix": ["The fix:", { slots: {} }],
  "overview.issues.show": ["Show the {count} Pages", { slots: { count: "text" } }],
  "overview.issues.show.one": ["Show the Page", { slots: {} }],
  "overview.alerts.empty": ["Nothing needs you today.", { slots: {} }],

  // ── The one supply statement Overview may make, resolved in this order.
  "overview.supply.exhausted": ["Nothing is left worth writing. Monday’s check looks for more.", { slots: {} }],
  // issue 784 (issue 765's distinction, 2026-09-16): zero supply over a market that
  // was never measured is not "no pages left". Drafted under issue 759's ruling.
  "overview.supply.unmeasured": ["We haven’t found enough searches for your market yet. Name a broader one in Settings and we’ll check again.", { slots: {} }],
  // issue 855: zero supply because the pass that should have filled it stopped
  // on a ceiling. Drafted under issue 759's ruling.
  "overview.supply.measuring": ["We’re still checking your market, so no pages are planned yet. Nothing is needed from you.", { slots: {} }],
  "overview.supply.short": ["Less than a week of pages is left. Monday’s check looks for more.", { slots: {} }],
  // Issue 1559: the depth is a week and its spares, not a month. Drafted.
  "overview.supply.first-arrival": ["Your first check found less than a week of pages. We look for more every Monday.", { slots: {} }],

  // 2026-09-07, issue #205 — the account a broken series puts on its own
  // break. REQ-071 c12/c13 forbid drawing a difference across a date the
  // site's answers changed, so every week-spanning form on this screen
  // stops at one; these are the lines that say which answer changed. One
  // key per `ChangeKind` and no default: a change this screen cannot name
  // is a change it must not stand a nameless rule for.
  //
  // The marker they name is a value the customer chose (a domain, a
  // category), and the value itself renders beside the line as a value
  // rather than as voice — §2.3's rule, the same one the draft screen's
  // matched-entry line follows.
  "overview.change.domain": ["Website changed. Figures start again from here.", { slots: {} }],
  "overview.change.category": ["Market changed. Your searches start again from here.", { slots: {} }],
  "overview.change.rivals": ["Competitors changed. Comparison starts again from here.", { slots: {} }],
  "overview.change.locale": ["Country or language changed. Figures start again from here.", { slots: {} }],
  // REQ-071 c13's other half: a card that compares two readings has to say
  // which span it compared over when a change falls inside it, rather than
  // quietly comparing across one.
  "overview.comparison.window": [
    "Shown from {since}, when your settings changed. Older figures are kept apart.",
    { slots: { since: "date" } },
  ],

  // The detail screens' names.
  "overview.tab.search": ["Google", { slots: {} }],
  "overview.tab.rivals": ["Competitors", { slots: {} }],

  // ── The page waiting for review.
  // A page in review with no window running: nothing publishes it on a
  // clock, so the line states no time.
  "overview.waiting.waits": ["Its go-live time isn’t set yet.", { slots: {} }],
  // The four arms of the reason, one per shape of evidence the opportunity
  // carries. Never composed at a call site: the screen picks the arm and the
  // registry says the sentence.
  "overview.waiting.why.answered-by": [
    "{volume} people a month search “{search}”. {rival} shows up, and you don’t.",
    { slots: { volume: "text", search: "text", rival: "text" } },
  ],
  "overview.waiting.why.not-high-enough": [
    "{volume} people a month search “{search}”. Your page for it isn’t high enough yet.",
    { slots: { volume: "text", search: "text" } },
  ],
  // The search was chosen but its demand was never read back: the screen
  // states what the page is for and claims no number (REQ-004).
  "overview.waiting.why.search": [
    "This page is written to win “{search}”.",
    { slots: { search: "text" } },
  ],
  // A Fix page has no market target at all (SPEC §9).
  "overview.waiting.why.fix": [
    "This page fixes something on your own site that is holding your pages back.",
    { slots: {} },
  ],
  "overview.waiting.badge.new": ["New page", { slots: {} }],
  "overview.waiting.badge.update": ["Update", { slots: {} }],
  // The screen's second control. "Stop this page" is the product's word on
  // every screen and in every mail (SPEC §4 · §7, 2026-09-20); "veto" stays
  // internal.
  "overview.waiting.stop": ["Stop This Page", { slots: {} }],
  // Every action answers (SPEC §4, 2026-09-20): the two words the control
  // says back, on the screen, in place of silence.
  "overview.waiting.stopped": ["Stopped. This page won’t go live.", { slots: {} }],
  "overview.waiting.stop-refused": [
    "Not stopped: this page may already be going live. You can still stop it in This Week.",
    { slots: {} },
  ],

  // ── This week: the word a day carries when nothing is scheduled on it.
  // The five stage words are the calendar's own (`calendar.stage.*`).
  "overview.week.day.no-page": ["No page", { slots: {} }],

  // ── SPEC §4 (2026-09-20, #908), the Search tab (#916) — every search
  // ReachKit is going after, and where the customer stands on it. Every
  // sentence below is drafted under the 2026-09-16 ruling (#759) and named
  // in the PR body for the owner to correct; the four status words and the
  // ceiling line are the issue's own drafts, taken verbatim.
  // The screen's own lead sentence is gone (SPEC §4, 2026-10-07, issue
  // 1324): Search, AI answers and Rivals open on their numbers.
  //
  // The line in the head: which measurement this whole screen is read
  // from. No vendor and no cost — the date the pass was taken, and nothing
  // else.
  "overview.search.measured": [
    "Checked {on}.",
    { slots: { on: "date" } },
  ],

  // Issue 1551 (owner, 2026-10-19): the searches the live pages target,
  // split by how far Google has got with each — the tile Overview's Google
  // figure is read from — and the market's twelve, labelled as the outcome
  // that takes months. Drafted (#759).
  "overview.search.tile.your-pages": ["Your Pages in Google", { slots: {} }],
  "overview.search.tile.your-pages.of": [
    "of {of} pages showing on Google",
    { slots: { of: "text" } },
  ],
  "overview.search.tile.your-pages.split": [
    "{first} on Google’s first page · {further} further down · {unseen} not showing yet",
    { slots: { first: "text", further: "text", unseen: "text" } },
  ],
  "overview.search.tile.your-pages.means": [
    "A page counts once Google shows it for its own search. Most new pages take weeks to show.",
    { slots: {} },
  ],
  "overview.search.tile.market": ["Your Market", { slots: {} }],
  "overview.search.tile.market.means": [
    "How many of your market’s biggest searches show you on Google’s first page. This takes months, not weeks.",
    { slots: {} },
  ],
  "overview.search.tile.searches.of": [
    "of {of} searches on Google’s first page",
    { slots: { of: "text" } },
  ],
  "overview.search.tile.market.split": [
    "{first} on Google’s first page · {rest} not yet",
    { slots: { first: "text", rest: "text" } },
  ],

  // The column heads.
  "overview.search.column.search": ["Search", { slots: {} }],
  "overview.search.column.volume": ["Searches a month", { slots: {} }],
  // The phone shape has no column heads, so a volume says what it counts.
  "overview.search.a-month": ["a month", { slots: {} }],
  "overview.search.column.you": ["You", { slots: {} }],
  "overview.search.column.rival": ["Best competitor", { slots: {} }],
  "overview.search.column.status": ["What we’re doing", { slots: {} }],

  // SPEC §4's four status words, and the chip that stands for all of them.
  "overview.search.status.all": ["All", { slots: {} }],
  "overview.search.status.live": ["Page is live", { slots: {} }],
  "overview.search.status.your-review": ["Page scheduled", { slots: {} }],
  "overview.search.status.up-next": ["Up next", { slots: {} }],
  "overview.search.status.too-big": ["Too hard for now", { slots: {} }],
  // A filter chip's whole text. It is one string because daisyUI's `filter`
  // draws a radio's own `aria-label`, so the word and its count reach the
  // screen as one attribute rather than as two elements.
  "overview.search.chip": [
    "{status} {count}",
    { slots: { status: "text", count: "text" } },
  ],
  "overview.search.filter.label": ["Show", { slots: {} }],
  "overview.search.table.label": [
    "Every search ReachKit is going after",
    { slots: {} },
  ],

  // A place on a search results page, and the week's move. The glyphs are
  // `overview.delta.up` / `overview.delta.down`, already written.
  "overview.search.position": ["#{position}", { slots: { position: "text" } }],
  // A page with a verdict and nothing recorded to compare it with: its
  // first week, which is a fact and not a change of zero.
  "overview.search.you.first": ["new", { slots: {} }],
  // An Improve target: the page that answers this search is the customer's
  // own, so no rival holds it.
  "overview.search.rival.yours": ["Your own page", { slots: {} }],

  // The foot of the table: how much of it is on screen, in what order, and
  // the one control that shows the rest.
  "overview.search.show-all": ["Show All {total} Searches", { slots: { total: "text" } }],
  // Nothing on file at all — a site whose first pass has not finished, or
  // one whose market was too small. It claims neither: it says what is
  // true of the list, and the Overview's own supply statement says why.
  "overview.search.empty": [
    "No searches yet. They arrive with your first check.",
    { slots: {} },
  ],

  // Board AppGoogle (issue 1746): the tab's head, the visits tile, each live
  // page in Google, and what is done about each search this week. Drafted (#759).
  "overview.tab.eyebrow": ["Overview · week {n}", { slots: { n: "text" } }],
  "overview.means": ["What this means", { slots: {} }],
  "overview.search.visits.label": ["Visits from Google", { slots: {} }],
  "overview.search.visits.of": ["this week, to your pages", { slots: {} }],
  "overview.search.visits.none": ["none yet", { slots: {} }],
  "overview.search.visits.chart": ["Visits from Google, week by week", { slots: {} }],
  "overview.search.visits.means": [
    "People who came to your pages from Google. Shown once there is one.",
    { slots: {} },
  ],
  "overview.search.pages.title": ["Each Page in Google", { slots: {} }],
  "overview.search.pages.caption": ["place 1 is the top result, maps not counted", { slots: {} }],
  "overview.search.pages.all": ["Show All {total} Pages", { slots: { total: "text" } }],
  "overview.search.pages.none": [
    "No page is live yet. Each shows here once it’s live, with its place in Google.",
    { slots: {} },
  ],
  "overview.search.place.up": [
    "Place {n}, up {gain} since {date}.",
    { slots: { n: "text", gain: "text", date: "date" } },
  ],
  "overview.search.place.flat": [
    "Place {n}, flat for {weeks} weeks.",
    { slots: { n: "text", weeks: "text" } },
  ],
  "overview.search.place.now": [
    "Place {n}.",
    { slots: { n: "text" } },
  ],
  "overview.search.place.update": ["Update goes live {day}.", { slots: { day: "date" } }],
  "overview.search.place.found": [
    "Found by Google {date}. Not in results yet.",
    { slots: { date: "date" } },
  ],
  "overview.search.place.unseen": ["Not in results yet.", { slots: {} }],
  // D8: a place read from the keyword database is an estimate, and says so.
  "overview.search.place.estimate": [
    "Based on Google’s estimate, not this week’s check.",
    { slots: {} },
  ],
  "overview.search.table.title": ["Your Market’s Searches", { slots: {} }],
  // A business that sells beyond one place: the lead names none.
  "overview.search.doing.today": ["Goes live today", { slots: {} }],
  "overview.search.doing.page": ["Page {day}", { slots: { day: "date" } }],
  "overview.search.doing.update": ["Update {day}", { slots: { day: "date" } }],
  "overview.search.doing.climbing": ["Climbing, so we wait", { slots: {} }],

  // ── 2026-09-20 (#908, #918): Overview › AI answers.
  //
  // SPEC §6 of that date: "a rolling four-week rate — answers that name or
  // link the site over all answers asked — beside this week's n of 12; named
  // and linked are counted apart." Every sentence below is **drafted** under
  // the owner's 2026-09-16 ruling (#759) and the PR names each one so the
  // owner can correct it. Three words the product already says are reused
  // rather than spelled again: the tile name ("Questions that name you"),
  // the window's "of {of}", and the three engine names, which are the
  // report screen's own keys.
  // Issue 1551 (owner, 2026-10-19; SEO review R5.1): the tab leads with the
  // published pages' own questions whose AI answer links the site — the
  // signal a page moves first. Drafted (#759).
  "overview.answers.pages-cited.label": ["Pages Linked by AI", { slots: {} }],
  "overview.answers.pages-cited.of": ["of {of} pages asked", { slots: { of: "text" } }],
  "overview.answers.pages-cited.none": [
    "Shows once a page is live and we’ve asked its question.",
    { slots: {} },
  ],
  // Board AppAI: the tiles, each page in AI answers, and which AI read and sent visits. Drafted (#759).
  "overview.answers.linked.mentioned.one": [
    "1 more mentioned you without a link.",
    { slots: {} },
  ],
  "overview.answers.linked.mentioned": [
    "{n} more mentioned you without a link.",
    { slots: { n: "text" } },
  ],
  "overview.answers.reads.label": [
    "Read by AI",
    { slots: {} },
  ],
  "overview.answers.reads.of": [
    "times this week",
    { slots: {} },
  ],
  "overview.answers.visits.label": [
    "Visits from AI",
    { slots: {} },
  ],
  "overview.answers.visits.of": [
    "this week",
    { slots: {} },
  ],
  "overview.answers.pages.title": [
    "Each Page in AI Answers",
    { slots: {} },
  ],
  "overview.answers.pages.unread": [
    "not read by AI yet",
    { slots: {} },
  ],
  "overview.answers.pages.engines": [
    "Answers from ChatGPT and Google’s AI",
    { slots: {} },
  ],
  "overview.answers.who.title": [
    "Which AI Read and Sent Visits",
    { slots: {} },
  ],
  "overview.answers.who.reads": [
    "Reads",
    { slots: {} },
  ],
  // The four-week rate over the twelve, its denominator, the split the
  // owner's ruling asks for, and the one line saying why four weeks.

  // The second tile: this week's n of 12, and the engine it is counted
  // from — the Overview's own rule, said on this screen too.

  // The grid: its head, the line under it, and the names a reader needs to
  // read a mark without seeing its colour.
  "overview.answers.grid.title": [
    "What AI Says on Your Searches",
    { slots: {} },
  ],
  "overview.answers.grid.lead": [
    "Your {of} searches, asked of each AI.",
    { slots: { of: "text" } },
  ],
  "overview.answers.grid.label": [
    "Each search, and what each AI engine said",
    { slots: {} },
  ],
  // ── 2026-09-20 (#908, #919): the cap, stated on the grid it bounds.
  //
  // SPEC §6 of that date: "at most 24 tracked questions in all (the twelve
  // plus twelve) … the set never grows past the cap, so its cost is flat",
  // confirmed as written by the owner on 2026-09-21 (§12, #985). The board
  // (R4-06) states it as "21 of 24 at most". **Drafted** under the owner's
  // 2026-09-16 ruling (#759); the PR names it so the owner can correct it.

  // The three marks, and "Not checked", which is never a miss. The last mark
  // covers an answer that mentions someone else, names no one or is not given.
  "overview.answers.mark.links": ["Links to you", { slots: {} }],
  "overview.answers.mark.names": ["Mentions you", { slots: {} }],
  "overview.answers.mark.not-you": ["Doesn’t mention you", { slots: {} }],
  "overview.answers.mark.not-measured": ["Not checked", { slots: {} }],
  // One cell's accessible name: which question, which engine, what it said.
  // Never the colour, and never the mark alone.
  "overview.answers.cell": [
    "{question} · {engine}: {mark}",
    { slots: { question: "text", engine: "text", mark: "text" } },
  ],
  // The search a question was phrased from — REQ-093 c3's other half, which
  // is why the wording never appears without it.
  "overview.answers.from": ["from {search}", { slots: { search: "text" } }],
  // The customer's own page for a question, where one is live.
  "overview.answers.page": ["Your page", { slots: {} }],
  // Nothing measured yet — a site whose first weekly pass has not run. It
  // claims nothing about the engines; it says what is true of the record.
  "overview.answers.empty": [
    "No AI answers yet. The first Monday check asks AI your questions.",
    { slots: {} },
  ],

  // ── 2026-10-03 (#1162): the tracked buyer prompts — owner D19 final, and
  // D22's AI mention rate and Your pages cited.
  //
  // The weekly AI measure is about 25 buyer prompts, each put to Google AI
  // Mode and ChatGPT twice. Every sentence below is **drafted** under the
  // owner's 2026-09-16 ruling (#759); the PR names each one so the owner
  // can correct it. No sentence states an AI position or sentiment.
  // The 95% range beside the figure: where the true rate very likely sits.
  // D58 (issue 1287, drafted): no rate is shown until two weeks of the
  // current prompt set exist, and one line says when the rate appears.
  "overview.tile.mention-rate.early": [
    "AI answers that mentioned you so far. A rate shows after {weeks} weeks.",
    { slots: { weeks: "text" } },
  ],
  // D64 (issue 1301, drafted): no pass has passed its own checks yet, so
  // the newest pass's count is shown and said to be the first.
  "overview.tile.mention-rate.first": [
    "First check. A rate shows after {weeks} weeks.",
    { slots: { weeks: "text" } },
  ],

  // The AI answers tab: the rate's own card. Issue 1551 (SEO review R5.1)
  // labels it as what it measures. Drafted (#759).
  "overview.prompts.rate.reputation": [
    "How often AI names you when buyers ask for a business like yours. It moves over months.",
    { slots: {} },
  ],
  "overview.prompts.rate.count": [
    "ChatGPT and Google’s AI mentioned you in {n} of {m} answers",
    { slots: { n: "text", m: "text" } },
  ],
  "overview.prompts.rate.first": [
    "last {weeks} weeks · first reading",
    { slots: { weeks: "text" } },
  ],
  "overview.prompts.rate.monthly": [
    "last {weeks} weeks · checked monthly",
    { slots: { weeks: "text" } },
  ],
  "overview.prompts.rate.band": [
    "Answers vary, so the true rate is {low}% to {high}%.",
    { slots: { low: "text", high: "text" } },
  ],

  // The site beside its rivals, by answers that named each; the lead heads the block (owner R6).
  "overview.prompts.share.label": [
    "You and your competitors, by AI answers that mentioned each",
    { slots: {} },
  ],
  "overview.prompts.share.you": ["You", { slots: {} }],
  "overview.prompts.share.none": [
    "No answer mentioned you or a competitor yet.",
    { slots: {} },
  ],

  // The set itself, so a founder can read what is asked.
  "overview.prompts.list.title": [
    "Questions We Ask AI",
    { slots: {} },
  ],
  "overview.prompts.list.count": [
    "{n} of {m} questions. We leave out questions with your name.",
    { slots: { n: "text", m: "text" } },
  ],

  // ── 2026-09-20 (#908, #921): the AI engines that read the hosted pages.
  // ChatGPT is `ai-answers.engine.chatgpt` — a second spelling of it would be
  // the second place the product speaks (ADR-001).
  "overview.blog.engine.perplexity": ["Perplexity", { slots: {} }],
  "overview.blog.engine.claude": ["Claude", { slots: {} }],
  "overview.blog.engine.gemini": ["Gemini", { slots: {} }],
  "overview.blog.engine.copilot": ["Microsoft Copilot", { slots: {} }],
  // ── 2026-09-20 (#908, #917): Overview › Rivals.
  //
  // SPEC §4 of that date: "who is on the first page for the twelve
  // searches, who the three answer engines name, how far ahead each rival's
  // footprint is over twelve weeks, and the searches rivals win that the
  // site does not, each with what ReachKit is doing about it." Every
  // sentence below is **drafted** under the owner's 2026-09-16 ruling (#759)
  // and the PR names each one so the owner can correct it. The card that
  // was already built keeps its own words — `overview.rivals.title`,
  // `overview.rivals.ratio`, the two line keys and
  // the market-leaders sentence are the Overview's and are reused here
  // rather than spelled a second time.
  // The first counting card: who holds a place on Google's first page for
  // the twelve searches the pass buys a top ten for.
  "overview.rivals.first-page.title": [
    "Who’s on Google’s First Page",
    { slots: {} },
  ],
  "overview.rivals.first-page.started": [
    "You were on {count} of {of} when you started.",
    { slots: { count: "text", of: "text" } },
  ],

  // The second: who the three answer engines name, counted the way the AI
  // answers tab draws it, with the link to that tab beneath.
  "overview.rivals.named.title": ["Who AI Answers Mention", { slots: {} }],
  "overview.rivals.named.lead": [
    "{answers} AI answers, last {weeks} weeks.",
    { slots: { answers: "text", weeks: "text" } },
  ],
  "overview.rivals.named.lead.none": [
    "From the AI answers to your buyers’ questions.",
    { slots: {} },
  ],
  "overview.rivals.first.title": [
    "Who Your Buyers See First",
    { slots: {} },
  ],
  "overview.rivals.first.lead": [
    "The top Google result on your {of} main searches.",
    { slots: { of: "text" } },
  ],
  "overview.rivals.first.of": [
    "{n} of {of}",
    { slots: { n: "text", of: "text" } },
  ],
  "overview.rivals.first.others": [
    "others",
    { slots: {} },
  ],
  "overview.rivals.first.line": [
    "You’re top on none yet, and on Google’s first page for {n}.",
    { slots: { n: "text" } },
  ],
  "overview.rivals.first.you": [
    "You’re the top result on {n} of the {of}.",
    { slots: { n: "text", of: "text" } },
  ],
  "overview.rivals.first.after": [
    "This week’s pages go after {m}.",
    { slots: { m: "text" } },
  ],

  // A card that was measured and counted no tracked rival anywhere says so
  // once, in place of a row of empty bars, and the rivals neither card
  // counted are named under them (SPEC §4, 2026-10-09). Drafted (issue
  // 759); the owner corrects the wording.
  "overview.rivals.first-page.none": [
    "None of your competitors is on Google’s first page here.",
    { slots: {} },
  ],
  "overview.rivals.first-page.none.holders": [
    "None of your competitors is on Google’s first page here. Most often there: {holders}.",
    { slots: { holders: "text" } },
  ],
  "overview.rivals.named.none": [
    "None of these answers mentioned one of your competitors.",
    { slots: {} },
  ],

  // `overview.rivals.gap.lead` is gone: no screen says what the ratio is a
  // ratio of (D24, SPEC §4 2026-10-02; issue 1324).

  // A card whose reading the pass never took. It claims nothing about the
  // rivals; it says what is true of the measurement.
  "overview.rivals.card.unmeasured": [
    "Not checked yet. The first Monday check fills this in.",
    { slots: {} },
  ],

  // The table: every search a rival wins that the site does not.
  "overview.rivals.table.title": [
    "Searches Competitors Win",
    { slots: {} },
  ],
  "overview.rivals.table.lead": [
    "This week’s pages come from this list.",
    { slots: {} },
  ],
  "overview.rivals.table.label": [
    "Searches competitors win and you don’t",
    { slots: {} },
  ],
  "overview.rivals.table.empty": [
    "No competitor wins a search you’re missing.",
    { slots: {} },
  ],
  "overview.rivals.column.winner": ["Who wins it", { slots: {} }],
  "overview.rivals.won-by": ["Won by", { slots: {} }],
  "overview.rivals.column.doing": ["What we’re doing", { slots: {} }],

  // SPEC §4's four words for what ReachKit is doing about a search a rival
  // wins. None of them is "live": a search the customer already wins is not
  // in this table at all.
  "overview.rivals.status.in-review": [
    "Page scheduled",
    { slots: {} },
  ],
  "overview.rivals.status.up-next": ["Up next", { slots: {} }],
  "overview.rivals.status.needs-page": [
    "Needs a page on your main site",
    { slots: {} },
  ],
  "overview.rivals.status.too-big": ["Too hard for now", { slots: {} }],

  // The filter over the table.
  "overview.rivals.filter.label": ["Show one competitor", { slots: {} }],
  "overview.rivals.filter.all": ["All competitors", { slots: {} }],
  // SPEC §5 (2026-09-20): Overview while the address waits for its DNS
  // record, as board OverviewDNS draws it. No line names a go-live time:
  // none is true until it is live (Q11). Drafted (#759); the PR names each.
  // No day is known where the address's start was not stored: the screen's name alone.
  "overview.connect.eyebrow.plain": ["Overview", { slots: {} }],
  "overview.connect.day": ["Overview · day {n}", { slots: { n: "text" } }],
  "overview.connect.head": ["Your Pages Wait for Your Website", { slots: {} }],
  "overview.connect.head.ready": ["Your First Page Is Ready", { slots: {} }],
  "overview.connect.lead": [
    "They go live once your website is connected. Everything else runs on its own.",
    { slots: {} },
  ],
  "overview.connect.lead.ready": ["It goes live once your website is connected.", { slots: {} }],
  "overview.connect.eyebrow": ["Needs you", { slots: {} }],
  "overview.connect.title": ["Add One Setting to Your Domain", { slots: {} }],
  "overview.connect.step.open": ["Open Your Domain Settings", { slots: {} }],
  "overview.connect.step.open.line": [
    "Where you bought {domain}.",
    { slots: { domain: "text" } },
  ],
  "overview.connect.step.paste": ["Paste the Three Values", { slots: {} }],
  "overview.connect.step.rest": ["We Do the Rest", { slots: {} }],
  "overview.connect.step.rest.line": ["Your pages appear on {host}.", { slots: { host: "text" } }],
  "overview.connect.copy.type": ["Copy the type", { slots: {} }],
  "overview.connect.copy.name": ["Copy the name", { slots: {} }],
  "overview.connect.copy.value": ["Copy the value", { slots: {} }],
  "overview.connect.check": ["Check Connection Now", { slots: {} }],
  "overview.connect.guide": [
    "Step-by-Step for Your Domain Host →",
    { slots: {} },
  ],
  "overview.connect.checked": ["Checked {time}: not found yet.", { slots: { time: "text" } }],
  "overview.connect.unchecked": ["Not found yet.", { slots: {} }],
  "overview.connect.hourly": [
    "We check every hour. It can take a few hours.",
    { slots: {} },
  ],
  "overview.connect.other": ["Other ways to connect", { slots: {} }],
  "overview.connect.wordpress": [
    "On WordPress? Connect with an app password instead.",
    { slots: {} },
  ],
  "overview.connect.wordpress.link": ["Connect WordPress →", { slots: {} }],
  "overview.connect.wordpress.action": ["Connect WordPress", { slots: {} }],
  "overview.connect.later": [
    "The setting is also in your mail, to add later from a computer.",
    { slots: {} },
  ],
  "overview.connect.page.eyebrow": ["Ready to go live", { slots: {} }],
  "overview.connect.page.read": ["Read or Edit It →", { slots: {} }],
  "overview.connect.progress": [
    "Progress shows here once your first page is live.",
    { slots: {} },
  ],

  // SPEC §4 (2026-09-20, #908), issue 912 — the first day after setup.
  //
  // "Overview shows the pass's named steps (done / now / next) in the hero
  // and skeletons for the week; it fills in when the pass ends."
  //
  // All three are **issue 912's own drafted wording, byte for byte**. The
  // owner may correct them; they are named in the pull request.
  //
  // The fourth sentence that issue drafts — "First measured Monday
  // {date}." — is deliberately **not** here: the rule it states ("a number
  // not yet measured is an em-dash with the date it will be") is already
  // shipped and already approved, as `overview.tile.score.first-due`
  // ("first measurement due {due}", S13 · REQ-040 c7). Adding a second
  // sentence for one fact would be two wordings of it on one screen, and
  // replacing an owner-approved string with a drafted one is not this
  // issue's to do.
  "overview.first-day.choosing": [
    "We’re choosing a first page you can win.",
    { slots: {} },
  ],
  "overview.first-day.mail": [
    "We’ll email you when it’s written. You can edit or stop it before it goes live.",
    { slots: {} },
  ],
  "overview.first-day.week": [
    "Your week is planned when the first check finishes.",
    { slots: {} },
  ],

  /* ── The owner's cost page (issue 1478, drafted) ──────────────────── */
  // Owner-only: `/app/costs` answers a 404 to every other account. No
  // figure here is a customer's, and no vendor name reaches a customer.
  "overview.costs.title": ["Costs", { slots: {} }],
  "overview.costs.eyebrow": ["Owner only", { slots: {} }],
  "overview.costs.lead": ["The seven UTC days to {today}.", { slots: { today: "text" } }],
  "overview.costs.unreadable": ["The ledger could not be read just now. Nothing is lost; open this page again in a minute.", { slots: {} }],
  "overview.costs.stat.week": ["This week", { slots: {} }],
  "overview.costs.stat.estimated.of": ["estimated, our price list", { slots: {} }],
  "overview.costs.stat.billed.of": ["billed, on {billed} of {calls} calls", { slots: { billed: "text", calls: "text" } }],
  "overview.costs.stat.today": ["Today against the cap", { slots: {} }],
  "overview.costs.stat.today.cap": ["of €{cap}", { slots: { cap: "text" } }],
  "overview.costs.stat.today.of": ["warning at €{warn}", { slots: { warn: "text" } }],
  "overview.costs.cents": ["{cents}¢", { slots: { cents: "text" } }],
  "overview.costs.eur": ["€{eur}", { slots: { eur: "text" } }],
  "overview.costs.share": ["€{eur} · {share}%", { slots: { eur: "text", share: "text" } }],
  "overview.costs.unbilled": ["Not billed", { slots: {} }],
  "overview.costs.unreported": ["Not reported", { slots: {} }],
  "overview.costs.col.site": ["Site", { slots: {} }],
  "overview.costs.col.day": ["Day", { slots: {} }],
  "overview.costs.col.estimated": ["Estimated", { slots: {} }],
  "overview.costs.col.billed": ["Billed", { slots: {} }],
  "overview.costs.col.month": ["A month, against €{price}", { slots: { price: "text" } }],
  "overview.costs.col.activity": ["Activity", { slots: {} }],
  "overview.costs.col.failed": ["Failed or timed out", { slots: {} }],
  "overview.costs.col.vendor": ["Vendor", { slots: {} }],
  "overview.costs.col.recorded": ["Recorded", { slots: {} }],
  "overview.costs.col.vendor-billed": ["Vendor billed", { slots: {} }],
  "overview.costs.col.gap": ["Gap", { slots: {} }],
  "overview.costs.col.judged": ["Judged", { slots: {} }],
  "overview.costs.col.cap": ["Against €2", { slots: {} }],
  "overview.costs.week.title": ["Each site this week", { slots: {} }],
  "overview.costs.week.note": ["A month is this week × {weeks} plus a share of fixed costs, against €{net} net. A free scan counts to the site it became.", { slots: { weeks: "text", net: "text" } }],
  "overview.costs.week.month": ["Month vs €{price}", { slots: { price: "text" } }],
  "overview.costs.week.sub": ["{estimated} est. · {billed} billed", { slots: { estimated: "text", billed: "text" } }],
  "overview.costs.week.sub.unbilled": ["{estimated} est. · not billed", { slots: { estimated: "text" } }],
  "overview.costs.week.empty": ["Nothing was spent this week.", { slots: {} }],
  "overview.costs.days.title": ["Each site, each day", { slots: {} }],
  "overview.costs.days.sub": ["One row per site and day.", { slots: {} }],
  "overview.costs.activities.title": ["This week by activity", { slots: {} }],
  "overview.costs.activities.sub": ["Writing, measuring, scans and checks.", { slots: {} }],
  "overview.costs.vendors.title": ["Against the vendors", { slots: {} }],
  "overview.costs.vendors.sub": ["Our estimate against each vendor's bill.", { slots: {} }],
  "overview.costs.vendors.note": ["Recorded is the ledger and the box: billed where the vendor said, estimated where not. Vendor billed is the vendor's own account for that UTC day; it is read the day after.", { slots: {} }],
  "overview.costs.vendors.no-ai": ["Anthropic's own bill is not read, so AI spend is our estimate. The deployment needs an admin key to read it.", { slots: {} }],
  "overview.costs.cap.title": ["The €2 a day", { slots: {} }],
  "overview.costs.cap.summary": ["{over}, {warn}", { slots: { over: "text", warn: "text" } }],
  "overview.costs.cap.over-days.one": ["1 day over", { slots: {} }],
  "overview.costs.cap.over-days.other": ["{count} days over", { slots: { count: "text" } }],
  "overview.costs.cap.warn-days.one": ["1 day past the warning", { slots: {} }],
  "overview.costs.cap.warn-days.other": ["{count} days past the warning", { slots: { count: "text" } }],
  "overview.costs.cap.line": ["cap €{cap}", { slots: { cap: "text" } }],
  "overview.costs.cap.warn-line": ["warning €{warn}", { slots: { warn: "text" } }],
  "overview.costs.cap.key.line": ["solid line: cap €{cap}", { slots: { cap: "text" } }],
  "overview.costs.cap.key.warn-line": ["dashed line: warning €{warn}", { slots: { warn: "text" } }],
  "overview.costs.cap.table": ["Show the days as a table", { slots: {} }],
  "overview.costs.cap.ok": ["Under", { slots: {} }],
  "overview.costs.cap.warn": ["Past €1.50", { slots: {} }],
  "overview.costs.cap.over": ["Over €2", { slots: {} }],
  "overview.costs.fixed.title": ["Fixed costs, {month}", { slots: { month: "text" } }],
  "overview.costs.fixed.sub": ["Hosting, mail and the rest, per month.", { slots: {} }],
  "overview.costs.segment.free": ["Free scans", { slots: {} }],
  "overview.costs.segment.smoke": ["Smoke tests", { slots: {} }],
  "overview.costs.segment.test": ["Test domains", { slots: {} }],
  "overview.costs.segment.box": ["Box tests", { slots: {} }],
  "overview.costs.activity.free_scan": ["Free scan", { slots: {} }],
  "overview.costs.activity.onboarding": ["First deep pass", { slots: {} }],
  "overview.costs.activity.weekly": ["Weekly pass", { slots: {} }],
  "overview.costs.activity.topup": ["Weekly top-up", { slots: {} }],
  "overview.costs.activity.draft": ["Pages", { slots: {} }],
  "overview.costs.activity.rescore": ["Later deep pass", { slots: {} }],
  "overview.costs.activity.smoke": ["Smoke test", { slots: {} }],
  "overview.costs.activity.test": ["Test domain", { slots: {} }],
  "overview.costs.activity.box": ["Box test", { slots: {} }],
  "overview.costs.vendor.dataforseo": ["DataForSEO", { slots: {} }],
  "overview.costs.vendor.anthropic": ["Anthropic", { slots: {} }],
  "overview.costs.vendor.vercel": ["Vercel", { slots: {} }],
  "overview.costs.vendor.supabase": ["Supabase", { slots: {} }],
  "overview.costs.vendor.jobs": ["Job platform", { slots: {} }],
  "overview.costs.vendor.resend": ["Resend", { slots: {} }],
  "overview.costs.vendor.stripe": ["Stripe fees", { slots: {} }],
  // ── Today's page and the ladder (owner E4, 2026-10-19; board Main): each step is the stored reading's own, drafted.
  "overview.today.eyebrow": ["Goes live today at {time}", { slots: { time: "date" } }],
  "overview.today.eyebrow.tomorrow": ["Goes live tomorrow at {time}", { slots: { time: "date" } }],
  "overview.today.eyebrow.on": ["Goes live {day} at {time}", { slots: { day: "date", time: "date" } }],
  "overview.today.stop-note": [
    "Stop: it won’t go live. Tomorrow’s page is not affected.",
    { slots: {} },
  ],
  // A page published since the last reading is left out of each step's count.
  "overview.ladder.unread": ["{k} not checked yet", { slots: { k: "text" } }],
  // ── The head, this week's pages, the site-fix line and the states without
  // a today card (board Main). Drafted (#759), the owner corrects them.
  "overview.head.eyebrow": ["Week {n} · {day}", { slots: { n: "text", day: "date" } }],
  "overview.head.title": ["Nothing Needs You This Week", { slots: {} }],
  "overview.head.lead.chosen": [
    "This week’s {n} were picked this morning.",
    { slots: { n: "text" } },
  ],
  "overview.head.lead.chosen-on": [
    "This week’s {n} were picked on {weekday}.",
    { slots: { n: "text", weekday: "date" } },
  ],
  "overview.week.pages": ["This Week’s {n} Pages", { slots: { n: "text" } }],
  "overview.week.goes-live": ["Goes live", { slots: {} }],
  "overview.week.today-at": ["today, {time}", { slots: { time: "date" } }],
  "overview.week.on-at": ["{day}, {time}", { slots: { day: "date", time: "date" } }],
  "overview.week.next": [
    "Next Monday, {date}, we pick the next {n}.",
    { slots: { date: "date", n: "text" } },
  ],
  "overview.fixes.line": [
    "{n} fixes for your own site.",
    { slots: { n: "text" } },
  ],
  "overview.fixes.line.one": ["One fix for your own site.", { slots: {} }],
  "overview.fixes.optional": ["Optional.", { slots: {} }],
  "overview.fixes.see": ["See the Fixes →", { slots: {} }],
  "overview.today.live": ["Today’s page went live at {time}.", { slots: { time: "date" } }],
  "overview.paused.line": [
    "Publishing is paused. Your pages are kept.",
    { slots: {} },
  ],
  "overview.paused.action": ["Turn Publishing On", { slots: {} }],

  // ── The three running totals: read by the Monday mail and the landing's sample picture (owner P4, 2026-11-16, #2737).
  "overview.totals.title": ["Your Results So Far", { slots: {} }],
  "overview.totals.ai.label": ["Times AI Mentioned You", { slots: {} }],
  "overview.totals.google.label": ["Google Searches That Have Shown You", { slots: {} }],
  "overview.totals.pages.label": ["Pages Published So Far", { slots: {} }],
  "overview.totals.added": ["+{n} this week", { slots: { n: "text" } }],
  // The first count is a starting point, not this week's gain.
  "overview.totals.first": ["First count, {date}", { slots: { date: "date" } }],
  "overview.totals.first.due": ["First count on {date}", { slots: { date: "date" } }],

  // ── Overview's four tiles (owner, 2026-11-20, #2982). A week down is information, never an alarm.
  "overview.tiles.label": ["Your results", { slots: {} }],
  "overview.tile.pages.name": ["Pages Live", { slots: {} }],
  "overview.tile.pages.of": ["of {total} published", { slots: { total: "text" } }],
  "overview.tile.pages.none.of": ["None live yet", { slots: {} }],
  "overview.tile.pages.none.change": ["First page goes live {day}", { slots: { day: "date" } }],
  // "Up to": a planned day can still be stopped or skipped.
  "overview.tile.pages.coming": ["Up to {n} more this week", { slots: { n: "text" } }],
  "overview.tile.google.name": ["On Google", { slots: {} }],
  "overview.tile.google.of": ["of {m} pages showing", { slots: { m: "text" } }],
  "overview.tile.google.none.of": ["No live pages yet", { slots: {} }],
  "overview.tile.ai.name": ["Linked by AI", { slots: {} }],
  "overview.tile.ai.of": ["of {m} pages asked, last 4 weeks", { slots: { m: "text" } }],
  "overview.tile.rivals.name": ["Against Competitors", { slots: {} }],
  "overview.tile.rivals.of": ["of {m} main searches on page 1", { slots: { m: "text" } }],
  "overview.tile.rivals.start": ["Starting point, scan {date}", { slots: { date: "date" } }],
  "overview.tile.see": ["See Details", { slots: {} }],
  "overview.tile.change.up": ["Up {n} on last week", { slots: { n: "text" } }],
  "overview.tile.change.down": ["Down {n} on last week", { slots: { n: "text" } }],
  "overview.tile.change.same": ["Same as last week", { slots: {} }],
  // The first count is a starting point, never "+n".
  "overview.tile.change.first": ["First count, {date}", { slots: { date: "date" } }],
  "overview.tile.change.unread": ["We couldn’t check {what} this week.", { slots: { what: "text" } }],
  "overview.tile.unread.ai": ["AI answers", { slots: {} }],
  "overview.tile.due.of": ["Not counted yet", { slots: {} }],
  "overview.tile.due.change": ["First check {date}", { slots: { date: "date" } }],
  "overview.tile.due.sr": ["Not counted yet", { slots: {} }],
  "overview.tile.short.pages": ["Pages", { slots: {} }],
  "overview.tile.short.google": ["Google", { slots: {} }],
  "overview.tile.short.ai": ["AI", { slots: {} }],
  "overview.tile.short.rivals": ["Competitors", { slots: {} }],
  "overview.tiles.how.title": ["What These Numbers Count", { slots: {} }],
  "overview.tiles.how.pages": ["Pages Live: our pages on your site now, out of every page we have published.", { slots: {} }],
  "overview.tiles.how.google": ["On Google: your live pages Google shows for their own search, places 1 to 100.", { slots: {} }],
  "overview.tiles.how.ai": ["Linked by AI: pages whose question an AI answer linked you on. We count it over the pages we asked about in the last 4 weeks.", { slots: {} }],
  "overview.tiles.how.rivals": ["Against Competitors: your main searches that show you on Google’s first page. The two competitors with the most stand beside you.", { slots: {} }],
  "overview.tiles.how.change": ["Each change compares with the week before. A week we couldn’t check is a gap, never a 0.", { slots: {} }],
  "overview.detail.checked": ["Checked {date}", { slots: { date: "date" } }],

  // ── The AI mark and the place words every Overview detail states.
  "overview.mark.links": ["Links to you", { slots: {} }],
  "overview.mark.mentions": ["Mentions you", { slots: {} }],
  "overview.mark.none": ["Doesn’t mention you", { slots: {} }],
  "overview.mark.unchecked": ["Not checked", { slots: {} }],
  "overview.place.up": ["Place {n}, up {k}", { slots: { n: "text", k: "text" } }],
  "overview.place.down": ["Place {n}, down {k}", { slots: { n: "text", k: "text" } }],
  "overview.place.new": ["Place {n}, new this week", { slots: { n: "text" } }],
  "overview.place.same": ["Place {n}, same for {k} weeks", { slots: { n: "text", k: "text" } }],
  "overview.place.gsc": ["About place {n}, from your Search Console", { slots: { n: "text" } }],
  "overview.place.none": ["Not in results yet", { slots: {} }],
}) satisfies CopyPartition;
