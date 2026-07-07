import { serverDb } from "@/lib/db/client";
import { entitlementsFor } from "@/lib/billing/entitlements";

/**
 * Link the app from a scan to the given user's app_ids array.
 * Idempotent — will not add a duplicate app_id.
 * Called from the auth callback after the magic-link is confirmed (Cycle 3),
 * and from the scan API when a signed-in user scans a URL.
 *
 * Enforces the tier's product cap here so it holds on EVERY path: the cap was
 * previously only a client-side grey-out on the "add product" button, so a
 * signed-in user running a free scan of any new URL (POST /api/scan) silently
 * bypassed it (e.g. a Growth/limit-3 account reaching 5 products). At the cap
 * we leave the scan untracked (it still exists as a public teardown) rather
 * than throwing — the scan itself must never fail on a limit.
 *
 * Returns true if the app was linked, false if skipped (duplicate or at cap).
 */
export async function linkScanToUser(scanId: string, userId: string): Promise<boolean> {
  const db = serverDb();

  // Resolve the app_id for this scan.
  const { data: scan, error: scanError } = await db
    .from("scans")
    .select("app_id")
    .eq("id", scanId)
    .single();
  if (scanError) throw new Error(`linkScanToUser: scan lookup failed — ${scanError.message}`);

  const appId = scan.app_id;

  // Fetch the current app_ids so we can guard against duplicates.
  const { data: user, error: userError } = await db
    .from("users")
    .select("app_ids")
    .eq("id", userId)
    .single();
  if (userError) throw new Error(`linkScanToUser: user lookup failed — ${userError.message}`);

  if (user.app_ids.includes(appId)) return false; // already linked, nothing to do

  // Product cap: don't push the user past their tier's app limit.
  const { limits } = await entitlementsFor(userId);
  if (user.app_ids.length >= limits.apps) {
    console.info(
      `[linkScanToUser] user ${userId} at product cap (${user.app_ids.length}/${limits.apps}); scan ${scanId} left untracked`,
    );
    return false;
  }

  const { error: updateError } = await db
    .from("users")
    .update({ app_ids: [...user.app_ids, appId] })
    .eq("id", userId);
  if (updateError) throw new Error(`linkScanToUser: update failed — ${updateError.message}`);
  return true;
}
