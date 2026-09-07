// BUILD §11, §9 — `draft/generate`'s site list (BP-014).
//
// The evening tick's candidates: every site ReachKit is still working for,
// that has a destination a page could actually reach, and that carries a
// zone to be evening *in*.
//
// **The hour is not decided here, and that is deliberate.** ADR-060's gate
// is `isDraftDue(now, zone)` in `src/jobs/site-clock.ts`, where the tick's
// own `now` lives, and it is already applied by `draft/generate` to every
// row this returns. Two homes for one clock rule is how a tick starts
// firing in a different hour than the one the calendar promised, so this
// file carries the *list* and that file carries the *hour*. Both halves
// are asserted — the list here, the gate in `tests/jobs/site-clock.test.ts`
// — and the composition in `tests/journeys/05-daily-loop.test.ts`.
//
// **Three predicates, each read from the row that owns it:**
//
//   1. a zone. A site with none cannot be told whether it is its own
//      evening, and inventing UTC for it would publish at the wrong time
//      of day rather than not at all.
//   2. `publishing_enabled` — the customer's own stop (§9: "pause is one
//      click and instant"). A stopped site is not prepared a page: §8's
//      cap is real money, and a page generated for a customer who pressed
//      stop is spend against a day they said they did not want. The stop
//      moves no page and this excludes none: the pages already held stay
//      exactly where they are (`switch/index.ts`).
//   3. a live destination that can publish. `health = 'ok'` is the whole
//      test the `destination_working` guard makes, and it already carries
//      `cannot_publish`: ADR-086 makes `publish_capable === false` outrank
//      every other answer, so such a row reads `error`. The column is
//      excluded here as well, spelled rather than relied on — a row whose
//      probe found it incapable is never a candidate even if its health
//      has not been re-read since. A site with no destination row at all
//      matches neither and is never returned.
//
// Two statements per tick whatever the number of sites, on the same
// grounds `src/lib/scan/weekly/due.ts` states for its own selection: a
// per-site read here would be one round trip per customer per hour.
//
// **What this does not ask.** Active access is not a predicate here. It is
// one for the weekly tick because the measurement is what the subscription
// buys; whether a lapsed site should still be prepared a page is a
// question about §13's grace and the answer is not written down. Adding it
// on a guess would silently stop a paying customer's pages on the day a
// billing read failed. Named here rather than assumed either way.
import { publishDb } from "../db";

/** One candidate, with the zone its own evening is decided in. */
export interface DailySite {
  readonly siteId: string;
  readonly timeZone: string;
}

interface SiteRow {
  id: string;
  timezone: string | null;
}

interface DestinationSiteRow {
  site_id: string;
  publish_capable: boolean | null;
}

export async function sitesForDailyTick(): Promise<readonly DailySite[]> {
  const sites = await publishDb()
    .from<SiteRow>("sites")
    .select("id, timezone")
    .eq("publishing_enabled", true)
    .not("timezone", "is", null);
  if (sites.error !== null) {
    throw new Error(`publish/daily: could not read the sites: ${sites.error.message}`);
  }

  const withAZone = (sites.data ?? []).filter(
    (row): row is SiteRow & { timezone: string } => typeof row.timezone === "string" && row.timezone.length > 0
  );
  if (withAZone.length === 0) {
    logSelection({ sites: 0, withDestination: 0 });
    return [];
  }

  const destinations = await publishDb()
    .from<DestinationSiteRow>("destinations")
    .select("site_id, publish_capable")
    .in(
      "site_id",
      withAZone.map((row) => row.id)
    )
    .eq("health", "ok")
    .is("deleted_at", null);
  if (destinations.error !== null) {
    throw new Error(`publish/daily: could not read the destinations: ${destinations.error.message}`);
  }

  // ADR-086's rule, spelled here rather than left to `health` alone: a
  // probe that found the credential cannot publish outranks every other
  // answer, and this is what keeps a row whose health has not been re-read
  // since out of the tick. `null` is "not probed", which is not a refusal.
  const reachable = new Set(
    (destinations.data ?? [])
      .filter((row) => row.publish_capable !== false)
      .map((row) => row.site_id)
  );
  const due = withAZone
    .filter((row) => reachable.has(row.id))
    .map((row): DailySite => ({ siteId: row.id, timeZone: row.timezone }));

  logSelection({ sites: withAZone.length, withDestination: due.length });
  return due;
}

/** One line per tick, carrying the counts and nothing about a customer. */
function logSelection(fields: { sites: number; withDestination: number }): void {
  console.log(JSON.stringify({ event: "daily_site_selection", ...fields }));
}
