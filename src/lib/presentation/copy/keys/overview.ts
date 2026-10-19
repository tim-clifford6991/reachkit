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
  "place.overview.weekly-presence.chart": [
    "No weekly scan yet. The line begins with the first Monday scan.",
    { law: "no-presence-yet", slots: {}, fixedBy: "REQ-041 c3" },
  ],
  "place.overview.weekly-presence.week": [
    "This week hasn’t been scanned. The next scan is due Monday.",
    { law: "no-presence-yet", slots: {}, fixedBy: "REQ-065 c3" },
  ],
  "place.overview.weekly-presence.partial-week": [
    "Not scanned this week. What was scanned is shown with its date.",
    { law: "no-presence-yet", slots: {}, fixedBy: "REQ-065 c4" },
  ],
  // ── The head: what autopilot is doing (owner 2026-10-09, issue 1362).
  // The four direction lines, the week-0 line and the two badges that stood
  // here are gone with it: the head states the product's own status, from
  // stored facts, and never a page waiting on the customer. Every other arm
  // of the head is the shell's `next-publish.*` sentence. Drafted; the
  // owner corrects the wording.
  "overview.head.due.today": [
    "Today’s page goes live at {time}.",
    { slots: { time: "date" }, fixedBy: "issue 1362" },
  ],
  "overview.head.due.tomorrow": [
    "Tomorrow’s page goes live at {time}.",
    { slots: { time: "date" }, fixedBy: "issue 1362" },
  ],
  "overview.head.writing.today": ["Today’s page is being written.", { slots: {}, fixedBy: "issue 1362" }],
  "overview.head.writing.tomorrow": ["Tomorrow’s page is being written.", { slots: {}, fixedBy: "issue 1362" }],
  "overview.head.planned": [
    "The next page is planned for {on}.",
    { slots: { on: "date" }, fixedBy: "issue 1362" },
  ],
  // What went live last, and when, under the head.
  "overview.head.last-live": [
    "Last page to go live: {title}, {on}.",
    { slots: { title: "text", on: "date" }, fixedBy: "issue 1362" },
  ],

  // ── The growth module.
  // The card head's right-hand chip (UI-SPEC S12: "re-measured Mon 1 Sep").
  // The date is a slot — it is the measurement's own, read from the series,
  // and the sidebar states the same one from the same `firstDueOn`/week.
  "overview.growth.source.remeasured": [
    "scanned again {on}",
    { slots: { on: "date" }, fixedBy: "S12" },
  ],
  // The week-0 chart's own chip and footnote pair. The chip names the pass
  // the single reading came from — the set is explicit that it is the deep
  // pass and not a weekly measurement — and the right footnote says the
  // weekly line has not begun, in place of the goal sentence the ordinary
  // arm carries.
  "overview.growth.source.deep-pass": [
    "from the deep scan · {on}",
    { slots: { on: "date" }, fixedBy: "S13" },
  ],
  "overview.growth.footnote.starting": [
    "starting at {value}",
    { slots: { value: "text" }, fixedBy: "S13" },
  ],
  "overview.growth.footnote.first-monday": [
    "the line begins with the first Monday",
    { slots: {}, fixedBy: "S13" },
  ],
  "overview.growth.footnote.start": ["started at {value}", { slots: { value: "text" }, fixedBy: "BUILD §4.5" }],
  "overview.growth.footnote.goal": [
    "At {goal} the big market searches unlock.",
    { slots: { goal: "text" }, fixedBy: "BUILD §4.5" },
  ],

  // ── The three tiles (DECISIONS 2026-09-03: no composite score tile).
  // Each name is §4.5's own; each meaning line is the owner's.
  // ── The three tiles' week-0 lines (UI-SPEC S13). Each names when its
  // own reading arrives, in place of a number nobody has measured — never
  // a zero, which REQ-004 forbids as a reading that was not taken.
  "overview.tile.score.first-due": [
    "first scan due {due}",
    { slots: { due: "date" }, fixedBy: "S13 · REQ-040 c7" },
  ],
  "overview.tile.ai-answers.first-pass": [
    "scanned with the first weekly scan",
    { slots: {}, fixedBy: "S13" },
  ],
  // #793: the deep pass is week 0. Where it measured the score or the AI
  // answers, the tile shows that reading and names it as the starting
  // measurement, with the date the weekly readings take over. Drafted
  // (#759); the owner corrects the wording.
  "overview.tile.starting": [
    "first scan, {on} · weekly from {due}",
    { slots: { on: "date", due: "date" }, fixedBy: "issue 793" },
  ],
  "overview.tile.pages.first-review": [
    "first page goes live on its own",
    { slots: {}, fixedBy: "S13 · issue 1362" },
  ],

  // ── The score tile (UI-SPEC S12, ruling 6a).
  //
  // Ruling 6a fixes the name on every surface that labels the number:
  // "Discoverability Score" — the report head's eyebrow, this tile, the
  // landing component tile and the two mails. Transcribed, not chosen.
  "overview.tile.score.label": ["Visibility Score", { slots: {}, fixedBy: "ruling 6a" }],
  // What reaching `GOAL_VALUES.score` means, in the product's own words.
  // The set prints no such line beside the score — it prints the band —
  // so the words are the owner's (#460).
  "overview.tile.score.means": ["At {goal} you’re Findable", { slots: { goal: "text" }, fixedBy: "BUILD §4.5" }],
  // The card head of the growth chart still names the searches reading:
  // the set moved that number off the tiles and onto its own card, and
  // this key is the card's eyebrow now rather than a tile label.
  // 2026-09-20 (#908/#915): the redesign names this tile "Searches you appear
  // for" — the Overview tab's first linked tile, and the Search tab's own
  // head. One key, reworded; drafted under issue 759's ruling and the
  // owner's to correct.
  "overview.tile.searches.label": ["Searches you appear for", { slots: {}, fixedBy: "issue 915" }],
  "overview.tile.ai-answers.label": ["AI", { slots: {}, fixedBy: "BUILD §4.5" }],
  "overview.tile.ai-answers.window": [
    "mentioned in {weeks} of the last {of} weeks",
    { slots: { weeks: "text", of: "text" }, fixedBy: "REQ-041 c12" },
  ],
  // Issue 867 (owner, 2026-09-17): the other engines this site's pages are
  // measured on where the paid battery asked them. Drafted under issue 759's
  // ruling; the owner corrects the wording.
  "overview.tile.ai-answers.also-measured": [
    "{engines} are measured on each page's own search.",
    { slots: { engines: "text" }, fixedBy: "issue 867" },
  ],
  "overview.tile.ai-answers.means": ["Mentioned by AI in half the weeks.", { slots: {}, fixedBy: "REQ-041 c4" }],
  "overview.tile.pages.label": ["Pages published", { slots: {}, fixedBy: "BUILD §4.5" }],
  // The set's own two lines on the pages tile, both unbracketed and so
  // approved (11a): the badge beside the count, and the dim line under it.
  // Both numbers are slots — the ranking count is measured and the three
  // weeks are `TOO_EARLY_WEEKS`, which is a pin and is never re-written.
  "overview.tile.pages.ranking": [
    "{count} already ranking",
    { slots: { count: "text" }, fixedBy: "S12" },
  ],
  "overview.tile.pages.too-early": [
    "rest under {weeks} weeks, too early to judge",
    { slots: { weeks: "text" }, fixedBy: "S12 · REQ-063 c2" },
  ],
  "overview.tile.pages.means": ["A month of daily pages.", { slots: {}, fixedBy: "REQ-041 c4" }],

  // §4.5's "goal: 6", with the number left to `GOAL_VALUES`.
  "overview.goal": ["goal: {value}", { slots: { value: "text" }, fixedBy: "BUILD §4.5" }],
  "overview.delta.up": ["▲", { slots: {}, fixedBy: "BUILD §4.5" }],
  "overview.delta.down": ["▼", { slots: {}, fixedBy: "BUILD §4.5" }],

  // ── The core data at a glance (owner, 2026-10-15, issue 1457): Visibility
  // Score, Google, AI and Content, in the #1444 vocabulary. Every line is
  // drafted (#759); the pull request names each so the owner can correct it.
  "overview.tile.change": ["{mark} {value} since last week", { slots: { mark: "text", value: "text" }, fixedBy: "issue 1457 (drafted)" }],
  "overview.tile.no-change": ["No change since last week", { slots: {}, fixedBy: "issue 1457 (drafted)" }],
  "overview.tile.first-scan": ["First scan {due}.", { slots: { due: "date" }, fixedBy: "issue 1457 (drafted)" }],
  "overview.tile.google.line": ["Searches where you’re on the first page", { slots: {}, fixedBy: "issue 1457 (drafted)" }],
  "overview.tile.ai.line": ["Searches where AI answers mention you", { slots: {}, fixedBy: "issue 1457 (drafted)" }],
  "overview.tile.ai.linked": ["{linked} of them link to you", { slots: { linked: "text" }, fixedBy: "issue 1457 (drafted)" }],
  "overview.tile.content.label": ["Content", { slots: {}, fixedBy: "issue 1457 (drafted)" }],
  "overview.tile.content.of": ["pages published", { slots: {}, fixedBy: "issue 1457 (drafted)" }],
  "overview.tile.content.recent": ["{recent} in the last {weeks} weeks", { slots: { recent: "text", weeks: "text" }, fixedBy: "issue 1457 (drafted)" }],
  "overview.tile.content.last": ["Last: {title}, {on}", { slots: { title: "text", on: "date" }, fixedBy: "issue 1457 (drafted)" }],
  "overview.tile.content.next": ["Next: {on}", { slots: { on: "date" }, fixedBy: "issue 1457 (drafted)" }],
  // Issue 1553: how many live pages reached each step toward being found,
  // joined with " · ". A step nothing can read is left out. Drafted (#759).
  "overview.tile.content.crawled": ["{count} crawled", { slots: { count: "text" }, fixedBy: "issue 1553 (drafted)" }],
  "overview.tile.content.indexed": ["{count} indexed", { slots: { count: "text" }, fixedBy: "issue 1553 (drafted)" }],
  "overview.tile.content.impressions": ["{count} impressions", { slots: { count: "text" }, fixedBy: "issue 1553 (drafted)" }],
  "overview.tile.content.place": ["best place {place}", { slots: { place: "text" }, fixedBy: "issue 1553 (drafted)" }],
  "overview.tile.content.cited": ["{count} cited by AI", { slots: { count: "text" }, fixedBy: "issue 1553 (drafted)" }],

  // ── How far ahead each rival is.
  "overview.rivals.title": ["How far ahead competitors are", { slots: {}, fixedBy: "BUILD §4.5" }],
  "overview.rivals.spark.label": [
    "How far ahead {rival} is",
    { slots: { rival: "text" }, fixedBy: "BUILD §4.5" },
  ],
  "overview.rivals.ratio": ["{ratio}×", { slots: { ratio: "text" }, fixedBy: "BUILD §4.5" }],
  "overview.rivals.was": ["was {previous}", { slots: { previous: "text" }, fixedBy: "BUILD §4.5" }],
  "overview.rivals.line.shrinking": [
    "Every line pointing down is the gap shrinking.",
    { slots: {}, fixedBy: "BUILD §4.5" },
  ],
  // §6.6's own "render the rivals' absolute numbers with `you: 0`" — the
  // word that names whose number the cold-start arm shows beside the rivals'.
  "overview.rivals.you": ["you", { slots: {}, fixedBy: "BUILD §4.5" }],
  // The cold-start arm's line, and the one key on this screen whose value is
  // constrained by what it must **not** say: nothing is shrinking yet, so it
  // can never be `overview.rivals.line.shrinking` (REQ-041 c9).
  "overview.rivals.line.absolute": ["Each line is a competitor’s own count beside yours.", { slots: {}, fixedBy: "REQ-041 c9" }],
  // The week-0 arm's one line, in place of the rows: nothing has been
  // sized yet, and the card says when it will be rather than drawing three
  // empty plots.
  "overview.rivals.line.week-zero": [
    "Sized with the first weekly scan, {due}.",
    { slots: { due: "date" }, fixedBy: "S13" },
  ],

  // #793: the deep pass sized the rivals, so week 0 draws their rows from
  // it and says so. Drafted (#759); the owner corrects the wording.
  "overview.rivals.line.starting": [
    "Starting sizes from your deep scan, {on}. Weekly from {due}.",
    { slots: { on: "date", due: "date" }, fixedBy: "issue 793" },
  ],

  // ── REQ-096 c6 as right-sized by issue 858 (owner walk, 2026-09-17): the
  // far rivals the customer tracks are market leaders on one secondary line,
  // never "your rivals" and never leading the card. The line names them and
  // says why they are apart; it does not name a replacement or suggest
  // removing them — the customer changes the set from the competitors card.
  // Drafted (issue 759); the owner corrects the wording.
  "overview.rivals.leaders": [
    "Far larger competitors in your searches: {rivals}. They aren’t tracked against you for now.",
    { slots: { rivals: "text" }, fixedBy: "issue 858" },
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
  "overview.rivals.leaders.tab": [
    "Far larger competitors in your searches: {rivals}. The gap card leaves them out for now.",
    { slots: { rivals: "text" }, fixedBy: "owner 2026-09-21 · issue 983" },
  ],
  "overview.rivals.none-reachable": [
    "None of the competitors you track is within reach yet. Add one closer to your size.",
    { slots: {}, fixedBy: "issue 858" },
  ],
  // The one control c6 allows, and the whole of it. Never "remove".
  "overview.rivals.leaders.swap": ["Change your competitors", { slots: {}, fixedBy: "REQ-096 c6" }],

  // ── This week.
  "overview.week.title": ["This week", { slots: {}, fixedBy: "BUILD §4.5" }],
  // Issue 867: what this week's pages are aimed at — the searches
  // themselves, never a count. Drafted; the owner corrects the wording.
  "overview.week.aimed-at": [
    "This week's pages aim at {searches}.",
    { slots: { searches: "text" }, fixedBy: "issue 867" },
  ],
  // SPEC §4 (2026-09-20, #914): *Plan* is the calendar's on-screen name;
  // the key still says where the link goes.
  "overview.week.calendar-link": ["Open the plan →", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  // SPEC §4 2026-09-24 (#1070): the one broader category the week's
  // notice offers, measured again on the press. Drafted.
  "overview.week.broader.try": [
    "Try “{category}”",
    { slots: { category: "text" }, fixedBy: "SPEC §4 2026-09-24" },
  ],
  "overview.week.day.done": ["done", { slots: {}, fixedBy: "REQ-041 c6" }],
  "overview.week.day.today": ["today", { slots: {}, fixedBy: "REQ-041 c6" }],
  "overview.week.day.to-come": ["next", { slots: {}, fixedBy: "REQ-041 c6" }],

  // ── The alerts, and the one remainder line.
  //
  // Since #353 they are their own card, headed as the set heads it — §4.5
  // put them under "This week", and the approved set draws two cards.
  "overview.needs-you.title": ["Needs you", { slots: {}, fixedBy: "S12" }],
  // A page in review is the next page of the daily autopilot, not something
  // to read before it can go out (owner 2026-10-09, issue 1362).
  "overview.alert.pending-veto": ["{title} goes live on its own", { slots: { title: "text" }, fixedBy: "REQ-041 c5 · issue 1362" }],
  "overview.alert.pending-veto.action": ["Read or edit", { slots: {}, fixedBy: "issue 1362" }],
  "overview.alert.needs-you": ["{title} needs you before it can go out", { slots: { title: "text" }, fixedBy: "REQ-041 c5" }],
  // "Reconnect" is unbracketed in the approved set (ruling 11a) — the word
  // on the accent panel's outline pill. The alert's own title and the line
  // saying what broke are bracketed there; their words below are the
  // owner's (#460).
  "overview.alert.needs-you.action": ["Reconnect", { slots: {}, fixedBy: "S12" }],
  // The cause: "[cause line — owner's]" in the set, written by the owner
  // (#460). One short line
  // under the title, never a paragraph (§2.5's dim line).
  "overview.alert.needs-you.cause": ["The page couldn’t be delivered to your site.", { slots: {}, fixedBy: "REQ-041 c5" }],
  // Issue 880: the word for a page that is not waiting on a destination —
  // one the writing rules stopped, or a step that could not run. It is read
  // and resolved on the page itself, which is where this alert already
  // points; "Reconnect" above is for a delivery the founder must fix.
  // Drafted under issue 759's ruling. The cause line for each of the five
  // causes is `publish.needs-you.*`, stated from the page's own record.
  "overview.alert.needs-you.read": ["Read the page", { slots: {}, fixedBy: "issue 880" }],
  // The veto panel's own line, unbracketed in the set and therefore
  // approved. `left` is how long the window has to run, from the draft's
  // own stored `veto_deadline` (issue 794) — never a number typed here.
  // The duration that fills `left` above. Its own key, because the two
  // numerals are slots and the units are the set's own characters — the
  // same composition `overview.rivals.was` makes over
  // `overview.rivals.ratio`, so no unit is written at a call site.
  "overview.alert.pending-veto.left": [
    "{hours} h {minutes} m",
    { slots: { hours: "text", minutes: "text" }, fixedBy: "S12" },
  ],
  "overview.alert.pending-veto.due": [
    "publishes in {left} unless you say otherwise",
    { slots: { left: "text" }, fixedBy: "S12" },
  ],
  // A page in review with no veto window running: nothing publishes it on
  // a clock, so the line states no countdown. Drafted (issue 794); the
  // owner corrects the wording.
  "overview.alert.pending-veto.no-window": [
    "has no go-live time yet",
    { slots: {}, fixedBy: "issue 794" },
  ],
  "overview.alert.overflow": ["{remaining} more in the plan.", { slots: { remaining: "text" }, fixedBy: "SPEC §4 2026-09-20" }],
  // A technical issue the customer fixes (SPEC §9, #572): its title is the
  // check's own, its line the severity word. The control's word and the
  // count of the issues not shown are owner-owed.
  "overview.alert.site-issue.action": ["See the fix", { slots: {}, fixedBy: "issue 572" }],
  "overview.alert.site-issue.overflow": [
    "{remaining} more on your latest report.",
    { slots: { remaining: "text" }, fixedBy: "issue 572" },
  ],
  "overview.alerts.empty": ["Nothing needs you today.", { slots: {}, fixedBy: "REQ-041 c5" }],

  // ── The one supply statement Overview may make, resolved in this order.
  "overview.supply.exhausted": ["No pages are left worth writing. Monday’s scan looks for more.", { slots: {}, fixedBy: "REQ-095 c3" }],
  // issue 784 (issue 765's distinction, 2026-09-16): zero supply over a market that
  // was never measured is not "no pages left". Drafted under issue 759's ruling.
  "overview.supply.unmeasured": ["Nothing in your market is ready to write yet. Pick a broader market and we’ll scan again right away.", { slots: {}, fixedBy: "issue 784" }],
  // issue 855: zero supply because the pass that should have filled it stopped
  // on a ceiling. Drafted under issue 759's ruling.
  "overview.supply.measuring": ["Your market is still being scanned, so no pages are planned yet. ReachKit scans it again automatically.", { slots: {}, fixedBy: "issue 855" }],
  // Issue 881 (owner's dogfood, 2026-09-18): the same zero as the two
  // below, told apart — the market is not used up and not unmeasured, it is
  // too big for this site today. Drafted; the owner corrects the wording.
  "overview.supply.outsized": [
    "Every search we’ve measured is still too big for your site. Smaller ones come into reach as it grows.",
    { slots: {}, fixedBy: "issue 881" },
  ],
  "overview.supply.short": ["Less than a week of pages is left. Monday’s scan looks for more.", { slots: {}, fixedBy: "REQ-095 c5" }],
  "overview.supply.first-arrival": ["Your first scan found less than a month of pages. We look for more every Monday.", { slots: {}, fixedBy: "REQ-095 c6" }],

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
  "overview.change.domain": ["Domain changed. Measurement starts again from here.", { slots: {}, fixedBy: "REQ-071 c12" }],
  "overview.change.category": ["Market changed. The 12 searches were rebuilt from here.", { slots: {}, fixedBy: "REQ-071 c12" }],
  "overview.change.rivals": ["Competitors changed. Comparison starts again from here.", { slots: {}, fixedBy: "REQ-071 c12" }],
  // REQ-071 c13's other half: a card that compares two readings has to say
  // which span it compared over when a change falls inside it, rather than
  // quietly comparing across one.
  "overview.comparison.window": [
    "Compared from {since}, when your settings changed. Earlier readings aren’t joined to these.",
    { slots: { since: "date" }, fixedBy: "REQ-071 c13" },
  ],

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
  "overview.tabs.label": ["Overview sections", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.tab.search": ["Google", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.tab.rivals": ["Competitors", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],

  // Every one of Overview's four tabs has its screen, so the line a tab
  // carried while it had only an address is gone with the last placeholder
  // that carried it. `_overview/tabs.ts` is where the four live.

  // Every sparkline's accessible name: what it is a reading of, over how
  // many weeks. One key, because every trend on this screen is the same kind
  // of thing and a chart with no name is a chart a screen reader skips.

  // ── The page waiting for review.
  "overview.waiting.goes-live": [
    "Goes live {at}, unless you stop it.",
    { slots: { at: "date" }, fixedBy: "SPEC §4 2026-09-20" },
  ],
  // A page in review with no window running: nothing publishes it on a
  // clock, so the line states no time.
  "overview.waiting.waits": ["Its go-live time isn’t set yet.", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  // SPEC §4 2026-09-24 (#1070): the card counts down to that same time.
  // `{left}` is the time left, `6h 12m 09s`, a value the card ticks; the
  // absolute time stays on the line's own `<time>`. Drafted; the owner
  // corrects the wording.
  "overview.waiting.goes-live-in": [
    "Goes live in {left} unless you stop it.",
    { slots: { left: "text" }, fixedBy: "SPEC §4 2026-09-24" },
  ],
  // The four arms of the reason, one per shape of evidence the opportunity
  // carries. Never composed at a call site: the screen picks the arm and the
  // registry says the sentence.
  "overview.waiting.why.answered-by": [
    "{volume} people a month search “{search}”. Today {rival} answers them and you don’t appear.",
    { slots: { volume: "text", search: "text", rival: "text" }, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.waiting.why.not-high-enough": [
    "{volume} people a month search “{search}”, and your own page for it isn’t high enough yet.",
    { slots: { volume: "text", search: "text" }, fixedBy: "SPEC §4 2026-09-20" },
  ],
  // The search was chosen but its demand was never read back: the screen
  // states what the page is for and claims no number (REQ-004).
  "overview.waiting.why.search": [
    "This page is written to win “{search}”.",
    { slots: { search: "text" }, fixedBy: "SPEC §4 2026-09-20" },
  ],
  // A Fix page has no market target at all (SPEC §9).
  "overview.waiting.why.fix": [
    "This page fixes something on your own site that is holding your pages back.",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.waiting.badge.new": ["New page", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.waiting.badge.update": ["Update", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],
  // The screen's second control. "Stop this page" is the product's word on
  // every screen and in every mail (SPEC §4 · §7, 2026-09-20); "veto" stays
  // internal.
  "overview.waiting.stop": ["Stop this page", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],
  // Every action answers (SPEC §4, 2026-09-20): the two words the control
  // says back, on the screen, in place of silence.
  "overview.waiting.stopped": ["Stopped. This page won’t publish.", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.waiting.stop-refused": [
    "That didn’t go through. The page is unchanged. Try again in a moment.",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],

  // ── The three linked tiles. Each name is the tile's own; the chip beside
  // it is the tab it opens, spoken from that tab's key.
  "overview.tile.questions.label": ["Questions that mention you", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  // The window's own denominator, beside the count. Its own key because the
  // "of" is a word and the number is `OVERVIEW_TRAILING_WEEKS`, which is a
  // pin and is never written at a call site.
  "overview.tile.ai-answers.of": ["of {of}", { slots: { of: "text" }, fixedBy: "SPEC §4 2026-09-20" }],

  // ── This week: the word a day carries when nothing is scheduled on it.
  // The five stage words are the calendar's own (`calendar.stage.*`).
  "overview.week.day.no-page": ["No page", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],

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
    "Measured {on}.",
    { slots: { on: "date" }, fixedBy: "SPEC §4 2026-09-20" },
  ],

  // The four tiles. Each carries a denominator or a goal, never a bare
  // number (SPEC §4's data rule).
  "overview.search.tile.going-after": [
    "Searches we’re going after",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.search.tile.going-after.of": [
    "of {of} kept ready",
    { slots: { of: "text" }, fixedBy: "SPEC §6 supply depth" },
  ],
  // The line under it states this site's own queue in the board's shape
  // ("Enough for the next five weeks.", R4-05-Search): the kept-ready count
  // at §7's one page a day, in whole weeks from two weeks up and in days
  // below that. Drafted under the 2026-09-16 ruling (#759), issue 1039.
  "overview.search.tile.going-after.weeks": [
    "Enough for the next {weeks} weeks.",
    { slots: { weeks: "text" }, fixedBy: "issue 1039" },
  ],
  "overview.search.tile.going-after.days": [
    "Enough for the next {days} days.",
    { slots: { days: "text" }, fixedBy: "issue 1039" },
  ],
  "overview.search.tile.going-after.one-day": [
    "Enough for tomorrow’s page.",
    { slots: {}, fixedBy: "issue 1039" },
  ],
  "overview.search.tile.going-after.none": [
    "No page is ready to write. Monday’s scan looks for more.",
    { slots: {}, fixedBy: "issue 1039" },
  ],
  "overview.search.tile.first-two-pages": [
    "On Google’s first two pages",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.search.tile.first-page": ["On the first page", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.search.tile.pages.of": [
    "of {of} live pages",
    { slots: { of: "text" }, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.search.tile.first-two-pages.means": [
    "The first two pages are where a page starts to be found.",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],
  // The first-page tile names this site's own best-placed live page, in the
  // board's shape ("'brake pads when to replace', at 11 last week.",
  // R4-05-Search). The place is `overview.search.position`'s, and the date
  // it was measured is the line under the tabs. Drafted under the
  // 2026-09-16 ruling (#759), issue 1039.
  "overview.search.tile.first-page.one": [
    "“{search}”, at {position}.",
    { slots: { search: "text", position: "text" }, fixedBy: "issue 1039" },
  ],
  "overview.search.tile.first-page.more": [
    "“{search}”, at {position}, and {others} more.",
    { slots: { search: "text", position: "text", others: "text" }, fixedBy: "issue 1039" },
  ],
  "overview.search.tile.first-page.closest": [
    "Closest: “{search}”, at {position}.",
    { slots: { search: "text", position: "text" }, fixedBy: "issue 1039" },
  ],
  "overview.search.tile.first-page.no-place": [
    "Google doesn’t show you for these searches yet.",
    { slots: {}, fixedBy: "issue 1457 (drafted)" },
  ],
  // Issue 1457: the first-page tile counts every search ReachKit tracks,
  // and Overview's Google and AI tiles say what they are out of the same
  // way. Drafted (#759).
  "overview.search.tile.searches.of": [
    "of {of} searches",
    { slots: { of: "text" }, fixedBy: "issue 1457 (drafted)" },
  ],
  "overview.search.tile.appear-for.means": [
    "Every search Google shows you for, at any position.",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],

  // The line over the table: what the mark on every difficulty bar stands
  // at. The number is `difficultyCeiling(ownRanked)` — arithmetic over a
  // stored count, never a new measurement — and the sentence says the one
  // thing a founder needs from it: it moves when they do.
  "overview.search.ceiling": [
    "The mark on each difficulty bar is your limit, {ceiling} today. It rises as you rank for more.",
    { slots: { ceiling: "text" }, fixedBy: "SPEC §4 2026-09-20" },
  ],

  // The six column heads.
  "overview.search.column.search": ["Search", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.search.column.volume": ["A month", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.search.column.difficulty": ["Difficulty", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.search.column.you": ["You", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.search.column.rival": ["Best competitor", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.search.column.status": ["Status", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],

  // SPEC §4's four status words, and the chip that stands for all of them.
  "overview.search.status.all": ["All", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.search.status.live": ["Page is live", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.search.status.your-review": ["Page scheduled", { slots: {}, fixedBy: "issue 1362" }],
  "overview.search.status.up-next": ["Up next", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.search.status.too-big": ["Too big for now", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  // A filter chip's whole text. It is one string because daisyUI's `filter`
  // draws a radio's own `aria-label`, so the word and its count reach the
  // screen as one attribute rather than as two elements.
  "overview.search.chip": [
    "{status} {count}",
    { slots: { status: "text", count: "text" }, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.search.filter.label": ["Show", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.search.table.label": [
    "Every search ReachKit is going after",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],

  // A place on a search results page, and the week's move. The glyphs are
  // `overview.delta.up` / `overview.delta.down`, already written.
  "overview.search.position": ["#{position}", { slots: { position: "text" }, fixedBy: "SPEC §4 2026-09-20" }],
  // A page with a verdict and nothing recorded to compare it with: its
  // first week, which is a fact and not a change of zero.
  "overview.search.you.first": ["new", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  // An Improve target: the page that answers this search is the customer's
  // own, so no rival holds it.
  "overview.search.rival.yours": ["Your own page", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.search.difficulty.label": [
    "Difficulty {difficulty}, your limit is {ceiling}",
    { slots: { difficulty: "text", ceiling: "text" }, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.search.difficulty.label.no-limit": [
    "Difficulty {difficulty}",
    { slots: { difficulty: "text" }, fixedBy: "SPEC §4 2026-09-20" },
  ],

  // The foot of the table: how much of it is on screen, in what order, and
  // the one control that shows the rest.
  "overview.search.showing": [
    "{shown} of {total} · sorted by what’s closest to the first page",
    { slots: { shown: "text", total: "text" }, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.search.show-all": ["Show all {total}", { slots: { total: "text" }, fixedBy: "SPEC §4 2026-09-20" }],
  // Nothing on file at all — a site whose first pass has not finished, or
  // one whose market was too small. It claims neither: it says what is
  // true of the list, and the Overview's own supply statement says why.
  "overview.search.empty": [
    "No searches are on file yet. They arrive with the first scan of your market.",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],

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
  // The first tile: the four-week rate, its denominator, the split the
  // owner's ruling asks for, and the one line saying why four weeks.
  "overview.answers.rate.label": [
    "Answers that mention or link you",
    { slots: {}, fixedBy: "SPEC §6 2026-09-20" },
  ],
  "overview.answers.rate.of": [
    "of {of} answers asked",
    { slots: { of: "text" }, fixedBy: "SPEC §6 2026-09-20" },
  ],
  "overview.answers.rate.means": [
    "Over the last {weeks} weeks: {questions} questions × {engines} engines. One week alone is too noisy to trust.",
    { slots: { weeks: "text", questions: "text", engines: "text" }, fixedBy: "SPEC §6 2026-09-20" },
  ],
  "overview.answers.rate.split": [
    "{linked} link to you · {named} mention you somewhere else",
    { slots: { linked: "text", named: "text" }, fixedBy: "SPEC §6 2026-09-20" },
  ],

  // The second tile: this week's n of 12, and the engine it is counted
  // from — the Overview's own rule, said on this screen too.
  "overview.answers.week.means": [
    "This week, counted from {engine}.",
    { slots: { engine: "text" }, fixedBy: "SPEC §6 2026-09-20" },
  ],

  // The grid: its head, the line under it, and the names a reader needs to
  // read a mark without seeing its colour.
  "overview.answers.grid.title": [
    "What AI says on your searches",
    { slots: {}, fixedBy: "SPEC §6 2026-09-20" },
  ],
  "overview.answers.grid.lead": [
    "Your market’s {of} biggest searches, and what AI says on each, every week.",
    { slots: { of: "text" }, fixedBy: "SPEC §6 2026-09-20" },
  ],
  "overview.answers.grid.label": [
    "Each search, and what each AI engine said",
    { slots: {}, fixedBy: "SPEC §6 2026-09-20" },
  ],
  // ── 2026-09-20 (#908, #919): the cap, stated on the grid it bounds.
  //
  // SPEC §6 of that date: "at most 24 tracked questions in all (the twelve
  // plus twelve) … the set never grows past the cap, so its cost is flat",
  // confirmed as written by the owner on 2026-09-21 (§12, #985). The board
  // (R4-06) states it as "21 of 24 at most". **Drafted** under the owner's
  // 2026-09-16 ruling (#759); the PR names it so the owner can correct it.
  "overview.answers.grid.tracked": [
    "{tracked} of {max} at most: your market’s twelve, and one question for each page we publish. A page’s question leaves after {weeks} weeks with no mention.",
    { slots: { tracked: "text", max: "text", weeks: "text" }, fixedBy: "SPEC §6 2026-09-20" },
  ],
  "overview.answers.legend.label": ["What each mark means", { slots: {}, fixedBy: "SPEC §6 2026-09-20" }],

  // The five marks. *Linked* is a cited domain that is the site's own;
  // *named* is the brand token appearing in a reference somewhere else.
  // "Names someone else" is deliberately wider than the board's "Names a
  // rival": an answer can cite a directory, a marketplace or nobody at all,
  // and none of those is a rival.
  "overview.answers.mark.links": ["Links to you", { slots: {}, fixedBy: "SPEC §6 2026-09-20" }],
  "overview.answers.mark.names": ["Mentions you", { slots: {}, fixedBy: "SPEC §6 2026-09-20" }],
  "overview.answers.mark.others": ["Mentions someone else", { slots: {}, fixedBy: "SPEC §6 2026-09-20" }],
  "overview.answers.mark.no-answer": ["No answer", { slots: {}, fixedBy: "SPEC §6 2026-09-20" }],
  "overview.answers.mark.not-measured": ["Not measured", { slots: {}, fixedBy: "SPEC §6 2026-09-20" }],
  // One cell's accessible name: which question, which engine, what it said.
  // Never the colour, and never the mark alone.
  "overview.answers.cell": [
    "{question} · {engine}: {mark}",
    { slots: { question: "text", engine: "text", mark: "text" }, fixedBy: "SPEC §6 2026-09-20" },
  ],
  // The search a question was phrased from — REQ-093 c3's other half, which
  // is why the wording never appears without it.
  "overview.answers.from": ["from {search}", { slots: { search: "text" }, fixedBy: "REQ-093 c3" }],
  // The customer's own page for a question, where one is live.
  "overview.answers.page": ["Your page", { slots: {}, fixedBy: "SPEC §6 2026-09-20" }],
  // Nothing measured yet — a site whose first weekly pass has not run. It
  // claims nothing about the engines; it says what is true of the record.
  "overview.answers.empty": [
    "No AI answers have been measured yet. The first weekly scan asks AI your questions and checks your market’s twelve searches.",
    { slots: {}, fixedBy: "SPEC §6 2026-10-03 D19" },
  ],

  // ── 2026-10-03 (#1162): the tracked buyer prompts — owner D19 final, and
  // D22's AI mention rate and Your pages cited.
  //
  // The weekly AI measure is about 25 buyer prompts, each put to Google AI
  // Mode and ChatGPT twice. Every sentence below is **drafted** under the
  // owner's 2026-09-16 ruling (#759); the PR names each one so the owner
  // can correct it. No sentence states an AI position or sentiment.
  "overview.tile.mention-rate.label": ["AI mention rate", { slots: {}, fixedBy: "SPEC §4 2026-10-02 D22" }],
  // The 95% range beside the figure: where the true rate very likely sits.
  "overview.tile.mention-rate.band": [
    "likely {low}–{high}%",
    { slots: { low: "text", high: "text" }, fixedBy: "SPEC §6 2026-10-03 D19" },
  ],
  "overview.tile.mention-rate.of": [
    "Mentioned in {mentioned} of {answers} AI answers, last {weeks} weeks",
    { slots: { mentioned: "text", answers: "text", weeks: "text" }, fixedBy: "SPEC §6 2026-10-03 D19" },
  ],
  // D58 (issue 1287, drafted): no rate is shown until two weeks of the
  // current prompt set exist. The count stands beside its sample
  // ("0" · "of 46 answers"), and one line says when the rate appears.
  "overview.tile.mention-rate.early.of": [
    "of {answers} answers",
    { slots: { answers: "text" }, fixedBy: "SPEC §6 2026-10-06 D58 (drafted)" },
  ],
  "overview.tile.mention-rate.early": [
    "AI answers that mentioned you so far. A rate appears after {weeks} weeks of these questions",
    { slots: { weeks: "text" }, fixedBy: "SPEC §6 2026-10-06 D58 (drafted)" },
  ],
  // D64 (issue 1301, drafted): no pass has passed its own checks yet, so
  // the newest pass's count is shown and said to be the first.
  "overview.tile.mention-rate.first": [
    "First scan. A rate appears after {weeks} weeks of these questions",
    { slots: { weeks: "text" }, fixedBy: "SPEC §6 2026-10-07 D64 (drafted)" },
  ],

  // The AI answers tab: the rate's own card.
  "overview.prompts.rate.split": [
    "{linked} link to you · {named} mention you without a link",
    { slots: { linked: "text", named: "text" }, fixedBy: "SPEC §6 2026-10-03 D19" },
  ],
  "overview.prompts.rate.means": [
    "{prompts} questions, asked of Google AI Mode and ChatGPT twice a week, over {weeks} weeks. The range fits the {answers} answers read.",
    { slots: { prompts: "text", weeks: "text", answers: "text" }, fixedBy: "SPEC §6 2026-10-03 D19" },
  ],
  // The two prompts that ask about the site by name, counted apart.
  "overview.prompts.branded": [
    "Asked about you by name, AI mentioned you in {mentioned} of {answers} answers. These are counted apart from the rate.",
    { slots: { mentioned: "text", answers: "text" }, fixedBy: "SPEC §6 2026-10-03 D19" },
  ],

  // Share of voice: the site beside its rivals, by answers that named each.
  "overview.prompts.share.title": ["Share of voice", { slots: {}, fixedBy: "SPEC §4 2026-10-02 D22" }],
  "overview.prompts.share.lead": [
    "How many of those answers mentioned you, and how many mentioned each competitor.",
    { slots: {}, fixedBy: "SPEC §4 2026-10-02 D22" },
  ],
  "overview.prompts.share.label": [
    "You and your competitors, by AI answers that mentioned each",
    { slots: {}, fixedBy: "SPEC §4 2026-10-02 D22" },
  ],
  "overview.prompts.share.you": ["You", { slots: {}, fixedBy: "SPEC §4 2026-10-02 D22" }],
  "overview.prompts.share.answers": [
    "Answers: {count}",
    { slots: { count: "text" }, fixedBy: "SPEC §4 2026-10-02 D22" },
  ],
  "overview.prompts.share.none": [
    "No answer mentioned you or a competitor yet.",
    { slots: {}, fixedBy: "SPEC §4 2026-10-02 D22" },
  ],

  // The site's own pages those answers cited.
  "overview.prompts.pages.title": ["Your pages AI links to", { slots: {}, fixedBy: "SPEC §4 2026-10-02 D22" }],
  "overview.prompts.pages.lead": [
    "Pages of yours that an AI answer linked to, over the last {weeks} weeks.",
    { slots: { weeks: "text" }, fixedBy: "SPEC §4 2026-10-02 D22" },
  ],
  "overview.prompts.pages.label": [
    "Your pages AI answers linked, and how many answers each",
    { slots: {}, fixedBy: "SPEC §4 2026-10-02 D22" },
  ],
  "overview.prompts.pages.none": [
    "No answer linked a page of yours yet. The pages we publish are written to be linked.",
    { slots: {}, fixedBy: "SPEC §4 2026-10-02 D22" },
  ],

  // The set itself, so a founder can read what is asked.
  "overview.prompts.list.title": [
    "Questions we ask AI weekly",
    { slots: {}, fixedBy: "SPEC §6 2026-10-03 D19" },
  ],
  "overview.prompts.list.lead": [
    "Built from your market: who buys, the job they need done, and your competitors. At most a fifth change in a quarter, so the rate stays comparable.",
    { slots: {}, fixedBy: "SPEC §6 2026-10-03 D19" },
  ],
  "overview.prompts.list.label": [
    "Each question, and how many answers mentioned you",
    { slots: {}, fixedBy: "SPEC §6 2026-10-03 D19" },
  ],
  "overview.prompts.list.named": [
    "mentioned in {mentioned} of {answers}",
    { slots: { mentioned: "text", answers: "text" }, fixedBy: "SPEC §6 2026-10-03 D19" },
  ],
  "overview.prompts.list.unanswered": ["no answer yet", { slots: {}, fixedBy: "SPEC §6 2026-10-03 D19" }],
  // Issue 1457: the rows Overview's AI tile counts, marked. Drafted (#759).
  "overview.prompts.list.links-you": ["Links to you", { slots: {}, fixedBy: "issue 1457 (drafted)" }],
  "overview.prompts.list.mentions-you": ["Mentions you", { slots: {}, fixedBy: "issue 1457 (drafted)" }],
  "overview.prompts.kind.category": ["Market", { slots: {}, fixedBy: "SPEC §6 2026-10-03 D19" }],
  "overview.prompts.kind.use-case": ["Use case", { slots: {}, fixedBy: "SPEC §6 2026-10-03 D19" }],
  "overview.prompts.kind.persona": ["Buyer", { slots: {}, fixedBy: "SPEC §6 2026-10-03 D19" }],
  "overview.prompts.kind.comparison": ["Comparison", { slots: {}, fixedBy: "SPEC §6 2026-10-03 D19" }],
  "overview.prompts.kind.problem": ["Problem", { slots: {}, fixedBy: "SPEC §6 2026-10-03 D19" }],
  "overview.prompts.kind.branded": ["About you", { slots: {}, fixedBy: "SPEC §6 2026-10-03 D19" }],

  // D32 (#1162): LLM Mentions is bought only at a footprint of 30 ranked
  // searches or more. A site below it is told so, not told "next Monday".
  "overview.mentions.small-footprint": [
    "We read this once your site ranks for {min} searches or more. Below that, the engines’ record of you is almost always empty.",
    { slots: { min: "text" }, fixedBy: "SPEC §6 2026-10-03 D32" },
  ],

  // ── 2026-09-22 (#1004): the two cards beneath the grid, from DataForSEO's
  // LLM Mentions database (owner ruling of that date, after the #920 pilot).
  //
  // SPEC §4 and §6 of 2026-09-22. Every sentence below is **drafted** under
  // the owner's 2026-09-16 ruling (#759) and the PR names each one so the
  // owner can correct it. Two things neither card ever says, because §4's
  // 2026-09-20 rule closes the tab on both: a rank position, and anything
  // readable as sentiment.
  //
  // The engine names are the tab's own three keys, reused rather than
  // spelled again; the window's length is a slot, read from the same pin
  // the four-week rate above uses.

  // *Also appearing for* — the questions the engines answered with this
  // site that ReachKit does not already track.
  "overview.mentions.also.title": [
    "Also appearing for",
    { slots: {}, fixedBy: "SPEC §6 2026-09-22" },
  ],
  "overview.mentions.also.lead": [
    "Questions AI already answers with you, beyond the ones we track. The engines found you on their own.",
    { slots: {}, fixedBy: "SPEC §6 2026-09-22" },
  ],
  "overview.mentions.also.label": [
    "Questions AI answers with you, and where each was first seen",
    { slots: {}, fixedBy: "SPEC §6 2026-09-22" },
  ],
  // The foot of the list, where the top-12 cut hid some. It states both
  // numbers rather than implying twelve is all there was.
  "overview.mentions.also.showing": [
    "{shown} of {total} · the most asked first",
    { slots: { shown: "text", total: "text" }, fixedBy: "SPEC §6 2026-09-22" },
  ],
  // One row's two readings. The demand figure is the vendor's; a question
  // it could not size says so rather than showing a zero.
  "overview.mentions.also.asked": [
    "{count} a month",
    { slots: { count: "text" }, fixedBy: "SPEC §6 2026-09-22" },
  ],
  "overview.mentions.also.unsized": [
    "How often it is asked is not measured",
    { slots: {}, fixedBy: "SPEC §6 2026-09-22" },
  ],
  "overview.mentions.also.first-seen": [
    "First seen {on}",
    { slots: { on: "text" }, fixedBy: "SPEC §6 2026-09-22" },
  ],

  // *Cited pages* — the site's own pages those answers quote.
  // Issue 1457: this card reads other questions' answers, so it no longer
  // shares the tracked searches' card title. Drafted (#759).
  "overview.mentions.cited.title": [
    "Your pages in other AI answers",
    { slots: {}, fixedBy: "SPEC §6 2026-09-22 · issue 1457 (drafted)" },
  ],
  "overview.mentions.cited.lead": [
    "The pages on your own site that AI answers link to, and how many questions each answers.",
    { slots: {}, fixedBy: "SPEC §6 2026-09-22" },
  ],
  "overview.mentions.cited.label": [
    "Your pages AI answers link to, and how many questions each",
    { slots: {}, fixedBy: "SPEC §6 2026-09-22" },
  ],
  "overview.mentions.cited.questions": [
    "{count} questions",
    { slots: { count: "text" }, fixedBy: "SPEC §6 2026-09-22" },
  ],
  "overview.mentions.cited.one-question": [
    "1 question",
    { slots: {}, fixedBy: "SPEC §6 2026-09-22" },
  ],
  // Answers name the site but quote no page of theirs — a real state, and
  // a different one from having no answers at all.
  "overview.mentions.cited.none": [
    "No answer linked a page of yours yet. The pages we publish are written to be linked.",
    { slots: {}, fixedBy: "SPEC §6 2026-09-22" },
  ],

  // The window both cards read, said once under each.
  "overview.mentions.window": [
    "Over the last {weeks} weeks, not one week alone.",
    { slots: { weeks: "text" }, fixedBy: "SPEC §6 2026-09-22" },
  ],
  // The engines that answered one question, listed after it.
  "overview.mentions.engines": [
    "Answered by {engines}",
    { slots: { engines: "text" }, fixedBy: "SPEC §6 2026-09-22" },
  ],

  // The two states that are not rows. A measured zero is a measurement and
  // says so; a window nobody could read says that instead, and never that
  // the engines named nobody.
  "overview.mentions.zero": [
    "Over the last {weeks} weeks no AI answer mentioned you outside the questions we track. That is measured, not missing.",
    { slots: { weeks: "text" }, fixedBy: "SPEC §6 2026-09-22" },
  ],
  // A window can be one week — a site whose first Monday has just run. "Over
  // the last 1 weeks" is the sentence a slot writes when nobody wrote the
  // singular, and the proof at 390 is where it was read.
  "overview.mentions.zero.one-week": [
    "This week no AI answer mentioned you outside the questions we track. That is measured, not missing.",
    { slots: {}, fixedBy: "SPEC §6 2026-09-22" },
  ],
  "overview.mentions.unread": [
    "We haven’t read this in the last {weeks} weeks. A Monday scan buys it once a month.",
    { slots: { weeks: "text" }, fixedBy: "SPEC §6 2026-09-22" },
  ],
  "overview.mentions.unread.one-week": [
    "We haven’t read this yet. A Monday scan buys it once a month.",
    { slots: {}, fixedBy: "SPEC §6 2026-09-22" },
  ],

  // ── 2026-09-20 (#908, #921): Overview › AI answers › AI engines on your blog.
  //
  // SPEC §6 of that date, measure (d): "On hosted blogs only: pages fetched
  // by an answer engine for a user's question, and visitors arriving from
  // one, counted by day, page and engine, shown as ‘at least’. Training
  // crawlers are not progress and are not shown." §7 of the same date adds
  // the how: "server-side, no cookie, no visitor identity, no client
  // script."
  //
  // Every sentence below is **drafted** under the owner's 2026-09-16 ruling
  // (#759) and the PR names each one so the owner can correct it; the six
  // the issue itself drafted are carried verbatim, with the window's number
  // moved into a slot so the pin is what states it. "ChatGPT" is not
  // re-spelled — it is the report screen's own key.
  "overview.blog.title": ["AI engines on your blog", { slots: {}, fixedBy: "SPEC §6 2026-09-20" }],
  "overview.blog.lead": [
    "Counted by us, on the pages we host. Last {days} days.",
    { slots: { days: "text" }, fixedBy: "SPEC §6 2026-09-20" },
  ],
  // The two figures §6(d) names. A fetch is an engine reading the page; a
  // referral is a person arriving. They are never added together.
  "overview.blog.fetches.label": [
    "Pages fetched to answer someone’s question",
    { slots: {}, fixedBy: "SPEC §6 2026-09-20" },
  ],
  "overview.blog.referrals.label": [
    "Visitors who came from an AI answer",
    { slots: {}, fixedBy: "SPEC §6 2026-09-20" },
  ],
  // §6(d)'s own word: the referral figure is a floor and is never stated
  // as a count.
  "overview.blog.at-least": ["at least {n}", { slots: { n: "text" }, fixedBy: "SPEC §6 2026-09-20" }],
  "overview.blog.at-least.means": [
    "“At least”, because many AI apps don’t say where a visitor came from.",
    { slots: {}, fixedBy: "SPEC §6 2026-09-20" },
  ],
  // The engine breakdown under the fetch figure, and its accessible name.
  // Issue 1364 (owner, 2026-10-09): the fetch figure with its change on the
  // window before it, on the card and on the Overview's tile. **Drafted**
  // (#759); the pull request names each so the owner can correct it.
  "overview.blog.change.up": [
    "{count} more than the {days} days before",
    { slots: { count: "text", days: "text" }, fixedBy: "SPEC §4 2026-10-09 (drafted)" },
  ],
  "overview.blog.change.down": [
    "{count} fewer than the {days} days before",
    { slots: { count: "text", days: "text" }, fixedBy: "SPEC §4 2026-10-09 (drafted)" },
  ],
  "overview.blog.change.same": [
    "The same as the {days} days before",
    { slots: { days: "text" }, fixedBy: "SPEC §4 2026-10-09 (drafted)" },
  ],
  "overview.blog.engines.label": [
    "Which AI engine fetched your pages",
    { slots: {}, fixedBy: "SPEC §6 2026-09-20" },
  ],
  // The four engine names the product does not already say. ChatGPT is
  // `ai-answers.engine.chatgpt` — a second spelling of it would be the
  // second place the product speaks (ADR-001).
  "overview.blog.engine.perplexity": ["Perplexity", { slots: {}, fixedBy: "SPEC §6 2026-09-20" }],
  "overview.blog.engine.claude": ["Claude", { slots: {}, fixedBy: "SPEC §6 2026-09-20" }],
  "overview.blog.engine.gemini": ["Gemini", { slots: {}, fixedBy: "SPEC §6 2026-09-20" }],
  "overview.blog.engine.copilot": ["Microsoft Copilot", { slots: {}, fixedBy: "SPEC §6 2026-09-20" }],
  // ── 2026-09-20 (#908, #917): Overview › Rivals.
  //
  // SPEC §4 of that date: "who is on the first page for the twelve
  // searches, who the three answer engines name, how far ahead each rival's
  // footprint is over twelve weeks, and the searches rivals win that the
  // site does not, each with what ReachKit is doing about it." Every
  // sentence below is **drafted** under the owner's 2026-09-16 ruling (#759)
  // and the PR names each one so the owner can correct it. The card that
  // was already built keeps its own words — `overview.rivals.title`,
  // `overview.rivals.ratio`, `overview.rivals.was`, the two line keys and
  // the market-leaders sentence are the Overview's and are reused here
  // rather than spelled a second time.
  // The first counting card: who holds a place on Google's first page for
  // the twelve searches the pass buys a top ten for.
  "overview.rivals.first-page.title": [
    "Who’s on the first page",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.rivals.first-page.lead": [
    "Of the {of} searches your buyers make most.",
    { slots: { of: "text" }, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.rivals.first-page.started": [
    "You were on {count} of {of} when you started.",
    { slots: { count: "text", of: "text" }, fixedBy: "SPEC §4 2026-09-20" },
  ],

  // The second: who the three answer engines name, counted the way the AI
  // answers tab draws it, with the link to that tab beneath.
  "overview.rivals.named.title": ["Who AI answers mention", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.rivals.named.lead": [
    "Across {engines}, {of} answers.",
    { slots: { engines: "text", of: "text" }, fixedBy: "SPEC §6 2026-09-20" },
  ],
  "overview.rivals.named.see-all": ["See every answer", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],

  // A card that was measured and counted no tracked rival anywhere says so
  // once, in place of a row of empty bars, and the rivals neither card
  // counted are named under them (SPEC §4, 2026-10-09). Drafted (issue
  // 759); the owner corrects the wording.
  "overview.rivals.first-page.none": [
    "None of your competitors is on the first page for these searches.",
    { slots: {}, fixedBy: "SPEC §4 2026-10-09" },
  ],
  "overview.rivals.first-page.none.holders": [
    "None of your competitors is on the first page for these searches. The sites there most often: {holders}.",
    { slots: { holders: "text" }, fixedBy: "SPEC §4 2026-10-09" },
  ],
  "overview.rivals.named.none": [
    "None of these answers mentioned one of your competitors.",
    { slots: {}, fixedBy: "SPEC §4 2026-10-09" },
  ],
  "overview.rivals.unseen": [
    "On no first page and in no answer this week: {rivals}.",
    { slots: { rivals: "text" }, fixedBy: "SPEC §4 2026-10-09" },
  ],

  // `overview.rivals.gap.lead` is gone: no screen says what the ratio is a
  // ratio of (D24, SPEC §4 2026-10-02; issue 1324).

  // A card whose reading the pass never took. It claims nothing about the
  // rivals; it says what is true of the measurement.
  "overview.rivals.card.unmeasured": [
    "Not scanned yet. The first weekly scan reads all twelve searches and every answer.",
    { slots: {}, fixedBy: "REQ-004 c6" },
  ],

  // The table: every search a rival wins that the site does not.
  "overview.rivals.table.title": [
    "Searches competitors win",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.rivals.table.lead": [
    "From every search your competitors rank for. Your plan comes from this list.",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.rivals.table.label": [
    "Searches competitors win and you don’t",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.rivals.table.empty": [
    "No search on file is one a competitor wins and you don’t. That can change with the next weekly scan.",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.rivals.column.winner": ["Who wins it", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.rivals.column.doing": ["What we’re doing", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],

  // SPEC §4's four words for what ReachKit is doing about a search a rival
  // wins. None of them is "live": a search the customer already wins is not
  // in this table at all.
  "overview.rivals.status.in-review": [
    "Page scheduled",
    { slots: {}, fixedBy: "issue 1362" },
  ],
  "overview.rivals.status.up-next": ["Up next", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.rivals.status.needs-page": [
    "Needs a page on your main site",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.rivals.status.too-big": ["Too big for now", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],

  // The chips over the table, and the foot under it.
  "overview.rivals.filter.label": ["Show one competitor", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.rivals.filter.all": ["All competitors", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.rivals.chip": [
    "{rival}, {count} searches",
    { slots: { rival: "text", count: "text" }, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.rivals.showing": [
    "{shown} of {total} searches",
    { slots: { shown: "text", total: "text" }, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.rivals.show-all": [
    "Show all {total}",
    { slots: { total: "text" }, fixedBy: "SPEC §4 2026-09-20" },
  ],
  // ── SPEC §5 (2026-09-20, #924): the hosted blog's address, still waiting
  // for its DNS record. It leads the needs-you list because until the
  // record exists nothing written can go live at all, and it leaves the
  // list the moment the host is live.
  //
  // Drafted under the owner's 2026-09-16 ruling (#759); the PR names it.
  "overview.alert.connect-blog": [
    "Connect your blog’s address",
    { slots: {}, fixedBy: "SPEC §5 2026-09-20" },
  ],
  "overview.alert.connect-blog.line": [
    "One DNS record for {host}, about 5 minutes. Pages wait until it exists.",
    { slots: { host: "text" }, fixedBy: "SPEC §5 2026-09-20" },
  ],
  "overview.alert.connect-blog.action": [
    "Connect it",
    { slots: {}, fixedBy: "SPEC §5 2026-09-20" },
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
    { slots: {}, fixedBy: "SPEC §4 2026-09-20 · issue 912" },
  ],
  "overview.first-day.mail": [
    "We’ll mail you when it’s written. It goes live on its own 24 hours later, and you can edit or stop it until then.",
    { slots: {}, fixedBy: "issue 912 · issue 1362" },
  ],
  "overview.first-day.week": [
    "Your week is planned as soon as the scan finishes.",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20 · issue 912" },
  ],

  // ── SPEC §4 (2026-10-10, issue 1395): what ReachKit did this week, and
  // the process. Every number is a slot filled from a stored row or a pin.
  // Drafted; the owner corrects the wording.
  "overview.done.label": [
    "What ReachKit did this week",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.done.measured": [
    "Measured {searches} searches in Google and {questions} AI questions ({engines}, each asked {runs} times) · {at}",
    { slots: { searches: "text", questions: "text", engines: "text", runs: "text", at: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.done.measured.searches": [
    "Measured {searches} searches in Google · {at}",
    { slots: { searches: "text", at: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.done.measured.none": [
    "Searches and AI questions: not measured this week",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.done.measured.note": [
    "Once a week ReachKit looks up the searches your buyers make and puts their questions to the AI engines. Google and AI hold every result.",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.done.rivals": [
    "Competitors tracked: {n}",
    { slots: { n: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.done.rivals.none": [
    "Competitors: not measured this week",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.done.rivals.note": [
    "These are the competitors your numbers are compared with each week. Competitors shows where each one stands.",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.done.wrote": [
    "Pages written: {pages} · {fresh} new, {updated} updated",
    { slots: { pages: "text", fresh: "text", updated: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.done.wrote.passed": [
    "all passed {checks} checks",
    { slots: { checks: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.done.wrote.held": [
    "{held} held by a check",
    { slots: { held: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.done.wrote.none": [
    "No page written yet this week",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.done.wrote.note": [
    "Each page is written from facts read on your site and from public pages, then put through {checks} checks before you see it. Plan lists every page.",
    { slots: { checks: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.done.published": [
    "Pages published: {n}",
    { slots: { n: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.done.published.next": [
    "the next goes live {when}",
    { slots: { when: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.done.published.none": [
    "No page published yet this week",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.done.published.note": [
    "A page goes live on its own at your publish time. Until then it can be stopped from its card or from Plan.",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.done.set-aside": [
    "Topics set aside: {n}",
    { slots: { n: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.process.title": [
    "How ReachKit works on your site",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.process.step.read": [
    "Read your site",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.process.step.measure": [
    "Measure your market",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.process.step.rivals": [
    "Find your competitors",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.process.step.pick": [
    "Pick a topic",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.process.step.write": [
    "Write from your facts",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.process.step.checks": [
    "Check the page",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.process.step.publish": [
    "Publish",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.process.step.remeasure": [
    "Scan again",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.process.figure.pages": [
    "Pages read: {n}",
    { slots: { n: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.process.figure.searches": [
    "Searches: {n}",
    { slots: { n: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.process.figure.questions": [
    "AI questions: {n}",
    { slots: { n: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.process.figure.rivals": [
    "Competitors tracked: {n}",
    { slots: { n: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.process.figure.ready": [
    "Topics ready: {n}",
    { slots: { n: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.process.figure.checks": [
    "Checks: {n}",
    { slots: { n: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.process.figure.publish": [
    "Daily at {time}",
    { slots: { time: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.process.figure.remeasure": [
    "Next on {on}",
    { slots: { on: "text" }, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  "overview.process.pending": [
    "not measured yet",
    { slots: {}, fixedBy: "SPEC §4 2026-10-10 · issue 1395 (drafted)" },
  ],
  /* ── The owner's cost page (issue 1478, drafted) ──────────────────── */
  // Owner-only: `/app/costs` answers a 404 to every other account. No
  // figure here is a customer's, and no vendor name reaches a customer.
  "overview.costs.title": ["Costs", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.lead": ["The seven UTC days to {today}, for the owner only. Estimated is our price list; billed is what the vendor charged.", { slots: { today: "text" }, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.unreadable": ["The ledger could not be read just now. Nothing is lost; open this page again in a minute.", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.stat.estimated": ["Estimated this week", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.stat.billed": ["Billed this week", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.stat.billed.of": ["on {billed} of {calls} calls", { slots: { billed: "text", calls: "text" }, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.stat.today": ["Today against the cap", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.stat.today.of": ["billed where known, estimated where not", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.cents": ["{cents}¢", { slots: { cents: "text" }, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.eur": ["€{eur}", { slots: { eur: "text" }, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.share": ["{share}% of €{net}", { slots: { share: "text", net: "text" }, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.unbilled": ["Not billed", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.unreported": ["Not reported", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.col.site": ["Site", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.col.day": ["Day", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.col.estimated": ["Estimated", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.col.billed": ["Billed", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.col.month": ["A month", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.col.activity": ["Activity", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.col.failed": ["Failed or timed out", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.col.vendor": ["Vendor", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.col.recorded": ["Recorded", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.col.vendor-billed": ["Vendor billed", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.col.gap": ["Gap", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.col.judged": ["Judged", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.col.cap": ["Against €2", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.week.title": ["Each site this week", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.week.note": ["A site's month is this week's spend times 4.35, plus its share of the fixed costs that were reported, set against €{net} net. A free scan's spend is the site's it became.", { slots: { net: "text" }, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.week.empty": ["Nothing was spent this week.", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.days.title": ["Each site, each day", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.activities.title": ["This week by activity", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.vendors.title": ["Against the vendors", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.vendors.note": ["Recorded is the ledger and the box: billed where the vendor said, estimated where not. Vendor billed is the vendor's own account for that UTC day; it is read the day after.", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.vendors.no-ai": ["Anthropic's own bill is not read, so AI spend is our estimate. The deployment needs an admin key to read it.", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.cap.title": ["The €2 a day", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.cap.ok": ["Under", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.cap.warn": ["Past €1.50", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.cap.over": ["Over €2", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.fixed.title": ["Fixed costs, {month}", { slots: { month: "text" }, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.segment.free": ["Free scans", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.segment.smoke": ["Smoke tests", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.segment.test": ["Test domains", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.segment.box": ["Box tests", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.activity.free_scan": ["Free scan", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.activity.onboarding": ["First deep pass", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.activity.weekly": ["Weekly pass", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.activity.draft": ["Pages", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.activity.rescore": ["Later deep pass", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.activity.smoke": ["Smoke test", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.activity.test": ["Test domain", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.activity.box": ["Box test", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.vendor.dataforseo": ["DataForSEO", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.vendor.anthropic": ["Anthropic", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.vendor.vercel": ["Vercel", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.vendor.supabase": ["Supabase", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.vendor.jobs": ["Job platform", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.vendor.resend": ["Resend", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.vendor.stripe": ["Stripe fees", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  // SPEC §7 (2026-10-18, issue 1511): the main-site link, an optional finding
  // and never a needs-you item. Drafted (#759); the owner may correct it.
  "overview.main-link.title": ["Link your site to your articles", { slots: {}, fixedBy: "SPEC §7 2026-10-18 · issue 1511 (drafted)" }],
  "overview.main-link.not-linked": [
    "No page of your site links to your articles at {host} yet. One link, in your menu or footer, tells search engines the two are one business.",
    { slots: { host: "text" }, fixedBy: "SPEC §7 2026-10-18 · issue 1511 (drafted)" },
  ],
  "overview.main-link.not-followed": [
    "Your site links to your articles at {host}, but the link asks search engines not to follow it. Swap it for this one.",
    { slots: { host: "text" }, fixedBy: "SPEC §7 2026-10-18 · issue 1511 (drafted)" },
  ],
  "overview.main-link.optional": [
    "Optional. Publishing goes on either way, and this goes away once the link is found.",
    { slots: {}, fixedBy: "SPEC §7 2026-10-18 · issue 1511 (drafted)" },
  ],
  // SPEC §4 (2026-10-19, issue 1539): what AI answers misstate of the
  // business, a finding and never a needs-you item. Drafted (#759); the
  // owner may correct it.
  "overview.misstated.title": ["What AI answers get wrong", { slots: {}, fixedBy: "SPEC §4 2026-10-19 · issue 1539 (drafted)" }],
  "overview.misstated.row": [
    "An AI answer says {ai}. Your site says: {site}.",
    { slots: { ai: "text", site: "text" }, fixedBy: "SPEC §4 2026-10-19 · issue 1539 (drafted)" },
  ],
  "overview.misstated.source": ["Where your site says it", { slots: {}, fixedBy: "SPEC §4 2026-10-19 · issue 1539 (drafted)" }],
  "overview.misstated.next": [
    "Your next page on each of these topics states what your site says, plainly.",
    { slots: {}, fixedBy: "SPEC §4 2026-10-19 · issue 1539 (drafted)" },
  ],
}) satisfies CopyPartition;
