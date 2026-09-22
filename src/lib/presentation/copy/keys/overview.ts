// src/lib/presentation/copy/keys/overview.ts — BP-020 decision 5, WO-041
//
// Overview's sentences. Three keys seeded (WO-041 step 3): the
// no-presence-yet lines for the weekly-presence chart, week and
// partial-week states. The block that owns Overview fills every other
// sentence this surface needs.
//
// 2026-09-05: issue #9 (BUILD §4.4) adds `overview.head` — the one written
// line this screen states inside the app shell until its own content lands
// (issue #15, §4.5). It is a customer-visible sentence, and so the owner's
// (constitution §1).
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
//   `overview.head` stays and is not orphaned: it is the head of the screen
//   where no week has been measured (`OVERVIEW_HEAD.no_data`), which is the
//   only state it was ever written for.
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
// written — the owner approved the master's drafted set ("copy proposal
// approved", proposal sheet
// https://claude.ai/code/artifact/546f45a0-a996-4d25-b85e-fb03fda7b102) and
// the strings land here byte for byte. The values named in the approval
// file are the owner's; nothing here is composed.
import type { CopyPartition } from "../registry.ts";

export const OVERVIEW_COPY = Object.freeze({
  "place.overview.weekly-presence.chart": [
    "No weekly measurement yet. The line begins with the first Monday pass.",
    { law: "no-presence-yet", slots: {}, fixedBy: "REQ-041 c3" },
  ],
  "place.overview.weekly-presence.week": [
    "This week hasn’t been measured. The next pass is due Monday.",
    { law: "no-presence-yet", slots: {}, fixedBy: "REQ-065 c3" },
  ],
  "place.overview.weekly-presence.partial-week": [
    "Not measured this week. What was measured is shown with its date.",
    { law: "no-presence-yet", slots: {}, fixedBy: "REQ-065 c4" },
  ],
  "overview.head": ["Too early to call a direction.", { slots: {}, fixedBy: "BUILD §4.5" }],

  // ── The head: one line per direction the stored series shows, and the
  // badge §4.5 puts beside it. Four lines, not one: §4.5's "The gap is
  // closing." is a claim about the chart directly under it, and a screen
  // that states it over a widening gap has said something untrue.
  "overview.head.rising": ["The gap is closing.", { slots: {}, fixedBy: "BUILD §4.5" }],
  "overview.head.flat": ["The gap hasn’t moved yet.", { slots: {}, fixedBy: "BUILD §4.5" }],
  "overview.head.falling": ["The gap has widened.", { slots: {}, fixedBy: "BUILD §4.5" }],
  // Approved as written (ruling 11a): the set's badge claims every week
  // and names no number, so the `weeks` slot goes with the wording rather
  // than staying declared and unfilled — a slot the value never spends is
  // a promise the registry cannot keep (`registry.test.ts` substitutes
  // every declared slot and asserts it lands).
  // ── UI-SPEC S13, the week-0 arm (REQ-040 c7).
  //
  // The deep pass has measured once and the first weekly pass is still
  // due. Every string below is unbracketed in the set and so approved
  // (11a). What the arm may not do is speak in the ordinary arm's words:
  // "The gap is closing." over a single reading would be a direction
  // nothing was compared to establish, which is the whole reason
  // `headDirection` answers `no_data` under two points.
  "overview.head.week-zero": [
    "Your first page is ready to read.",
    { slots: {}, fixedBy: "S13" },
  ],
  "overview.head.badge.week-zero": ["week 0", { slots: {}, fixedBy: "S13" }],
  "overview.head.badge": ["▲ every week since you started", { slots: {}, fixedBy: "S12" }],

  // ── The growth module.
  // The card head's right-hand chip (UI-SPEC S12: "re-measured Mon 1 Sep").
  // The date is a slot — it is the measurement's own, read from the series,
  // and the sidebar states the same one from the same `firstDueOn`/week.
  "overview.growth.source.remeasured": [
    "re-measured {on}",
    { slots: { on: "date" }, fixedBy: "S12" },
  ],
  // The week-0 chart's own chip and footnote pair. The chip names the pass
  // the single reading came from — the set is explicit that it is the deep
  // pass and not a weekly measurement — and the right footnote says the
  // weekly line has not begun, in place of the goal sentence the ordinary
  // arm carries.
  "overview.growth.source.deep-pass": [
    "from the deep pass · {on}",
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
    "At {goal} the big category terms unlock.",
    { slots: { goal: "text" }, fixedBy: "BUILD §4.5" },
  ],

  // ── The three tiles (DECISIONS 2026-09-03: no composite score tile).
  // Each name is §4.5's own; each meaning line is the owner's.
  // ── The three tiles' week-0 lines (UI-SPEC S13). Each names when its
  // own reading arrives, in place of a number nobody has measured — never
  // a zero, which REQ-004 forbids as a reading that was not taken.
  "overview.tile.score.first-due": [
    "first measurement due {due}",
    { slots: { due: "date" }, fixedBy: "S13 · REQ-040 c7" },
  ],
  "overview.tile.ai-answers.first-pass": [
    "measured with the first weekly pass",
    { slots: {}, fixedBy: "S13" },
  ],
  // #793: the deep pass is week 0. Where it measured the score or the AI
  // answers, the tile shows that reading and names it as the starting
  // measurement, with the date the weekly readings take over. Drafted
  // (#759); the owner corrects the wording.
  "overview.tile.starting": [
    "starting measurement, {on} · weekly from {due}",
    { slots: { on: "date", due: "date" }, fixedBy: "issue 793" },
  ],
  "overview.tile.pages.first-review": [
    "first page in review today",
    { slots: {}, fixedBy: "S13" },
  ],

  // ── The score tile (UI-SPEC S12, ruling 6a).
  //
  // Ruling 6a fixes the name on every surface that labels the number:
  // "Discoverability Score" — the report head's eyebrow, this tile, the
  // landing component tile and the two mails. Transcribed, not chosen.
  "overview.tile.score.label": ["Discoverability Score", { slots: {}, fixedBy: "ruling 6a" }],
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
  "overview.tile.ai-answers.label": ["AI answers", { slots: {}, fixedBy: "BUILD §4.5" }],
  "overview.tile.ai-answers.window": [
    "named in {weeks} of the last {of} weeks",
    { slots: { weeks: "text", of: "text" }, fixedBy: "REQ-041 c12" },
  ],
  // Issue 867 (owner, 2026-09-17): the number counts Google's AI Overview
  // alone (§6.2, matrix.ts), so the line under the tile says which engine it
  // is counted from, and names the other engines this site's pages are
  // measured on where the paid battery asked them. Drafted under issue 759's
  // ruling; the owner corrects the wording.
  "overview.tile.ai-answers.counted-from": [
    "Counted from {engine}.",
    { slots: { engine: "text" }, fixedBy: "issue 867" },
  ],
  "overview.tile.ai-answers.also-measured": [
    "{engines} are measured on each page's own search.",
    { slots: { engines: "text" }, fixedBy: "issue 867" },
  ],
  "overview.tile.ai-answers.means": ["Named by AI in half the weeks.", { slots: {}, fixedBy: "REQ-041 c4" }],
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
    "rest under {weeks} weeks — too early to judge",
    { slots: { weeks: "text" }, fixedBy: "S12 · REQ-063 c2" },
  ],
  "overview.tile.pages.means": ["A month of daily pages.", { slots: {}, fixedBy: "REQ-041 c4" }],

  // §4.5's "goal: 6", with the number left to `GOAL_VALUES`.
  "overview.goal": ["goal: {value}", { slots: { value: "text" }, fixedBy: "BUILD §4.5" }],
  "overview.delta.up": ["▲", { slots: {}, fixedBy: "BUILD §4.5" }],
  "overview.delta.down": ["▼", { slots: {}, fixedBy: "BUILD §4.5" }],

  // ── How far ahead each rival is.
  "overview.rivals.title": ["How far ahead each rival is", { slots: {}, fixedBy: "BUILD §4.5" }],
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
  "overview.rivals.line.absolute": ["Each line is a rival’s own count beside yours.", { slots: {}, fixedBy: "REQ-041 c9" }],
  // The week-0 arm's one line, in place of the rows: nothing has been
  // sized yet, and the card says when it will be rather than drawing three
  // empty plots.
  "overview.rivals.line.week-zero": [
    "Sized with the first weekly measurement, {due}.",
    { slots: { due: "date" }, fixedBy: "S13" },
  ],

  // #793: the deep pass sized the rivals, so week 0 draws their rows from
  // it and says so. Drafted (#759); the owner corrects the wording.
  "overview.rivals.line.starting": [
    "Starting sizes from your deep pass, {on}. Weekly from {due}.",
    { slots: { on: "date", due: "date" }, fixedBy: "issue 793" },
  ],

  // ── REQ-096 c6 as right-sized by issue 858 (owner walk, 2026-09-17): the
  // far rivals the customer tracks are market leaders on one secondary line,
  // never "your rivals" and never leading the card. The line names them and
  // says why they are apart; it does not name a replacement or suggest
  // removing them — the customer changes the set from the competitors card.
  // Drafted (issue 759); the owner corrects the wording.
  "overview.rivals.leaders": [
    "Market leaders in your searches: {rivals}. They are far larger than you for now, so they aren’t shown as your rivals.",
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
    "Market leaders in your searches: {rivals}. They are far larger than you for now, so the gap card leaves them out.",
    { slots: { rivals: "text" }, fixedBy: "owner 2026-09-21 · issue 983" },
  ],
  "overview.rivals.none-reachable": [
    "None of the rivals you track is within reach yet. Add a site closer to your size to see the gap move.",
    { slots: {}, fixedBy: "issue 858" },
  ],
  // The one control c6 allows, and the whole of it. Never "remove".
  "overview.rivals.leaders.swap": ["Change who you’re measured against", { slots: {}, fixedBy: "REQ-096 c6" }],

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
  "overview.week.day.done": ["done", { slots: {}, fixedBy: "REQ-041 c6" }],
  "overview.week.day.today": ["today", { slots: {}, fixedBy: "REQ-041 c6" }],
  "overview.week.day.to-come": ["next", { slots: {}, fixedBy: "REQ-041 c6" }],

  // ── The alerts, and the one remainder line.
  //
  // Since #353 they are their own card, headed as the set heads it — §4.5
  // put them under "This week", and the approved set draws two cards.
  "overview.needs-you.title": ["Needs you", { slots: {}, fixedBy: "S12" }],
  "overview.alert.pending-veto": ["{title} is ready to read", { slots: { title: "text" }, fixedBy: "REQ-041 c5" }],
  "overview.alert.pending-veto.action": ["Read it", { slots: {}, fixedBy: "BUILD §4.5" }],
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
    "waits for you before it publishes",
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
  "overview.supply.exhausted": ["No pages are left worth writing. Monday’s re-measure looks for more.", { slots: {}, fixedBy: "REQ-095 c3" }],
  // issue 784 (issue 765's distinction, 2026-09-16): zero supply over a market that
  // was never measured is not "no pages left". Drafted under issue 759's ruling.
  "overview.supply.unmeasured": ["Nothing in your market is ready to write yet, so no pages are planned. Pick a broader category and we’ll measure again right away.", { slots: {}, fixedBy: "issue 784" }],
  // issue 855: zero supply because the pass that should have filled it stopped
  // on a ceiling. Drafted under issue 759's ruling.
  "overview.supply.measuring": ["Your market is still being measured, so no pages are planned yet. ReachKit measures it again automatically.", { slots: {}, fixedBy: "issue 855" }],
  // Issue 881 (owner's dogfood, 2026-09-18): the same zero as the two
  // below, told apart — the market is not used up and not unmeasured, it is
  // too big for this site today. Drafted; the owner corrects the wording.
  "overview.supply.outsized": [
    "Every search we've measured is still too big for your site, so no page is planned. Smaller ones come into reach as your site grows.",
    { slots: {}, fixedBy: "issue 881" },
  ],
  "overview.supply.short": ["Fewer than a week of pages is left. Monday’s re-measure looks for more.", { slots: {}, fixedBy: "REQ-095 c5" }],
  "overview.supply.first-arrival": ["Your first pass found less than a month of pages. We look for more every Monday.", { slots: {}, fixedBy: "REQ-095 c6" }],

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
  "overview.change.category": ["Market changed. The 12 questions were rebuilt from here.", { slots: {}, fixedBy: "REQ-071 c12" }],
  "overview.change.rivals": ["Rivals changed. Comparison starts again from here.", { slots: {}, fixedBy: "REQ-071 c12" }],
  // REQ-071 c13's other half: a card that compares two readings has to say
  // which span it compared over when a change falls inside it, rather than
  // quietly comparing across one.
  "overview.comparison.window": [
    "Compared from {since}, when your settings changed — earlier readings aren’t joined to these.",
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
  "overview.tab.search": ["Search", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.tab.rivals": ["Rivals", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],

  // Every one of Overview's four tabs has its screen, so the line a tab
  // carried while it had only an address is gone with the last placeholder
  // that carried it. `_overview/tabs.ts` is where the four live.

  // The head, when a page is waiting to be read. The other four head lines
  // are the series' own (`OVERVIEW_HEAD`) and are unchanged: this arm is
  // about the customer's own queue, not about the gap.
  "overview.head.waiting": ["One page is waiting for you.", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],

  // Every sparkline's accessible name: what it is a reading of, over how
  // many weeks. One key, because every trend on this screen is the same kind
  // of thing and a chart with no name is a chart a screen reader skips.
  "overview.trend.label": [
    "{name}, the last {weeks} weeks",
    { slots: { name: "text", weeks: "text" }, fixedBy: "SPEC §4 2026-09-20" },
  ],

  // ── The page waiting for review.
  "overview.waiting.goes-live": [
    "Goes live {at}, unless you stop it.",
    { slots: { at: "date" }, fixedBy: "SPEC §4 2026-09-20" },
  ],
  // A page in review with no window running: nothing publishes it on a
  // clock, so the line states no time.
  "overview.waiting.waits": ["It waits for you before it publishes.", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.waiting.why.label": ["Why this page:", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
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
  // The small view of the page under the reason. The bar carries the address
  // readers reach it at, where the destination has one.
  "overview.waiting.preview.label": ["As your readers will see it", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  // The screen's second control. "Stop this page" is the product's word on
  // every screen and in every mail (SPEC §4 · §7, 2026-09-20); "veto" stays
  // internal.
  "overview.waiting.stop": ["Stop this page", { slots: {}, fixedBy: "SPEC §7 2026-09-20" }],
  // Every action answers (SPEC §4, 2026-09-20): the two words the control
  // says back, on the screen, in place of silence.
  "overview.waiting.stopped": ["Stopped. This page won’t publish.", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.waiting.stop-refused": [
    "That didn’t go through. The page is unchanged — try again in a moment.",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],

  // ── The three linked tiles. Each name is the tile's own; the chip beside
  // it is the tab it opens, spoken from that tab's key.
  "overview.tile.questions.label": ["Questions that name you", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  // The window's own denominator, beside the count. Its own key because the
  // "of" is a word and the number is `OVERVIEW_TRAILING_WEEKS`, which is a
  // pin and is never written at a call site.
  "overview.tile.ai-answers.of": ["of {of}", { slots: { of: "text" }, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.tile.rivals.label": ["Your nearest rival’s lead", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  // The line under the searches tile. The count is REQ-063's own stored
  // standing — pages whose week was judged `working` — so the sentence says
  // "already ranking" and claims no position.
  "overview.tile.searches.ranking": [
    "{ranked} of your {published} pages are already ranking.",
    { slots: { ranked: "text", published: "text" }, fixedBy: "issue 915" },
  ],
  "overview.tile.rivals.whose": [
    "Your nearest rival is {rival}.",
    { slots: { rival: "text" }, fixedBy: "issue 915" },
  ],

  // ── This week: the word a day carries when nothing is scheduled on it.
  // The five stage words are the calendar's own (`calendar.stage.*`).
  "overview.week.day.no-page": ["No page", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],

  // ── SPEC §4 (2026-09-20, #908), the Search tab (#916) — every search
  // ReachKit is going after, and where the customer stands on it. Every
  // sentence below is drafted under the 2026-09-16 ruling (#759) and named
  // in the PR body for the owner to correct; the four status words and the
  // ceiling line are the issue's own drafts, taken verbatim.
  "overview.search.lead": [
    "The searches we’re going after for you, and where you stand on each.",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],
  // The line under the tabs: which measurement this whole screen is read
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
  "overview.search.tile.going-after.means": [
    "ReachKit keeps a queue of searches ready so there is always a page to write tomorrow.",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
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
    "Top 20 is where a page starts to be found.",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.search.tile.first-page.means": [
    "The first page is where nearly every click goes.",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
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
    "The mark on each difficulty bar is your limit — {ceiling} today. It rises as you rank for more.",
    { slots: { ceiling: "text" }, fixedBy: "SPEC §4 2026-09-20" },
  ],

  // The six column heads.
  "overview.search.column.search": ["Search", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.search.column.volume": ["A month", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.search.column.difficulty": ["Difficulty", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.search.column.you": ["You", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.search.column.rival": ["Best rival", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.search.column.status": ["Status", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],

  // SPEC §4's four status words, and the chip that stands for all of them.
  "overview.search.status.all": ["All", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.search.status.live": ["Page is live", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.search.status.your-review": ["Your review", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
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
    "No searches are on file yet. They arrive with the first pass over your market.",
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
  "overview.answers.lead": [
    "Whether the AI engines your buyers ask name you, link to you, and send people your way.",
    { slots: {}, fixedBy: "SPEC §6 2026-09-20" },
  ],

  // The first tile: the four-week rate, its denominator, the split the
  // owner's ruling asks for, and the one line saying why four weeks.
  "overview.answers.rate.label": [
    "Answers that name or link you",
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
    "{linked} link to you · {named} name you somewhere else",
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
    "The questions we ask every week",
    { slots: {}, fixedBy: "SPEC §6 2026-09-20" },
  ],
  "overview.answers.grid.lead": [
    "The {of} your buyers ask most, put to every engine, every week.",
    { slots: { of: "text" }, fixedBy: "SPEC §6 2026-09-20" },
  ],
  "overview.answers.grid.label": [
    "Each question, and what each AI engine said",
    { slots: {}, fixedBy: "SPEC §6 2026-09-20" },
  ],
  "overview.answers.legend.label": ["What each mark means", { slots: {}, fixedBy: "SPEC §6 2026-09-20" }],

  // The five marks. *Linked* is a cited domain that is the site's own;
  // *named* is the brand token appearing in a reference somewhere else.
  // "Names someone else" is deliberately wider than the board's "Names a
  // rival": an answer can cite a directory, a marketplace or nobody at all,
  // and none of those is a rival.
  "overview.answers.mark.links": ["Links to you", { slots: {}, fixedBy: "SPEC §6 2026-09-20" }],
  "overview.answers.mark.names": ["Names you", { slots: {}, fixedBy: "SPEC §6 2026-09-20" }],
  "overview.answers.mark.others": ["Names someone else", { slots: {}, fixedBy: "SPEC §6 2026-09-20" }],
  "overview.answers.mark.no-answer": ["No answer", { slots: {}, fixedBy: "SPEC §6 2026-09-20" }],
  "overview.answers.mark.not-measured": ["Not measured", { slots: {}, fixedBy: "SPEC §6 2026-09-20" }],
  // One cell's accessible name: which question, which engine, what it said.
  // Never the colour, and never the mark alone.
  "overview.answers.cell": [
    "{question} — {engine}: {mark}",
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
    "No AI answers have been measured yet. The first weekly pass puts all twelve questions to every engine.",
    { slots: {}, fixedBy: "SPEC §6 2026-09-20" },
  ],
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
  "overview.rivals.lead": [
    "What we learned from the sites you’re measured against.",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],

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
  "overview.rivals.named.title": ["Who AI answers name", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.rivals.named.lead": [
    "Across {engines} — {of} answers.",
    { slots: { engines: "text", of: "text" }, fixedBy: "SPEC §6 2026-09-20" },
  ],
  "overview.rivals.named.see-all": ["See every answer", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],

  // The line under the card that was already built, which the Overview tab
  // does not draw: what the ratio is a ratio of, and where level is.
  "overview.rivals.gap.lead": [
    "Searches each site appears for, against yours. 1.0× is level.",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],

  // A card whose reading the pass never took. It claims nothing about the
  // rivals; it says what is true of the measurement.
  "overview.rivals.card.unmeasured": [
    "Not measured yet. The first weekly pass reads all twelve searches and every answer.",
    { slots: {}, fixedBy: "REQ-004 c6" },
  ],

  // The table: every search a rival wins that the site does not.
  "overview.rivals.table.title": [
    "Searches your rivals win and you don’t",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.rivals.table.lead": [
    "From every search your rivals rank for. This list is where your plan comes from.",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.rivals.table.label": [
    "Searches your rivals win and you don’t",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.rivals.table.empty": [
    "No search on file is one a rival wins and you don’t. That changes with the next weekly pass.",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.rivals.column.winner": ["Who wins it", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.rivals.column.doing": ["What we’re doing", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],

  // SPEC §4's four words for what ReachKit is doing about a search a rival
  // wins. None of them is "live": a search the customer already wins is not
  // in this table at all.
  "overview.rivals.status.in-review": [
    "Page in your review",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.rivals.status.up-next": ["Up next", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.rivals.status.needs-page": [
    "Needs a page on your main site",
    { slots: {}, fixedBy: "SPEC §4 2026-09-20" },
  ],
  "overview.rivals.status.too-big": ["Too big for now", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],

  // The chips over the table, and the foot under it.
  "overview.rivals.filter.label": ["Show one rival", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
  "overview.rivals.filter.all": ["All rivals", { slots: {}, fixedBy: "SPEC §4 2026-09-20" }],
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
    "One DNS record for {host} — about 5 minutes. Pages are written and waiting until it exists.",
    { slots: { host: "text" }, fixedBy: "SPEC §5 2026-09-20" },
  ],
  "overview.alert.connect-blog.action": [
    "Connect it",
    { slots: {}, fixedBy: "SPEC §5 2026-09-20" },
  ],
}) satisfies CopyPartition;
