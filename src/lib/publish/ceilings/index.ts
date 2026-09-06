// BUILD §9 — the two ceilings: one a day, eight a week, in the customer's
// own zone, on a Monday-start week.
//
// §9: "Autopilot hard limits regardless of settings: ≤1 publish/day,
// ≤8/week". Regardless of settings is the whole point — this module reads
// the two limits from the pins and reads **no per-site column that could
// hold a rate**, so no value a customer or a plan writes anywhere can raise
// either one. It exports nothing that returns a rate.
//
// The two ceilings hold independently: eight in a week with a free day
// still refuses a second on that day, and one a day with seven already
// published still refuses the ninth in the week. A refusal is a hold, never
// a failure — it names which ceiling blocked and when the block lifts.
//
// The archived plan is WO-211.
import { RATE_LIMITS } from "@/lib/config/constants";
import { publishDb } from "../db";
import {
  startOfLocalDay,
  startOfLocalWeek,
  startOfNextLocalDay,
  startOfNextLocalWeek,
} from "./local-week";

/**
 * Three arms, not two.
 *
 * `zone_not_set` is a hold with no `nextFreeAt` because no clock clears it:
 * `sites.timezone` is nullable by design (REQ-073 c1 forbids a zone the
 * customer never stated), and a site whose zone we cannot read is a site
 * whose calendar day we cannot count. Counting it in the server's zone
 * would publish on the wrong day, which is the one thing the ceiling is
 * stated in the customer's zone to prevent.
 */
export type CeilingRoom =
  | { room: true }
  | { room: false; blockedBy: "day" | "week"; nextFreeAt: Date }
  | { room: false; blockedBy: "zone_not_set" };

/**
 * Is there room to publish for this site at this moment?
 *
 * The day is reported before the week when both block: it is the nearer
 * boundary, so it is the one the customer is waiting on.
 */
export async function ceilingRoom(siteId: string, at: Date): Promise<CeilingRoom> {
  const timeZone = await siteTimeZone(siteId);
  if (timeZone === null) return { room: false, blockedBy: "zone_not_set" };

  const dayStart = startOfLocalDay(at, timeZone);
  const weekStart = startOfLocalWeek(at, timeZone);

  // One read over the wider of the two windows; the day is a slice of it.
  // A published page counts against its ceiling whether or not it was later
  // unpublished — the day it went out is the day it used.
  const published = await publishedSince(siteId, weekStart);

  const inDay = published.filter((instant) => instant >= dayStart).length;
  if (inDay >= RATE_LIMITS.publishesPerDay) {
    return { room: false, blockedBy: "day", nextFreeAt: startOfNextLocalDay(at, timeZone) };
  }

  if (published.length >= RATE_LIMITS.publishesPerWeek) {
    return { room: false, blockedBy: "week", nextFreeAt: startOfNextLocalWeek(at, timeZone) };
  }

  return { room: true };
}

async function siteTimeZone(siteId: string): Promise<string | null> {
  const { data, error } = await publishDb()
    .from<{ timezone: string | null }>("sites")
    .select("timezone")
    .eq("id", siteId)
    .single();
  if (error !== null || data === null) return null;
  return typeof data.timezone === "string" && data.timezone.length > 0 ? data.timezone : null;
}

async function publishedSince(siteId: string, from: Date): Promise<Date[]> {
  const { data, error } = await publishDb()
    .from<{ published_at: string | null }>("publications")
    .select("published_at")
    .eq("site_id", siteId)
    .gte("published_at", from.toISOString());
  if (error !== null || data === null) return [];
  return data
    .map((row) => row.published_at)
    .filter((value): value is string => typeof value === "string")
    .map((value) => new Date(value));
}
