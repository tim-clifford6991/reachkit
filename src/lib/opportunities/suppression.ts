// SPEC §6 — what a Monday "not working" does downstream.
//
// "A Monday verdict of 'not working' on a cluster suppresses new Write
// opportunities in that cluster for four weeks; Improve of the live URL in
// it stays allowed." And an owned URL whose Improve has been judged not
// working twice is retired: nothing further targets it.
//
// Pure. The verdicts are `page_verdicts` rows as `judgeWeek` wrote them,
// read back joined through their publication to the opportunity that page
// was written for (`OpportunityStore.notWorkingVerdicts`, one read). Nothing
// here judges a page again or measures anything: a verdict is the week's
// fact, and this only reads what it implies for the rows still open.
import { CLUSTER_SUPPRESS_WEEKS, IMPROVE_RETIRE_AFTER_NOT_WORKING } from "@/lib/config/constants";
import { canonicalUrl } from "./cluster";
import type { Family, Opportunity, UnreadyReason } from "./types";

/** One `not_working` verdict, with the opportunity behind the judged page.
 *  The three opportunity fields are `null` where the publication has no
 *  opportunity to read them from — such a verdict implies nothing. */
export interface NotWorkingVerdict {
  /** The site-local Monday it was judged, `YYYY-MM-DD`. */
  week: string;
  clusterKey: string | null;
  family: Family | null;
  /** The opportunity's target: a slug for Write, the owned page's own URL
   *  for Improve. */
  targetRef: string | null;
}

export interface Suppression {
  /** Clusters with a `not_working` verdict inside the window. */
  clusters: ReadonlySet<string>;
  /** Owned URLs whose Improve was judged not working in two weeks. */
  retiredUrls: ReadonlySet<string>;
}

const MS_PER_WEEK = 7 * 86_400_000;

/** A retired URL and a row's target are compared in `canonicalUrl`'s form.
 *  A target that is not a URL (a slug) matches no page address. */
export function urlKey(ref: string): string {
  return canonicalUrl(ref);
}

/** Whether a verdict judged on `week` still suppresses at `at`: from its
 *  Monday for `CLUSTER_SUPPRESS_WEEKS` weeks. */
function insideWindow(week: string, at: Date): boolean {
  const monday = Date.parse(`${week}T00:00:00.000Z`);
  return Number.isFinite(monday) && at.getTime() < monday + CLUSTER_SUPPRESS_WEEKS * MS_PER_WEEK;
}

export function suppressionOf(verdicts: readonly NotWorkingVerdict[], at: Date): Suppression {
  const clusters = new Set<string>();
  const improveWeeks = new Map<string, Set<string>>();
  for (const v of verdicts) {
    if (v.clusterKey !== null && insideWindow(v.week, at)) clusters.add(v.clusterKey);
    if (v.family === "improve" && v.targetRef !== null) {
      const key = urlKey(v.targetRef);
      const weeks = improveWeeks.get(key) ?? new Set<string>();
      weeks.add(v.week);
      improveWeeks.set(key, weeks);
    }
  }
  const retiredUrls = new Set<string>();
  for (const [url, weeks] of improveWeeks) {
    if (weeks.size >= IMPROVE_RETIRE_AFTER_NOT_WORKING) retiredUrls.add(url);
  }
  return { clusters, retiredUrls };
}

/**
 * The reason a verdict holds this open row back, or `null`.
 *
 * Retirement first: a retired URL is targeted by nothing, whatever family.
 * Then suppression, which is Write's alone — Improve of a live URL in a
 * suppressed cluster stays allowed, and a Fix is not new writing.
 */
export function verdictReason(o: Opportunity, s: Suppression): UnreadyReason | null {
  if (o.family !== "fix" && s.retiredUrls.has(urlKey(o.targetRef))) return "url_retired";
  if (o.family === "write" && o.clusterKey !== null && s.clusters.has(o.clusterKey)) return "cluster_suppressed";
  return null;
}
