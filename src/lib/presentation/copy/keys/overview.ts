// src/lib/presentation/copy/keys/overview.ts — BP-020 decision 5, WO-041
//
// Overview's sentences. Three keys seeded (WO-041 step 3): the
// no-presence-yet lines for the weekly-presence chart, week and
// partial-week states. Empty value, owner-owed — no string is written here
// (constitution §1). The block that owns Overview fills every other
// sentence this surface needs.
//
// 2026-09-05: issue #9 (BUILD §4.4) adds `overview.head` — the one written
// line this screen states inside the app shell until its own content lands
// (issue #15, §4.5). Owner-owed and empty: it is a customer-visible sentence
// (constitution §1).
//
// 2026-09-05, separately: issue #15 (BUILD §4.5, as amended by DECISIONS
// 2026-09-03) builds the screen itself and adds the keys its five modules
// speak. Two categories, and the line between them is the one issue #9's own
// keys already drew:
//
//   **Owner-owed and empty** — every composed sentence: the three further
//   head lines and the badge, the two goal-meaning lines this screen says in
//   its own words, the AI-answers window reading, the cold-start rival line,
//   the four alert lines and the three supply lines. Nothing invents one.
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
// the ones `src/lib/presentation/place/` registers as places. They stay
// owner-owed and empty on this screen's own rule, above — a marker is the
// right standing for a key a screen must render something for, and Overview
// reads these through `writtenLine`. `account()` therefore throws naming the
// key rather than handing a place a blank.
import type { CopyPartition } from "../registry.ts";

export const OVERVIEW_COPY = Object.freeze({
  "place.overview.weekly-presence.chart": [
    "TODO(copy)",
    { law: "no-presence-yet", slots: {}, fixedBy: "REQ-041 c3" },
  ],
  "place.overview.weekly-presence.week": [
    "TODO(copy)",
    { law: "no-presence-yet", slots: {}, fixedBy: "REQ-065 c3" },
  ],
  "place.overview.weekly-presence.partial-week": [
    "TODO(copy)",
    { law: "no-presence-yet", slots: {}, fixedBy: "REQ-065 c4" },
  ],
  "overview.head": ["TODO(copy)", { slots: {}, fixedBy: "BUILD §4.5" }],

  // ── The head: one line per direction the stored series shows, and the
  // badge §4.5 puts beside it. Four lines, not one: §4.5's "The gap is
  // closing." is a claim about the chart directly under it, and a screen
  // that states it over a widening gap has said something untrue.
  "overview.head.rising": ["The gap is closing.", { slots: {}, fixedBy: "BUILD §4.5" }],
  "overview.head.flat": ["TODO(copy)", { slots: {}, fixedBy: "BUILD §4.5" }],
  "overview.head.falling": ["TODO(copy)", { slots: {}, fixedBy: "BUILD §4.5" }],
  // Approved as written (ruling 11a): the set's badge claims every week
  // and names no number, so the `weeks` slot goes with the wording rather
  // than staying declared and unfilled — a slot the value never spends is
  // a promise the registry cannot keep (`registry.test.ts` substitutes
  // every declared slot and asserts it lands).
  "overview.head.badge": ["▲ every week since you started", { slots: {}, fixedBy: "UI-SPEC S12" }],

  // ── The growth module.
  "overview.growth.footnote.start": ["started at {value}", { slots: { value: "text" }, fixedBy: "BUILD §4.5" }],
  "overview.growth.footnote.goal": [
    "At {goal} the big category terms unlock.",
    { slots: { goal: "text" }, fixedBy: "BUILD §4.5" },
  ],

  // ── The three tiles (DECISIONS 2026-09-03: no composite score tile).
  // Each name is §4.5's own; each meaning line is the owner's.
  "overview.tile.searches.label": ["Searches you appear in", { slots: {}, fixedBy: "BUILD §4.5" }],
  "overview.tile.ai-answers.label": ["AI answers", { slots: {}, fixedBy: "BUILD §4.5" }],
  "overview.tile.ai-answers.window": [
    "TODO(copy)",
    { slots: { weeks: "text", of: "text" }, fixedBy: "REQ-041 c12" },
  ],
  "overview.tile.ai-answers.means": ["TODO(copy)", { slots: {}, fixedBy: "REQ-041 c4" }],
  "overview.tile.pages.label": ["Pages published", { slots: {}, fixedBy: "BUILD §4.5" }],
  "overview.tile.pages.means": ["TODO(copy)", { slots: {}, fixedBy: "REQ-041 c4" }],

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
  "overview.rivals.line.absolute": ["TODO(copy)", { slots: {}, fixedBy: "REQ-041 c9" }],

  // ── REQ-096 c6: a rival banded `far`, and the two sentences it needs.
  //
  // **The empty value, not the marker.** The general rule for a screen is
  // the renderable `TODO(copy)` (the 2026-09-05 ruling on #93), but this
  // screen took the stricter one and asserts it: `tests/app/overview/
  // page.test.tsx` — "no owner-owed key renders anything at all — not a
  // placeholder, not a TODO". Overview reads every line through
  // `writtenLine`, which answers `null` for an owed key, and the module
  // omits what it has no words for. `overview.rivals.line.absolute` above
  // has been owed on those terms since #15.
  //
  // So until these two are written, a `far` rival's row is exactly the row
  // it is today: its plot, its figure and its badge, with no line and no
  // control under it. That is the honest state — a control whose label
  // nobody has written cannot be rendered — and it is visible rather than
  // silent, because the registry's own count reports both keys as owed.
  //
  // **What the line must not say.** It says the rival is far beyond what
  // this customer could catch and why the distance to it will not move. It
  // does not name a replacement, does not suggest removing the rival, and
  // is not a verdict on the customer — REQ-096 c7 keeps the rival in the
  // set until the customer takes it out themselves.
  "overview.rivals.far.line": ["TODO(copy)", { slots: { rival: "text" }, fixedBy: "REQ-096 c6" }],
  // The one control c6 allows, and the whole of it: a word for "go to
  // where you can change who you are measured against". Never "remove".
  "overview.rivals.far.swap": ["TODO(copy)", { slots: {}, fixedBy: "REQ-096 c6" }],

  // ── This week.
  "overview.week.title": ["This week", { slots: {}, fixedBy: "BUILD §4.5" }],
  "overview.week.calendar-link": ["Open calendar →", { slots: {}, fixedBy: "BUILD §4.5" }],
  "overview.week.day.done": ["done", { slots: {}, fixedBy: "REQ-041 c6" }],
  "overview.week.day.today": ["today", { slots: {}, fixedBy: "REQ-041 c6" }],
  "overview.week.day.to-come": ["next", { slots: {}, fixedBy: "REQ-041 c6" }],

  // ── The alerts, and the one remainder line.
  "overview.alert.pending-veto": ["TODO(copy)", { slots: { title: "text" }, fixedBy: "REQ-041 c5" }],
  "overview.alert.pending-veto.action": ["Read it", { slots: {}, fixedBy: "BUILD §4.5" }],
  "overview.alert.needs-you": ["TODO(copy)", { slots: { title: "text" }, fixedBy: "REQ-041 c5" }],
  "overview.alert.needs-you.action": ["TODO(copy)", { slots: {}, fixedBy: "REQ-041 c5" }],
  "overview.alert.overflow": ["TODO(copy)", { slots: { remaining: "text" }, fixedBy: "REQ-041 c5" }],
  "overview.alerts.empty": ["TODO(copy)", { slots: {}, fixedBy: "REQ-041 c5" }],

  // ── The one supply statement Overview may make, resolved in this order.
  "overview.supply.exhausted": ["TODO(copy)", { slots: {}, fixedBy: "REQ-095 c3" }],
  "overview.supply.short": ["TODO(copy)", { slots: {}, fixedBy: "REQ-095 c5" }],
  "overview.supply.first-arrival": ["TODO(copy)", { slots: {}, fixedBy: "REQ-095 c6" }],

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
  "overview.change.domain": ["TODO(copy)", { slots: {}, fixedBy: "REQ-071 c12" }],
  "overview.change.category": ["TODO(copy)", { slots: {}, fixedBy: "REQ-071 c12" }],
  "overview.change.rivals": ["TODO(copy)", { slots: {}, fixedBy: "REQ-071 c12" }],
  // REQ-071 c13's other half: a card that compares two readings has to say
  // which span it compared over when a change falls inside it, rather than
  // quietly comparing across one.
  "overview.comparison.window": [
    "TODO(copy)",
    { slots: { since: "date" }, fixedBy: "REQ-071 c13" },
  ],
}) satisfies CopyPartition;
