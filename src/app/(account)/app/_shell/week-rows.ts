// BUILD §4.4 — which of this site's weeks were measured.
//
// §4.4's domain block states `Week n · re-measured Mon`, and `weeks.ts`
// counts the n from a list of `MeasuredWeek`. This is where that list comes
// from for a real account: every site-local Monday this site has existed
// for, asked of §11's own row set in one query.
//
// **The candidate weeks are generated, the measured ones are read.** A week
// is measured when `scans` carries its `(site_id, week_start)` pair — the
// same key the partial unique index enforces and the same spelling
// `weekKey()` writes, so this file invents no second notion of "a week".
//
// **Every step is taken on an instant and re-read through the site's own
// clock**, never by adding seven days to a local date string: a week that a
// daylight transition shortens by an hour would otherwise land the step
// back inside the week it started in. `weekStartFor` does that re-reading,
// and this file only ever hands it instants.
import { weekKey, weekStartFor as localWeekStart, weeksAlreadyStamped } from "@/lib/scan/weekly";
import type { MeasuredWeek } from "./weeks";

const MS_PER_DAY = 86_400_000;

/** The site as this file needs it. */
export interface WeekSite {
  siteId: string;
  domain: string;
  timeZone: string;
  createdAt: Date;
}

/**
 * A guard on the walk, not a window on the product.
 *
 * The loop below steps one week at a time from the site's creation to now,
 * and it terminates on the date comparison — this bound only stops a clock
 * that has gone backwards, or a `created_at` read as something absurd, from
 * spinning. Ten years of weeks is far past anything this product has, and a
 * site that somehow reached it still reads its most recent weeks: the walk
 * runs forward from creation, so the cap drops the oldest, which are the
 * ones already counted and never re-read.
 */
const MAX_WEEKS_WALKED = 520;

/** Every site-local Monday from the week the site was created to the week
 *  it is now, oldest first, as `scans.week_start` spells them. */
export function candidateWeekStarts(site: WeekSite, now: Date): string[] {
  const zone = site.timeZone;
  const starts: string[] = [];
  const seen = new Set<string>();
  let cursor = site.createdAt.getTime();
  const end = now.getTime();

  for (let walked = 0; walked < MAX_WEEKS_WALKED && cursor <= end; walked += 1) {
    const start = localWeekStart({ at: new Date(cursor), zone });
    if (!seen.has(start)) {
      seen.add(start);
      starts.push(start);
    }
    cursor += 7 * MS_PER_DAY;
  }

  // The week `now` falls in, whether or not the step landed on it — a site
  // created on a Thursday and read the following Tuesday has two weeks, and
  // the walk above can finish one short of the second.
  const current = localWeekStart({ at: now, zone });
  if (!seen.has(current)) starts.push(current);
  return starts;
}

/**
 * This site's weeks, each saying whether it was measured.
 *
 * One read for the whole list. A site with no weekly row yet returns every
 * candidate week marked unmeasured, which `weeksMeasured` reads as its
 * `none` arm and the shell states as the date the first measurement is due
 * — never as "Week 0".
 */
export async function measuredWeeksOf(a: {
  site: WeekSite;
  now: Date;
}): Promise<readonly MeasuredWeek[]> {
  const starts = candidateWeekStarts(a.site, a.now);
  if (starts.length === 0) return [];

  let stamped: ReadonlySet<string>;
  try {
    stamped = await weeksAlreadyStamped([a.site.siteId], starts);
  } catch {
    // A read that could not be made is not a week that was not measured.
    // Stating "no week has been measured" on a failed read would put the
    // never-measured line on an account that has been measured for months;
    // an empty list takes the same arm, and it is the honest one — nothing
    // is claimed about any week.
    return [];
  }

  return starts.map((weekStart) => ({
    domain: a.site.domain,
    // `week_start` is a site-local calendar date; midnight UTC is the
    // instant the shell's own date arithmetic uses for it, and `weeks.ts`
    // compares these only against each other.
    weekStart: new Date(`${weekStart}T00:00:00.000Z`),
    measured: stamped.has(weekKey({ siteId: a.site.siteId, weekStart })),
  }));
}
