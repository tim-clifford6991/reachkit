/**
 * Active-app resolution for multi-app (Growth) users. The selected app is held in
 * a cookie; everything falls back to app_ids[0] when there's no valid selection,
 * so single-app users and pre-switcher behaviour are unchanged.
 */

import { cookies } from "next/headers";
import { serverDb } from "@/lib/db/client";

export const ACTIVE_APP_COOKIE = "active_app";

export async function activeAppId(user: { app_ids: string[] }): Promise<string | null> {
  const ids = user.app_ids;
  if (ids.length === 0) return null;
  const selected = (await cookies()).get(ACTIVE_APP_COOKIE)?.value;
  return selected && ids.includes(selected) ? selected : (ids[0] ?? null);
}

export interface AppOption {
  id: string;
  name: string;
}

/** A clean display name for an app: its backfilled product name, else the bare
 *  host (reachkit.app — never the raw URL or "Untitled app"). The scan backfills
 *  `apps.name` from the discovered product name (scan-requested collect step); this
 *  is the fallback for an app whose scan hasn't populated it yet (or a legacy row). */
export function appDisplayName(name: string | null, storeUrl: string | null): string {
  if (name && name.trim()) return name.trim();
  if (storeUrl && storeUrl.trim()) {
    try { return new URL(storeUrl).host.replace(/^www\./, ""); }
    catch { return storeUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""); }
  }
  return "Your product";
}

/** The user's apps as {id, name}, in app_ids order, for the switcher dropdown.
 *  Only apps that ACTUALLY EXIST are returned — a dangling `app_ids` entry
 *  (an id whose `apps` row was deleted out from under it, e.g. an admin/manual
 *  delete) is filtered out, never rendered as a ghost "Your product". */
export async function userApps(appIds: string[]): Promise<AppOption[]> {
  if (appIds.length === 0) return [];
  const { data } = await serverDb().from("apps").select("id, name, store_url").in("id", appIds);
  const byId = new Map((data ?? []).map((a) => [a.id as string, a]));
  return appIds
    .map((id) => byId.get(id))
    .filter((a): a is NonNullable<typeof a> => a != null)
    .map((a) => ({ id: a.id as string, name: appDisplayName((a.name as string | null) ?? null, (a.store_url as string | null) ?? null) }));
}

/**
 * Self-heal a user's `app_ids`: drop any id whose `apps` row no longer exists
 * (dangling reference from a deleted app), persisting the pruned list. Returns the
 * LIVE ids. Idempotent + best-effort — a failure just leaves the stored list as-is
 * (reads already filter dangling ids for display). Prevents dangling ids from
 * inflating the tracked-product COUNT (the plan cap check reads app_ids.length).
 */
export async function pruneDanglingApps(userId: string, appIds: string[]): Promise<string[]> {
  if (appIds.length === 0) return [];
  try {
    const db = serverDb();
    const { data } = await db.from("apps").select("id").in("id", appIds);
    const live = new Set((data ?? []).map((a) => a.id as string));
    const kept = appIds.filter((id) => live.has(id));
    if (kept.length !== appIds.length) {
      await db.from("users").update({ app_ids: kept }).eq("id", userId);
    }
    return kept;
  } catch (e) {
    console.error("[active-app] pruneDanglingApps failed (best-effort)", e);
    return appIds.filter(Boolean);
  }
}
