// BUILD §9 · §4.7 — the four values the customer sets, and the one written line each pair produces. Every surface reads
// them through one function (REQ-073 c5), and `save.ts` is their only writer.
// Whole days 1–7 on screen, hours in `veto_hours` (BUILD §10); the one conversion is `veto.ts`'s.
// No read falls back to the server's zone: REQ-073 c1's one source is the browser at first sign-in, so none is `null`
// and every caller holds a page against it. No function here returns a rate (REQ-070 c3).
import { VETO } from "@/lib/config/constants";
import { publishDb } from "../db";
import { governingVetoHours, isWholeDays, vetoHoursFromDays } from "./veto";

/** Autopilot only (SPEC §7); a stored `copilot` reads as autopilot. */
export type Mode = "autopilot";

export interface PublishingSettings {
  mode: Mode;
  /** 0..168, always a whole multiple of 24. */
  vetoHours: number;
  /** `HH:mm`, 24-hour, read in `timezone`. */
  publishTime: string;
  /** IANA name, or `null` where the customer has stated none. */
  timezone: string | null;
}

/** The four fields a patch can name; REQ-070 c1's list is closed. */
export type SettingsField = "mode" | "vetoHours" | "publishTime" | "timezone";

export const SETTINGS_FIELDS: readonly SettingsField[] = Object.freeze([
  "mode",
  "vetoHours",
  "publishTime",
  "timezone",
] as const);

const HH_MM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** Re-exported from the `veto.ts` leaf, which the settings screen's formatter reads without parsing every binding. */
export { vetoDaysFromHours, vetoHoursFromDays } from "./veto";

/** Does the runtime resolve this IANA zone? Its database is the only source, with no second list to go stale. */
export function isResolvableZone(zone: unknown): zone is string {
  if (typeof zone !== "string" || zone.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Every failed field in `SETTINGS_FIELDS` order, not just the first; the patch is refused whole. */
export function invalidFields(patch: Partial<PublishingSettings>): readonly SettingsField[] {
  const bad: SettingsField[] = [];

  if (patch.mode !== undefined && (patch.mode as string) !== "autopilot") {
    bad.push("mode");
  }

  if (patch.vetoHours !== undefined) {
    const hours = patch.vetoHours;
    const wholeDays = isWholeDays(hours);
    const inRange =
      hours >= vetoHoursFromDays(VETO.minDays) && hours <= vetoHoursFromDays(VETO.maxDays);
    // A 36-hour window is refused: the screen shows whole days only.
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

/** `HH:mm` from the column's `time` rendering (`09:00:00`). */
function toHhMm(value: string | null): string {
  if (value === null) return DEFAULT_PUBLISH_TIME;
  const [hh = "", mm = ""] = value.split(":");
  return `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`;
}

/** BUILD §10's column default (`publish_time ... default '09:00'`), for a null the column cannot produce; never a second decision. */
const DEFAULT_PUBLISH_TIME = "09:00";

export function toPublishingSettings(row: SiteSettingsRow): PublishingSettings {
  return {
    // Autopilot only: a stored `copilot` is read as autopilot.
    mode: "autopilot",
    vetoHours: governingVetoHours(row.veto_hours),
    publishTime: toHhMm(row.publish_time),
    // Never a fallback. A null zone travels as null.
    timezone: row.timezone,
  };
}

/** The site's four values with REQ-073 c1's defaults; the zone is the browser's, never the server's. An unreadable row
 *  throws rather than returning settings nobody chose. */
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

/** REQ-073 c2's one written line — the key, never the sentence. */
export type PairCopyKey =
  | "settings.publishing.pair.autopilotWindow"
  | "settings.publishing.pair.autopilotZero";

/** The one place a pair becomes a statement: what it does to a draft the customer never acts on. A key, never a string. */
export function explainPair(s: Pick<PublishingSettings, "mode" | "vetoHours">): PairCopyKey {
  return s.vetoHours === 0
    ? "settings.publishing.pair.autopilotZero"
    : "settings.publishing.pair.autopilotWindow";
}

export type AdoptResult =
  | { adopted: true }
  | { adopted: false; reason: "already_set" | "invalid" };

/** REQ-073 c1's first-sign-in write, only while `sites.timezone` is null, so signing in from an airport never moves a
 *  publish hour. The same IANA check as a patch. Read and write are two statements; a racing write writes the same zone. */
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
