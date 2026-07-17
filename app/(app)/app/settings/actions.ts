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
import { normalizeHost } from "@/lib/scan/referral/classify";
import { updateProductUrlForUser } from "@/lib/app/update-product-url";
import { addTrackedProduct, AddProductError } from "@/lib/app/add-product";
import { removeTrackedProduct, RemoveProductError } from "@/lib/app/remove-product";
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

export type AddFirstProductResult =
  | { ok: true; host: string; scanId: string | null }
  | { ok: false; error: string };

/**
 * Attach a zero-app user's FIRST tracked product. Every intel page redirects
 * app-less users to Settings, and updateProductUrl can only edit an app you
 * already own — without this action a paid user provisioned with no app
 * (Path B direct checkout, or any provisioning miss) was hard-stuck in a
 * redirect loop (live-hit 2026-07-11).
 *
 * Delegates to `addTrackedProduct` — the single shared product-resolution
 * policy (spec 2026-07-15) also used by `/api/scan` and `/app/add`. The
 * lib this used to call, `addFirstTrackedProduct`, always inserted a fresh
 * app with NO dedupe and started NO scan, leaving "the new, unscanned app"
 * occupying the user's tracked slot — a zero-app user adding here landed on
 * an empty dashboard. `addTrackedProduct` always resolves through the shared
 * dedupe/staleness policy and always produces a scan (`scanId` can still be
 * `null` if the scan-row insert itself failed — the app still links and the
 * dashboard offers a retry; that is not an error to swallow).
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

  let newAppId: string;
  let scanId: string | null;
  try {
    const { appId, scanId: startedScanId } = await addTrackedProduct(userId, raw);
    newAppId = appId;
    scanId = startedScanId;
  } catch (e) {
    if (e instanceof AddProductError) return { ok: false, error: e.message };
    return { ok: false, error: "Couldn't add your product — please try again." };
  }

  (await cookies()).set(ACTIVE_APP_COOKIE, newAppId, { path: "/", sameSite: "lax" });
  revalidatePath("/app/settings");
  revalidatePath("/app");
  revalidatePath("/app/dashboard");
  return { ok: true, host: normalizeHost(raw), scanId };
}

export type RemoveProductResult = { ok: true } | { ok: false; error: string };

/**
 * Stop tracking a product. The action the cap error ("remove one in Settings")
 * promised long before any code delivered it — until now the only path that
 * shrank `users.app_ids` was deleting the whole account.
 *
 * Delegates to `removeTrackedProduct` (unlink only — `apps` rows are shared by
 * URL, never deleted here). If the removed app was the ACTIVE one, clear the
 * cookie so the dashboard falls back to another tracked app (or the empty state)
 * instead of pointing at an app the user no longer tracks.
 */
export async function removeProduct(appId: string): Promise<RemoveProductResult> {
  let userId: string;
  try {
    const { user } = await requireUser();
    userId = user.id;
  } catch {
    return { ok: false, error: "You need to be signed in to do that." };
  }

  try {
    await removeTrackedProduct(userId, appId);
  } catch (e) {
    if (e instanceof RemoveProductError) return { ok: false, error: e.message };
    return { ok: false, error: "Couldn't remove that product — please try again." };
  }

  const jar = await cookies();
  if (jar.get(ACTIVE_APP_COOKIE)?.value === appId) {
    jar.delete(ACTIVE_APP_COOKIE);
  }
  revalidatePath("/app/settings");
  revalidatePath("/app");
  revalidatePath("/app/dashboard");
  return { ok: true };
}
