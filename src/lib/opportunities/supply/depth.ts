// BUILD §7 — how many days of pages the product actually holds.
//
// BUILD §14 guardrail 1 — volume follows supply: the anti-scaled-content-abuse
// control is this count, and never a target.
//
// "Supply is the cap: never invent an opportunity to fill a day; the
// calendar is never padded" (DECISIONS, 2026-08-28). Depth is the number
// that rule is enforced against, and it counts **days of pages**: open,
// and not the Fix family. An `unblock` takes no publishing day and
// consumes no supply, so a customer holding four outstanding instructions
// and no pages has zero days of pages — the alternative tells them they
// have four, which is the precise failure the rule exists against.
//
// Nothing is stored. There is no counter column, no `supply_depth` field
// and no materialised view: a count with a second home drifts from the
// rows it counts, and a customer told supply is short while it is not is
// the failure mode that drift produces.
import { opportunityStore } from "../store";

export interface Depth {
  unused: number;
  /** Set only while `unused` is 0 — the moment the site's last non-Fix
   *  opportunity left `open` is the moment supply hit zero. `null` while
   *  supply stands, so a caller cannot read a stale date as a live claim. */
  exhaustedSince: Date | null;
}

export async function supplyDepth(siteId: string): Promise<Depth> {
  const store = opportunityStore();
  const unused = await store.countUnused(siteId);
  if (unused > 0) return { unused, exhaustedSince: null };

  // Exhausted. The date is the last status change over the site's non-Fix
  // rows; where the site has never held one, it is the completion of its
  // most recent completed scan — the moment we last looked and found
  // nothing, which is the honest answer to "since when?". A site with
  // neither answers `null`, and the caller renders a notice with no date
  // rather than inventing one.
  const lastChange = await store.lastStatusChangeAt(siteId);
  if (lastChange !== null) return { unused: 0, exhaustedSince: lastChange };
  return { unused: 0, exhaustedSince: await store.latestCompletedScanAt(siteId) };
}

/**
 * Whether a site with no supply ever had a market to use up (#765).
 *
 * Zero depth says two different things. A site whose opportunities were all
 * used or held has **exhausted** its supply; a site whose current scan
 * derived no questions, or that has never held a single non-Fix
 * opportunity, was **never measured** — there was nothing to use up, and
 * telling that founder their supply "is used up" is false.
 *
 * Both halves are stored facts: the current report's `questions`, and
 * `lastStatusChangeAt`, which is `null` exactly where the site has never
 * held a non-Fix row. A site with no current report has no measured
 * questions. A read that throws propagates — the caller decides what an
 * unreadable answer is, and it is never a guess at either state.
 */
export async function supplyMeasured(siteId: string): Promise<boolean> {
  const store = opportunityStore();
  const [report, lastChange] = await Promise.all([
    store.currentReport(siteId),
    store.lastStatusChangeAt(siteId),
  ]);
  const questions = report?.questions;
  const asked = questions !== undefined && questions.kind !== "unmeasured" && questions.value.length > 0;
  return asked && lastChange !== null;
}
