// BUILD §11, §9 — `draft/generate`'s site list (BP-014). The hour is not decided here: ADR-060's `isDraftDue` in
// `src/jobs/site-clock.ts` gates every row this returns, so one clock rule has one home. A candidate has:
//   1. a zone, since inventing UTC would publish at the wrong time of day;
//   2. `publishing_enabled`, since a page for a customer who pressed stop is spend they did not want; held pages stay put;
//   3. a live destination row, whatever its health (SPEC §5): the page waits in review, and `destination_working` decides at publish;
//   4. active access, from the gate the weekly tick asks (ADR-050, one rule, one reader); grace is `hasActiveAccess()`'s alone.
// Two statements per tick whatever the number of sites, and the gate asked once, for the survivors.
// An unreadable gate holds the tick loudly: no sites, recorded as degraded, never "everyone" and never a quiet "nobody".
// A hold is not a stop: nothing moves, and the next tick asks again.
import { sitesWithActiveAccess } from "@/lib/scan/weekly/access";
import { publishDb } from "../db";
import { toPublishingSettings } from "../settings/settings";

/** One candidate, with the zone, publish time and veto window its due hour is decided from. */
export interface DailySite {
  readonly siteId: string;
  readonly timeZone: string;
  /** `HH:mm`, read in `timeZone`. */
  readonly publishTime: string;
  /** The governing window: never below a day. */
  readonly vetoHours: number;
}

/** `held` is non-null exactly where the tick could not decide who pays; then no site is returned and the run records it. */
export interface DailySelection {
  readonly sites: readonly DailySite[];
  readonly held: "access-unreadable" | null;
}

interface SiteRow {
  id: string;
  timezone: string | null;
  veto_hours?: number | null;
  publish_time?: string | null;
}

interface DestinationSiteRow {
  site_id: string;
}

export async function sitesForDailyTick(): Promise<DailySelection> {
  const allSites = await publishDb()
    .from<SiteRow>("sites")
    .select("id, timezone, veto_hours, publish_time")
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

  // Somewhere for the page to go; health is not read, since a waiting destination still gets pages to review.
  const hasDestination = new Set((destinations.data ?? []).map((row) => row.site_id));
  const candidates = withAZone
    .filter((row) => hasDestination.has(row.id))
    .map((row): DailySite => {
      const { publishTime, vetoHours } = toPublishingSettings({
        mode: null,
        timezone: row.timezone,
        veto_hours: row.veto_hours ?? null,
        publish_time: row.publish_time ?? null,
      });
      return { siteId: row.id, timeZone: row.timezone, publishTime, vetoHours };
    });
  if (candidates.length === 0) {
    logSelection({ sites: withAZone.length, withDestination: 0, paying: 0 });
    return { sites: [], held: null };
  }

  // ADR-050's one reader, imported by file: the `@/lib/scan/weekly` barrel drags a database client behind it.
  let paying: ReadonlySet<string>;
  try {
    paying = await sitesWithActiveAccess(
      "sitesForDailyTick",
      candidates.map((site) => site.siteId)
    );
  } catch (error) {
    // The error's class, never its message, so the hold is diagnosable from this line alone.
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

/** One line per tick, counts only; `paying: null` is the hold. */
function logSelection(fields: {
  sites: number;
  withDestination: number;
  paying: number | null;
  errorClass?: string;
}): void {
  console.log(JSON.stringify({ event: "daily_site_selection", ...fields }));
}
