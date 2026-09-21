// SPEC §5 (2026-09-20, #908) — "the right-hand side matches the step".
//
// #923's rivals panel: "the searches measured so far × you and each rival,
// dots for first-two-pages presence, as CSS grid".
//
// **This file is pure.** A stored report in, a grid out — so the rule is
// decided by a test with no database and no browser. The reading is
// `provider.ts`'s, which already holds the report for the address the
// founder gave.
//
// **What "measured so far" means here, and what it does not.** The grid is
// built from the report the *free scan* already stored for this address:
// twelve top tens, bought and written before the founder ever paid. It is
// real measured data and it costs nothing to draw. It is **not** a live
// feed of the deep pass's own SERPs as that pass buys them — the pass
// writes its report once, at the end, and records only its stage as it goes
// (`sites.setup_stage`). Streaming partial SERPs would mean the pass
// writing rows mid-flight that nothing reads afterwards; that is a change
// to the engine, not to this screen, and #923 is a screen issue. So: the
// scan's measurements where there are some, honest skeletons where there
// are none, and never a dot nobody measured.
//
// **A cell is `present` only where a row was read.** A search whose SERP
// the scan could not buy contributes no column at all — it is not a search
// the customer lost, and a grid that drew it as an empty dot would say they
// had.
import { classifyReferences } from "@/lib/measure/drivers";
import type { StoredReport } from "@/lib/scan/report";

/**
 * Google's first two pages.
 *
 * Ten results to a page is what "the first page" means to a customer, and
 * §7's acceptance test for every Write target is "top 20 for Q" — the same
 * twenty. Named here rather than written into the filter, and declared in
 * this module rather than imported from Overview's own private directory:
 * one number, two screens, and neither reaches into the other's internals.
 */
export const FIRST_TWO_PAGES = 20;

/** One site's row: the domain, whether it is the customer's own, and one
 *  cell per measured search. */
export interface RivalGridRow {
  domain: string;
  /** Drawn in the accent, and counted for the line under the grid. */
  you: boolean;
  /** `true` where that site holds a first-two-pages place on that search.
   *  Exactly as long as `searches`, so a renderer indexes by position. */
  present: readonly boolean[];
}

export interface RivalGrid {
  /** The searches whose top ten the scan actually read, in the order the
   *  scan phrased them. */
  searches: readonly string[];
  /** The customer first, then each rival in the order the scan scored
   *  them. */
  rows: readonly RivalGridRow[];
  /** How many of the measured searches the customer holds a place on, and
   *  how many were measured — the two halves of the line under the grid. */
  yours: number;
  of: number;
}

/**
 * The grid, or `null` where there is nothing measured to draw.
 *
 * `null` is the skeleton arm and is the honest one in three cases: no
 * report at all (a purchase with no scan behind it), a report whose
 * questions were never phrased, and a report none of whose SERPs could be
 * read. In every one of them the panel shows a shape and a line, never a
 * grid of empty dots.
 */
export function rivalGridOf(report: StoredReport | null): RivalGrid | null {
  if (report === null) return null;
  // Read defensively, not because the type says they can be absent but
  // because a report *row* can be: a blob written before a member existed
  // is a case this codebase handles explicitly everywhere else (see
  // `ownRankedRows` on `version <= 8`), and the honest answer for a report
  // that carries no questions is the skeleton, not a thrown screen.
  const questions = report.questions as StoredReport["questions"] | undefined;
  const serps = (report.serps ?? []) as StoredReport["serps"];
  if (questions === undefined || questions.kind === "unmeasured") return null;

  // One column per *measured* SERP, paired with the search it was bought
  // for. `serps[i]` is `questions[i]`'s — the scan's own parallel record.
  const columns: { search: string; serp: { domain: string; position: number }[] }[] = [];
  questions.value.forEach((question, i) => {
    const serp = serps[i];
    if (serp === undefined || serp.kind === "unmeasured") return;
    columns.push({
      search: question.search.keyword,
      serp: serp.value.organic.map((row) => ({ domain: row.domain, position: row.position })),
    });
  });
  if (columns.length === 0) return null;

  const rivals = (report.presence?.rivals ?? []).map((rival) => rival.domain);
  const domains = [report.domain, ...rivals.filter((domain) => domain !== report.domain)];

  const rows = domains.map((domain, index): RivalGridRow => ({
    domain,
    you: index === 0,
    present: columns.map((column) =>
      column.serp.some(
        (row) => row.position <= FIRST_TWO_PAGES && classifyReferences([row.domain], domain).cited
      )
    ),
  }));

  const mine = rows[0];
  return {
    searches: columns.map((column) => column.search),
    rows,
    yours: mine === undefined ? 0 : mine.present.filter(Boolean).length,
    of: columns.length,
  };
}
