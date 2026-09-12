// BUILD §9 · §4.7 — the four values the customer sets, and the one written
// line each pair produces.
//
// §4.7: "**Publishing** (mode toggle, veto window stepper 0–7d default 24h,
// publish time, …)". §9: "Autopilot = auto-approve when the veto window
// (default 24h, settable 0–7d) expires without a veto. Copilot = explicit
// approve only."
//
// Four values, one home. The mode a sidebar card shows and the mode this
// screen shows are the same column read through the same function
// (REQ-073 c5), and the writer is `save.ts` — the only place `sites.mode`,
// `sites.veto_hours`, `sites.publish_time` and `sites.timezone` are
// written.
//
// **The days-to-hours conversion exists here and nowhere else.** The screen
// offers whole days 1–7 (`VETO.minDays`/`VETO.maxDays`); the column stores
// hours because BUILD §10 names it `veto_hours`. Two conversions would be
// two chances to disagree about what "1 day" is.
//
// **No read path falls back to the server's zone.** REQ-073 c1 gives the
// zone one source — "the one their browser reported at first sign-in, which
// they may change here at any time afterwards" — so a site with no zone
// yields `timezone: null`, which every caller must hold a page against
// rather than guess around.
//
// This module exports no function that returns a rate: the ceilings are
// `ceilings/`'s, and REQ-070 c3 keeps engine parameters off every screen.
//
// The archived plans are WO-218 and WO-219.
import { VETO } from "@/lib/config/constants";
import { publishDb } from "../db";
import { isWholeDays, storedVetoHours, vetoHoursFromDays } from "./veto";

export type Mode = "autopilot" | "copilot";

export interface PublishingSettings {
  mode: Mode;
  /** 0..168, always a whole multiple of 24. */
  vetoHours: number;
  /** `HH:mm`, 24-hour, read in `timezone`. */
  publishTime: string;
  /** IANA name, or `null` where the customer has stated none. */
  timezone: string | null;
}

/** The four fields a patch can name, and the four the validator answers
 *  about. A fifth would be a fifth setting, which REQ-070 c1's closed list
 *  does not carry. */
export type SettingsField = "mode" | "vetoHours" | "publishTime" | "timezone";

export const SETTINGS_FIELDS: readonly SettingsField[] = Object.freeze([
  "mode",
  "vetoHours",
  "publishTime",
  "timezone",
] as const);

const HH_MM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** The days-to-hours conversion, re-exported from the leaf that holds it
 *  (`veto.ts`, issue #374). It is still one implementation and this is
 *  still the module WO-178 step 4 names; what the leaf buys is that the
 *  settings screen's own formatter can read it without evaluating this
 *  file, which imports `publishDb` and so parses every binding. */
export { storedVetoHours, vetoDaysFromHours, vetoHoursFromDays } from "./veto";

/** Does the runtime resolve this as an IANA zone? The runtime's own zone
 *  database is the only source; there is no second list to fall out of
 *  date. */
export function isResolvableZone(zone: unknown): zone is string {
  if (typeof zone !== "string" || zone.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The four independent closed checks. Returns the fields that failed, in
 * `SETTINGS_FIELDS` order, so a refusal names every bad value at once
 * rather than the first.
 *
 * A patch is refused **whole**: nothing is partially saved, so a customer
 * who mistypes a zone does not find their mode changed.
 */
export function invalidFields(patch: Partial<PublishingSettings>): readonly SettingsField[] {
  const bad: SettingsField[] = [];

  if (patch.mode !== undefined && patch.mode !== "autopilot" && patch.mode !== "copilot") {
    bad.push("mode");
  }

  if (patch.vetoHours !== undefined) {
    const hours = patch.vetoHours;
    const wholeDays = isWholeDays(hours);
    const inRange =
      hours >= vetoHoursFromDays(VETO.minDays) && hours <= vetoHoursFromDays(VETO.maxDays);
    // A 36-hour window is refused: the stepper offers whole days and a
    // value between two of them is not a setting the screen can show.
    if (!wholeDays || !inRange) bad.push("vetoHours");
  }

  if (patch.publishTime !== undefined && !HH_MM.test(patch.publishTime)) {
    bad.push("publishTime");
  }

  if (patch.timezone !== undefined && !isResolvableZone(patch.timezone)) {
    bad.push("timezone");
  }

  return bad;
}

interface SiteSettingsRow {
  mode: string | null;
  veto_hours: number | null;
  publish_time: string | null;
  timezone: string | null;
}

/** `HH:mm` from the column's `time` rendering (`09:00:00`), which carries
 *  seconds the screen never shows. */
function toHhMm(value: string | null): string {
  if (value === null) return DEFAULT_PUBLISH_TIME;
  const [hh = "", mm = ""] = value.split(":");
  return `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`;
}

/** BUILD §10's own column default (`publish_time time not null default
 *  '09:00'`), read back in the shape the screen shows. Stated here only for
 *  a row that answered null, which the not-null column cannot produce; it
 *  is the same value, never a second decision. */
const DEFAULT_PUBLISH_TIME = "09:00";

export function toPublishingSettings(row: SiteSettingsRow): PublishingSettings {
  return {
    mode: row.mode === "copilot" ? "copilot" : "autopilot",
    // §7: there is no zero window. A stored value below the floor reads as
    // the floor, through the one clamp every reader of the pair comes by.
    vetoHours: storedVetoHours(row.veto_hours),
    publishTime: toHhMm(row.publish_time),
    // Never a fallback. A null zone travels as null.
    timezone: row.timezone,
  };
}

/**
 * The site's four values, with REQ-073 c1's defaults applied: the veto
 * window is 24 hours where nothing is set, and the zone is whatever the
 * customer's browser reported at first sign-in — never the server's.
 *
 * A site row that cannot be read is not a site to publish for, and the
 * defaults are not an answer about it: the read throws rather than
 * returning a settings object nobody chose.
 */
export async function readPublishingSettings(siteId: string): Promise<PublishingSettings> {
  const { data, error } = await publishDb()
    .from<SiteSettingsRow>("sites")
    .select("mode, veto_hours, publish_time, timezone")
    .eq("id", siteId)
    .single();
  if (error !== null || data === null) {
    throw new Error(`src/lib/publish/settings: could not read the site's publishing settings`);
  }
  return toPublishingSettings(data);
}

export type AdoptResult =
  | { adopted: true }
  | { adopted: false; reason: "already_set" | "invalid" };

/**
 * REQ-073 c1's first-sign-in write: the zone the browser reported.
 *
 * Writes `sites.timezone` **only while it is null**. A zone the customer
 * set is never overwritten — a customer who publishes in Lisbon and signs
 * in from an airport in Denver must not have their publish hour moved by
 * the airport.
 *
 * The `reported` value goes through the same IANA check a patch does; there
 * is no second, looser validation for the automatic path.
 *
 * The read and the write are two statements, which the one client any code
 * here may hold cannot join (`src/lib/publish/db.ts` documents the same
 * limitation). Two first sign-ins racing is not a case that exists — this
 * runs on one browser's first authenticated request — and the losing write
 * would in any case write the same zone.
 */
export async function adoptBrowserTimezone(
  siteId: string,
  reported: string
): Promise<AdoptResult> {
  if (!isResolvableZone(reported)) return { adopted: false, reason: "invalid" };

  const { data, error } = await publishDb()
    .from<{ timezone: string | null }>("sites")
    .select("timezone")
    .eq("id", siteId)
    .single();
  if (error !== null || data === null) return { adopted: false, reason: "invalid" };
  if (data.timezone !== null) return { adopted: false, reason: "already_set" };

  const written = await publishDb()
    .from<never>("sites")
    .update({ timezone: reported })
    .eq("id", siteId);
  if (written.error !== null) return { adopted: false, reason: "invalid" };
  return { adopted: true };
}
