// src/lib/config/constants/ui.ts — Overview's goals and windows, the editor's intervals and the Web Vitals budget. Imports nothing.

/** Overview's headline goal **values** (BP-038). Numbers only: BP-038's `GOALS`
 *  pairs each with its copy key and is the one home of the pairing, so this file
 *  stays free of `CopyKey` and keeps importing nothing.
 *  BP-038 decision 2's derivation, verbatim:
 *  - `searches_appeared_in = 400` — `BUILD.md` §4.5's footnote pair, "start
 *    value · At 400 the big category terms unlock."
 *  - `ai_answers = 6` — `BUILD.md` §4.5's AI-answers tile, "dashed goal dots
 *    + goal: 6", out of the twelve tracked questions.
 *  - `score = 50` — `BUILD.md` §5's band boundaries; 50 is the first score at
 *    which the product's own verdict changes from not-findable to findable.
 *  - `pages_published = 30` — **not derivable; ruled by the owner on
 *    2026-08-31**: a month of daily pages, the product's own promise of one
 *    page a day (REQ-056 c8), sustained for a month. It is no longer
 *    optional, and BP-038 renders that tile's goal like the other three. */
export const GOAL_VALUES = Object.freeze({
  searches_appeared_in: 400, ai_answers: 6, score: 50,
  pages_published: 30,          // owner ruling, 2026-08-31 — a month of daily pages
} as const);

// ── Overview (issue #15) — BUILD §4.5
/** The point below which a rival-to-customer ratio misleads more than it
 *  informs. §6.6, verbatim: "The ratio module unlocks at ranked ≥ 10 with
 *  copy 'now comparable'" — and, above it, the reason there is a threshold
 *  at all: "when the customer's count is 0, render the rivals' absolute
 *  numbers with `you: 0` — **never a ratio** (division by zero renders as
 *  ∞× and reads as broken)". Transcribed, not chosen. */
export const RATIO_UNLOCK = 10 as const;                      // §6.6

/** The fixed trailing window Overview reads its two week-counted readings
 *  over: the weekly points the growth chart draws, and — since the owner's
 *  ruling of 2026-09-03 (DECISIONS) — the AI-answers tile's one reading,
 *  "in how many of a fixed trailing window of weeks the customer was named
 *  in at least one tracked question's AI answer". Twelve weeks is a
 *  quarter of weekly measurement, and it is what makes
 *  `GOAL_VALUES.ai_answers = 6` read as half the window; one number, so the
 *  chart and the tile can never disagree about which weeks they mean. */
export const OVERVIEW_TRAILING_WEEKS = 12 as const;           // BUILD §4.5 · DECISIONS 2026-09-03

/** SPEC §6 (owner, 2026-09-20, #908): the AI-answers tab states "a rolling
 *  four-week rate — answers that name or link the site over all answers
 *  asked". Four weekly passes, and not the twelve above: the window exists
 *  because one week of twelve questions is too small a sample to read a
 *  direction from, and the tab's own sentence says so. A separate pin
 *  because it is a separate reading — the tile over it counts *answers*,
 *  where `OVERVIEW_TRAILING_WEEKS` counts *weeks*. */
export const ANSWER_RATE_WEEKS = 4 as const;                  // SPEC §6 2026-09-20

/** SPEC §4 (owner, 2026-10-15, issue 1457): Overview's Content tile states
 *  the pages published in this many recent weeks beside the total, and
 *  Plan's *Published* list counts the same weeks. */
export const CONTENT_RECENT_WEEKS = 4 as const;               // SPEC §4 2026-10-15

/** SPEC §6 (owner, D58 of 2026-10-06, issue 1287): no mention rate is shown
 *  until this many weeks of the current prompt set exist. Before then the
 *  count and its sample stand in its place ("0 of 46 answers"). */
export const MENTION_RATE_MIN_WEEKS = 2 as const;             // SPEC §6 2026-10-06 D58

/** SPEC §7 (owner, D59 of 2026-10-06, issue 1287): a context pack drops a
 *  rival pricing fact read more than this many days ago. */
export const RIVAL_PRICE_MAX_AGE_D = 30 as const;             // SPEC §7 2026-10-06 D59

/** BUILD §4.5, verbatim: "up to two alerts". The remainder is stated as a
 *  count with where to see it, never as a third alert. */
export const OVERVIEW_ALERT_CAP = 2 as const;                 // BUILD §4.5

// ── The draft editor's two intervals (issue #17) — BUILD §4.6
/** BUILD §4.6's autosave, in milliseconds. The archived BP-044 `## NFR
 *  budget` derives it: "criterion 6 triggers on 'pauses or leaves the
 *  view'; 1200 ms is above ordinary inter-keystroke pauses and below the
 *  interval at which a customer starts to feel their work is at risk."
 *  A pause of this length issues one save; blur and leaving the view flush
 *  immediately, so the number bounds the pause and never the departure. */
export const AUTOSAVE_DEBOUNCE_MS = 1200 as const;             // BP-044 · BUILD §4.6

/** BUILD §4.6's live preview pane, in milliseconds. Same source: "preview
 *  re-renders at most every 100 ms and runs entirely client-side, so 'as
 *  they type' costs no round trip." It is a ceiling on re-render, never on
 *  the edit itself — the textarea is never debounced. */
export const PREVIEW_DEBOUNCE_MS = 100 as const;               // BP-044 · BUILD §4.6

// ── The Core Web Vitals budget (issue #332)
/**
 * The three ceilings the two surfaces a stranger meets are held to: the
 * landing page (`/`) and the free report (`/scan/{domain}`).
 *
 * **Chosen, not transcribed (rule 1.2).** No clause in `BUILD.md`,
 * `DECISIONS.md` or `DATA-COSTS.md` rules a page-speed number — BP-018's
 * `## NFR budget` is the nearest thing the corpus has and it budgets *what
 * ships* ("no chart library, so no runtime dependency ships to the browser
 * for a five-chart inventory"), never how fast it arrives. Two of the three
 * are the published "good" thresholds of the Core Web Vitals as issue #332
 * states them; the third is the script weight that issue chose. They are
 * pinned here rather than left in the suite that measures them because a
 * budget nobody can find is a budget nobody raises on purpose.
 *
 * The unit of each is written into its name, because a budget read in the
 * wrong unit is a budget that never fires:
 *   - `LCP_MS` — Largest Contentful Paint, milliseconds from navigation.
 *   - `CLS` — Cumulative Layout Shift, the unitless session-window score.
 *   - `LANDING_SCRIPT_KB` — the script bytes `/` transfers over the wire,
 *     in kilobytes of 1000. Only `/` carries it: the issue names one route
 *     ("JS ≤ 200 kB on `/`"), the landing page is the one surface a
 *     stranger loads cold, and the report's own weight is its data.
 *
 * `tests/ui/layout/vitals.test.ts` is what measures them, in the same real
 * Chromium the layout sweep uses and against the same built-and-served app.
 */
export const WEB_VITALS_BUDGET = Object.freeze({              // #332 (chosen)
  LCP_MS: 2500,
  CLS: 0.1,
  LANDING_SCRIPT_KB: 200,
} as const);
