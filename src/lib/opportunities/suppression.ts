// SPEC §6 — what a Monday "not working" does downstream: an owned URL whose
// Improve has been judged not working twice is retired, and nothing further
// targets it. A cluster is never held back, since the week takes the
// highest-value topics (owner 2026-11-08).
//
// Pure. The verdicts are `page_verdicts` rows as `judgeWeek` wrote them,
// read back joined through their publication to the opportunity that page
// was written for (`OpportunityStore.notWorkingVerdicts`, one read). Nothing
// here judges a page again or measures anything: a verdict is the week's
// fact, and this only reads what it implies for the rows still open.
import { IMPROVE_RETIRE_AFTER_NOT_WORKING } from "@/lib/config/constants";
import { canonicalUrl } from "@/lib/measure/page-reading";
import type { Family, Opportunity } from "./types";

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
  /** Owned URLs whose Improve was judged not working in two weeks. */
  retiredUrls: ReadonlySet<string>;
}

/** A retired URL and a row's target are compared in `canonicalUrl`'s form.
 *  A target that is not a URL (a slug) matches no page address. */
export function urlKey(ref: string): string {
  return canonicalUrl(ref);
}

export function suppressionOf(verdicts: readonly NotWorkingVerdict[]): Suppression {
  const improveWeeks = new Map<string, Set<string>>();
  for (const v of verdicts) {
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
  return { retiredUrls };
}

/** Whether a verdict holds this open row back: a retired URL, whatever the family but Fix. */
export function heldByVerdict(o: Opportunity, s: Suppression): boolean {
  return o.family !== "fix" && s.retiredUrls.has(urlKey(o.targetRef));
}
