// BUILD §9 — can this week decide the test this page was created with?
//
// Pure: no clock, no database, no network, no model. It reads the recorded
// `Acceptance` and never writes it — §7's test is written once at creation
// (`opportunities.acceptance`'s own `before update` trigger is that
// invariant), including where it can no longer be evaluated. REQ-063 c6:
// "its recorded test is not rewritten to something that could be judged."
//
// **It produces exactly two of the five causes** — `search_untracked` and
// `question_left_set`, each read as an *absent key* in the week's
// measurements. The other three are the caller's, from stored state this
// function's inputs do not carry: `unpublished` is the publication's own
// state, `domain_changed` is the publication's domain against the week's,
// and `page_not_found` is what the one check at 24 hours recorded.
//
// **A code path here that returns `page_not_found` is the ADR-085 merge
// arriving by the back door.** This module makes no request and reads no
// publication row, so it cannot know a page's absence; a value it cannot
// observe is a value it must not name. The negative sweep in
// `evaluate.test.ts` is what holds that line — a positive-only suite is
// green either way.
import { measured, measuredZero, unmeasured, type Measured } from "@/lib/measure/measured";
import type { SiteIssuesSection } from "@/lib/site-issues/types";
import { pageOf } from "@/lib/market/prompts/answer";
import { canonicalUrl } from "../cluster";
import type { Acceptance, PageFix } from "../types";
import type { NotJudgeableCause, PlacedUrl, SearchRows, WeekMeasurements } from "./types";

/**
 * What one week can say about one recorded test. **Three arms, not two.**
 *
 * WO-204 declared this as a two-arm return — decided, or a
 * `NotJudgeableCause` — and a two-arm return cannot express REQ-063 c5's
 * transient case at all: "each remaining page stating that it was not
 * measured this week" is `not_measured`, which ADR-071 forbids merging
 * into `not_judgeable` precisely because one is a week's miss and the
 * other retires a page forever. Folding the two would write a transient
 * miss down as a permanent state, which is the whole of what this
 * subsystem is shaped to prevent. So the third arm is declared, and the
 * `cause` arm still carries only the two causes this function can observe.
 */
export type Evaluation =
  | { readonly decided: true; readonly passes: boolean; readonly measuredAt: Date }
  /** REQ-063 c5 — the week reached this reading and this page's test is
   *  still tracked; it simply was not measured. Transient. No row. */
  | { readonly decided: false; readonly because: "not_measured" }
  /** REQ-063 c6 — the test itself has stopped being evaluable. Terminal. */
  | { readonly decided: false; readonly cause: NotJudgeableCause };

/**
 * The reading, once the key was found. A measurement this week did not
 * reach decides nothing, and says so as the transient arm — never as a
 * cause. `passes` is handed the whole arm rather than the value, because
 * for a search position the *arm* is the answer: `zero` is "measured, and
 * the customer holds no place", which is a result and not a gap.
 */
function decide<T>(
  value: Measured<T>,
  passes: (m: { kind: "measured" | "zero"; value: T }) => boolean
): Evaluation {
  if (value.kind === "unmeasured") return { decided: false, because: "not_measured" };
  return { decided: true, passes: passes(value), measuredAt: value.at };
}

/** REQ-063 c5's transient arm, written once. */
const NOT_MEASURED: Evaluation = Object.freeze({ decided: false, because: "not_measured" as const });

/** REQ-063 c6's terminal arm, from an *absent key* and from nothing else. */
function retired(cause: NotJudgeableCause): Evaluation {
  return { decided: false, cause };
}

/**
 * Whether every named check passes for one page this week. Decided only
 * where the week checked that page and every named check ran with its
 * addresses recorded; anything less is this week's miss, never a pass.
 */
export function pageFixesCleared(
  section: SiteIssuesSection | null,
  issues: readonly PageFix[],
  pageUrl: string,
  at: Date
): Measured<boolean> | null {
  if (section === null || section.checkedPages === null) return null;
  if (!section.checkedPages.includes(pageUrl)) return null;
  for (const check of issues) {
    const issue = section.issues.find((i) => i.check === check);
    if (issue === undefined || !issue.ran || issue.pages === null) return null;
    if (issue.pages.includes(pageUrl)) return measured(false, at);
  }
  return measured(true, at);
}

/** One page's address as two readings of it compare: tracking parameters,
 *  the fragment, the scheme, `www.` and a trailing slash dropped. */
export function addressOf(url: string): string {
  return canonicalUrl(pageOf(url) ?? url);
}

/** The best place a page's test counts: `top20` names the top twenty. */
export const TRACKED_DEPTH = 20;

/**
 * One page's own place on one search (issue 1518): the best place a row
 * holds whose address is one of the page's own — its live address, or an
 * address it had before (issue 1487). Another page of the same domain is
 * not this page, so the home page at #3 places an article nowhere.
 *
 * The week's SERP is read first. Where it holds no row for the page, the
 * ranked rows are read, to depth 20 and beyond, before the page reads as
 * absent: a page at 14 is in the top twenty. A row past twenty is the
 * page's measured place, and outside the top twenty (issue 1548). A page
 * in no row is a measured zero where the rows are complete, and not
 * measured where they are not.
 */
export function placeOf(reading: Measured<SearchRows>, addresses: readonly string[]): Measured<number> {
  if (reading.kind === "unmeasured") return unmeasured<number>(reading.reason, reading.at, reading.because);
  const own = new Set(addresses.map(addressOf));
  const best = (rows: readonly PlacedUrl[]): number | null => {
    let found: number | null = null;
    for (const row of rows) {
      if (!own.has(addressOf(row.url))) continue;
      if (found === null || row.position < found) found = row.position;
    }
    return found;
  };
  const place = best(reading.value.serp ?? []) ?? best(reading.value.ranked);
  if (place !== null) return measured(place, reading.at);
  return reading.value.complete ? measuredZero(0, reading.at) : unmeasured<number>("undeterminable", reading.at);
}

/**
 * Pure. Can this recorded test be decided from what this week measured?
 *
 * The three forms are §7's own — "top 20 for Q" / "named on question P" /
 * "gate passes" — and each is decided from one reading and no other.
 */
export function evaluateAcceptance(a: {
  acceptance: Acceptance;
  week: WeekMeasurements;
  /** The address the page answers at. A `named_on` test and a `top20`
   *  test read it. */
  pageUrl: string;
  /** The addresses the page answered at before (issue 1487). A `top20`
   *  test counts a row at any of them as this page's. */
  earlierUrls?: readonly string[];
}): Evaluation {
  switch (a.acceptance.form) {
    case "top20": {
      const reading = a.week.positions.get(a.acceptance.query);
      // Absent: the search this test names is no longer measured.
      if (reading === undefined) return retired("search_untracked");
      // A measured place inside the top twenty passes it, and the rank
      // rides along for the movement. A place past twenty, and the `zero`
      // arm — measured, and this page holds no place — fail it, which is a
      // measured result and not a missing one (§6.6's cold-start law).
      const place = placeOf(reading, [a.pageUrl, ...(a.earlierUrls ?? [])]);
      return decide(place, (m) => m.kind === "measured" && m.value <= TRACKED_DEPTH);
    }
    case "named_on": {
      const cited = a.week.ownPagesCited.get(a.acceptance.question);
      // Absent: the question left the tracked set when the market changed.
      if (cited === undefined) return retired("question_left_set");
      // SPEC §4 2026-09-29 (D16): the page is credited only where the
      // answer to its own tracked question cites this page. An answer that
      // names the site and cites another of its pages does not pass it.
      const page = addressOf(a.pageUrl);
      return decide(cited, (m) => m.value.some((url) => addressOf(url) === page));
    }
    case "gate_cleared": {
      const cleared = a.week.gatesCleared.get(a.acceptance.gate);
      // A barrier belongs to a closed set (`BARRIERS`) and cannot leave a
      // tracked set, so a gate this week did not look at is
      // `not_measured` — never one of the five causes, and this branch
      // names none.
      if (cleared === undefined) return NOT_MEASURED;
      return decide(cleared, (m) => m.value);
    }
    case "issues_cleared": {
      // A page the week did not check, or a check that did not run, is this
      // week's miss — never a cause: the checks are a closed set.
      const cleared = pageFixesCleared(
        a.week.siteIssues,
        a.acceptance.issues,
        a.acceptance.pageUrl,
        a.week.measuredAt
      );
      if (cleared === null) return NOT_MEASURED;
      return decide(cleared, (m) => m.value);
    }
  }
}
