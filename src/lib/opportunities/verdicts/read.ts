// BUILD §9, §12 — what a surface and the weekly mail read. It recomputes
// no verdict.
//
// A verdict is a fact about the week it was taken in, so this file reads
// the rows written for the week it was asked about and no other. **It
// never falls back to the most recent verdict** where the requested week
// has none: showing last week's verdict as this week's is exactly what
// REQ-063 c5 forbids ("In neither case is an earlier week's verdict shown
// as this week's"), and it is the change that reads, in review, as a
// helpful default.
//
// Which of the two row-less standings a page gets is decided the same way
// `judgeWeek` decides it, and from the same one read: a week with no
// measurement at all is `no_week` for every page; a week that was measured
// but could not decide this page is `not_measured`. Neither has a row —
// the absence is the representation — so the distinction is made from the
// week, not from a flag.
import { groupByPage, type PageStanding } from "./judge";
import { noteFor, verdictStore, type VerdictRecord } from "./store";
import type { WeekStanding, WeekStart } from "./types";

const NO_WEEK: WeekStanding = Object.freeze({ kind: "no_week" as const });
const NOT_MEASURED: WeekStanding = Object.freeze({ kind: "not_measured" as const });

/**
 * Every published page's standing for one week.
 *
 * Three reads and no writes: the site's published pages, the rows for this
 * week, and the history behind `lastJudgedWeek`.
 */
export async function readWeek(a: {
  siteId: string;
  week: WeekStart;
}): Promise<readonly PageStanding[]> {
  const store = verdictStore();
  const pages = await store.publishedPages(a.siteId);
  if (pages.length === 0) return [];

  const thisWeek = await store.verdictsForWeek({ siteId: a.siteId, week: a.week });
  const rowFor = new Map(thisWeek.map((row) => [row.publicationId, row]));
  const history = groupByPage(await store.historyBefore({ siteId: a.siteId, week: a.week }));

  // One read to tell the two row-less standings apart. A page with a row
  // does not need it, but a week either was measured or was not, and the
  // question is asked once for the site rather than once per page.
  const measured = thisWeek.length > 0 || (await store.weekReport({ siteId: a.siteId, week: a.week })) !== null;

  return pages.map((page) => {
    const row = rowFor.get(page.publicationId);
    if (row === undefined) {
      return { publicationId: page.publicationId, standing: measured ? NOT_MEASURED : NO_WEEK };
    }
    return {
      publicationId: page.publicationId,
      standing: standingOf(row, history.get(page.publicationId) ?? []),
    };
  });
}

/** One stored row, as the standing it records. Nothing is recomputed: the
 *  verdict, the movement and the date are read back exactly as they were
 *  written, so a decline cannot be rounded away on the render path. */
function standingOf(row: VerdictRecord, priorRows: readonly VerdictRecord[]): WeekStanding {
  if (row.verdict === "not_judgeable" && row.cause !== null) {
    return {
      kind: "not_judgeable",
      cause: row.cause,
      lastJudgedWeek: priorRows.find((prior) => prior.verdict !== "not_judgeable")?.week ?? null,
    };
  }
  if (row.verdict === "not_judgeable" || row.measuredAt === null) {
    // Both are unrepresentable on disk — `page_verdicts` constrains `cause`
    // to be non-null exactly on a `not_judgeable` row, and a judged row
    // carries the date its measurement was taken. A row that reached here
    // is a schema this code no longer matches, and saying so is the only
    // honest answer: a substituted verdict or an epoch date would render
    // as a fact about a customer's page.
    throw new Error(
      `page_verdicts: row for publication ${row.publicationId}, week ${row.week}, ` +
        "carries neither a cause nor a complete verdict."
    );
  }
  return {
    kind: "verdict",
    verdict: row.verdict,
    measuredAt: row.measuredAt,
    movement: row.movement,
    // The note is not stored beside the verdict: it is the record of the
    // one check at 24 hours, read from `publications.verify` where the
    // digest asks for it (`weeklyDigest`), so a re-verification would
    // never have to rewrite a verdict row to change what sits beside it.
    verifyNote: null,
  };
}

/** One page in the weekly mail: its standing, the address it is served
 *  at, and what the check at 24 hours recorded beside it. The address, not
 *  a title: a page's title is model-written and a mail does not speak it
 *  in ReachKit's own voice (§8, REQ-093). */
export interface DigestPage extends PageStanding {
  readonly liveUrl: string | null;
}

/**
 * What the Monday mail reads — REQ-063 c4's "each page's verdict and what
 * moved since the previous measurement, every figure carrying its change,
 * the date it was measured, and … the interval that change spans".
 *
 * The same standings the surface reads, plus the week's own measurement
 * date and each page's title. It writes nothing and recomputes nothing.
 */
export async function weeklyDigest(a: {
  siteId: string;
  week: WeekStart;
}): Promise<{ standings: readonly DigestPage[]; weekMeasuredAt: Date | null }> {
  const store = verdictStore();
  const [standings, pages, week] = await Promise.all([
    readWeek(a),
    store.publishedPages(a.siteId),
    store.weekReport({ siteId: a.siteId, week: a.week }),
  ]);
  const byId = new Map(pages.map((page) => [page.publicationId, page]));

  return {
    standings: standings.map((standing) => {
      const page = byId.get(standing.publicationId);
      // The note rides with the standing here rather than in the stored
      // row: it is REQ-062's record, shown beside a verdict and never in
      // place of one, so a page whose check could not be confirmed carries
      // an ordinary verdict with a note and is identical in every other
      // respect to a page whose check passed.
      const standingWithNote: WeekStanding =
        standing.standing.kind === "verdict" && page !== undefined
          ? { ...standing.standing, verifyNote: noteFor(page.verification) }
          : standing.standing;
      return {
        publicationId: standing.publicationId,
        standing: standingWithNote,
        liveUrl: page?.liveUrl ?? null,
      };
    }),
    weekMeasuredAt: week === null ? null : week.report.verdict.measuredAt,
  };
}
