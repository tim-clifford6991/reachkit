// BUILD §11: the hourly selection of whose local Monday has arrived. Due-ness is site-local: a weekly cron at one UTC hour would re-file
// every measurement west of UTC−6 into the previous week. Four predicates, each owned elsewhere:
// 1. the site's local Monday at its due hour, or any later hour of its week where it has a row for the week before (`week.ts`)
// 2. active access (billing)
// 3. no weekly row for `(site_id, week_start)`, or a released (`failed`) one inside the week (`store.ts`)
// 4. a zone to decide 1 in (`store.ts`)
// Three statements per tick whatever the site count; the local-clock filter is arithmetic in hand, since no PostgREST filter asks in each row's zone.
// A failed or credit-refused run releases its claim to a `failed` row and is retried each hour until its week ends, spending only what is left
// of that row's `WEEKLY` cap. A completed run is never selected again that week.
import { sitesWithActiveAccess } from "@/lib/account/billing";
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
  const lastWeek = (weekStart: string) => new Date(Date.parse(`${weekStart}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
  const weeks = begun.flatMap((site) => [site.weekStart, lastWeek(site.weekStart)]);
  const rows = begun.length === 0 ? new Map<string, string>() : await weekStatuses([...new Set(weeks)]);
  // A missed Monday hour stays owed all week to any site with a row last week, measured or failed; a new site waits for its first Monday.
  const owed = (site: DueSite) => rows.has(weekKey({ ...site, weekStart: lastWeek(site.weekStart) }));
  const candidates = begun.filter((site) => {
    const key = weekKey(site);
    return rows.get(key) === "failed" || (!rows.has(key) && (owed(site) || isWeeklyDue({ at: now, zone: site.zone })));
  });
  if (candidates.length === 0) {
    logSelection({ candidates: 0, due: 0 });
    return [];
  }

  const withAccess = await sitesWithActiveAccess(candidates.map((site) => site.siteId));
  const due = candidates.filter((site) => withAccess.has(site.siteId));
  logSelection({ candidates: candidates.length, due: due.length });
  return due;
}

/** One line per tick, carrying the counts and nothing about a customer. */
function logSelection(fields: { candidates: number; due: number }): void {
  console.log(JSON.stringify({ event: "weekly_due_selection", ...fields }));
}
