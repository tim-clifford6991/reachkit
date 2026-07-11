/**
 * Attaching a user's FIRST tracked product.
 *
 * Provisioning normally links an app at checkout (Path A: purchase from a scan
 * report). But Path B (direct checkout, no prior scan) — and any provisioning
 * miss — leaves a paid user with `app_ids = []`, and every intel page redirects
 * app-less users to Settings. Before this existed, Settings could only EDIT an
 * app you already owned, so a zero-app user was hard-stuck in a redirect loop
 * with no way to attach a product (live-hit 2026-07-11). This is the missing
 * zero → one transition; `switchTrackedProduct` handles one → different.
 */
import { serverDb } from "@/lib/db/client";

export interface AddFirstResult {
  /** The new, unscanned app now occupying the user's tracked slot. */
  newAppId: string;
}

/**
 * Create an app for `url`/`platform` and attach it as the user's only tracked
 * app. Refuses when the user already tracks something (that's an edit/switch,
 * not an add — and tier app-limits are enforced by the switch/add-slot flows).
 */
export async function addFirstTrackedProduct(
  userId: string,
  url: string,
  platform: "ios" | "android" | "web",
): Promise<AddFirstResult> {
  const db = serverDb();

  // Re-read ownership server-side — never trust the caller's view of app_ids.
  const { data: user, error: userErr } = await db
    .from("users")
    .select("app_ids")
    .eq("id", userId)
    .single();
  if (userErr || !user) {
    throw new Error(`addFirstTrackedProduct: user lookup failed — ${userErr?.message}`);
  }
  if ((user.app_ids ?? []).length > 0) {
    throw new Error("addFirstTrackedProduct: user already tracks a product");
  }

  const { data: created, error: createErr } = await db
    .from("apps")
    .insert({ store_url: url, platform })
    .select("id")
    .single();
  if (createErr || !created) {
    throw new Error(`addFirstTrackedProduct: failed to create app — ${createErr?.message}`);
  }
  const newAppId = created.id as string;

  const { error: updErr } = await db.from("users").update({ app_ids: [newAppId] }).eq("id", userId);
  if (updErr) {
    throw new Error(`addFirstTrackedProduct: failed to attach app — ${updErr.message}`);
  }

  return { newAppId };
}
