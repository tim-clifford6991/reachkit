// BUILD §11 — the hourly selection: whose local Monday has arrived
//
// ADR-060: the tick is hourly and due-ness is site-local. "Mon 06:00 UTC"
// is not the trigger, and a weekly cron on that hour would silently re-file
// every measurement west of UTC−6 into the previous customer-week — which
// is the mutation `tests/scan/weekly/due.test.ts` fails on.
//
// Four predicates, each owned once and none re-derived here:
//   1. the site's own local Monday, at its own due hour  — `week.ts`
//   2. active access                                     — billing (`access.ts`)
//   3. no weekly scan row for `(site_id, week_start)`     — `store.ts`
//   4. a zone to decide 1 in                             — `store.ts`
//
// Three statements per tick, whatever the number of sites: the sites, the
// gate, the weeks already stamped. The local-clock filter is arithmetic
// over rows already in hand, because no PostgREST filter can ask a
// question in each row's own zone.
//
// The already-stamped exclusion is what makes a retry free: a site whose
// run failed had its claim released and so carries no row, and is selected
// again on the very next hourly tick — inside the same site-local week. A
// site whose run completed, wholly or partly, carries its row and is never
// selected again for that week.
import { sitesWithActiveAccess } from "./access";
import { sitesWithAZone, weeksAlreadyStamped } from "./store";
import { isWeeklyDue, weekKey, weekStartFor } from "./week";

/** One site due this hour, with the week the run belongs to. */
export interface DueSite {
  readonly siteId: string;
  readonly domain: string;
  readonly zone: string;
  readonly weekStart: string;
}

export async function dueSites(now: Date): Promise<readonly DueSite[]> {
  const candidates: DueSite[] = [];
  for (const site of await sitesWithAZone()) {
    if (!isWeeklyDue({ at: now, zone: site.zone })) continue;
    candidates.push({ ...site, weekStart: weekStartFor({ at: now, zone: site.zone }) });
  }
  if (candidates.length === 0) {
    logSelection({ candidates: 0, due: 0 });
    return [];
  }

  const withAccess = await sitesWithActiveAccess(
    "dueSites",
    candidates.map((site) => site.siteId)
  );
  const paying = candidates.filter((site) => withAccess.has(site.siteId));
  if (paying.length === 0) {
    logSelection({ candidates: candidates.length, due: 0 });
    return [];
  }

  const stamped = await weeksAlreadyStamped(
    paying.map((site) => site.siteId),
    [...new Set(paying.map((site) => site.weekStart))]
  );
  const due = paying.filter((site) => !stamped.has(weekKey(site)));
  logSelection({ candidates: candidates.length, due: due.length });
  return due;
}

/** One line per tick, carrying the counts and nothing about a customer. */
function logSelection(fields: { candidates: number; due: number }): void {
  console.log(JSON.stringify({ event: "weekly_due_selection", ...fields }));
}
