// src/lib/presentation/copy/keys/overview.ts — BP-020 decision 5, WO-041
//
// Overview's sentences. Three keys seeded (WO-041 step 3): the
// no-presence-yet lines for the weekly-presence chart, week and
// partial-week states. The block that owns Overview fills every other
// sentence this surface needs.
//
// 2026-09-05, separately: issue #15 (BUILD §4.5, as amended by DECISIONS
// 2026-09-03) builds the screen itself and adds the keys its five modules
// speak. Two categories, and the line between them is the one issue #9's own
// keys already drew:
//
//   **The owner's** — every composed sentence: the three further
//   head lines and the badge, the two goal-meaning lines this screen says in
//   its own words, the AI-answers window reading, the cold-start rival line,
//   the four alert lines and the three supply lines. Nothing here invents
//   one; each was owed until the owner approved it (#460).
//
//   **Filled, and every one a transcription** of a word or sentence
//   `BUILD.md` §4.5 itself prints — the same footing as the thirteen band
//   words and the five `shell.*` words. §4.5 prints the module headings
//   ("How far ahead each rival is", "This week"), two tile names ("AI
//   answers", "Pages published"), the strip's three day words
//   ("done/today/next"), its two controls ("Open calendar →", "Read it"),
//   the goal form ("goal: 6"), the two figure forms (`78×`, `was 276×`), the
//   dim rival line ("Every line pointing down is the gap shrinking.") and
//   the growth footnote ("At 400 the big category terms unlock."). Where a
//   printed sentence carries a pinned number, the number is a slot: the
//   value is `GOAL_VALUES`' and is never re-written here.
//
// The two delta glyphs are the same kind of thing as `unmeasured.dash` —
// §4.5's own "▲delta" mark, transcribed once so no arrow character is
// written at a call site.
// 2026-09-06, issue #20 (REQ-091 c2): the three `place.overview.*` keys are
// the ones `src/lib/presentation/place/` registers as places, and Overview
// reads these through `writtenLine`.
//
// 2026-09-10, issue #460: every sentence this partition still owed is now
// written — the owner approved the drafted set ("copy proposal
// approved", proposal sheet
// https://claude.ai/code/artifact/546f45a0-a996-4d25-b85e-fb03fda7b102) and
// the strings land here byte for byte. The values named in the approval
// file are the owner's; nothing here is composed.
import type { CopyPartition } from "../registry.ts";

export const OVERVIEW_COPY = Object.freeze({
  "place.overview.weekly-presence.chart": "No Monday check yet. The line starts with the first one.",
  "place.overview.weekly-presence.week": "Not checked this week yet. Next check: Monday.",
  "place.overview.weekly-presence.partial-week": "Part of this week wasn’t checked. What was checked shows its date.",
  // ── The tiles.
  "overview.tile.ai-answers.label": "AI",
  // The set's own two lines on the pages tile, both unbracketed and so
  // approved (11a): the badge beside the count, and the dim line under it.
  // Both numbers are slots — the ranking count is measured and the three
  // weeks are `TOO_EARLY_WEEKS`, which is a pin and is never re-written.
  "overview.tile.pages.ranking": "{count} already showing on Google",

  // §4.5's "goal: 6", with the number left to `GOAL_VALUES`.
  "overview.delta.up": "▲",
  "overview.delta.down": "▼",

  // ── How far ahead each rival is.
  "overview.rivals.title": "How Far Ahead Competitors Are",
  "overview.rivals.spark.label": "How far ahead {rival} is",
  "overview.rivals.ratio": "{ratio}× your size",
  "overview.rivals.from": "from {ratio}×",
  "overview.rivals.flat": "no clear change",
  "overview.rivals.ahead.sub": "Moves over months, not weeks.",
  "overview.rivals.ahead.size": "Size is how many searches a site shows up for.",
  "overview.rivals.line.shrinking": "A line going down means the gap is closing.",
  // §6.6's own "render the rivals' absolute numbers with `you: 0`" — the
  // word that names whose number the cold-start arm shows beside the rivals'.
  "overview.rivals.you": "you",
  // The cold-start arm's line, and the one key on this screen whose value is
  // constrained by what it must **not** say: nothing is shrinking yet, so it
  // can never be `overview.rivals.line.shrinking` (REQ-041 c9).
  "overview.rivals.line.absolute": "Each line is a competitor’s own count beside yours.",
  // The week-0 arm's one line, in place of the rows: nothing has been
  // sized yet, and the card says when it will be rather than drawing three
  // empty plots.
  "overview.rivals.line.week-zero": "Shown after the first Monday check, {due}.",

  // #793: the deep pass sized the rivals, so week 0 draws their rows from
  // it and says so. Drafted (#759); the owner corrects the wording.
  "overview.rivals.line.starting": "Starting sizes from your first check, {on}. Updated every Monday from {due}.",

  // ── REQ-096 c6 as right-sized by issue 858 (owner walk, 2026-09-17): the
  // far rivals the customer tracks are market leaders on one secondary line,
  // never "your rivals" and never leading the card. The line names them and
  // says why they are apart; it does not name a replacement or suggest
  // removing them — the customer changes the set from the competitors card.
  // Drafted (issue 759); the owner corrects the wording.
  "overview.rivals.leaders": "Far larger sites, like {rivals}, are left out.",
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
  "overview.rivals.none-reachable": "None of the competitors you track is within reach yet. Add one closer to your size.",
  // The one control c6 allows, and the whole of it. Never "remove".
  "overview.rivals.leaders.swap": "Change Your Competitors",

  // ── This week.
  "overview.week.title": "This Week",
  // SPEC §4 (2026-09-20, #914): *Plan* is the calendar's on-screen name;
  // the key still says where the link goes.
  "overview.week.calendar-link": "See Why Each Page →",
  "overview.week.day.done": "done",
  "overview.week.day.today": "today",
  "overview.week.day.to-come": "next",

  // ── The alerts, and the one remainder line.
  // A page in review is the next page of the daily autopilot, not something
  // to read before it can go out (owner 2026-10-09, issue 1362).
  "overview.alert.pending-veto": "{title} goes live on its own",
  "overview.alert.pending-veto.action": "Read or Edit",
  "overview.alert.needs-you": "{title} needs you before it can go out",
  // "Reconnect" is unbracketed in the approved set (ruling 11a) — the word
  // on the accent panel's outline pill. The alert's own title and the line
  // saying what broke are bracketed there; their words below are the
  // owner's (#460).
  "overview.alert.needs-you.action": "Reconnect WordPress",
  // The cause: "[cause line — owner's]" in the set, written by the owner
  // (#460). One short line
  // under the title, never a paragraph (§2.5's dim line).
  "overview.alert.needs-you.cause": "We couldn’t put this page on your site.",
  // Issue 880: the word for a page that is not waiting on a destination —
  // one the writing rules stopped, or a step that could not run. It is read
  // and resolved on the page itself, which is where this alert already
  // points; "Reconnect" above is for a delivery the founder must fix.
  // Drafted under issue 759's ruling. The cause line for each of the five
  // causes is `publish.needs-you.*`, stated from the page's own record.
  "overview.alert.needs-you.read": "Read the Page",
  // The veto panel's own line, unbracketed in the set and therefore
  // approved. `left` is how long the window has to run, from the draft's
  // own stored `veto_deadline` (issue 794) — never a number typed here.
  "overview.alert.pending-veto.due": "goes live in {left} unless you stop it",
  // A page in review with no veto window running: nothing publishes it on
  // a clock, so the line states no countdown. Drafted (issue 794); the
  // owner corrects the wording.
  "overview.alert.pending-veto.no-window": "has no go-live time yet",
  "overview.alert.overflow": "{remaining} more in This week.",
  // A technical issue the customer fixes (SPEC §9, #572): its title is the
  // check's own, its line the severity word. The control's word and the
  // count of the issues not shown are owner-owed.
  "overview.alert.site-issue.action": "See the Fix",
  "overview.alert.site-issue.overflow": "{remaining} more in Site fixes.",
  /* ── Technical issues, the account's view of the checks it fixes (issue 1550, drafted) */
  "overview.issues.title": "Site Fixes",
  "overview.issues.lead": "Optional. Whoever runs your website can make them; ReachKit can’t.",
  "overview.issues.found": "Found {date}.",
  "overview.issues.empty": "Nothing on your site needs fixing. We check again on Monday.",
  "overview.issues.unscanned": "Your site hasn’t been checked yet. What the first check finds shows here.",
  "overview.issues.unreadable": "This list didn’t load. Try again in a minute.",
  "overview.issues.site": "Applies to the whole site.",
  "overview.issues.seconds": "{seconds} s",
  "overview.issues.slow-note": "Each took {seconds} seconds or more, twice.",
  "overview.issues.read": "Your site, {count} pages read",
  "overview.issues.fine": "pages with nothing to fix",
  "overview.issues.affected": "{pages} pages have a problem.",
  "overview.issues.affected.one-page": "One page has a problem.",
  "overview.issues.ours": "Your ReachKit pages are checked before they go live.",
  "overview.issues.share": "{count} of {over}",
  "overview.issues.share.unit": "pages",
  "overview.issues.fix": "The fix:",
  "overview.issues.show": "Show the {count} Pages",
  "overview.issues.show.one": "Show the Page",
  "overview.alerts.empty": "Nothing needs you today.",

  // ── The one supply statement Overview may make, resolved in this order.
  "overview.supply.exhausted": "Nothing is left worth writing. Monday’s check looks for more.",
  // issue 784 (issue 765's distinction, 2026-09-16): zero supply over a market that
  // was never measured is not "no pages left". Drafted under issue 759's ruling.
  "overview.supply.unmeasured": "We haven’t found enough searches for your market yet. Name a broader one in Settings and we’ll check again.",
  // issue 855: zero supply because the pass that should have filled it stopped
  // on a ceiling. Drafted under issue 759's ruling.
  "overview.supply.measuring": "We’re still checking your market, so no pages are planned yet. Nothing is needed from you.",
  "overview.supply.short": "Less than a week of pages is left. Monday’s check looks for more.",
  // Issue 1559: the depth is a week and its spares, not a month. Drafted.
  "overview.supply.first-arrival": "Your first check found less than a week of pages. We look for more every Monday.",

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
  "overview.change.domain": "Website changed. Figures start again from here.",
  "overview.change.category": "Market changed. Your searches start again from here.",
  "overview.change.rivals": "Competitors changed. Comparison starts again from here.",
  "overview.change.locale": "Country or language changed. Figures start again from here.",
  // REQ-071 c13's other half: a card that compares two readings has to say
  // which span it compared over when a change falls inside it, rather than
  // quietly comparing across one.
  "overview.comparison.window": "Shown from {since}, when your settings changed. Older figures are kept apart.",

  // ── 2026-09-20 (#908, #915): Overview's four tabs, the header, the page
  // waiting for review, and the three linked tiles.
  //
  // Every sentence below is **drafted** under the owner's 2026-09-16 ruling
  // (#759): a customer-visible string is written in the registry's voice and
  // shipped, never left as a marker, and the PR names each one so the owner
  // can correct it.

  // The tab bar. Three of the four words already exist in the registry and
  // are reused (`shell.nav.overview`, `overview.tile.ai-answers.label`); a
  // fourth spelling of a word the product already says would be a second
  // place to change it.
  "overview.tabs.label": "Overview sections",
  "overview.tab.search": "Google",
  "overview.tab.rivals": "Competitors",

  // Every one of Overview's four tabs has its screen, so the line a tab
  // carried while it had only an address is gone with the last placeholder
  // that carried it. `_overview/tabs.ts` is where the four live.

  // Every sparkline's accessible name: what it is a reading of, over how
  // many weeks. One key, because every trend on this screen is the same kind
  // of thing and a chart with no name is a chart a screen reader skips.

  // ── The page waiting for review.
  // A page in review with no window running: nothing publishes it on a
  // clock, so the line states no time.
  "overview.waiting.waits": "Its go-live time isn’t set yet.",
  // The four arms of the reason, one per shape of evidence the opportunity
  // carries. Never composed at a call site: the screen picks the arm and the
  // registry says the sentence.
  "overview.waiting.why.answered-by": "{volume} people a month search “{search}”. {rival} shows up, and you don’t.",
  "overview.waiting.why.not-high-enough": "{volume} people a month search “{search}”. Your page for it isn’t high enough yet.",
  // The search was chosen but its demand was never read back: the screen
  // states what the page is for and claims no number (REQ-004).
  "overview.waiting.why.search": "This page is written to win “{search}”.",
  // A Fix page has no market target at all (SPEC §9).
  "overview.waiting.why.fix": "This page fixes something on your own site that is holding your pages back.",
  "overview.waiting.badge.new": "New page",
  "overview.waiting.badge.update": "Update",
  // The screen's second control. "Stop this page" is the product's word on
  // every screen and in every mail (SPEC §4 · §7, 2026-09-20); "veto" stays
  // internal.
  "overview.waiting.stop": "Stop This Page",
  // Every action answers (SPEC §4, 2026-09-20): the two words the control
  // says back, on the screen, in place of silence.
  "overview.waiting.stopped": "Stopped. This page won’t go live.",
  "overview.waiting.stop-refused": "Not stopped: this page may already be going live. You can still stop it in This Week.",

  // ── This week: the word a day carries when nothing is scheduled on it.
  // The five stage words are the calendar's own (`calendar.stage.*`).
  "overview.week.day.no-page": "No page",

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
  "overview.search.measured": "Checked {on}.",

  // Issue 1551 (owner, 2026-10-19): the searches the live pages target,
  // split by how far Google has got with each — the tile Overview's Google
  // figure is read from — and the market's twelve, labelled as the outcome
  // that takes months. Drafted (#759).
  "overview.search.tile.your-pages": "Your Pages in Google",
  "overview.search.tile.your-pages.of": "of {of} pages showing on Google",
  "overview.search.tile.your-pages.split": "{first} on Google’s first page · {further} further down · {unseen} not showing yet",
  "overview.search.tile.your-pages.means": "A page counts once Google shows it for its own search. Most new pages take weeks to show.",
  "overview.search.tile.market": "Your Market",
  "overview.search.tile.market.means": "How many of your market’s biggest searches show you on Google’s first page. This takes months, not weeks.",
  "overview.search.tile.searches.of": "of {of} searches on Google’s first page",
  "overview.search.tile.market.split": "{first} on Google’s first page · {rest} not yet",

  // The column heads.
  "overview.search.column.search": "Search",
  "overview.search.column.volume": "Searches a month",
  // The phone shape has no column heads, so a volume says what it counts.
  "overview.search.a-month": "a month",
  "overview.search.column.you": "You",
  "overview.search.column.rival": "Best competitor",
  "overview.search.column.status": "What we’re doing",

  // SPEC §4's four status words, and the chip that stands for all of them.
  "overview.search.status.all": "All",
  "overview.search.status.live": "Page is live",
  "overview.search.status.your-review": "Page scheduled",
  "overview.search.status.up-next": "Up next",
  "overview.search.status.too-big": "Too hard for now",
  // A filter chip's whole text. It is one string because daisyUI's `filter`
  // draws a radio's own `aria-label`, so the word and its count reach the
  // screen as one attribute rather than as two elements.
  "overview.search.chip": "{status} {count}",
  "overview.search.filter.label": "Show",
  "overview.search.table.label": "Every search ReachKit is going after",

  // A place on a search results page, and the week's move. The glyphs are
  // `overview.delta.up` / `overview.delta.down`, already written.
  "overview.search.position": "#{position}",
  // A page with a verdict and nothing recorded to compare it with: its
  // first week, which is a fact and not a change of zero.
  "overview.search.you.first": "new",
  // An Improve target: the page that answers this search is the customer's
  // own, so no rival holds it.
  "overview.search.rival.yours": "Your own page",

  // The foot of the table: how much of it is on screen, in what order, and
  // the one control that shows the rest.
  "overview.search.show-all": "Show All {total} Searches",
  // Nothing on file at all — a site whose first pass has not finished, or
  // one whose market was too small. It claims neither: it says what is
  // true of the list, and the Overview's own supply statement says why.
  "overview.search.empty": "No searches yet. They arrive with your first check.",

  // Board AppGoogle (issue 1746): the tab's head, the visits tile, each live
  // page in Google, and what is done about each search this week. Drafted (#759).
  "overview.tab.eyebrow": "Overview · week {n}",
  "overview.means": "What this means",
  "overview.search.visits.label": "Visits from Google",
  "overview.search.visits.of": "this week, to your pages",
  "overview.search.visits.none": "none yet",
  "overview.search.visits.chart": "Visits from Google, week by week",
  "overview.search.visits.means": "People who came to your pages from Google. Shown once there is one.",
  "overview.search.pages.title": "Each Page in Google",
  "overview.search.pages.caption": "place 1 is the top result, maps not counted",
  "overview.search.pages.all": "Show All {total} Pages",
  "overview.search.pages.none": "No page is live yet. Each shows here once it’s live, with its place in Google.",
  "overview.search.place.up": "Place {n}, up {gain} since {date}.",
  "overview.search.place.flat": "Place {n}, flat for {weeks} weeks.",
  "overview.search.place.now": "Place {n}.",
  "overview.search.place.update": "Update goes live {day}.",
  "overview.search.place.found": "Found by Google {date}. Not in results yet.",
  "overview.search.place.unseen": "Not in results yet.",
  // D8: a place read from the keyword database is an estimate, and says so.
  "overview.search.place.estimate": "Based on Google’s estimate, not this week’s check.",
  "overview.search.table.title": "Your Market’s Searches",
  // A business that sells beyond one place: the lead names none.
  "overview.search.doing.today": "Goes live today",
  "overview.search.doing.page": "Page {day}",
  "overview.search.doing.update": "Update {day}",
  "overview.search.doing.climbing": "Climbing, so we wait",

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
  "overview.answers.pages-cited.label": "Pages Linked by AI",
  "overview.answers.pages-cited.of": "of {of} pages asked",
  "overview.answers.pages-cited.none": "Shows once a page is live and we’ve asked its question.",
  // Board AppAI: the tiles, each page in AI answers, and which AI read and sent visits. Drafted (#759).
  "overview.answers.linked.mentioned.one": "1 more mentioned you without a link.",
  "overview.answers.linked.mentioned": "{n} more mentioned you without a link.",
  "overview.answers.reads.label": "Read by AI",
  "overview.answers.reads.of": "times this week",
  "overview.answers.visits.label": "Visits from AI",
  "overview.answers.visits.of": "this week",
  "overview.answers.pages.title": "Each Page in AI Answers",
  "overview.answers.pages.unread": "not read by AI yet",
  "overview.answers.pages.engines": "Answers from ChatGPT and Google’s AI",
  "overview.answers.who.title": "Which AI Read and Sent Visits",
  "overview.answers.who.reads": "Reads",
  // The four-week rate over the twelve, its denominator, the split the
  // owner's ruling asks for, and the one line saying why four weeks.

  // The second tile: this week's n of 12, and the engine it is counted
  // from — the Overview's own rule, said on this screen too.

  // The grid: its head, the line under it, and the names a reader needs to
  // read a mark without seeing its colour.
  "overview.answers.grid.title": "What AI Says on Your Searches",
  "overview.answers.grid.lead": "Your {of} searches, asked of each AI.",
  "overview.answers.grid.label": "Each search, and what each AI engine said",
  // ── 2026-09-20 (#908, #919): the cap, stated on the grid it bounds.
  //
  // SPEC §6 of that date: "at most 24 tracked questions in all (the twelve
  // plus twelve) … the set never grows past the cap, so its cost is flat",
  // confirmed as written by the owner on 2026-09-21 (§12, #985). The board
  // (R4-06) states it as "21 of 24 at most". **Drafted** under the owner's
  // 2026-09-16 ruling (#759); the PR names it so the owner can correct it.

  // The three marks, and "Not checked", which is never a miss. The last mark
  // covers an answer that mentions someone else, names no one or is not given.
  "overview.answers.mark.links": "Links to you",
  "overview.answers.mark.names": "Mentions you",
  "overview.answers.mark.not-you": "Doesn’t mention you",
  "overview.answers.mark.not-measured": "Not checked",
  // One cell's accessible name: which question, which engine, what it said.
  // Never the colour, and never the mark alone.
  "overview.answers.cell": "{question} · {engine}: {mark}",
  // The search a question was phrased from — REQ-093 c3's other half, which
  // is why the wording never appears without it.
  "overview.answers.from": "from {search}",
  // The customer's own page for a question, where one is live.
  "overview.answers.page": "Your page",
  // Nothing measured yet — a site whose first weekly pass has not run. It
  // claims nothing about the engines; it says what is true of the record.
  "overview.answers.empty": "No AI answers yet. The first Monday check asks AI your questions.",

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
  "overview.tile.mention-rate.early": "AI answers that mentioned you so far. A rate shows after {weeks} weeks.",
  // D64 (issue 1301, drafted): no pass has passed its own checks yet, so
  // the newest pass's count is shown and said to be the first.
  "overview.tile.mention-rate.first": "First check. A rate shows after {weeks} weeks.",

  // The AI answers tab: the rate's own card. Issue 1551 (SEO review R5.1)
  // labels it as what it measures. Drafted (#759).
  "overview.prompts.rate.reputation": "How often AI names you when buyers ask for a business like yours. It moves over months.",
  "overview.prompts.rate.count": "ChatGPT and Google’s AI mentioned you in {n} of {m} answers",
  "overview.prompts.rate.first": "last {weeks} weeks · first reading",
  "overview.prompts.rate.monthly": "last {weeks} weeks · checked monthly",
  "overview.prompts.rate.band": "Answers vary, so the true rate is {low}% to {high}%.",

  // The site beside its rivals, by answers that named each; the lead heads the block (owner R6).
  "overview.prompts.share.label": "You and your competitors, by AI answers that mentioned each",
  "overview.prompts.share.you": "You",
  "overview.prompts.share.none": "No answer mentioned you or a competitor yet.",

  // The set itself, so a founder can read what is asked.
  "overview.prompts.list.title": "Questions We Ask AI",
  "overview.prompts.list.count": "{n} of {m} questions. We leave out questions with your name.",

  // ── 2026-09-20 (#908, #921): the AI engines that read the hosted pages.
  // ChatGPT is `ai-answers.engine.chatgpt` — a second spelling of it would be
  // the second place the product speaks (ADR-001).
  "overview.blog.engine.perplexity": "Perplexity",
  "overview.blog.engine.claude": "Claude",
  "overview.blog.engine.gemini": "Gemini",
  "overview.blog.engine.copilot": "Microsoft Copilot",
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
  "overview.rivals.first-page.title": "Who’s on Google’s First Page",
  "overview.rivals.first-page.started": "You were on {count} of {of} when you started.",

  // The second: who the three answer engines name, counted the way the AI
  // answers tab draws it, with the link to that tab beneath.
  "overview.rivals.named.title": "Who AI Answers Mention",
  "overview.rivals.named.lead": "{answers} AI answers, last {weeks} weeks.",
  "overview.rivals.named.lead.none": "From the AI answers to your buyers’ questions.",
  "overview.rivals.first.title": "Who Your Buyers See First",
  "overview.rivals.first.lead": "The top Google result on your {of} main searches.",
  "overview.rivals.first.of": "{n} of {of}",
  "overview.rivals.first.others": "others",
  "overview.rivals.first.line": "You’re top on none yet, and on Google’s first page for {n}.",
  "overview.rivals.first.you": "You’re the top result on {n} of the {of}.",
  "overview.rivals.first.after": "This week’s pages go after {m}.",

  // A card that was measured and counted no tracked rival anywhere says so
  // once, in place of a row of empty bars, and the rivals neither card
  // counted are named under them (SPEC §4, 2026-10-09). Drafted (issue
  // 759); the owner corrects the wording.
  "overview.rivals.first-page.none": "None of your competitors is on Google’s first page here.",
  "overview.rivals.first-page.none.holders": "None of your competitors is on Google’s first page here. Most often there: {holders}.",
  "overview.rivals.named.none": "None of these answers mentioned one of your competitors.",

  // `overview.rivals.gap.lead` is gone: no screen says what the ratio is a
  // ratio of (D24, SPEC §4 2026-10-02; issue 1324).

  // A card whose reading the pass never took. It claims nothing about the
  // rivals; it says what is true of the measurement.
  "overview.rivals.card.unmeasured": "Not checked yet. The first Monday check fills this in.",

  // The table: every search a rival wins that the site does not.
  "overview.rivals.table.title": "Searches Competitors Win",
  "overview.rivals.table.lead": "This week’s pages come from this list.",
  "overview.rivals.table.label": "Searches competitors win and you don’t",
  "overview.rivals.table.empty": "No competitor wins a search you’re missing.",
  "overview.rivals.column.winner": "Who wins it",
  "overview.rivals.won-by": "Won by",
  "overview.rivals.column.doing": "What we’re doing",

  // SPEC §4's four words for what ReachKit is doing about a search a rival
  // wins. None of them is "live": a search the customer already wins is not
  // in this table at all.
  "overview.rivals.status.in-review": "Page scheduled",
  "overview.rivals.status.up-next": "Up next",
  "overview.rivals.status.needs-page": "Needs a page on your main site",
  "overview.rivals.status.too-big": "Too hard for now",

  // The filter over the table.
  "overview.rivals.filter.label": "Show one competitor",
  "overview.rivals.filter.all": "All competitors",
  // SPEC §5 (2026-09-20): Overview while the address waits for its DNS
  // record, as board OverviewDNS draws it. No line names a go-live time:
  // none is true until it is live (Q11). Drafted (#759); the PR names each.
  // No day is known where the address's start was not stored: the screen's name alone.
  "overview.connect.eyebrow.plain": "Overview",
  "overview.connect.day": "Overview · day {n}",
  "overview.connect.head": "Your Pages Wait for Your Website",
  "overview.connect.head.ready": "Your First Page Is Ready",
  "overview.connect.lead": "They go live once your website is connected. Everything else runs on its own.",
  "overview.connect.lead.ready": "It goes live once your website is connected.",
  "overview.connect.eyebrow": "Needs you",
  "overview.connect.title": "Add One Setting to Your Domain",
  "overview.connect.step.open": "Open Your Domain Settings",
  "overview.connect.step.open.line": "Where you bought {domain}.",
  "overview.connect.step.paste": "Paste the Three Values",
  "overview.connect.step.rest": "We Do the Rest",
  "overview.connect.step.rest.line": "Your pages appear on {host}.",
  "overview.connect.copy.type": "Copy the type",
  "overview.connect.copy.name": "Copy the name",
  "overview.connect.copy.value": "Copy the value",
  "overview.connect.check": "Check Connection Now",
  "overview.connect.guide": "Step-by-Step for Your Domain Host →",
  "overview.connect.checked": "Checked {time}: not found yet.",
  "overview.connect.unchecked": "Not found yet.",
  "overview.connect.hourly": "We check every hour. It can take a few hours.",
  "overview.connect.other": "Other ways to connect",
  "overview.connect.wordpress": "On WordPress? Connect with an app password instead.",
  "overview.connect.wordpress.link": "Connect WordPress →",
  "overview.connect.wordpress.action": "Connect WordPress",
  "overview.connect.later": "The setting is also in your mail, to add later from a computer.",
  "overview.connect.page.eyebrow": "Ready to go live",
  "overview.connect.page.read": "Read or Edit It →",
  "overview.connect.progress": "Progress shows here once your first page is live.",

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
  "overview.first-day.choosing": "We’re choosing a first page you can win.",
  "overview.first-day.mail": "We’ll email you when it’s written. You can edit or stop it before it goes live.",
  "overview.first-day.week": "Your week is planned when the first check finishes.",

  /* ── The owner's cost page (issue 1478, drafted) ──────────────────── */
  // Owner-only: `/app/costs` answers a 404 to every other account. No
  // figure here is a customer's, and no vendor name reaches a customer.
  "overview.costs.title": "Costs",
  "overview.costs.eyebrow": "Owner only",
  "overview.costs.lead": "The seven UTC days to {today}.",
  "overview.costs.unreadable": "The ledger could not be read just now. Nothing is lost; open this page again in a minute.",
  "overview.costs.stat.week": "This week",
  "overview.costs.stat.estimated.of": "estimated, our price list",
  "overview.costs.stat.billed.of": "billed, on {billed} of {calls} calls",
  "overview.costs.stat.today": "Today against the cap",
  "overview.costs.stat.today.cap": "of €{cap}",
  "overview.costs.stat.today.of": "warning at €{warn}",
  "overview.costs.cents": "{cents}¢",
  "overview.costs.eur": "€{eur}",
  "overview.costs.share": "€{eur} · {share}%",
  "overview.costs.unbilled": "Not billed",
  "overview.costs.unreported": "Not reported",
  "overview.costs.col.site": "Site",
  "overview.costs.col.day": "Day",
  "overview.costs.col.estimated": "Estimated",
  "overview.costs.col.billed": "Billed",
  "overview.costs.col.month": "A month, against €{price}",
  "overview.costs.col.activity": "Activity",
  "overview.costs.col.failed": "Failed or timed out",
  "overview.costs.col.recorded": "Recorded",
  "overview.costs.col.vendor-billed": "Vendor billed",
  "overview.costs.col.gap": "Gap",
  "overview.costs.col.judged": "Judged",
  "overview.costs.col.cap": "Against €2",
  "overview.costs.week.title": "Each site this week",
  "overview.costs.week.note": "A month is this week × {weeks} plus a share of fixed costs, against €{net} net. A free scan counts to the site it became.",
  "overview.costs.week.month": "Month vs €{price}",
  "overview.costs.week.sub": "{estimated} est. · {billed} billed",
  "overview.costs.week.sub.unbilled": "{estimated} est. · not billed",
  "overview.costs.week.empty": "Nothing was spent this week.",
  "overview.costs.days.title": "Each site, each day",
  "overview.costs.days.sub": "One row per site and day.",
  "overview.costs.activities.title": "This week by activity",
  "overview.costs.activities.sub": "Writing, measuring, scans and checks.",
  "overview.costs.vendors.title": "Against the vendors",
  "overview.costs.vendors.sub": "Our estimate against each vendor's bill.",
  "overview.costs.vendors.note": "Recorded is the ledger and the box: billed where the vendor said, estimated where not. Vendor billed is the vendor's own account for that UTC day; it is read the day after.",
  "overview.costs.vendors.no-ai": "Anthropic's own bill is not read, so AI spend is our estimate. The deployment needs an admin key to read it.",
  "overview.costs.cap.title": "The €2 a day",
  "overview.costs.cap.summary": "{over}, {warn}",
  "overview.costs.cap.over-days.one": "1 day over",
  "overview.costs.cap.over-days.other": "{count} days over",
  "overview.costs.cap.warn-days.one": "1 day past the warning",
  "overview.costs.cap.warn-days.other": "{count} days past the warning",
  "overview.costs.cap.line": "cap €{cap}",
  "overview.costs.cap.warn-line": "warning €{warn}",
  "overview.costs.cap.key.line": "solid line: cap €{cap}",
  "overview.costs.cap.key.warn-line": "dashed line: warning €{warn}",
  "overview.costs.cap.table": "Show the days as a table",
  "overview.costs.cap.ok": "Under",
  "overview.costs.cap.warn": "Past €1.50",
  "overview.costs.cap.over": "Over €2",
  "overview.costs.fixed.title": "Fixed costs, {month}",
  "overview.costs.fixed.sub": "Hosting, mail and the rest, per month.",
  "overview.costs.segment.free": "Free scans",
  "overview.costs.segment.smoke": "Smoke tests",
  "overview.costs.segment.test": "Test domains",
  "overview.costs.segment.box": "Box tests",
  "overview.costs.activity.free_scan": "Free scan",
  "overview.costs.activity.onboarding": "First deep pass",
  "overview.costs.activity.weekly": "Weekly pass",
  "overview.costs.activity.topup": "Weekly top-up",
  "overview.costs.activity.draft": "Pages",
  "overview.costs.activity.rescore": "Later deep pass",
  "overview.costs.activity.smoke": "Smoke test",
  "overview.costs.activity.test": "Test domain",
  "overview.costs.activity.box": "Box test",
  "overview.costs.vendor.dataforseo": "DataForSEO",
  "overview.costs.vendor.anthropic": "Anthropic",
  "overview.costs.vendor.vercel": "Vercel",
  "overview.costs.vendor.supabase": "Supabase",
  "overview.costs.vendor.jobs": "Job platform",
  "overview.costs.vendor.resend": "Resend",
  "overview.costs.vendor.stripe": "Stripe fees",
  // ── Today's page and the ladder (owner E4, 2026-10-19; board Main): each step is the stored reading's own, drafted.
  "overview.today.eyebrow": "Goes live today at {time}",
  "overview.today.eyebrow.tomorrow": "Goes live tomorrow at {time}",
  "overview.today.eyebrow.on": "Goes live {day} at {time}",
  "overview.today.stop-note": "Stop: it won’t go live. Tomorrow’s page is not affected.",
  // A page published since the last reading is left out of each step's count.
  "overview.ladder.unread": "{k} not checked yet",
  // ── The head, this week's pages, the site-fix line and the states without
  // a today card (board Main). Drafted (#759), the owner corrects them.
  "overview.head.eyebrow": "Week {n} · {day}",
  "overview.head.title": "Nothing Needs You This Week",
  "overview.head.lead.chosen": "This week’s {n} were picked this morning.",
  "overview.head.lead.chosen-on": "This week’s {n} were picked on {weekday}.",
  "overview.week.pages": "This Week’s {n} Pages",
  "overview.week.goes-live": "Goes live",
  "overview.week.today-at": "today, {time}",
  "overview.week.on-at": "{day}, {time}",
  "overview.week.next": "Next Monday, {date}, we pick the next {n}.",
  "overview.fixes.line": "{n} fixes for your own site.",
  "overview.fixes.line.one": "One fix for your own site.",
  "overview.fixes.optional": "Optional.",
  "overview.fixes.see": "See the Fixes →",
  "overview.today.live": "Today’s page went live at {time}.",
  "overview.paused.line": "Publishing is paused. Your pages are kept.",
  "overview.paused.action": "Turn Publishing On",

  // ── Your results so far: three totals that only rise (owner 2026-11-16, #2737).
  // "Mentioned", never "named"; the AI line never says the count is ReachKit's doing.
  "overview.totals.title": "Your Results So Far",
  "overview.totals.ai.label": "Times AI Mentioned You",
  "overview.totals.google.label": "Google Searches That Have Shown You",
  "overview.totals.pages.label": "Pages Published So Far",
  "overview.totals.added": "+{n} this week",
  // Flat is said as flat, never "+0".
  "overview.totals.added.none": "None new this week",
  // The first count is a starting point, not this week's gain.
  "overview.totals.first": "First count, {date}",
  "overview.totals.first.due": "First count on {date}",
  "overview.totals.unread.ai": "We couldn’t check AI this week",
  "overview.totals.unmeasured.sr": "Not counted yet",
  "overview.totals.how.title": "What these numbers count",
  "overview.totals.how.ai": "Each week we ask AI the questions your buyers ask. This counts answers that mention or link you, not visits.",
  "overview.totals.how.ai.brand": "Questions that use your business name are not counted.",
  "overview.totals.how.google": "Searches where a page we published appeared in Google’s first 10 pages of results. Each search counts once.",
  "overview.totals.how.pages": "Every page we have published on your site. A page you stopped later still counts, because it went live.",
}) satisfies CopyPartition;
