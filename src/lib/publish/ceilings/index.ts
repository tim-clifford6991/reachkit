// BUILD §9 — the two ceilings, a day's and a week's, in the customer's own zone on a Monday-start week.
// BUILD §14 guardrail 7 — autopilot rate limits, independent of the monthly cap.
// §9: hard limits regardless of settings, so the limits come from the pins and no per-site column that could hold a
// rate is read, and nothing here returns a rate. They hold independently. A refusal is a hold naming the ceiling and when it lifts.
import { RATE_LIMITS } from "@/lib/config/constants";
import { publishDb } from "../db";
import {
  startOfLocalDay,
  startOfLocalWeek,
  startOfNextLocalDay,
  startOfNextLocalWeek,
} from "./local-week";

/** `zone_not_set` holds with no `nextFreeAt`, as no clock clears it: REQ-073 c1 forbids a zone never stated, and the
 *  server's zone would publish on the wrong day. `unreadable` holds too, since "none known" is not "none went out";
 *  it writes nothing and the next tick asks again. */
export type CeilingRoom =
  | { room: true }
  | { room: false; blockedBy: "day" | "week"; nextFreeAt: Date }
  | { room: false; blockedBy: "zone_not_set" }
  | { room: false; blockedBy: "unreadable" };

/** Room to publish now? When both block, the day is reported: it is the nearer boundary the customer waits on. */
export async function ceilingRoom(siteId: string, at: Date): Promise<CeilingRoom> {
  const timeZone = await siteTimeZone(siteId);
  if (timeZone === UNREADABLE) return unreadable(siteId, "sites");
  if (timeZone === null) return { room: false, blockedBy: "zone_not_set" };

  const dayStart = startOfLocalDay(at, timeZone);
  const weekStart = startOfLocalWeek(at, timeZone);

  // One read over the week; the day is a slice. A page counts even if later unpublished: the day it went out is used.
  const published = await publishedSince(siteId, weekStart);
  if (published === UNREADABLE) return unreadable(siteId, "publications");

  const inDay = published.filter((instant) => instant >= dayStart).length;
  if (inDay >= RATE_LIMITS.publishesPerDay) {
    return { room: false, blockedBy: "day", nextFreeAt: startOfNextLocalDay(at, timeZone) };
  }

  if (published.length >= RATE_LIMITS.publishesPerWeek) {
    return { room: false, blockedBy: "week", nextFreeAt: startOfNextLocalWeek(at, timeZone) };
  }

  return { room: true };
}

const UNREADABLE = Symbol("unreadable");

/** A ceiling that cannot be counted holds, and says why in the log. */
function unreadable(siteId: string, table: string): CeilingRoom {
  console.warn(JSON.stringify({ event: "publish_ceiling_unreadable", siteId, table }));
  return { room: false, blockedBy: "unreadable" };
}

/** `null` is no zone or no site, both a hold; a read that errored is `UNREADABLE`. */
async function siteTimeZone(siteId: string): Promise<string | null | typeof UNREADABLE> {
  const { data, error } = await publishDb()
    .from<{ timezone: string | null }>("sites")
    .select("timezone")
    .eq("id", siteId)
    .limit(1);
  if (error !== null || data === null) return UNREADABLE;
  const timezone = data[0]?.timezone;
  return typeof timezone === "string" && timezone.length > 0 ? timezone : null;
}

async function publishedSince(siteId: string, from: Date): Promise<Date[] | typeof UNREADABLE> {
  const { data, error } = await publishDb()
    .from<{ published_at: string | null }>("publications")
    .select("published_at")
    .eq("site_id", siteId)
    .gte("published_at", from.toISOString());
  if (error !== null || data === null) return UNREADABLE;
  return data
    .map((row) => row.published_at)
    .filter((value): value is string => typeof value === "string")
    .map((value) => new Date(value));
}
