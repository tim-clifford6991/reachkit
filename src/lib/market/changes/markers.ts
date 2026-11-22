// BUILD §4.7 — the dates every series, verdict and week count breaks at.
//
// REQ-071 c12 and c13 forbid presenting the difference across a change as
// movement, in any form. Every chart that spans such a date is broken at it.
//
// The markers are derived from the stored reports a screen has already read,
// each of which carries the domain, category and locale it measured under
// (ADR-030 point 5). There is no change-log table: it would be a second
// record of a fact the reports already carry.
import { localeKey, measuredLocale } from "@/lib/locale/locales";
import type { ChangeKind } from "./declared";

/** The answers a series breaks at: the three declared ones, and the
 *  country and language a pass measured in (SPEC §6, D66). */
export type MarkerKind = ChangeKind | "locale";

/** A date a series must break at, and which answer changed on it: the
 *  first measurement taken under the new answer. */
export interface ChangeMarker {
  kind: MarkerKind;
  on: Date;
}

/** The part of a stored report a marker is read from. */
export interface MeasuredReport {
  domain: string;
  /** `null` on a report written before the pass recorded it, which marks nothing. */
  measuredCategory: string | null;
  locale?: { country?: unknown; language?: unknown } | undefined;
  verdict: { measuredAt: Date };
}

/**
 * Every date at which an answer changed between adjacent reports, oldest
 * first. A marker sits on the later report of each pair that disagrees;
 * the first report carries none, since nothing preceded it. The rival set
 * is deliberately not a marker kind: c8 shows the current set from the next
 * re-measurement rather than breaking every chart.
 */
export function changeMarkers(reports: readonly MeasuredReport[]): ChangeMarker[] {
  const markers: ChangeMarker[] = [];
  for (let i = 1; i < reports.length; i += 1) {
    const previous = reports[i - 1]!;
    const current = reports[i]!;
    const on = current.verdict.measuredAt;
    if (current.domain !== previous.domain) markers.push({ kind: "domain", on });
    // A category never named on one side is not a change.
    if (
      current.measuredCategory !== null &&
      previous.measuredCategory !== null &&
      current.measuredCategory !== previous.measuredCategory
    ) {
      markers.push({ kind: "category", on });
    }
    if (localeKey(measuredLocale(current)) !== localeKey(measuredLocale(previous))) markers.push({ kind: "locale", on });
  }
  return markers;
}
