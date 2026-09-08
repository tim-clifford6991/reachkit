// tests/ui/layout/seed-rows.ts
//
// The rows the layout sweep's seed writes, as values rather than as SQL.
//
// Split out of `seed.ts` for one reason (issue #295): these are pure data
// and pure functions, and the assertion that they are shapes §7 could have
// produced belongs in the `node` project — which runs with no environment
// bindings at all, while `seed.ts` reaches `src/lib/scan/report` and so
// parses `src/lib/config/env.ts` the moment it is imported. `seed.ts`
// re-exports everything here, so no other file learns that this file exists.

/**
 * The live account's drafts, one per state the `/app` screens draw
 * differently (#206).
 *
 * Three states because that is what the shell, the overview and the
 * calendar each read for: a page in review is what the draft address
 * renders and what the veto window counts, a published one is what the
 * overview's "live" reads, and a planned one is what the calendar draws on
 * a future date. One state would leave two of the three live reads
 * rendering an empty arm, which is not the layout this sweep is here to
 * measure.
 */
export const LIVE_DRAFTS: readonly {
  id: string;
  state: string;
  title: string;
  /** Days from today, in the site's own zone, that this page sits on
   *  (issue #269).
   *
   *  **Without one the calendar has nothing to draw.** `scheduledPagesFor`
   *  selects `drafts` on `scheduled_for` between the month's ends, so a
   *  draft with a null date lands on no cell: every day was an empty-day
   *  account, every stage filter read `0` — correctly, since the counts are
   *  derived from the very cells the grid renders — and the calendar's
   *  *populated* arm had never been rendered by any sweep. Three dates in
   *  the current month, so the grid carries a page in three different
   *  stages and the filters have something to count. */
  scheduledIn: number;
}[] = Object.freeze([
  { id: "00000000-0000-0000-0000-0000000000e1", state: "in_review", title: "How teams pick an onboarding tool", scheduledIn: 1 },
  { id: "00000000-0000-0000-0000-0000000000e2", state: "published", title: "Onboarding checklists that survive week one", scheduledIn: -2 },
  { id: "00000000-0000-0000-0000-0000000000e3", state: "planned", title: "What to measure after a rollout", scheduledIn: 3 },
]);

/** A `scheduled_for` date, `days` from today, as the column stores it.
 *  Computed at midday UTC so a zone either side of it cannot land the date
 *  on the day before or after.
 *
 *  **One clock read, not three** (issue #295). The year, month and day used
 *  to come from three separate `new Date()` calls, so a run that crossed
 *  UTC midnight between the first and the third composed a date out of two
 *  different days — the rarest possible flake, and one nothing would have
 *  explained afterwards. */
export function scheduledFor(days: number): string {
  const now = new Date();
  const midday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12);
  return new Date(midday + days * 86_400_000).toISOString().slice(0, 10);
}

/** The instant every seeded opportunity's evidence was measured at.
 *
 *  Fixed, and deliberately not read off the clock: the calendar's store
 *  puts this date straight onto the day panel's provenance line
 *  (`measuredAtOf`), so a date derived from today would move a rendered
 *  sentence — and the committed baseline under it — on every run. */
export const EVIDENCE_MEASURED_AT = "2026-08-24T09:00:00.000Z";

/** The demand the `index`-th seeded opportunity was chosen on. Distinct per
 *  index so `rankOpen` has a strict order to return rather than a
 *  three-way tie broken by whichever `created_at` the inserts happened to
 *  land on — the order the month's days are filled in is then the same on
 *  every run. */
export function seededVolume(index: number): number {
  return 1900 - index * 500;
}

/**
 * §7's Write evidence, whole, for the `index`-th seeded opportunity.
 *
 * **Whole is the point** (issue #295). This used to be `{"family":"write"}`
 * and nothing else, which is not an `Evidence` any part of §7 could have
 * written: the type's Write arm carries `query`, `volume` and `rival`, and
 * `readOpportunity` hands the object it read back as one without checking.
 * The calendar's `measuredAtOf` then read `.at` off an absent `volume` and
 * the whole route threw — so `/app/calendar` on the live sweep was Next's
 * own error page, with none of the app's stylesheet on it, from the first
 * baseline that was ever taken of it.
 */
export function writeEvidence(index: number): string {
  const at = EVIDENCE_MEASURED_AT;
  return JSON.stringify({
    family: "write",
    query: `onboarding tools ${index}`,
    volume: { kind: "measured", value: seededVolume(index), at },
    rival: {
      domain: "appcues.com",
      url: { kind: "measured", value: `https://appcues.com/onboarding-tools-${index}`, at },
      position: { kind: "measured", value: index + 2, at },
    },
  }).replaceAll("'", "''");
}

/** §7's acceptance test for the same row. `{"check": "..."}` was not one of
 *  the three forms either: `doneWhen` fell through both named arms to
 *  `gate_cleared`, which is the one form a Write row can never carry. */
export function acceptanceFor(index: number): string {
  return JSON.stringify({ form: "top20", query: `onboarding tools ${index}` }).replaceAll("'", "''");
}
