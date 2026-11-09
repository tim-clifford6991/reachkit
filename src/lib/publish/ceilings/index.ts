// BUILD §9 — the day's ceiling, in the customer's own zone, else UTC.
// BUILD §14 guardrail 7 — autopilot rate limits, independent of the monthly cap.
// §9: hard limits regardless of settings, so the limit comes from the pin and no per-site column that could hold a
// rate is read, and nothing here returns a rate. A refusal is a hold naming the ceiling and when it lifts.
import { addDays, startOfDay } from "date-fns";
import { RATE_LIMITS } from "@/lib/config/constants";
import { inZone } from "@/lib/scan/weekly/week";
import { publishDb } from "../db";

/** The instant the customer's calendar day containing `at` begins; a skipped midnight is the day's first instant. */
export function startOfLocalDay(at: Date, timeZone: string): Date {
  return new Date(+startOfDay(inZone(at, timeZone)));
}

/** The instant the next local day begins: the day ceiling's `nextFreeAt`. */
export function startOfNextLocalDay(at: Date, timeZone: string): Date {
  return new Date(+startOfDay(addDays(startOfDay(inZone(at, timeZone)), 1)));
}

/** `unreadable` holds, since "none known" is not "none went out"; it writes nothing and the next tick asks again. */
export type CeilingRoom =
  | { room: true }
  | { room: false; blockedBy: "day"; nextFreeAt: Date }
  | { room: false; blockedBy: "unreadable" };

/** Room to publish now? A site with no zone counts its day in UTC, so a missing zone never holds a page. */
export async function ceilingRoom(siteId: string, at: Date): Promise<CeilingRoom> {
  const zone = await siteTimeZone(siteId);
  if (zone === UNREADABLE) return unreadable(siteId, "sites");
  const timeZone = zone ?? "UTC";

  // A page counts even if later unpublished: the day it went out is used.
  const published = await publishedSince(siteId, startOfLocalDay(at, timeZone));
  if (published === UNREADABLE) return unreadable(siteId, "publications");

  if (published.length >= RATE_LIMITS.publishesPerDay) {
    return { room: false, blockedBy: "day", nextFreeAt: startOfNextLocalDay(at, timeZone) };
  }
  return { room: true };
}

const UNREADABLE = Symbol("unreadable");

/** A ceiling that cannot be counted holds, and says why in the log. */
function unreadable(siteId: string, table: string): CeilingRoom {
  console.warn(JSON.stringify({ event: "publish_ceiling_unreadable", siteId, table }));
  return { room: false, blockedBy: "unreadable" };
}

/** `null` is no zone or no site; a read that errored is `UNREADABLE`. */
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
