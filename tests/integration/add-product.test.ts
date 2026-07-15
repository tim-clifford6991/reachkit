/**
 * addTrackedProduct — zero→one AND N→N+1 (supersedes add-first-product.test.ts).
 *
 * addFirstTrackedProduct always inserted (no dedupe) and triggered NO scan at
 * all — a zero-app user adding via Settings landed on an empty dashboard. It
 * also hard-threw for any N>0 user, so it never covered the N→N+1 transition.
 * addTrackedProduct is the ONE shared executor for both: it always resolves
 * through resolveProductScan and always produces a scan.
 *
 * Run: INNGEST_SIGNING_KEY=local-dummy pnpm test:int tests/integration/add-product.test.ts
 */
import { afterAll, expect, test } from "vitest";
import { serverDb } from "@/lib/db/client";
import { addTrackedProduct, AddProductError } from "@/lib/app/add-product";

const db = serverDb();
const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const users: string[] = []; const apps: string[] = [];
afterAll(async () => {
  for (const id of users) await db.from("users").delete().eq("id", id);
  for (const id of apps) await db.from("apps").delete().eq("id", id);
});
async function seedUser(tier: string, appIds: string[] = []) {
  const { data } = await db.from("users").insert({ email: `add-${stamp()}@test.local`, tier, app_ids: appIds }).select("id").single();
  users.push(data!.id); return data!.id as string;
}

test("zero-app user: creates the app, links it, AND starts a scan (the old lib created an UNSCANNED app)", async () => {
  const userId = await seedUser("growth");
  const url = `https://add-${stamp()}.example.com/`;
  const { appId, scanId } = await addTrackedProduct(userId, url);
  apps.push(appId);
  const { data: user } = await db.from("users").select("app_ids").eq("id", userId).single();
  expect(user!.app_ids).toEqual([appId]);
  expect(scanId, "a product must never be added without a scan").toBeTruthy();
  const { data: scan } = await db.from("scans").select("tier, app_id").eq("id", scanId!).single();
  expect(scan!.app_id).toBe(appId);
});

test("N→N+1: a growth user adds a SECOND product (the old lib threw here)", async () => {
  const first = await db.from("apps").insert({ store_url: `https://first-${stamp()}.com/`, platform: "web" }).select("id").single();
  apps.push(first.data!.id);
  const userId = await seedUser("growth", [first.data!.id]);
  const { appId } = await addTrackedProduct(userId, `https://second-${stamp()}.example.com/`);
  apps.push(appId);
  const { data: user } = await db.from("users").select("app_ids").eq("id", userId).single();
  expect(user!.app_ids).toHaveLength(2);
});

test("at the tier cap: refuses and creates NOTHING", async () => {
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const a = await db.from("apps").insert({ store_url: `https://cap${i}-${stamp()}.com/`, platform: "web" }).select("id").single();
    apps.push(a.data!.id); ids.push(a.data!.id);
  }
  const userId = await seedUser("growth", ids); // growth cap = 3
  const url = `https://over-${stamp()}.example.com/`;
  await expect(addTrackedProduct(userId, url)).rejects.toBeInstanceOf(AddProductError);
  const { data: app } = await db.from("apps").select("id").eq("store_url", url).maybeSingle();
  expect(app, "a capped add must not leave an orphan app row").toBeNull();
});
