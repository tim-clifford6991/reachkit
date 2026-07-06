/**
 * Switching the tracked product to a *different* domain.
 *
 * A Tracked-product URL edit that stays on the same host (e.g. adding a `/pricing`
 * path) is a correction — the caller updates `store_url` in place and keeps all
 * the existing intel. But pointing at a genuinely different product means the
 * old scans, competitors, score history and plan describe something else. Rather
 * than delete that data (which would also take down the old product's public
 * teardown/SEO page), we mint a FRESH app row for the new URL and repoint the
 * user's active slot to it. The old app becomes unreferenced by this user — its
 * derived intel is simply no longer shown, and no expensive re-onboarding or scan
 * fires here. The dashboard's existing "no scan yet" empty state then invites a
 * single on-demand scan of the new product.
 */
import { serverDb } from "@/lib/db/client";

export interface SwitchResult {
  /** The new, unscanned app now occupying the user's tracked slot. */
  newAppId: string;
}

/**
 * Create a new app for `url`/`platform` and swap it in for `oldAppId` in the
 * user's `app_ids` (preserving order and any other tracked apps). Idempotent
 * enough for a form submit: a failure leaves the old app in place.
 */
export async function switchTrackedProduct(
  userId: string,
  oldAppId: string,
  url: string,
  platform: "ios" | "android" | "web",
): Promise<SwitchResult> {
  const db = serverDb();

  const { data: created, error: createErr } = await db
    .from("apps")
    .insert({ store_url: url, platform })
    .select("id")
    .single();
  if (createErr || !created) {
    throw new Error(`switchTrackedProduct: failed to create app — ${createErr?.message}`);
  }
  const newAppId = created.id as string;

  const { data: user, error: userErr } = await db
    .from("users")
    .select("app_ids")
    .eq("id", userId)
    .single();
  if (userErr || !user) {
    throw new Error(`switchTrackedProduct: user lookup failed — ${userErr?.message}`);
  }

  const current: string[] = user.app_ids ?? [];
  // Replace the old slot in place; if it wasn't present, append (defensive).
  const next = current.includes(oldAppId)
    ? current.map((id) => (id === oldAppId ? newAppId : id))
    : [...current, newAppId];

  const { error: updErr } = await db.from("users").update({ app_ids: next }).eq("id", userId);
  if (updErr) {
    throw new Error(`switchTrackedProduct: failed to repoint app_ids — ${updErr.message}`);
  }

  return { newAppId };
}
