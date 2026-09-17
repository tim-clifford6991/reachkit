// BUILD §11, §9 — `draft/generate`'s site list (BP-014).
//
// The evening tick's candidates: every site ReachKit is still working for,
// that has somewhere to publish once the page is written, and that carries
// a zone to be evening *in*.
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
// **Four predicates, three read from the row that owns it and one asked
// of the gate that owns it:**
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
//   3. a live destination row — **whatever its health** (SPEC §5, owner
//      2026-09-16, issue 744). A hosted destination is `expired` until its
//      CNAME resolves and a deferred WordPress until it is connected, and a
//      founder is not left without pages for the days that takes: the page
//      is written and waits in review. Publishing is where health is
//      decided, by the `destination_working` guard on every edge into
//      `publishing` (`machine/table.ts`), so nothing goes out to a
//      destination that cannot take it. A site with no destination row at
//      all is still never returned: that page would have nowhere to go
//      even once it was written.
//   4. active access, asked of **the same registered gate the weekly tick
//      asks** (issue #201, master's ruling; ADR-050 — one rule, one
//      reader). A day's page is spend, and a site whose access has ended
//      is not prepared one. §13's grace, if there is any, is billing's to
//      express inside `hasActiveAccess()` and is never a second clause
//      here — a threshold written twice is a threshold that disagrees with
//      itself the day one copy is corrected.
//
// Two statements per tick whatever the number of sites, on the same
// grounds `src/lib/scan/weekly/due.ts` states for its own selection: a
// per-site read here would be one round trip per customer per hour. The
// gate is asked once too, about the candidates that survived the three
// row predicates — there is no point asking who pays for a site that has
// nowhere to publish.
//
// **An unreadable gate holds the tick, and holds it loudly.** Where the
// gate is not registered, or answers by throwing, this returns *no sites*
// and says why. It does not fall back to "everyone" — that spends a
// lapsed customer's day on a read that failed — and it does not fall back
// to "nobody" quietly, which is the same silence as an ordinary hour with
// nothing due. `draft/generate` records it as a degraded run naming the
// step, so an operator sees a tick that could not decide who pays rather
// than a quiet night. Failing closed on **spend** is the same direction
// `hasActiveAccess()` itself fails in.
//
// A hold is not a stop: nothing moves, no page is touched, and the next
// tick asks again. The pages a site already holds stay exactly where they
// are, which is `switch/index.ts`'s property and not this file's to
// change.
import { sitesWithActiveAccess } from "@/lib/scan/weekly/access";
import { publishDb } from "../db";

/** One candidate, with the zone its own evening is decided in. */
export interface DailySite {
  readonly siteId: string;
  readonly timeZone: string;
}

/** What one tick's selection found. `held` is non-null exactly where the
 *  tick could not decide who is paying — no site is returned then, and the
 *  run records it rather than reporting a quiet hour. */
export interface DailySelection {
  readonly sites: readonly DailySite[];
  readonly held: "access-unreadable" | null;
}

interface SiteRow {
  id: string;
  timezone: string | null;
}

interface DestinationSiteRow {
  site_id: string;
}

export async function sitesForDailyTick(): Promise<DailySelection> {
  const allSites = await publishDb()
    .from<SiteRow>("sites")
    .select("id, timezone")
    .eq("publishing_enabled", true)
    .not("timezone", "is", null);
  if (allSites.error !== null) {
    throw new Error(`publish/daily: could not read the sites: ${allSites.error.message}`);
  }

  const withAZone = (allSites.data ?? []).filter(
    (row): row is SiteRow & { timezone: string } => typeof row.timezone === "string" && row.timezone.length > 0
  );
  if (withAZone.length === 0) {
    logSelection({ sites: 0, withDestination: 0, paying: 0 });
    return { sites: [], held: null };
  }

  const destinations = await publishDb()
    .from<DestinationSiteRow>("destinations")
    .select("site_id")
    .in(
      "site_id",
      withAZone.map((row) => row.id)
    )
    .is("deleted_at", null);
  if (destinations.error !== null) {
    throw new Error(`publish/daily: could not read the destinations: ${destinations.error.message}`);
  }

  // Somewhere for the page to go, once it is written. Health is not read
  // here (issue 744): a destination still waiting for DNS or for its
  // credential is one a page waits for in review, not one a founder gets
  // no pages for.
  const hasDestination = new Set((destinations.data ?? []).map((row) => row.site_id));
  const candidates = withAZone
    .filter((row) => hasDestination.has(row.id))
    .map((row): DailySite => ({ siteId: row.id, timeZone: row.timezone }));
  if (candidates.length === 0) {
    logSelection({ sites: withAZone.length, withDestination: 0, paying: 0 });
    return { sites: [], held: null };
  }

  // ADR-050's one reader, through the one seam billing registers itself
  // into. Imported by file and never through `@/lib/scan/weekly`, whose
  // barrel re-exports the selection and the measurement and drags a
  // database client behind it — the same reason `billing/access-gate.ts`
  // gives for importing it the same way.
  let paying: ReadonlySet<string>;
  try {
    paying = await sitesWithActiveAccess(
      "sitesForDailyTick",
      candidates.map((site) => site.siteId)
    );
  } catch (error) {
    // The error's class and never its message (issue 863): a hold must be
    // diagnosable from this line alone.
    logSelection({
      sites: withAZone.length,
      withDestination: candidates.length,
      paying: null,
      errorClass: error instanceof Error ? error.name : "unknown",
    });
    return { sites: [], held: "access-unreadable" };
  }

  const paid = candidates.filter((site) => paying.has(site.siteId));
  logSelection({
    sites: withAZone.length,
    withDestination: candidates.length,
    paying: paid.length,
  });
  return { sites: paid, held: null };
}

/** One line per tick, carrying the counts and nothing about a customer.
 *  `paying: null` is the hold — the question was asked and not answered. */
function logSelection(fields: {
  sites: number;
  withDestination: number;
  paying: number | null;
  errorClass?: string;
}): void {
  console.log(JSON.stringify({ event: "daily_site_selection", ...fields }));
}
