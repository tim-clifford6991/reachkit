// scripts/live-drafts/measured-text.ts — one of the two seams the live run
// replaces (`./fixture.ts` names both).
//
// The runner aliases this module over `@/lib/measure/text` for the run only,
// so `readAllFacts` (the grounding read) and `buildComparisonSet` (the
// near-duplicate sets) get the fixture's pages instead of a Postgres read.
// Everything either of them then does with the pages is the product's own
// code.
//
// The signatures are the real module's, imported as types by path so a
// change to either one is a compile error here rather than a runtime
// surprise during a paid run.
import type { MeasuredText } from "../../src/lib/measure/text";
import { DOMAIN, PAGES, SITE_ID } from "./fixture";

/** Fixed, locale-free ordering, the same one the real reader applies: by
 *  read date, then by URL as code units. */
function ordered(pages: readonly MeasuredText[]): MeasuredText[] {
  return [...pages].sort((a, b) => {
    const byDate = a.measuredAt.getTime() - b.measuredAt.getTime();
    if (byDate !== 0) return byDate;
    return a.url < b.url ? -1 : a.url > b.url ? 1 : 0;
  });
}

/** Site-scoped, like the real read: a site this run does not hold has no
 *  measured page, and never another site's. */
export async function readMeasuredText(a: { siteId: string; scanId?: string }): Promise<MeasuredText[]> {
  return a.siteId === SITE_ID ? ordered(PAGES) : [];
}

export async function readDomainText(domain: string): Promise<MeasuredText[]> {
  return domain === DOMAIN ? ordered(PAGES) : [];
}
