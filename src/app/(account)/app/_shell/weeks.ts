// BUILD §4.4 — the domain block's "`Week n · re-measured Mon`".
//
// REQ-040 criterion 6: the week count is "counted from the first weekly
// measurement of that domain — and where the customer has changed the
// domain, the count starts again at the first measurement of the new domain
// … That number is never larger than the number of weeks in which the site
// was measured: a week that ran and measured something advances it, a week
// that produced no measurement at all … does not."
//
// Criterion 7: with no measurement yet, "no week count is stated and in its
// place the domain block carries one written line saying this domain has not
// been measured yet and naming the date its first measurement is due."
//
// So: distinct measured weeks, for the *current* domain, computed — never a
// stored counter (which a domain change would have to remember to reset) and
// never elapsed weeks (which overstate whenever a week produced nothing).

/** One site-local week of weekly measurement (BUILD §11, ADR-060), as the
 *  shell needs to count it. `measured` is REQ-065 c3's own distinction: a
 *  week that ran and produced something, versus one that "has not been
 *  measured". A partially measured week is `true` — it produced something. */
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-07: Overview reads the measured weeks in one query (readWeekScans): a week
//   with no row is unmeasured, never zero; the window starts at the first measured week; false
//   and null are different AI-answer weeks (measured-and-not-named vs never measured);
//   weeksMeasured counts from the last change by week; the series carries changeMarkers for
//   #205 to draw; the rival set stays unmeasured until its own gated change. — #222

export interface MeasuredWeek {
  /** The domain the week was measured for. A week measured for a domain the
   *  customer has since changed away from is not this domain's week. */
  domain: string;
  /** The week's own start (site-local Monday, `WEEK_START`). Two rows with
   *  the same start are one week. */
  weekStart: Date;
  measured: boolean;
}

export type WeekCount =
  | { kind: "counted"; weeks: number; lastMeasuredOn: Date }
  | { kind: "none"; firstDueOn: Date };

/**
 * REQ-040 c6's rule, isolated so it has exactly one implementation.
 *
 * `firstDueOn` is supplied by the caller rather than computed here: the
 * weekly clock is §11's (`nextDueOn`, issue #41), and the shell and Overview
 * stating two different dates for the same due measurement is precisely what
 * a second implementation would produce.
 */
export function weeksMeasured(input: {
  domain: string;
  weeks: readonly MeasuredWeek[];
  firstDueOn: Date;
}): WeekCount {
  const starts = new Map<number, Date>();
  for (const week of input.weeks) {
    if (week.domain !== input.domain) continue;
    if (!week.measured) continue;
    starts.set(week.weekStart.getTime(), week.weekStart);
  }
  if (starts.size === 0) return { kind: "none", firstDueOn: input.firstDueOn };

  const latest = [...starts.keys()].reduce((a, b) => (a > b ? a : b));
  return { kind: "counted", weeks: starts.size, lastMeasuredOn: new Date(latest) };
}
