/**
 * addFirstTrackedProduct — the zero → one tracked-product transition.
 *
 * Guard for the 2026-07-11 live incident: a paid user provisioned with
 * `app_ids = []` (Path B direct checkout) was hard-stuck — every intel page
 * redirects app-less users to /app/settings, and the settings action could
 * only EDIT an app you already owned. This tests the lib core the
 * `addFirstProduct` server action wraps (same lib-level pattern as
 * app-refresh-route.test.ts — server actions need a real cookie session).
 *
 * Run with: pnpm test:int tests/integration/add-first-product.test.ts
 */
import { afterAll, expect, test } from "vitest";
import { serverDb } from "@/lib/db/client";
import { addFirstTrackedProduct } from "@/lib/app/add-first-product";

const createdUserIds: string[] = [];
const createdAppIds: string[] = [];

afterAll(async () => {
  const db = serverDb();
  for (const id of createdUserIds) await db.from("users").delete().eq("id", id);
  for (const id of createdAppIds) await db.from("apps").delete().eq("id", id);
});

async function seedUser(appIds: string[]): Promise<string> {
  const db = serverDb();
  const { data, error } = await db
    .from("users")
    .insert({ email: `add-first-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`, app_ids: appIds })
    .select("id")
    .single();
  if (error || !data) throw new Error(`seed user failed: ${error?.message}`);
  createdUserIds.push(data.id as string);
  return data.id as string;
}

test("zero-app user: creates the app and attaches it as the only tracked slot", async () => {
  const db = serverDb();
  const userId = await seedUser([]);

  const { newAppId } = await addFirstTrackedProduct(userId, "https://example-first.com", "web");
  createdAppIds.push(newAppId);

  const { data: user } = await db.from("users").select("app_ids").eq("id", userId).single();
  expect(user?.app_ids).toEqual([newAppId]);

  const { data: app } = await db.from("apps").select("store_url, platform").eq("id", newAppId).single();
  expect(app?.store_url).toBe("https://example-first.com");
  expect(app?.platform).toBe("web");
});

test("user who already tracks a product: refuses (that's an edit/switch, not an add)", async () => {
  const db = serverDb();
  const { data: existing, error } = await db
    .from("apps")
    .insert({ store_url: "https://already-tracked.com", platform: "web" })
    .select("id")
    .single();
  if (error || !existing) throw new Error("seed app failed");
  createdAppIds.push(existing.id as string);

  const userId = await seedUser([existing.id as string]);

  await expect(addFirstTrackedProduct(userId, "https://second.com", "web")).rejects.toThrow(
    /already tracks/,
  );

  // app_ids untouched.
  const { data: user } = await db.from("users").select("app_ids").eq("id", userId).single();
  expect(user?.app_ids).toEqual([existing.id]);
});
