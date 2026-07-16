"use server";

/**
 * Settings server actions (Wave D launch ops — minimum-viable user management).
 *
 * updateProductUrl: lets the app owner change the tracked product URL
 * (apps.store_url). The auth boundary (requireUser + ownership) plus
 * cookies/revalidation live here; the data mutation is
 * `updateProductUrlForUser` (`lib/app/update-product-url.ts`) so the
 * integration suite can exercise it directly — same split as `deleteAccount`.
 *
 * Three cases (see the helper for detail):
 *   - Same host, sole owner: in-place correction, keep existing intel.
 *   - Same host, SHARED row (2+ users track this app — normal since the attach
 *     path, PR #72): fork to a fresh row so a co-owner can never mutate the
 *     product another user tracks (security review 2026-07-15).
 *   - Different host (a genuine product switch): fresh app + repoint the slot.
 *     NOTHING expensive fires — no re-onboarding, no automatic scan.
 */

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/server";
import { classifyUrl } from "@/lib/scan/router";
import { normalizeHost } from "@/lib/scan/referral/classify";
import { updateProductUrlForUser } from "@/lib/app/update-product-url";
import { addFirstTrackedProduct } from "@/lib/app/add-first-product";
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

  const result = await updateProductUrlForUser(userId, appId, raw);
  if (!result.ok) {
    return result;
  }

  if (result.switched && result.newAppId) {
    // Point the active-app selection at the new slot so the dashboard shows it
    // immediately (Growth users especially, where app_ids[0] may be another app).
    (await cookies()).set(ACTIVE_APP_COOKIE, result.newAppId, { path: "/", sameSite: "lax" });
    revalidatePath("/app/settings");
    revalidatePath("/app");
    revalidatePath("/app/dashboard");
    return { ok: true, switched: true, host: result.host };
  }

  revalidatePath("/app/settings");
  revalidatePath("/app");
  return { ok: true, switched: false, host: result.host };
}

export type AddFirstProductResult = { ok: true; host: string } | { ok: false; error: string };

/**
 * Attach a zero-app user's FIRST tracked product. Every intel page redirects
 * app-less users to Settings, and updateProductUrl can only edit an app you
 * already own — without this action a paid user provisioned with no app
 * (Path B direct checkout, or any provisioning miss) was hard-stuck in a
 * redirect loop (live-hit 2026-07-11).
 */
export async function addFirstProduct(formData: FormData): Promise<AddFirstProductResult> {
  let userId: string;
  let appIds: string[];
  try {
    const { user } = await requireUser();
    userId = user.id;
    appIds = user.app_ids ?? [];
  } catch {
    return { ok: false, error: "You need to be signed in to do that." };
  }

  if (appIds.length > 0) {
    return { ok: false, error: "You're already tracking a product — edit its URL above instead." };
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

  let newAppId: string;
  try {
    ({ newAppId } = await addFirstTrackedProduct(userId, routed.url, routed.platform));
  } catch {
    return { ok: false, error: "Couldn't add your product — please try again." };
  }

  (await cookies()).set(ACTIVE_APP_COOKIE, newAppId, { path: "/", sameSite: "lax" });
  revalidatePath("/app/settings");
  revalidatePath("/app");
  revalidatePath("/app/dashboard");
  return { ok: true, host: normalizeHost(routed.url) };
}
