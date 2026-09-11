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
//   `SPEC.md` §4.5 itself prints — the same footing as the thirteen band
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
    { slots: {}, fixedBy: "UI-SPEC S13" },
  ],
  "overview.head.badge.week-zero": ["week 0", { slots: {}, fixedBy: "UI-SPEC S13" }],
  "overview.head.badge": ["▲ every week since you started", { slots: {}, fixedBy: "UI-SPEC S12" }],

  // ── The growth module.
  // The card head's right-hand chip (UI-SPEC S12: "re-measured Mon 1 Sep").
  // The date is a slot — it is the measurement's own, read from the series,
  // and the sidebar states the same one from the same `firstDueOn`/week.
  "overview.growth.source.remeasured": [
    "re-measured {on}",
    { slots: { on: "date" }, fixedBy: "UI-SPEC S12" },
  ],
  // The week-0 chart's own chip and footnote pair. The chip names the pass
  // the single reading came from — the set is explicit that it is the deep
  // pass and not a weekly measurement — and the right footnote says the
  // weekly line has not begun, in place of the goal sentence the ordinary
  // arm carries.
  "overview.growth.source.deep-pass": [
    "from the deep pass · {on}",
    { slots: { on: "date" }, fixedBy: "UI-SPEC S13" },
  ],
  "overview.growth.footnote.starting": [
    "starting at {value}",
    { slots: { value: "text" }, fixedBy: "UI-SPEC S13" },
  ],
  "overview.growth.footnote.first-monday": [
    "the line begins with the first Monday",
    { slots: {}, fixedBy: "UI-SPEC S13" },
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
    { slots: { due: "date" }, fixedBy: "UI-SPEC S13 · REQ-040 c7" },
  ],
  "overview.tile.ai-answers.first-pass": [
    "measured with the first weekly pass",
    { slots: {}, fixedBy: "UI-SPEC S13" },
  ],
  "overview.tile.pages.first-review": [
    "first page in review today",
    { slots: {}, fixedBy: "UI-SPEC S13" },
  ],

  // ── The score tile (UI-SPEC S12, ruling 6a).
  //
  // Ruling 6a fixes the name on every surface that labels the number:
  // "Discoverability Score" — the report head's eyebrow, this tile, the
  // landing component tile and the two mails. Transcribed, not chosen.
  "overview.tile.score.label": ["Discoverability Score", { slots: {}, fixedBy: "UI-SPEC 6a" }],
  // What reaching `GOAL_VALUES.score` means, in the product's own words.
  // The set prints no such line beside the score — it prints the band —
  // so the words are the owner's (#460).
  "overview.tile.score.means": ["At {goal} you’re Findable", { slots: { goal: "text" }, fixedBy: "BUILD §4.5" }],
  // The card head of the growth chart still names the searches reading:
  // the set moved that number off the tiles and onto its own card, and
  // this key is the card's eyebrow now rather than a tile label.
  "overview.tile.searches.label": ["Searches you appear in", { slots: {}, fixedBy: "BUILD §4.5" }],
  "overview.tile.ai-answers.label": ["AI answers", { slots: {}, fixedBy: "BUILD §4.5" }],
  "overview.tile.ai-answers.window": [
    "named in {weeks} of the last {of} weeks",
    { slots: { weeks: "text", of: "text" }, fixedBy: "REQ-041 c12" },
  ],
  "overview.tile.ai-answers.means": ["Named by AI in half the weeks.", { slots: {}, fixedBy: "REQ-041 c4" }],
  "overview.tile.pages.label": ["Pages published", { slots: {}, fixedBy: "BUILD §4.5" }],
  // The set's own two lines on the pages tile, both unbracketed and so
  // approved (11a): the badge beside the count, and the dim line under it.
  // Both numbers are slots — the ranking count is measured and the three
  // weeks are `TOO_EARLY_WEEKS`, which is a pin and is never re-written.
  "overview.tile.pages.ranking": [
    "{count} already ranking",
    { slots: { count: "text" }, fixedBy: "UI-SPEC S12" },
  ],
  "overview.tile.pages.too-early": [
    "rest under {weeks} weeks — too early to judge",
    { slots: { weeks: "text" }, fixedBy: "UI-SPEC S12 · REQ-063 c2" },
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
    { slots: { due: "date" }, fixedBy: "UI-SPEC S13" },
  ],

  // ── REQ-096 c6: a rival banded `far`, and the two sentences it needs.
  //
  // **What the line must not say.** It says the rival is far beyond what
  // this customer could catch and why the distance to it will not move. It
  // does not name a replacement, does not suggest removing the rival, and
  // is not a verdict on the customer — REQ-096 c7 keeps the rival in the
  // set until the customer takes it out themselves.
  "overview.rivals.far.line": ["{rival} is far beyond your reach for now. Its lead is so large that this distance won’t move week to week.", { slots: { rival: "text" }, fixedBy: "REQ-096 c6" }],
  // The one control c6 allows, and the whole of it: a word for "go to
  // where you can change who you are measured against". Never "remove".
  "overview.rivals.far.swap": ["Change who you’re measured against", { slots: {}, fixedBy: "REQ-096 c6" }],

  // ── This week.
  "overview.week.title": ["This week", { slots: {}, fixedBy: "BUILD §4.5" }],
  "overview.week.calendar-link": ["Open calendar →", { slots: {}, fixedBy: "BUILD §4.5" }],
  "overview.week.day.done": ["done", { slots: {}, fixedBy: "REQ-041 c6" }],
  "overview.week.day.today": ["today", { slots: {}, fixedBy: "REQ-041 c6" }],
  "overview.week.day.to-come": ["next", { slots: {}, fixedBy: "REQ-041 c6" }],

  // ── The alerts, and the one remainder line.
  //
  // Since #353 they are their own card, headed as the set heads it — §4.5
  // put them under "This week", and the approved set draws two cards.
  "overview.needs-you.title": ["Needs you", { slots: {}, fixedBy: "UI-SPEC S12" }],
  "overview.alert.pending-veto": ["{title} is ready to read", { slots: { title: "text" }, fixedBy: "REQ-041 c5" }],
  "overview.alert.pending-veto.action": ["Read it", { slots: {}, fixedBy: "BUILD §4.5" }],
  "overview.alert.needs-you": ["{title} needs you before it can go out", { slots: { title: "text" }, fixedBy: "REQ-041 c5" }],
  // "Reconnect" is unbracketed in the approved set (ruling 11a) — the word
  // on the accent panel's outline pill. The alert's own title and the line
  // saying what broke are bracketed there; their words below are the
  // owner's (#460).
  "overview.alert.needs-you.action": ["Reconnect", { slots: {}, fixedBy: "UI-SPEC S12" }],
  // The cause: "[cause line — owner's]" in the set, written by the owner
  // (#460). One short line
  // under the title, never a paragraph (§2.5's dim line).
  "overview.alert.needs-you.cause": ["The page couldn’t be delivered to your site.", { slots: {}, fixedBy: "REQ-041 c5" }],
  // The veto panel's own line, unbracketed in the set and therefore
  // approved. `left` is how long the window has to run, written by
  // `formatHoursLeft` from the item's own `since` and `VETO.defaultHours` —
  // never a number typed here.
  // The duration that fills `left` above. Its own key, because the two
  // numerals are slots and the units are the set's own characters — the
  // same composition `overview.rivals.was` makes over
  // `overview.rivals.ratio`, so no unit is written at a call site.
  "overview.alert.pending-veto.left": [
    "{hours} h {minutes} m",
    { slots: { hours: "text", minutes: "text" }, fixedBy: "UI-SPEC S12" },
  ],
  "overview.alert.pending-veto.due": [
    "publishes in {left} unless you say otherwise",
    { slots: { left: "text" }, fixedBy: "UI-SPEC S12" },
  ],
  "overview.alert.overflow": ["{remaining} more in the calendar.", { slots: { remaining: "text" }, fixedBy: "REQ-041 c5" }],
  "overview.alerts.empty": ["Nothing needs you today.", { slots: {}, fixedBy: "REQ-041 c5" }],

  // ── The one supply statement Overview may make, resolved in this order.
  "overview.supply.exhausted": ["No pages are left worth writing. Monday’s re-measure looks for more.", { slots: {}, fixedBy: "REQ-095 c3" }],
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
}) satisfies CopyPartition;
