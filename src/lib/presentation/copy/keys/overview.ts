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
  "overview.tile.pages.means": [
    "About a month of pages, at up to {days} a week.",
    { slots: { days: "text" }, fixedBy: "REQ-041 c4 · A1 2026-10-19" },
  ],

  // §4.5's "goal: 6", with the number left to `GOAL_VALUES`.
  "overview.goal": ["goal: {value}", { slots: { value: "text" }, fixedBy: "BUILD §4.5" }],
  "overview.delta.up": ["▲", { slots: {}, fixedBy: "BUILD §4.5" }],
  "overview.delta.down": ["▼", { slots: {}, fixedBy: "BUILD §4.5" }],

  // ── How far ahead each rival is.
  "overview.rivals.title": ["How far ahead competitors are", { slots: {}, fixedBy: "BUILD §4.5" }],
  "overview.rivals.spark.label": [
    "How far ahead {rival} is",
    { slots: { rival: "text" }, fixedBy: "BUILD §4.5" },
  ],
  "overview.rivals.ratio": ["{ratio}× your size", { slots: { ratio: "text" }, fixedBy: "board AppCompetitors (drafted)" }],
  "overview.rivals.from": [
    "from {ratio}×",
    { slots: { ratio: "text" }, fixedBy: "board AppCompetitors (drafted)" },
  ],
  "overview.rivals.flat": [
    "no clear change",
    { slots: {}, fixedBy: "board AppCompetitors (drafted)" },
  ],
  "overview.rivals.ahead.sub": [
    "Moves over months, not weeks.",
    { slots: {}, fixedBy: "board AppCompetitors (drafted)" },
  ],
  "overview.rivals.ahead.size": [
    "Size means how many searches each site shows up for, against yours.",
    { slots: {}, fixedBy: "board AppCompetitors (drafted)" },
  ],
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
  "overview.rivals.none-reachable": [
    "None of the competitors you track is within reach yet. Add one closer to your size.",
    { slots: {}, fixedBy: "issue 858" },
  ],
  // The one control c6 allows, and the whole of it. Never "remove".
  "overview.rivals.leaders.swap": ["Change your competitors", { slots: {}, fixedBy: "REQ-096 c6" }],

  // ── This week.
  "overview.week.title": ["This week", { slots: {}, fixedBy: "BUILD §4.5" }],
  // SPEC §4 (2026-09-20, #914): *Plan* is the calendar's on-screen name;
  // the key still says where the link goes.
  "overview.week.calendar-link": ["Why each page →", { slots: {}, fixedBy: "SPEC §4 2026-09-20 · issue 1744 (drafted)" }],
  "overview.week.day.done": ["done", { slots: {}, fixedBy: "REQ-041 c6" }],
  "overview.week.day.today": ["today", { slots: {}, fixedBy: "REQ-041 c6" }],
  "overview.week.day.to-come": ["next", { slots: {}, fixedBy: "REQ-041 c6" }],

  // ── The alerts, and the one remainder line.
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
    "{remaining} more in Technical issues.",
    { slots: { remaining: "text" }, fixedBy: "issue 1550 (drafted)" },
  ],
  /* ── Technical issues, the account's view of the checks it fixes (issue 1550, drafted) */
  "overview.issues.title": ["Technical issues", { slots: {}, fixedBy: "issue 1550 (drafted)" }],
  "overview.issues.lead": ["Problems on your own site that ReachKit can’t change. Fixing them is optional.", { slots: {}, fixedBy: "issue 1752 (drafted)" }],
  "overview.issues.found": ["Found by the scan on {date}.", { slots: { date: "text" }, fixedBy: "issue 1752 (drafted)" }],
  "overview.issues.empty": ["Nothing on your site needs fixing. We check again on Monday.", { slots: {}, fixedBy: "issue 1752 (drafted)" }],
  "overview.issues.unscanned": ["Your site has not been scanned yet. What the first scan finds shows here.", { slots: {}, fixedBy: "issue 1752 (drafted)" }],
  "overview.issues.unreadable": ["Your latest scan could not be read just now. Open this page again in a minute.", { slots: {}, fixedBy: "issue 1550 (drafted)" }],
  "overview.issues.site": ["Applies to the whole site.", { slots: {}, fixedBy: "issue 1550 (drafted)" }],
  "overview.issues.seconds": ["{seconds} s", { slots: { seconds: "text" }, fixedBy: "issue 1550 (drafted)" }],
  "overview.issues.slow-note": ["Each page took {seconds} seconds or more on two reads; the time shown is the quicker one.", { slots: { seconds: "text" }, fixedBy: "issue 1550 (drafted)" }],
  "overview.issues.read": ["Your site, {count} pages read", { slots: { count: "text" }, fixedBy: "issue 1752 (drafted)" }],
  "overview.issues.fine": ["pages with nothing to fix", { slots: {}, fixedBy: "issue 1752 (drafted)" }],
  "overview.issues.affected": ["{pages} pages have one of {problems} problems.", { slots: { pages: "text", problems: "text" }, fixedBy: "issue 1752 (drafted)" }],
  "overview.issues.affected.one-problem": ["{pages} pages have the problem below.", { slots: { pages: "text" }, fixedBy: "issue 1752 (drafted)" }],
  "overview.issues.affected.one-page": ["One page has a problem listed below.", { slots: {}, fixedBy: "issue 1752 (drafted)" }],
  "overview.issues.ours": ["Your ReachKit pages are not affected: they are checked before they go live.", { slots: {}, fixedBy: "issue 1752 (drafted)" }],
  "overview.issues.ours.hosted": ["Your ReachKit pages are not affected: they live on {host} and are checked before they go live.", { slots: { host: "text" }, fixedBy: "issue 1752 (drafted)" }],
  "overview.issues.legend.noindex-pages": ["{count} hidden from search", { slots: { count: "text" }, fixedBy: "issue 1752 (drafted)" }],
  "overview.issues.legend.slow-pages": ["{count} slow", { slots: { count: "text" }, fixedBy: "issue 1752 (drafted)" }],
  "overview.issues.legend.broken-links": ["{count} broken links", { slots: { count: "text" }, fixedBy: "issue 1752 (drafted)" }],
  "overview.issues.legend.phone-usability": ["{count} phone", { slots: { count: "text" }, fixedBy: "issue 1752 (drafted)" }],
  "overview.issues.legend.ai-readers": ["{count} hidden from AI", { slots: { count: "text" }, fixedBy: "issue 1752 (drafted)" }],
  "overview.issues.legend.fine": ["{count} fine", { slots: { count: "text" }, fixedBy: "issue 1752 (drafted)" }],
  "overview.issues.share": ["{count} of {over} pages", { slots: { count: "text", over: "text" }, fixedBy: "issue 1752 (drafted)" }],
  "overview.issues.fix": ["The fix:", { slots: {}, fixedBy: "issue 1752 (drafted)" }],
  "overview.issues.who": ["Who can do it: whoever looks after your website.", { slots: {}, fixedBy: "issue 1752 (drafted)" }],
  "overview.issues.show": ["Show the {count} pages", { slots: { count: "text" }, fixedBy: "issue 1752 (drafted)" }],
  "overview.issues.show.one": ["Show the page", { slots: {}, fixedBy: "issue 1752 (drafted)" }],
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
  // Issue 1559: the depth is a week and its spares, not a month. Drafted.
  "overview.supply.first-arrival": ["Your first scan found fewer pages than a full week and its spares. We look for more every Monday.", { slots: {}, fixedBy: "SPEC §7 2026-10-19 (drafted)" }],

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
  "overview.change.locale": ["Country or language changed. Measurement starts again from here.", { slots: {}, fixedBy: "SPEC §6 · D66 · issue 1689" }],
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
  "overview.waiting.stopped": ["Stopped. This page won’t go live.", { slots: {}, fixedBy: "SPEC §4 2026-09-20 · issue 1605 (drafted)" }],
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

  // Issue 1551 (owner, 2026-10-19): the searches the live pages target,
  // split by how far Google has got with each — the tile Overview's Google
  // figure is read from — and the market's twelve, labelled as the outcome
  // that takes months. Drafted (#759).
  "overview.search.tile.your-pages": ["Your pages in Google", { slots: {}, fixedBy: "issue 1551 (drafted)" }],
  "overview.search.tile.your-pages.of": [
    "of {of} pages showing in results",
    { slots: { of: "text" }, fixedBy: "board AppGoogle (drafted)" },
  ],
  "overview.search.tile.your-pages.split": [
    "{first} on the first page · {further} at places 11–100 · {unseen} not yet seen",
    { slots: { first: "text", further: "text", unseen: "text" }, fixedBy: "board AppGoogle (drafted)" },
  ],
  "overview.search.tile.your-pages.means": [
    "A page counts once Google shows it anywhere in the top 100 results for its own search. Pages climb over weeks, so most start not yet seen.",
    { slots: {}, fixedBy: "board AppGoogle (drafted)" },
  ],
  "overview.search.tile.market": ["Your market", { slots: {}, fixedBy: "issue 1551 (drafted)" }],
  "overview.search.tile.market.means": [
    "Your market’s biggest searches, and how many show you on Google’s first page. Expect months, not weeks: they follow links and mentions from other sites.",
    { slots: {}, fixedBy: "board AppGoogle (drafted)" },
  ],
  "overview.search.tile.searches.of": [
    "of {of} searches on the first page",
    { slots: { of: "text" }, fixedBy: "board AppGoogle (drafted)" },
  ],
  "overview.search.tile.market.split": [
    "{first} on the first page · {rest} not yet",
    { slots: { first: "text", rest: "text" }, fixedBy: "board AppGoogle (drafted)" },
  ],

  // The column heads.
  "overview.search.column.search": ["Search", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.search.column.volume": ["A month", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.search.column.you": ["You", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.search.column.rival": ["Best competitor", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.search.column.status": ["What we’re doing", { slots: {}, fixedBy: "board AppGoogle (drafted)" }],

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

  // The foot of the table: how much of it is on screen, in what order, and
  // the one control that shows the rest.
  "overview.search.showing": [
    "{shown} of {total} · closest to the first page first",
    { slots: { shown: "text", total: "text" }, fixedBy: "board AppGoogle (drafted)" },
  ],
  "overview.search.show-all": ["Show all {total}", { slots: { total: "text" }, fixedBy: "SPEC §4 2026-09-20" }],
  // Nothing on file at all — a site whose first pass has not finished, or
  // one whose market was too small. It claims neither: it says what is
  // true of the list, and the Overview's own supply statement says why.
  "overview.search.empty": [
    "No searches are on file yet. They arrive with the first scan of your market.",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],

  // Board AppGoogle (issue 1746): the tab's head, the visits tile, each live
  // page in Google, and what is done about each search this week. Drafted (#759).
  "overview.tab.eyebrow": ["Overview · week {n}", { slots: { n: "text" }, fixedBy: "board AppGoogle (drafted)" }],
  "overview.means": ["What this means", { slots: {}, fixedBy: "board AppGoogle (drafted)" }],
  "overview.search.visits.label": ["Visits from Google", { slots: {}, fixedBy: "board AppGoogle (drafted)" }],
  "overview.search.visits.of": ["this week, to your pages", { slots: {}, fixedBy: "board AppGoogle (drafted)" }],
  "overview.search.visits.none": ["none yet", { slots: {}, fixedBy: "board AppGoogle (drafted)" }],
  "overview.search.visits.means": [
    "People who arrived on your pages from a Google search, counted on your pages themselves. Shown once there is at least one.",
    { slots: {}, fixedBy: "board AppGoogle (drafted)" },
  ],
  "overview.search.pages.title": ["Each page in Google", { slots: {}, fixedBy: "board AppGoogle (drafted)" }],
  "overview.search.pages.caption": ["place 1 is the top result", { slots: {}, fixedBy: "board AppGoogle (drafted)" }],
  "overview.search.pages.where": ["Where your pages sit this week", { slots: {}, fixedBy: "board AppGoogle (drafted)" }],
  "overview.search.pages.chart": ["Each live page’s place in Google this week", { slots: {}, fixedBy: "board AppGoogle (drafted)" }],
  "overview.search.pages.band": ["Google’s first page, places 1 to 10", { slots: {}, fixedBy: "board AppGoogle (drafted)" }],
  "overview.search.pages.now": ["a page this week", { slots: {}, fixedBy: "board AppGoogle (drafted)" }],
  "overview.search.pages.before": ["where it was before", { slots: {}, fixedBy: "board AppGoogle (drafted)" }],
  "overview.search.pages.shown": [
    "{shown} of {total} live pages",
    { slots: { shown: "text", total: "text" }, fixedBy: "board AppGoogle (drafted)" },
  ],
  "overview.search.pages.none": [
    "No page is live yet. Each page shows here once it’s live, with its place in Google.",
    { slots: {}, fixedBy: "board AppGoogle (drafted)" },
  ],
  "overview.search.place.up": [
    "Place {n} for “{search}”, up {gain} since {date}.",
    { slots: { n: "text", search: "text", gain: "text", date: "date" }, fixedBy: "board AppGoogle (drafted)" },
  ],
  "overview.search.place.flat": [
    "Place {n} for “{search}”, no gain in {weeks} weeks.",
    { slots: { n: "text", search: "text", weeks: "text" }, fixedBy: "board AppGoogle (drafted)" },
  ],
  "overview.search.place.now": [
    "Place {n} for “{search}”.",
    { slots: { n: "text", search: "text" }, fixedBy: "board AppGoogle (drafted)" },
  ],
  "overview.search.place.update": ["An update goes live {day}.", { slots: { day: "date" }, fixedBy: "board AppGoogle (drafted)" }],
  "overview.search.place.found": [
    "Found by Google on {date}. Not in results yet.",
    { slots: { date: "date" }, fixedBy: "board AppGoogle (drafted)" },
  ],
  "overview.search.place.unseen": ["Not in results yet.", { slots: {}, fixedBy: "board AppGoogle (drafted)" }],
  "overview.search.place.out": ["not in results yet", { slots: {}, fixedBy: "board AppGoogle (drafted)" }],
  // D8: a place read from the keyword database is an estimate, and says so.
  "overview.search.place.estimate": [
    "Read from Google’s estimate, not a live search this week.",
    { slots: {}, fixedBy: "D8 (drafted)" },
  ],
  "overview.search.table.title": ["Your market’s searches", { slots: {}, fixedBy: "board AppGoogle (drafted)" }],
  "overview.search.table.lead": [
    "What buyers in {place} search, who Google shows, and what ReachKit is doing about each.",
    { slots: { place: "text" }, fixedBy: "board AppGoogle (drafted)" },
  ],
  // A business that sells beyond one place: the lead names none.
  "overview.search.table.lead.anywhere": [
    "What buyers search, who Google shows, and what ReachKit is doing about each.",
    { slots: {}, fixedBy: "board AppGoogle (drafted)" },
  ],
  "overview.search.doing.today": ["Goes live today", { slots: {}, fixedBy: "board AppGoogle (drafted)" }],
  "overview.search.doing.page": ["Page {day}", { slots: { day: "date" }, fixedBy: "board AppGoogle (drafted)" }],
  "overview.search.doing.update": ["Update {day}", { slots: { day: "date" }, fixedBy: "board AppGoogle (drafted)" }],
  "overview.search.doing.climbing": ["Climbing, left alone", { slots: {}, fixedBy: "board AppGoogle (drafted)" }],

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
  "overview.answers.pages-cited.label": ["Pages linked by AI", { slots: {}, fixedBy: "board AppAI (drafted)" }],
  "overview.answers.pages-cited.of": ["of {of} pages asked", { slots: { of: "text" }, fixedBy: "issue 1551 (drafted)" }],
  "overview.answers.pages-cited.means": [
    "A page counts when the AI answer to its own question links to that page. Asked every Monday in ChatGPT and Google AI Mode, plus the AI Overview where the search has one.",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.answers.pages-cited.none": [
    "Shows once a page of yours is live and its question has been asked.",
    { slots: {}, fixedBy: "issue 1551 (drafted)" },
  ],
  // Board AppAI: the tiles, each page in AI answers, and which AI read and sent visits. Drafted (#759).
  "overview.answers.linked.line": [
    "Linked on their own question this week.",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.answers.linked.mentioned.one": [
    "1 more was mentioned without a link.",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.answers.linked.mentioned": [
    "{n} more were mentioned without a link.",
    { slots: { n: "text" }, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.answers.reads.label": [
    "AI reads",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.answers.reads.of": [
    "times this week",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.answers.reads.means": [
    "An AI app fetching one of your pages to answer someone. Training crawlers are not counted.",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.answers.visits.label": [
    "Visits from AI",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.answers.visits.of": [
    "this week",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.answers.visits.means": [
    "People who clicked through from an AI answer to your pages. At least: many AI apps don’t say where a visitor came from. Few for most businesses, so each one is a bonus.",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.answers.visits.chart": [
    "Visits from AI, week by week",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.answers.pages.title": [
    "Each page in AI answers",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.answers.pages.lead": [
    "Each page’s own question, asked in {place} every Monday. The dots are its AI steps: read, linked, visit.",
    { slots: { place: "text" }, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.answers.pages.lead.anywhere": [
    "Each page’s own question, asked every Monday. The dots are its AI steps: read, linked, visit.",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.answers.pages.unread": [
    "not read by AI yet",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.answers.pages.shown": [
    "{shown} of {total} pages asked",
    { slots: { shown: "text", total: "text" }, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.answers.pages.engines": [
    "Answers by engine",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.answers.engine.none": [
    "None on this search",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.answers.who.title": [
    "Which AI read and sent visits",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.answers.who.sum": [
    "{reads} reads · {visits} visits this week",
    { slots: { reads: "text", visits: "text" }, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.answers.who.reads": [
    "Reads",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.answers.who.reads.means": [
    "An AI app fetching a page to answer someone.",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.answers.who.visits.means": [
    "A person arriving from an AI answer.",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  // The four-week rate over the twelve, its denominator, the split the
  // owner's ruling asks for, and the one line saying why four weeks.

  // The second tile: this week's n of 12, and the engine it is counted
  // from — the Overview's own rule, said on this screen too.

  // The grid: its head, the line under it, and the names a reader needs to
  // read a mark without seeing its colour.
  "overview.answers.grid.title": [
    "What AI says on your searches",
    { slots: {}, fixedBy: "SPEC §6 2026-09-20" },
  ],
  "overview.answers.grid.lead": [
    "The {of} searches, asked of each engine. Opens as a grid.",
    { slots: { of: "text" }, fixedBy: "board AppAI (drafted)" },
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

  // The five marks. *Linked* is a cited domain that is the site's own;
  // *named* is the brand token appearing in a reference somewhere else.
  // "Names someone else" is deliberately wider than the board's "Names a
  // rival": an answer can cite a directory, a marketplace or nobody at all,
  // and none of those is a rival.
  "overview.answers.mark.links": ["Links to this page", { slots: {}, fixedBy: "SPEC §6 2026-09-20" }],
  "overview.answers.mark.names": ["Mentions you, no link", { slots: {}, fixedBy: "SPEC §6 2026-09-20" }],
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
  // The 95% range beside the figure: where the true rate very likely sits.
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

  // The AI answers tab: the rate's own card. Issue 1551 (SEO review R5.1)
  // labels it as what it measures. Drafted (#759).
  "overview.prompts.rate.reputation": [
    "How often AI mentions you when buyers ask for a business like yours. It follows mentions of you on other sites, so it moves over months.",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.prompts.rate.title": [
    "Reputation",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.prompts.rate.count": [
    "mentioned in {n} of {m} AI answers, last {weeks} weeks",
    { slots: { n: "text", m: "text", weeks: "text" }, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.prompts.rate.first": [
    "first reading · checked monthly",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.prompts.rate.monthly": [
    "checked monthly",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.prompts.rate.band": [
    "{n} of {m} AI answers mentioned you in the last {weeks} weeks: between {low}% and {high}%, because answers vary.",
    { slots: { n: "text", m: "text", weeks: "text", low: "text", high: "text" }, fixedBy: "board AppAI (drafted)" },
  ],

  // Share of voice: the site beside its rivals, by answers that named each.
  "overview.prompts.share.title": ["Share of voice", { slots: {}, fixedBy: "SPEC §4 2026-10-02 D22" }],
  "overview.prompts.share.lead": [
    "How many of those {m} answers mentioned you, and each competitor.",
    { slots: { m: "text" }, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.prompts.share.label": [
    "You and your competitors, by AI answers that mentioned each",
    { slots: {}, fixedBy: "SPEC §4 2026-10-02 D22" },
  ],
  "overview.prompts.share.you": ["You", { slots: {}, fixedBy: "SPEC §4 2026-10-02 D22" }],
  "overview.prompts.share.none": [
    "No answer mentioned you or a competitor yet.",
    { slots: {}, fixedBy: "SPEC §4 2026-10-02 D22" },
  ],

  // The set itself, so a founder can read what is asked.
  "overview.prompts.list.title": [
    "Questions we ask AI",
    { slots: {}, fixedBy: "board AppAI (drafted)" },
  ],
  "overview.prompts.list.count": [
    "{n} of the {m} questions a buyer in your market might ask. Questions with your name in them are left out of this count.",
    { slots: { n: "text", m: "text" }, fixedBy: "board AppAI (drafted)" },
  ],

  // ── 2026-09-20 (#908, #921): the AI engines that read the hosted pages.
  // ChatGPT is `ai-answers.engine.chatgpt` — a second spelling of it would be
  // the second place the product speaks (ADR-001).
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
  // `overview.rivals.ratio`, the two line keys and
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
    "Of {answers} AI answers to your buyers’ {questions} questions, last {weeks} weeks. Checked monthly.",
    { slots: { answers: "text", questions: "text", weeks: "text" }, fixedBy: "board AppCompetitors (drafted)" },
  ],
  "overview.rivals.named.lead.none": [
    "Of the AI answers to your buyers’ questions. Checked monthly.",
    { slots: {}, fixedBy: "board AppCompetitors (drafted)" },
  ],
  "overview.rivals.first.title": [
    "Who your buyers see first",
    { slots: {}, fixedBy: "board AppCompetitors (drafted)" },
  ],
  "overview.rivals.first.lead": [
    "The top Google result on each of the {of} searches your buyers make most.",
    { slots: { of: "text" }, fixedBy: "board AppCompetitors (drafted)" },
  ],
  "overview.rivals.first.of": [
    "{n} of {of}",
    { slots: { n: "text", of: "text" }, fixedBy: "board AppCompetitors (drafted)" },
  ],
  "overview.rivals.first.others": [
    "others",
    { slots: {}, fixedBy: "board AppCompetitors (drafted)" },
  ],
  "overview.rivals.first.line": [
    "You’re not the top result on any of the {of} yet, and you’re on the first page for {n}.",
    { slots: { of: "text", n: "text" }, fixedBy: "board AppCompetitors (drafted)" },
  ],
  "overview.rivals.first.you": [
    "You’re the top result on {n} of the {of}.",
    { slots: { n: "text", of: "text" }, fixedBy: "board AppCompetitors (drafted)" },
  ],
  "overview.rivals.first.after": [
    "This week’s pages go after {m} of them.",
    { slots: { m: "text" }, fixedBy: "board AppCompetitors (drafted)" },
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
  // SPEC §5 (2026-09-20): Overview while the address waits for its DNS
  // record, as board OverviewDNS draws it. No line names a go-live time:
  // none is true until it is live (Q11). Drafted (#759); the PR names each.
  "overview.connect.day": ["Overview · day {n}", { slots: { n: "text" }, fixedBy: "board OverviewDNS · issue 1811 (drafted)" }],
  "overview.connect.head": ["Your pages wait for your website", { slots: {}, fixedBy: "SPEC §5 2026-09-20 (drafted)" }],
  "overview.connect.head.ready": ["Your first page is ready", { slots: {}, fixedBy: "board OverviewDNS · issue 1811 (drafted)" }],
  "overview.connect.lead": [
    "They go live once your website is connected. Everything else runs on its own.",
    { slots: {}, fixedBy: "SPEC §5 2026-09-20 (drafted)" },
  ],
  "overview.connect.lead.ready": [
    "It goes live once your domain is connected. Everything else is done.",
    { slots: {}, fixedBy: "board OverviewDNS · issue 1811 (drafted)" },
  ],
  "overview.connect.eyebrow": ["Needs you · about 10 minutes, once", { slots: {}, fixedBy: "SPEC §5 2026-09-20 (drafted)" }],
  "overview.connect.title": ["Add one setting to your domain", { slots: {}, fixedBy: "board OverviewDNS · owner 2026-10-15 six words · issue 1811 (drafted)" }],
  "overview.connect.step.open": ["Open your domain settings", { slots: {}, fixedBy: "board OverviewDNS · issue 1811 (drafted)" }],
  "overview.connect.step.open.line": [
    "Where you bought {domain}, such as GoDaddy or Namecheap.",
    { slots: { domain: "text" }, fixedBy: "board OverviewDNS · issue 1811 (drafted)" },
  ],
  "overview.connect.step.paste": ["Paste the three values", { slots: {}, fixedBy: "board OverviewDNS · issue 1811 (drafted)" }],
  "overview.connect.step.paste.line": ["Copy each one from the box below.", { slots: {}, fixedBy: "board OverviewDNS · issue 1811 (drafted)" }],
  "overview.connect.step.rest": ["We do the rest", { slots: {}, fixedBy: "board OverviewDNS · issue 1811 (drafted)" }],
  "overview.connect.step.rest.line": [
    "Your pages appear on your own web address, under {label}.",
    { slots: { label: "text" }, fixedBy: "board OverviewDNS · issue 1811 (drafted)" },
  ],
  "overview.connect.copy.type": ["Copy the type", { slots: {}, fixedBy: "board OverviewDNS · issue 1811 (drafted)" }],
  "overview.connect.copy.name": ["Copy the name", { slots: {}, fixedBy: "board OverviewDNS · issue 1811 (drafted)" }],
  "overview.connect.copy.value": ["Copy the value", { slots: {}, fixedBy: "board OverviewDNS · issue 1811 (drafted)" }],
  "overview.connect.check": ["I’ve added it, check now", { slots: {}, fixedBy: "board OverviewDNS · issue 1811 (drafted)" }],
  "overview.connect.guide": [
    "Step-by-step for GoDaddy, Namecheap, Cloudflare →",
    { slots: {}, fixedBy: "board OverviewDNS · issue 1811 (drafted)" },
  ],
  "overview.connect.checked": ["Checked {time}: not found yet.", { slots: { time: "text" }, fixedBy: "board OverviewDNS · issue 1811 (drafted)" }],
  "overview.connect.unchecked": ["Not found yet.", { slots: {}, fixedBy: "board OverviewDNS · issue 1811 (drafted)" }],
  "overview.connect.hourly": [
    "We check every hour; this page updates when it works. A new setting can take up to a few hours to show.",
    { slots: {}, fixedBy: "board OverviewDNS · issue 1811 (drafted)" },
  ],
  "overview.connect.other": ["Other ways to connect", { slots: {}, fixedBy: "board OverviewDNS · issue 1811 (drafted)" }],
  "overview.connect.wordpress": [
    "On WordPress? Connect it with a username and an app password instead, and skip this setting.",
    { slots: {}, fixedBy: "board OverviewDNS · issue 1811 (drafted)" },
  ],
  "overview.connect.wordpress.link": ["Connect WordPress →", { slots: {}, fixedBy: "board OverviewDNS · issue 1811 (drafted)" }],
  "overview.connect.later": [
    "The same setting is in your first page’s mail, so you can add it later from a desk.",
    { slots: {}, fixedBy: "board OverviewDNS · owner R20 2026-10-22" },
  ],
  "overview.connect.page.eyebrow": ["Waiting to go live", { slots: {}, fixedBy: "board OverviewDNS · issue 1811 (drafted)" }],
  "overview.connect.page.line": [
    "It goes live once the setting works. Only this first page is written until then; the week’s other pages follow.",
    { slots: {}, fixedBy: "Q11 · board OverviewDNS · issue 1811" },
  ],
  "overview.connect.page.read": ["Read or edit it →", { slots: {}, fixedBy: "board OverviewDNS · issue 1811 (drafted)" }],
  "overview.connect.progress": [
    "Your progress starts here once your first page is live.",
    { slots: {}, fixedBy: "SPEC §5 2026-09-20 (drafted)" },
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

  // ── SPEC §4 (2026-10-10, issue 1395): the process. Every number is a slot filled from a stored row or a pin.
  // Drafted; the owner corrects the wording.
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
    "Pages go live at {time}",
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
  "overview.costs.eyebrow": ["Owner only", { slots: {}, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
  "overview.costs.lead": ["The seven UTC days to {today}. Estimated is our price list; billed is what the vendor charged.", { slots: { today: "text" }, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
  "overview.costs.unreadable": ["The ledger could not be read just now. Nothing is lost; open this page again in a minute.", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.stat.estimated": ["Estimated this week", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.stat.estimated.of": ["our price list", { slots: {}, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
  "overview.costs.stat.billed": ["Billed this week", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.stat.billed.of": ["on {billed} of {calls} calls", { slots: { billed: "text", calls: "text" }, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.stat.today": ["Today against the cap", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.stat.today.cap": ["of €{cap}", { slots: { cap: "text" }, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
  "overview.costs.stat.today.of": ["billed where known, estimated where not · mark at €{warn}", { slots: { warn: "text" }, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
  "overview.costs.cents": ["{cents}¢", { slots: { cents: "text" }, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.eur": ["€{eur}", { slots: { eur: "text" }, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.share": ["€{eur} · {share}%", { slots: { eur: "text", share: "text" }, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
  "overview.costs.unbilled": ["Not billed", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.unreported": ["Not reported", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.col.site": ["Site", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.col.day": ["Day", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.col.estimated": ["Estimated", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.col.billed": ["Billed", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.col.month": ["A month, against €{price}", { slots: { price: "text" }, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
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
  "overview.costs.week.sub": ["{estimated} est. · {billed} billed", { slots: { estimated: "text", billed: "text" }, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
  "overview.costs.week.sub.unbilled": ["{estimated} est. · not billed", { slots: { estimated: "text" }, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
  "overview.costs.week.empty": ["Nothing was spent this week.", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.days.title": ["Each site, each day", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.days.sub": ["One row per site and day.", { slots: {}, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
  "overview.costs.activities.title": ["This week by activity", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.activities.sub": ["Writing, measuring, scans and checks.", { slots: {}, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
  "overview.costs.vendors.title": ["Against the vendors", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.vendors.sub": ["Our estimate against each vendor's bill.", { slots: {}, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
  "overview.costs.vendors.note": ["Recorded is the ledger and the box: billed where the vendor said, estimated where not. Vendor billed is the vendor's own account for that UTC day; it is read the day after.", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.vendors.no-ai": ["Anthropic's own bill is not read, so AI spend is our estimate. The deployment needs an admin key to read it.", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.cap.title": ["The €2 a day", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.cap.summary": ["{over}, {warn}", { slots: { over: "text", warn: "text" }, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
  "overview.costs.cap.over-days.one": ["1 day over", { slots: {}, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
  "overview.costs.cap.over-days.other": ["{count} days over", { slots: { count: "text" }, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
  "overview.costs.cap.warn-days.one": ["1 day past the warning", { slots: {}, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
  "overview.costs.cap.warn-days.other": ["{count} days past the warning", { slots: { count: "text" }, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
  "overview.costs.cap.line": ["cap €{cap}", { slots: { cap: "text" }, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
  "overview.costs.cap.warn-line": ["warning €{warn}", { slots: { warn: "text" }, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
  "overview.costs.cap.key.line": ["solid line: cap €{cap}", { slots: { cap: "text" }, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
  "overview.costs.cap.key.warn-line": ["dashed line: warning €{warn}", { slots: { warn: "text" }, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
  "overview.costs.cap.table": ["Show the days as a table", { slots: {}, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
  "overview.costs.cap.ok": ["Under", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.cap.warn": ["Past €1.50", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.cap.over": ["Over €2", { slots: {}, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.fixed.title": ["Fixed costs, {month}", { slots: { month: "text" }, fixedBy: "SPEC §6 2026-10-17 · issue 1478 (drafted)" }],
  "overview.costs.fixed.sub": ["Hosting, mail and the rest, per month.", { slots: {}, fixedBy: "AppCosts board · issue 1753 (drafted)" }],
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
  // ── Today's page and the ladder (owner E4, 2026-10-19; board Main). Each
  // step is the stored reading's own; drafted (#759), the owner corrects it.
  "overview.today.eyebrow": ["Goes live today at {time}", { slots: { time: "date" }, fixedBy: "issue 1605 (drafted)" }],
  "overview.today.ready": ["Ready. Nothing is needed from you.", { slots: {}, fixedBy: "issue 1605 (drafted)" }],
  "overview.today.stop-note": [
    "Stop means it won’t go live and the topic is dropped. Tomorrow’s page is not affected.",
    { slots: {}, fixedBy: "issue 1605 (drafted)" },
  ],
  // Six words at most (SPEC §0; owner R12, B12).
  "overview.ladder.title": ["How far your {n} pages got", { slots: { n: "text" }, fixedBy: "issue 1605 (drafted)" }],
  "overview.ladder.read": ["Read {on}", { slots: { on: "date" }, fixedBy: "issue 1605 (drafted)" }],
  // A page published since the last reading is left out of each step's count.
  "overview.ladder.unread": ["{k} not read yet", { slots: { k: "text" }, fixedBy: "issue 1876 (drafted)" }],
  "overview.ladder.google.sub": ["highest step each page has reached", { slots: {}, fixedBy: "issue 1605 (drafted)" }],
  "overview.ladder.ai.sub": ["counted apart from Google", { slots: {}, fixedBy: "issue 1605 (drafted)" }],
  "overview.ladder.step.live": ["of {n} on your own web address", { slots: { n: "text" }, fixedBy: "issue 1605 (drafted)" }],
  "overview.ladder.step.found": ["of {n} Google fetched the page", { slots: { n: "text" }, fixedBy: "issue 1605 (drafted)" }],
  "overview.ladder.step.showing": ["of {n} in the top 100 for its own search", { slots: { n: "text" }, fixedBy: "issue 1605 (drafted)" }],
  "overview.ladder.step.first-page": ["of {n} places 1 to 10 in Google", { slots: { n: "text" }, fixedBy: "issue 1605 (drafted)" }],
  "overview.ladder.step.read": ["of {n} an AI app fetched it to answer someone", { slots: { n: "text" }, fixedBy: "issue 1605 (drafted)" }],
  "overview.ladder.step.linked": ["of {n} an AI answer to its own question links to it", { slots: { n: "text" }, fixedBy: "issue 1605 (drafted)" }],
  "overview.ladder.step.visit": ["of {n} someone came from an AI answer", { slots: { n: "text" }, fixedBy: "issue 1605 (drafted)" }],
  "overview.ladder.climbing": ["{n} climbing", { slots: { n: "text" }, fixedBy: "issue 1605 (drafted)" }],
  // Search Console's clicks are summed over the reading's window, not one week.
  "overview.ladder.visits": [
    "{n} visits from Google this week: people who arrived on these pages from Google.",
    { slots: { n: "text" }, fixedBy: "issue 1605 (drafted) · issue 1615: counted on the hosted pages" },
  ],
  "overview.ladder.how.title": ["How long each step takes", { slots: {}, fixedBy: "issue 1605 (drafted)" }],
  "overview.ladder.how.google": [
    "Each page climbs these steps at Google’s pace, not ours. Google usually fetches a new page within days to a few weeks. Showing in results, somewhere in the top 100 for the page’s own search, takes weeks. Reaching the first page takes months, and not every page gets there. Places are Google’s ordinary results; the map listings above them are not counted.",
    { slots: {}, fixedBy: "issue 1605 (drafted)" },
  ],
  "overview.ladder.how.ai": [
    "The AI steps are counted apart. An AI app can read a page within days, and an AI answer can link to a page before it reaches Google’s first page. Visits from AI are few for most businesses, so each one is a bonus, not a target.",
    { slots: {}, fixedBy: "issue 1605 (drafted)" },
  ],
  // Before any page shows in results. Without server logs nothing says what
  // Google or an AI app fetched, so the short line names neither.
  "overview.ladder.week1": [
    "Your first {live} pages are live, Google has found {found} and an AI app has read {read}. Showing in results usually takes weeks. Each step lights up here as it happens.",
    { slots: { live: "text", found: "text", read: "text" }, fixedBy: "issue 1605 (drafted)" },
  ],
  "overview.ladder.week1.short": [
    "Your first {live} pages are live. Showing in results usually takes weeks. Each step lights up here as it happens.",
    { slots: { live: "text" }, fixedBy: "issue 1605 (drafted)" },
  ],
  // ── The head, this week's pages, the site-fix line and the states without
  // a today card (board Main). Drafted (#759), the owner corrects them.
  "overview.head.eyebrow": ["Week {n} · {day}", { slots: { n: "text", day: "date" }, fixedBy: "issue 1744 (drafted)" }],
  "overview.head.title": ["Nothing needs you this week", { slots: {}, fixedBy: "issue 1744 (drafted)" }],
  "overview.head.lead.live": [
    "{live} of your pages are live and {showing} already show in Google.",
    { slots: { live: "text", showing: "text" }, fixedBy: "issue 1744 (drafted)" },
  ],
  // No reading yet: how many show in Google is not known, so it is not said.
  "overview.head.lead.live-unread": ["{live} of your pages are live.", { slots: { live: "text" }, fixedBy: "issue 1744 (drafted)" }],
  "overview.head.lead.chosen": [
    "This week’s {n} pages were chosen this morning.",
    { slots: { n: "text" }, fixedBy: "issue 1744 (drafted)" },
  ],
  "overview.head.lead.chosen-on": [
    "This week’s {n} pages were chosen on {weekday}.",
    { slots: { n: "text", weekday: "date" }, fixedBy: "issue 1744 (drafted)" },
  ],
  "overview.week.pages": ["This week’s {n} pages", { slots: { n: "text" }, fixedBy: "issue 1744 (drafted)" }],
  "overview.week.goes-live": ["Goes live", { slots: {}, fixedBy: "issue 1744 (drafted)" }],
  "overview.week.today-at": ["today, {time}", { slots: { time: "date" }, fixedBy: "issue 1744 (drafted)" }],
  // The board says "measure again"; SPEC §0 retires it (owner R12, B9).
  "overview.week.next": [
    "Next Monday, {date}, we check again and choose the next {n}.",
    { slots: { date: "date", n: "text" }, fixedBy: "issue 1744 (drafted) · owner R12 B9" },
  ],
  "overview.fixes.line": [
    "{n} things on your own site are worth fixing.",
    { slots: { n: "text" }, fixedBy: "issue 1744 (drafted)" },
  ],
  "overview.fixes.line.one": ["One thing on your own site is worth fixing.", { slots: {}, fixedBy: "issue 1744 (drafted)" }],
  "overview.fixes.optional": ["Optional. ReachKit keeps working either way.", { slots: {}, fixedBy: "issue 1744 (drafted)" }],
  "overview.fixes.see": ["See them →", { slots: {}, fixedBy: "issue 1744 (drafted)" }],
  "overview.today.live": ["Today’s page went live at {time}.", { slots: { time: "date" }, fixedBy: "issue 1744 (drafted)" }],
  "overview.paused.line": [
    "Publishing is paused. No page goes live until you turn it back on. Your plan and pages are kept.",
    { slots: {}, fixedBy: "issue 1744 (drafted)" },
  ],
  "overview.paused.action": ["Turn publishing on", { slots: {}, fixedBy: "issue 1744 (drafted)" }],

  // Board Main's figures: the week's AI and Google numbers, then the ones
  // that move over months (owner 2026-10-19, the simple model). Drafted (#759).
  "overview.ai.title": ["Your pages in AI answers", { slots: {}, fixedBy: "issue 1615 (drafted)" }],
  "overview.ai.linked.of": ["of {of} pages asked are linked by AI", { slots: { of: "text" }, fixedBy: "issue 1615 (drafted)" }],
  "overview.ai.linked.own": ["{n} linked on their own question", { slots: { n: "text" }, fixedBy: "issue 1615 (drafted)" }],
  "overview.ai.linked.not-yet": ["{n} not yet", { slots: { n: "text" }, fixedBy: "issue 1615 (drafted)" }],
  "overview.ai.reads": ["AI read your pages {n} times this week.", { slots: { n: "text" }, fixedBy: "issue 1615 (drafted)" }],
  "overview.ai.reads.one": ["AI read your pages once this week.", { slots: {}, fixedBy: "issue 1615 (drafted)" }],
  "overview.ai.reads.none": ["No AI app read your pages this week.", { slots: {}, fixedBy: "issue 1615 (drafted)" }],
  "overview.ai.reads.who": [
    "ChatGPT, Perplexity and other AI apps fetching a page to answer someone. Training crawlers are not counted.",
    { slots: {}, fixedBy: "issue 1615 (drafted): no vendor or model name under a stop (REQ-092 c8)" },
  ],
  "overview.ai.reads.chart": ["AI reads, week by week", { slots: {}, fixedBy: "issue 1615 (drafted)" }],
  "overview.ai.each": ["Each page in AI answers →", { slots: {}, fixedBy: "issue 1615 (drafted)" }],
  "overview.mover.title": ["Best mover this week", { slots: {}, fixedBy: "issue 1615 (drafted) · owner E2" }],
  "overview.mover.place": ["place in Google", { slots: {}, fixedBy: "issue 1615 (drafted)" }],
  "overview.mover.up": ["up {n} since {date}", { slots: { n: "text", date: "date" }, fixedBy: "issue 1615 (drafted)" }],
  "overview.mover.climbing": [
    "Still climbing, so we leave it alone. A page gets an update only once it stops gaining.",
    { slots: {}, fixedBy: "issue 1615 (drafted)" },
  ],
  "overview.mover.none": [
    "No page moved up this week. Pages climb over weeks, not days.",
    { slots: {}, fixedBy: "issue 1615 (drafted)" },
  ],
  "overview.mover.each": ["Each page in Google →", { slots: {}, fixedBy: "issue 1615 (drafted)" }],
  "overview.months.title": ["Measures that move over months", { slots: {}, fixedBy: "issue 1615 (drafted)" }],
  "overview.months.checked": ["checked monthly · next on {date}", { slots: { date: "date" }, fixedBy: "issue 1615 (drafted)" }],
  "overview.months.first": ["First reading on {date}.", { slots: { date: "date" }, fixedBy: "issue 1615 (drafted)" }],
  "overview.months.of": ["of {of}", { slots: { of: "text" }, fixedBy: "issue 1615 (drafted)" }],
  "overview.months.score": ["Visibility Score", { slots: {}, fixedBy: "issue 1615 (drafted)" }],
  "overview.months.score.up": ["up from {n} at your scan", { slots: { n: "text" }, fixedBy: "issue 1615 (drafted)" }],
  "overview.months.score.down": ["down from {n} at your scan", { slots: { n: "text" }, fixedBy: "issue 1615 (drafted)" }],
  "overview.months.score.same": ["same as at your scan", { slots: {}, fixedBy: "issue 1615 (drafted)" }],
  "overview.months.market": ["searches on the first page", { slots: {}, fixedBy: "issue 1615 (drafted)" }],
  "overview.months.market.up": ["searches on the first page, up from {n}", { slots: { n: "text" }, fixedBy: "issue 1615 (drafted)" }],
  "overview.months.market.down": ["searches on the first page, down from {n}", { slots: { n: "text" }, fixedBy: "issue 1615 (drafted)" }],
  "overview.months.reputation": ["Reputation", { slots: {}, fixedBy: "issue 1615 (drafted)" }],
  "overview.months.reputation.line": [
    "AI answers mentioned you, last {weeks} weeks",
    { slots: { weeks: "text" }, fixedBy: "issue 1615 (drafted)" },
  ],
  "overview.months.note": [
    "These follow links and mentions from other sites, so they move over months, not weeks.",
    { slots: {}, fixedBy: "issue 1615 (drafted)" },
  ],
  "overview.months.range": [
    "Reputation is the first reading: between {low}% and {high}%, because AI answers vary.",
    { slots: { low: "text", high: "text" }, fixedBy: "issue 1615 (drafted)" },
  ],
}) satisfies CopyPartition;
