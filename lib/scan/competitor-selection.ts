/**
 * User-chosen competitor benchmark set. The app surfaces a ranked candidate list
 * (closeness + size) and the user picks up to 5 — stored here (source='user_selected',
 * confirmed=true on the existing `competitors` table) and used to benchmark intel.
 */
import { serverDb } from "@/lib/db/client";
import { normalizeHost } from "@/lib/scan/referral/classify";

const SOURCE = "user_selected";
export const MAX_SELECTED = 5;

export async function getSelectedCompetitors(appId: string): Promise<string[]> {
  const { data } = await serverDb()
    .from("competitors")
    .select("competitor_store_url")
    .eq("app_id", appId)
    .eq("source", SOURCE);
  return (data ?? [])
    .map((r) => (r as { competitor_store_url: string | null }).competitor_store_url)
    .filter((x): x is string => !!x);
}

export async function saveSelectedCompetitors(appId: string, domains: string[]): Promise<string[]> {
  const db = serverDb();
  await db.from("competitors").delete().eq("app_id", appId).eq("source", SOURCE);
  const clean = [...new Set(domains.map((d) => normalizeHost(d)).filter(Boolean))].slice(0, MAX_SELECTED);
  if (clean.length) {
    const { error } = await db
      .from("competitors")
      .insert(clean.map((d) => ({ app_id: appId, competitor_store_url: d, name: d, source: SOURCE, confirmed: true })));
    if (error) throw error;
  }
  return clean;
}
