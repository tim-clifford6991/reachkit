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
 * NOTE: this does NOT re-trigger a scan. Cached intel (scans, findings,
 * score snapshots) stays keyed to the app's existing rows, which describe
 * the OLD domain — after a successful change the dashboard will show its
 * empty/calculating state until the next scan runs. That's an accepted
 * launch-minimum tradeoff; re-scan orchestration is out of scope here.
 */

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/server";
import { serverDb } from "@/lib/db/client";
import { classifyUrl } from "@/lib/scan/router";

export type UpdateProductUrlResult = { ok: true } | { ok: false; error: string };

export async function updateProductUrl(
  appId: string,
  formData: FormData,
): Promise<UpdateProductUrlResult> {
  let appIds: string[];
  try {
    const { user } = await requireUser();
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

  const { error } = await serverDb()
    .from("apps")
    .update({ store_url: routed.url, platform: routed.platform })
    .eq("id", appId);

  if (error) {
    return { ok: false, error: "Couldn't save — please try again." };
  }

  revalidatePath("/app/settings");
  revalidatePath("/app");
  return { ok: true };
}
