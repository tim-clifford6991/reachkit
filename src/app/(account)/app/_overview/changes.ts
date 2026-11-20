// BUILD §4.5, §2.4 — where a series stops being one series.
//
// REQ-071 c12 and c13: a difference measured across a date the site's
// answers changed is not movement, and may not be drawn, counted or
// described as though it were. `src/lib/market/changes/markers.ts` supplies
// those dates; this file is where the Overview's series learn to stop at
// them.
//
// **A marker is not a sixth chart** (§2.4's inventory is closed). It is the
// break the two week-spanning forms already draw: `GrowthLine` cuts its run
// at a week with no value and leaves the gap standing (#386 — the set
// draws nothing in it), and `RivalSparkline` does the same on a `null`. A
// change marker takes exactly that shape — a column of its own, carrying
// the account of why the run stops, in the mark's own tooltip — so nothing
// new is invented and no series is joined across one.
//
// **The marker gets its own column rather than a flag on the week after
// it.** A flag would put the break *inside* a week that was measured,
// which reads as that week being partly one market and partly the other.
// The change happened between two measurements, and a column between them
// is where it belongs — which is also the one place the existing form can
// draw it.
import type { CopyKey } from "@/lib/presentation/copy";
import type { ChangeMarker, MarkerKind } from "@/lib/market/changes/markers";
import { weekStartFor } from "@/lib/scan/weekly/week";

/** The written account each kind of change puts on its break. One key per
 *  kind and no default: a change this screen cannot name is a change it
 *  must not draw a nameless rule for. */
export const CHANGE_ACCOUNT_KEY: Readonly<Record<MarkerKind, CopyKey>> = Object.freeze({
  domain: "overview.change.domain",
  category: "overview.change.category",
  rivals: "overview.change.rivals",
  locale: "overview.change.locale",
});

/** One entry of a series as the screen draws it: a measured week, or the
 *  break a change stands in. `T` is whatever the caller's own week is, so
 *  the growth series and the AI window share this shape without sharing a
 *  value type. */
export type SeriesEntry<T> =
  | { kind: "week"; week: T }
  | { kind: "break"; marker: ChangeMarker };

/**
 * The caller's weeks, with a break standing between every pair a change
 * fell between.
 *
 * `startOf` reads a week's own Monday. A marker belongs *before the week it
 * was measured in* — that week is the first one under the new answer, which
 * is exactly what `weeksSinceChange` counts from, because both ask
 * `weekStartFor` in the site's zone: the count and the drawing cannot
 * disagree about which side of the break a week is on.
 *
 * A marker before every week it could break (a change older than the whole
 * window) draws nothing: there is no earlier run for it to separate this
 * one from, and a rule at the left edge would claim a run that is not on
 * the chart. The same for a marker after the last week.
 */
export function withBreaks<T>(
  weeks: readonly T[],
  changes: readonly ChangeMarker[],
  startOf: (week: T) => Date,
  zone: string
): readonly SeriesEntry<T>[] {
  if (weeks.length === 0) return [];
  const ordered = [...changes].sort((a, b) => a.on.getTime() - b.on.getTime());
  const out: SeriesEntry<T>[] = [];

  weeks.forEach((week, index) => {
    if (index > 0) {
      const previous = storedWeek(startOf(weeks[index - 1] as T));
      const current = storedWeek(startOf(week));
      for (const marker of ordered) {
        const changed = weekStartFor({ at: marker.on, zone });
        if (changed > previous && changed <= current) {
          out.push({ kind: "break", marker });
        }
      }
    }
    out.push({ kind: "week", week });
  });

  return out;
}

/** A drawn week's stored `week_start`, read back from the instant it is drawn at. */
export function storedWeek(weekStart: Date): string {
  return weekStart.toISOString().slice(0, 10);
}

/**
 * Whether any change falls inside the span these two **readings** cover —
 * the question a card asking "how does this compare with before?" has to
 * ask before it answers (REQ-071 c12).
 *
 * **On the instants, not on the weeks, and that is not an inconsistency
 * with `withBreaks`.** They answer different questions. A weekly series
 * asks *which week* a change belongs to, and the answer is the week it was
 * measured in — a series has no finer grain than a week. Two readings ask
 * *which side of the change each was taken on*, and they carry the
 * instants they were taken at: a reading from Monday and a change from
 * Thursday of the same week are on opposite sides of it, and comparing
 * them would cross it. Rounding both to the week here would hide exactly
 * that case.
 */
export function changeWithin(
  weeks: readonly Date[],
  changes: readonly ChangeMarker[]
): ChangeMarker | null {
  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  if (first === undefined || last === undefined) return null;
  return changes.find((marker) => marker.on > first && marker.on <= last) ?? null;
}
