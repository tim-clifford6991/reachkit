// scripts/voice-reset/run.ts — clears a stored voice that describes the read
// that failed rather than the site. 0¢: it reads exported rows and prints
// guarded updates; it holds no database key and calls no vendor or model.
//
// With no rows it prints the two selects to run through the Supabase
// connector. Saved as JSON and handed back with `--profiles` and `--sites`,
// it prints the count and one update per bad voice. A seeded `voice_text` is
// cleared only while unstamped, so the customer's own words always stand.
import { readsAsUnread } from "@/lib/locale/language";

export interface ProfileRow {
  domain: string;
  text: string | null;
  tone: string | null;
}

export interface SiteRow {
  id: string;
  voice_text: string | null;
}

export const PROFILES_SQL = "select domain, voice->>'text' as text, voice->>'tone' as tone from site_profiles where voice is not null order by domain;";
export const SITES_SQL = "select id, voice_text from sites where voice_edited_at is null and voice_text is not null order by id;";

function text(value: string | null): string {
  return value === null ? "null" : `'${value.replace(/'/g, "''")}'`;
}

/** One update per stored voice that reads as a failed read, each guarded on the text it was read with. */
export function resets(a: { profiles: readonly ProfileRow[]; sites: readonly SiteRow[] }): { profiles: string[]; sites: string[] } {
  return {
    profiles: a.profiles
      .filter((row) => readsAsUnread(row.text ?? "", row.tone ?? ""))
      .map((row) => `update site_profiles set voice = null where domain = ${text(row.domain)} and voice->>'text' is not distinct from ${text(row.text)} returning domain;`),
    sites: a.sites
      .filter((row) => row.voice_text !== null && readsAsUnread(row.voice_text))
      .map((row) => `update sites set voice_text = null where id = ${text(row.id)} and voice_edited_at is null and voice_text = ${text(row.voice_text)} returning id;`),
  };
}

export function main(a: { profiles: readonly ProfileRow[] | null; sites: readonly SiteRow[] | null }): number {
  if (a.profiles === null || a.sites === null) {
    console.log(PROFILES_SQL);
    console.log(SITES_SQL);
    console.error("\n-- Run both through the Supabase connector, save each as JSON, then:");
    console.error("-- node scripts/voice-reset.mjs --profiles <profiles.json> --sites <sites.json>");
    return 0;
  }
  const out = resets({ profiles: a.profiles, sites: a.sites });
  console.error(`-- Dry report: ${out.profiles.length} of ${a.profiles.length} profile voice(s), ${out.sites.length} of ${a.sites.length} unstamped site voice(s) read as a failed read.`);
  for (const sql of [...out.profiles, ...out.sites]) console.log(sql);
  return 0;
}
