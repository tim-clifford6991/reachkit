/**
 * updateProductUrlForUser — the DB core of the Settings "edit tracked product
 * URL" action, extracted from `app/(app)/app/settings/actions.ts` so the
 * integration suite can exercise it directly (the same testability split
 * `deleteAccount` uses: the server action keeps auth/cookies/revalidation, the
 * lib helper owns the data mutation).
 *
 * Two cases, keyed on whether the HOST changed:
 *   - Same host (a correction — e.g. adding a `/pricing` path): update
 *     `store_url` in place and keep all existing intel — UNLESS the row is
 *     shared (see below).
 *   - Different host (a genuine product switch): `switchTrackedProduct` mints a
 *     fresh app and repoints the tracked slot.
 *
 * Shared rows fork, never mutate: since the attach path (PR #72) two users
 * tracking the same URL share ONE `apps` row. An in-place `store_url` edit by
 * one co-owner would silently rewrite the product the OTHER user tracks —
 * cross-tenant tampering (security review 2026-07-15). So when 2+ users hold
 * the row, even a same-host edit forks to a fresh row for the editor and
 * leaves the co-owner's row untouched.
 */
import { serverDb } from "@/lib/db/client";
import { classifyUrl } from "@/lib/scan/router";
import { normalizeHost } from "@/lib/scan/referral/classify";
import { switchTrackedProduct } from "@/lib/app/switch-product";

export type UpdateProductUrlOutcome =
  | { ok: true; switched: boolean; host: string; newAppId: string | null }
  | { ok: false; error: string };

export async function updateProductUrlForUser(
  userId: string,
  appId: string,
  rawUrl: string,
): Promise<UpdateProductUrlOutcome> {
  let routed: { platform: "ios" | "android" | "web"; url: string };
  try {
    routed = classifyUrl(rawUrl);
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }

  const db = serverDb();
  const { data: appRow } = await db.from("apps").select("store_url").eq("id", appId).maybeSingle();
  const currentHost = appRow?.store_url ? normalizeHost(appRow.store_url) : "";
  const nextHost = normalizeHost(routed.url);
  const isSwitch = !!currentHost && !!nextHost && currentHost !== nextHost;

  if (!isSwitch) {
    // A shared `apps` row (two users tracking the same URL — normal since the
    // attach path, PR #72) must never be edited in place: forking keeps the
    // co-owner's product identity intact (security review 2026-07-15).
    const { count: owners } = await db
      .from("users")
      .select("id", { count: "exact", head: true })
      .contains("app_ids", [appId]);

    if ((owners ?? 0) <= 1) {
      // Sole owner → in-place correction, keep existing intel.
      const { error } = await db
        .from("apps")
        .update({ store_url: routed.url, platform: routed.platform })
        .eq("id", appId);
      if (error) {
        return { ok: false, error: "Couldn't save — please try again." };
      }
      return { ok: true, switched: false, host: nextHost, newAppId: null };
    }
    // Shared → fall through to the fork path below (same as a host change).
  }

  // Different product, or a shared row → fresh app + repoint the tracked slot.
  // Old intel is left behind (unreferenced by this user), no scan/onboarding runs.
  let newAppId: string;
  try {
    ({ newAppId } = await switchTrackedProduct(userId, appId, routed.url, routed.platform));
  } catch {
    return { ok: false, error: "Couldn't switch product — please try again." };
  }
  return { ok: true, switched: true, host: nextHost, newAppId };
}
