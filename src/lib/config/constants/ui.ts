// src/lib/config/constants/ui.ts — Overview's goals and windows, the editor's intervals and the Web Vitals budget. Imports nothing.

/** Overview's headline goal values. Numbers only: `GOALS` pairs each with its
 *  copy key, so this file stays free of `CopyKey` and keeps importing nothing.
 *  - `searches_appeared_in` 400: the point at which the big category terms unlock.
 *  - `ai_answers` 6: half of `OVERVIEW_TRAILING_WEEKS`.
 *  - `score` 50: the first score at which the verdict changes from
 *    not-findable to findable (`SCORE_BAND_BOUNDS.findable`).
 *  - `pages_published` 30: a month of daily pages. */
export const GOAL_VALUES = Object.freeze({
  searches_appeared_in: 400, ai_answers: 6, score: 50,
  pages_published: 30,
} as const);

// ── Overview — BUILD §4.5
/** Below this many ranked keywords a rival-to-customer ratio misleads more
 *  than it informs, and at 0 it would divide by zero: the module shows the
 *  rivals' absolute numbers instead of a ratio. */
export const RATIO_UNLOCK = 10 as const;

/** The fixed trailing window Overview reads its two week-counted readings
 *  over: the weekly points the growth chart draws, and the AI-answers tile's
 *  count of weeks in which the customer was named in at least one tracked
 *  answer. One number, so the chart and the tile can never disagree about
 *  which weeks they mean. */
export const OVERVIEW_TRAILING_WEEKS = 12 as const;

/** SPEC §6: the AI-answers tab's rolling four-week rate, answers that name or
 *  link the site over all answers asked. Four weeks because one week of
 *  twelve questions is too small a sample to read a direction from. A
 *  separate pin because the tile over it counts answers, where
 *  `OVERVIEW_TRAILING_WEEKS` counts weeks. */
export const ANSWER_RATE_WEEKS = 4 as const;

/** SPEC §4: Overview's Content tile states the pages published in this many
 *  recent weeks beside the total, and Plan's *Published* list counts the same
 *  weeks. */
export const CONTENT_RECENT_WEEKS = 4 as const;

/** SPEC §6 (D58): no mention rate is shown until this many weeks of the
 *  current prompt set exist. Before then the count and its sample stand in
 *  its place ("0 of 46 answers"). */
export const MENTION_RATE_MIN_WEEKS = 2 as const;

/** SPEC §7 (D59): a context pack drops a rival pricing fact read more than
 *  this many days ago. */
export const RIVAL_PRICE_MAX_AGE_D = 30 as const;

/** Up to two alerts; the remainder is stated as a count with where to see
 *  it, never as a third alert. */
export const OVERVIEW_ALERT_CAP = 2 as const;

// ── The draft editor's two intervals — BUILD §4.6
/** Autosave, in milliseconds: above ordinary inter-keystroke pauses and
 *  below the point at which a customer feels their work is at risk. A pause
 *  of this length issues one save; blur and leaving the view flush
 *  immediately, so the number bounds the pause and never the departure. */
export const AUTOSAVE_DEBOUNCE_MS = 1200 as const;

/** The live preview re-renders at most this often, in milliseconds, entirely
 *  client-side. A ceiling on re-render, never on the edit itself: the
 *  textarea is never debounced. */
export const PREVIEW_DEBOUNCE_MS = 100 as const;

// ── The Core Web Vitals budget
/**
 * The three ceilings the two surfaces a stranger meets are held to: the
 * landing page (`/`) and the free report (`/scan/{domain}`). Two are the
 * published "good" Core Web Vitals thresholds; the script weight is chosen.
 * Pinned here because a budget nobody can find is a budget nobody raises on
 * purpose.
 *
 * The unit is in each name, because a budget read in the wrong unit never fires:
 *   - `LCP_MS` — Largest Contentful Paint, milliseconds from navigation.
 *   - `CLS` — Cumulative Layout Shift, the unitless session-window score.
 *   - `LANDING_SCRIPT_KB` — the script bytes `/` transfers over the wire, in
 *     kilobytes of 1000. Only `/` carries it: it is the one surface a stranger
 *     loads cold, and the report's own weight is its data.
 *
 * `tests/ui/layout/vitals.test.ts` measures them in the layout sweep's
 * Chromium against the same built-and-served app.
 */
export const WEB_VITALS_BUDGET = Object.freeze({
  LCP_MS: 2500,
  CLS: 0.1,
  LANDING_SCRIPT_KB: 200,
} as const);
