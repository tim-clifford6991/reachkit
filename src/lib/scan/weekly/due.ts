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
//   3. no weekly scan row for `(site_id, week_start)`,
//      or a released (`failed`) one inside the week      — `store.ts`
//   4. a zone to decide 1 in                             — `store.ts`
//
// Three statements per tick, whatever the number of sites: the sites, the
// weeks' rows, the gate. The local-clock filter is arithmetic
// over rows already in hand, because no PostgREST filter can ask a
// question in each row's own zone.
//
// The already-stamped exclusion is what makes a retry free: a site whose
// run failed, or was refused for credit, had its claim released to a
// `failed` row, and is selected again on every hourly tick after it until
// its own week ends. A site whose run completed, wholly or partly, carries
// its row and is never selected again for that week.
import { sitesWithActiveAccess } from "./access";
import { sitesWithAZone, weekStatuses } from "./store";
import { isWeeklyDue, weekHasBegun, weekKey, weekStartFor } from "./week";

/** One site due this hour, with the week the run belongs to. */
export interface DueSite {
  readonly siteId: string;
  readonly domain: string;
  readonly zone: string;
  readonly weekStart: string;
}

export async function dueSites(now: Date): Promise<readonly DueSite[]> {
  const begun: DueSite[] = [];
  for (const site of await sitesWithAZone()) {
    if (!weekHasBegun({ at: now, zone: site.zone })) continue;
    begun.push({ ...site, weekStart: weekStartFor({ at: now, zone: site.zone }) });
  }
  const rows = begun.length === 0 ? new Map<string, string>() : await weekStatuses([...new Set(begun.map((site) => site.weekStart))]);
  // Due in its Monday hour with no row yet, or at any hour of its week once its claim was released.
  const candidates = begun.filter((site) => {
    const key = weekKey(site);
    return rows.get(key) === "failed" || (!rows.has(key) && isWeeklyDue({ at: now, zone: site.zone }));
  });
  if (candidates.length === 0) {
    logSelection({ candidates: 0, due: 0 });
    return [];
  }

  const withAccess = await sitesWithActiveAccess(
    "dueSites",
    candidates.map((site) => site.siteId)
  );
  const due = candidates.filter((site) => withAccess.has(site.siteId));
  logSelection({ candidates: candidates.length, due: due.length });
  return due;
}

/** One line per tick, carrying the counts and nothing about a customer. */
function logSelection(fields: { candidates: number; due: number }): void {
  console.log(JSON.stringify({ event: "weekly_due_selection", ...fields }));
}
