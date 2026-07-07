"use server";

/**
 * Settings server actions (Wave D launch ops — minimum-viable user management).
 *
 * updateProductUrl: lets the app owner change the tracked product URL
 * (apps.store_url). Reuses `classifyUrl` — the same normalizer the scan
 * intake (`app/api/scan/route.ts`) uses — so "example.com" becomes
 * "https://example.com" and App/Play Store links reclassify `platform`
 * automatically.
 *
 * Two cases, keyed on whether the HOST changed:
 *   - Same host (a correction — e.g. adding a `/pricing` path): update
 *     `store_url` in place and keep all existing intel; the next scan uses the
 *     tweaked URL. Cheap, non-destructive.
 *   - Different host (a genuine product switch): `switchTrackedProduct` mints a
 *     fresh app and repoints the tracked slot, so the old product's mismatched
 *     scans/competitors/plan are no longer shown. NOTHING expensive fires — no
 *     re-onboarding, no automatic scan. The dashboard's "no scan yet" empty
 *     state then invites a single on-demand scan of the new product.
 */

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/server";
import { serverDb } from "@/lib/db/client";
import { classifyUrl } from "@/lib/scan/router";
import { normalizeHost } from "@/lib/scan/referral/classify";
import { switchTrackedProduct } from "@/lib/app/switch-product";
import { ACTIVE_APP_COOKIE } from "@/lib/app/active-app";

export type UpdateProductUrlResult =
  | { ok: true; switched: boolean; host: string }
  | { ok: false; error: string };

export async function updateProductUrl(
  appId: string,
  formData: FormData,
): Promise<UpdateProductUrlResult> {
  let userId: string;
  let appIds: string[];
  try {
    const { user } = await requireUser();
    userId = user.id;
    appIds = user.app_ids ?? [];
  } catch {
    return { ok: false, error: "You need to be signed in to do that." };
  }

  // Ownership — the app must belong to this user (same check as the
  // manual-refresh route, app/api/app/[id]/refresh/route.ts).
  if (!appId || !appIds.includes(appId)) {
    return { ok: false, error: "You don't have access to this app." };
  }

  const raw = String(formData.get("store_url") ?? "").trim();
  if (!raw) {
    return { ok: false, error: "Enter a URL." };
  }

  let routed: { platform: "ios" | "android" | "web"; url: string };
  try {
    routed = classifyUrl(raw);
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }

  const db = serverDb();
  const { data: appRow } = await db.from("apps").select("store_url").eq("id", appId).maybeSingle();
  const currentHost = appRow?.store_url ? normalizeHost(appRow.store_url) : "";
  const nextHost = normalizeHost(routed.url);
  const isSwitch = !!currentHost && !!nextHost && currentHost !== nextHost;

  if (isSwitch) {
    // Different product → fresh app + repoint the tracked slot. Old intel is
    // left behind (unreferenced), no scan/onboarding runs.
    let newAppId: string;
    try {
      ({ newAppId } = await switchTrackedProduct(userId, appId, routed.url, routed.platform));
    } catch {
      return { ok: false, error: "Couldn't switch product — please try again." };
    }
    // Point the active-app selection at the new slot so the dashboard shows it
    // immediately (Growth users especially, where app_ids[0] may be another app).
    (await cookies()).set(ACTIVE_APP_COOKIE, newAppId, { path: "/", sameSite: "lax" });
    revalidatePath("/app/settings");
    revalidatePath("/app");
    revalidatePath("/app/dashboard");
    return { ok: true, switched: true, host: nextHost };
  }

  // Same host → in-place correction, keep existing intel.
  const { error } = await db
    .from("apps")
    .update({ store_url: routed.url, platform: routed.platform })
    .eq("id", appId);

  if (error) {
    return { ok: false, error: "Couldn't save — please try again." };
  }

  revalidatePath("/app/settings");
  revalidatePath("/app");
  return { ok: true, switched: false, host: nextHost };
}
