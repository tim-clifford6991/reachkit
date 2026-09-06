// BUILD §9 — judgeWeek: one site's week, judged once, from that week's
// measurement alone.
//
// §9: "Monday → full re-measure; each published page gets Working / Too
// early / Not working against its acceptance test. A regression is shown,
// never hidden."
//
// **The terminality short-circuit is the first thing this file does, and
// it is written first on purpose.** For each page, one look at the history
// for an existing `not_judgeable` row; where there is one, the same cause
// and the same `lastJudgedWeek` are emitted and *nothing is evaluated*.
// Writing it later means writing an evaluation path that has to be un-run,
// and re-ordering it — evaluate first, check the row second — is invisible
// on every screen. `terminal.test.ts` fails on that re-ordering.
//
// **Do not write a lift condition for any cause.** The branch that judges
// a page again once its search comes back into the tracked set will
// present as a *bug report* — the page is live, the search is back, the
// customer is paying, and the screen says no longer judgeable — and
// REQ-063 c6 forbids it in terms. Its criterion 7, the resumption path,
// was withdrawn outright on 2026-09-01 and its number was not reused, so a
// citation to it dangles rather than pointing at a softer promise. Read
// ADR-072 before touching this file.
//
// **It fetches nothing.** No page's address is visited here, this week or
// any week (REQ-063's non-goal). `page_not_found` is read from what the
// one check at 24 hours recorded and is derived nowhere; a
// `could_not_confirm` is not retried, not folded into a failed
// `reachable`, and not routed to `not_judgeable` — it leaves the page
// fully judged with a note beside its verdict (ADR-085).
//
// `no_week` is a property of the **week**, not of the page: it is returned
// once per page only so the returned type is uniform, and a surface or a
// mail states it once for the week and never once per page (ADR-071
// point 3).
import type { Measured } from "@/lib/measure/measured";
import { evaluateAcceptance } from "./evaluate";
import { weekMeasurementsFrom } from "./measurements";
import { movementFor } from "./movement";
import {
  noteFor,
  verdictStore,
  type PublishedPage,
  type VerdictInsert,
  type VerdictRecord,
} from "./store";
import type {
  NotJudgeableCause,
  WeekMeasurements,
  WeekStanding,
  WeekStart,
} from "./types";
import { verdictFor } from "./verdict";

export interface PageStanding {
  readonly publicationId: string;
  readonly standing: WeekStanding;
}

/**
 * The week's judgement for one site. Idempotent per (site, week): the
 * unique key on `page_verdicts` is what makes it so, not a guard here, so
 * a second delivery of the weekly tick inserts nothing further and mints
 * no second verdict.
 */
export async function judgeWeek(a: {
  siteId: string;
  week: WeekStart;
}): Promise<{ standings: readonly PageStanding[] }> {
  const store = verdictStore();
  const pages = await store.publishedPages(a.siteId);
  if (pages.length === 0) return { standings: [] };

  const history = await store.historyBefore({ siteId: a.siteId, week: a.week });
  const byPage = groupByPage(history);

  // The week's own measurement, and no other week's. A verdict is a fact
  // about the week it was taken in; reading any other measurement is what
  // REQ-063's first non-goal forbids.
  const week = await store.weekReport({ siteId: a.siteId, week: a.week });
  if (week === null) {
    // REQ-065 c3's unmeasured week: **no rows at all**, and every page
    // reads `no_week`. There is nowhere to write a week that was not
    // measured, which is what stops one missed Monday being recorded as a
    // permanent state (ADR-071 point 2).
    return { standings: pages.map((page) => ({ publicationId: page.publicationId, standing: NO_WEEK })) };
  }
  const measurements = weekMeasurementsFrom({ report: week.report, week: a.week });

  const standings: PageStanding[] = [];
  const rows: VerdictInsert[] = [];

  for (const page of pages) {
    const priorRows = byPage.get(page.publicationId) ?? [];
    const decided = judgeOne({ page, measurements, week: a.week, priorRows });
    standings.push({ publicationId: page.publicationId, standing: decided.standing });
    if (decided.row !== null) {
      rows.push({ ...decided.row, siteId: a.siteId, week: a.week, scanId: week.scanId });
    }
  }

  await store.insert(rows);
  return { standings };
}

const NO_WEEK: WeekStanding = Object.freeze({ kind: "no_week" as const });
const NOT_MEASURED: WeekStanding = Object.freeze({ kind: "not_measured" as const });

/** The insert this page earns, minus the three members that are the same
 *  for every row of one run. */
type RowBody = Omit<VerdictInsert, "siteId" | "week" | "scanId">;

interface OnePage {
  readonly standing: WeekStanding;
  /** `null` where nothing is written: `not_measured` has no row shape, and
   *  a page already retired is not retired a second time. */
  readonly row: RowBody | null;
}

/**
 * One page's standing for one week.
 *
 * Order is load-bearing throughout: the short-circuit, then the three
 * causes this node holds that `evaluateAcceptance` cannot observe, then
 * the evaluation, then the verdict, then the movement. A cause found
 * before evaluation is a page not evaluated.
 */
function judgeOne(a: {
  page: PublishedPage;
  measurements: WeekMeasurements;
  week: WeekStart;
  priorRows: readonly VerdictRecord[];
}): OnePage {
  const { page } = a;
  const lastJudgedWeek = lastVerdictWeek(a.priorRows);

  // 1. **The terminality short-circuit, before any evaluation whatever.**
  //    Same cause, same `lastJudgedWeek`, no row: the page was retired in
  //    an earlier week and nothing restores it (ADR-072 decision 5c). It
  //    is not re-inserted, so the row that retired it stays the one row
  //    that did.
  const retired = a.priorRows.find((row) => row.verdict === "not_judgeable" && row.cause !== null);
  if (retired !== undefined && retired.cause !== null) {
    return { standing: notJudgeable(retired.cause, lastJudgedWeek), row: null };
  }

  // 2. The three causes this node supplies and `evaluateAcceptance`
  //    cannot: they are stored state and a stored record, not readings of
  //    a measurement. `page_not_found` is read from what the one check at
  //    24 hours recorded and from nothing else — this file issues no
  //    request of any kind.
  const held = heldCause(page, a.measurements);
  if (held !== null) {
    return {
      standing: notJudgeable(held, lastJudgedWeek),
      row: { publicationId: page.publicationId, verdict: "not_judgeable", cause: held, measuredAt: null, measured: null, movement: null },
    };
  }

  // 3. The recorded test, against what this week measured.
  const evaluation = evaluateAcceptance({ acceptance: page.acceptance, week: a.measurements });
  if (!evaluation.decided) {
    if ("cause" in evaluation) {
      return {
        standing: notJudgeable(evaluation.cause, lastJudgedWeek),
        row: {
          publicationId: page.publicationId,
          verdict: "not_judgeable",
          cause: evaluation.cause,
          measuredAt: null,
          measured: null,
          movement: null,
        },
      };
    }
    // REQ-063 c5's second half: this week measured too little to decide
    // this page. **No row** — a transient miss has nowhere to be written
    // down, so it cannot become permanent.
    return { standing: NOT_MEASURED, row: null };
  }

  const verdict = verdictFor({
    passes: evaluation.passes,
    publishedAt: page.publishedAt,
    week: a.week,
  });

  const measured = measurementOf(page, a.measurements);
  const movement =
    measured === null
      ? null
      : movementFor({ previous: previousMeasurement(a.priorRows), current: measured, week: a.week });

  return {
    standing: {
      kind: "verdict",
      verdict,
      measuredAt: evaluation.measuredAt,
      movement,
      // c1: shown beside the verdict and never in place of one. It is
      // composed after the verdict, from the stored record, and is never
      // consulted while composing it.
      verifyNote: noteFor(page.verification),
    },
    row: {
      publicationId: page.publicationId,
      verdict,
      cause: null,
      measuredAt: evaluation.measuredAt,
      measured,
      movement,
    },
  };
}

function notJudgeable(cause: NotJudgeableCause, lastJudgedWeek: WeekStart | null): WeekStanding {
  return { kind: "not_judgeable", cause, lastJudgedWeek };
}

/**
 * The three causes that are stored state rather than a reading of this
 * week's measurement, in the order they are asked.
 *
 * `unpublished` first: a page the customer took down is not a page whose
 * domain we argue about. `page_not_found` is the record of the one check
 * at 24 hours, read and never re-taken; `could_not_confirm` is deliberately
 * **not** here — it is a `VerifyNote`, it leaves the page fully judged, and
 * adding it beside `page_not_found` is the tidy-up ADR-085 exists to stop.
 */
function heldCause(page: PublishedPage, week: WeekMeasurements): NotJudgeableCause | null {
  if (page.unpublishedAt !== null) return "unpublished";
  if (page.verification?.outcome === "page_not_found") return "page_not_found";
  if (page.domain !== week.domain) return "domain_changed";
  return null;
}

/** The figure this page's test was decided from, where its form yields
 *  one. Only `top20` does: a named-on question and a cleared gate are
 *  booleans, and REQ-063 c3's decline is about "the measurement for its
 *  target search". */
function measurementOf(page: PublishedPage, week: WeekMeasurements): Measured<number> | null {
  if (page.acceptance.form !== "top20") return null;
  return week.positions.get(page.acceptance.query) ?? null;
}

/** The most recent recorded measurement for this page — the figure the
 *  last verdict was actually taken at, which is what makes a gap in the
 *  series visible as `spansWeeks` rather than silently closed. */
function previousMeasurement(
  priorRows: readonly VerdictRecord[]
): { week: WeekStart; value: Measured<number> } | null {
  for (const row of priorRows) {
    if (row.measured !== null) return { week: row.week, value: row.measured };
  }
  return null;
}

/** REQ-063 c6's "the date of the last verdict it did receive — or, where
 *  it never received one, that it was never judged". `null` is that second
 *  half, and it is a value rather than an absent field so a consumer must
 *  handle it. */
function lastVerdictWeek(priorRows: readonly VerdictRecord[]): WeekStart | null {
  for (const row of priorRows) {
    if (row.verdict !== "not_judgeable") return row.week;
  }
  return null;
}

/** Newest week first inside each page, which is the order every reader
 *  above walks. */
export function groupByPage(
  rows: readonly VerdictRecord[]
): ReadonlyMap<string, readonly VerdictRecord[]> {
  const byPage = new Map<string, VerdictRecord[]>();
  for (const row of rows) {
    const held = byPage.get(row.publicationId);
    if (held === undefined) byPage.set(row.publicationId, [row]);
    else held.push(row);
  }
  for (const rowsOfPage of byPage.values()) {
    rowsOfPage.sort((left, right) => (left.week < right.week ? 1 : left.week > right.week ? -1 : 0));
  }
  return byPage;
}

