import { serverDb } from "@/lib/db/client";

/**
 * Link the app from a scan to the given user's app_ids array.
 * Idempotent — will not add a duplicate app_id.
 * Called from the auth callback after the magic-link is confirmed (Cycle 3).
 */
export async function linkScanToUser(scanId: string, userId: string): Promise<void> {
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

  if (user.app_ids.includes(appId)) return; // already linked, nothing to do

  const { error: updateError } = await db
    .from("users")
    .update({ app_ids: [...user.app_ids, appId] })
    .eq("id", userId);
  if (updateError) throw new Error(`linkScanToUser: update failed — ${updateError.message}`);
}
