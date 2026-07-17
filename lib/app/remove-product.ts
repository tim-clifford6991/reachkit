/**
 * Stop tracking a product. The counterpart to `addTrackedProduct` — and the
 * reason the cap copy ("Upgrade or remove one to add another") was a dead end:
 * no such path existed. The ONLY code that shrank `users.app_ids` was
 * `lib/account/delete.ts`, i.e. deleting your whole account. A growth customer
 * at 3/3 was therefore permanently capped and told to do two impossible things.
 *
 * UNLINK ONLY. `apps` is keyed by URL globally, so two users tracking one URL
 * share an `app_id` (and therefore its scans/actions/competitors — spec
 * 2026-07-15 Risks). Deleting the row would destroy another user's data.
 * Removal is a per-user link operation, never a delete.
 */
import { serverDb } from "@/lib/db/client";

export class RemoveProductError extends Error {
  constructor(
    public code: "not_tracked",
    message: string,
  ) {
    super(message);
    this.name = "RemoveProductError";
  }
}

export async function removeTrackedProduct(userId: string, appId: string): Promise<void> {
  const db = serverDb();
  const { data: user } = await db.from("users").select("app_ids").eq("id", userId).maybeSingle();
  const appIds: string[] = user?.app_ids ?? [];
  if (!appIds.includes(appId)) {
    throw new RemoveProductError("not_tracked", "You're not tracking that product.");
  }
  const { error } = await db
    .from("users")
    .update({ app_ids: appIds.filter((id) => id !== appId) })
    .eq("id", userId);
  if (error) throw new Error(`removeTrackedProduct: unlink failed — ${error.message}`);
}
