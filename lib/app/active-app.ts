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

/** The user's apps as {id, name}, in app_ids order, for the switcher dropdown. */
export async function userApps(appIds: string[]): Promise<AppOption[]> {
  if (appIds.length === 0) return [];
  const { data } = await serverDb().from("apps").select("id, name, store_url").in("id", appIds);
  const byId = new Map((data ?? []).map((a) => [a.id as string, a]));
  return appIds.map((id) => {
    const a = byId.get(id);
    const name = (a?.name as string | null) || (a?.store_url as string | null) || "Untitled app";
    return { id, name };
  });
}
