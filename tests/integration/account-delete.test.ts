/**
 * deleteAccount — the account HARD-DELETE orchestration (launch P3b).
 *
 * The user↔data link is a `users.app_ids[]` array, NOT an FK, so nothing
 * cascades from deleting a `users` row. This guard proves the explicit
 * orchestration removes exactly the right footprint and NOTHING else:
 *   - the user's apps + their entire CASCADE subtree,
 *   - claim-only scans reached only by `claim_email` (PII orphan),
 *   - the `users` row itself,
 * while a second user's rows and global shared caches stay intact.
 *
 * Stripe cancel + auth-user delete are exercised in the no-op path (test users
 * are seeded straight into public.users with no auth row / no subscription);
 * deleteAccount tolerates the "already gone" 404 by design.
 *
 * Run with: pnpm test:int tests/integration/account-delete.test.ts
 */
import { afterAll, expect, test } from "vitest";
import { serverDb } from "@/lib/db/client";
import { deleteAccount } from "@/lib/account/delete";

const db = serverDb();
const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createdUserIds: string[] = [];
const createdAppIds: string[] = [];
const createdCacheKeys: string[] = [];

afterAll(async () => {
  for (const id of createdUserIds) await db.from("users").delete().eq("id", id);
  for (const id of createdAppIds) await db.from("apps").delete().eq("id", id);
  for (const k of createdCacheKeys) await db.from("search_cache").delete().eq("key", k);
});

async function seedApp(storeUrl: string): Promise<string> {
  const { data, error } = await db.from("apps").insert({ store_url: storeUrl, platform: "web" }).select("id").single();
  if (error || !data) throw new Error(`seed app failed: ${error?.message}`);
  createdAppIds.push(data.id);
  return data.id;
}

async function seedUser(email: string, appIds: string[]): Promise<string> {
  const { data, error } = await db.from("users").insert({ email, app_ids: appIds }).select("id").single();
  if (error || !data) throw new Error(`seed user failed: ${error?.message}`);
  createdUserIds.push(data.id);
  return data.id;
}

test("deletes the user's whole footprint, its cascade subtree, and claim-only scans — nothing else", async () => {
  const s = stamp();

  // --- Victim: userA with one tracked app + a full child subtree. ---
  const appA = await seedApp(`https://del-a-${s}.com`);
  const userA = await seedUser(`del-a-${s}@test.local`, [appA]);

  const scanA = (await db.from("scans").insert({ app_id: appA }).select("id").single()).data!.id;
  await db.from("actions").insert({ app_id: appA, scan_id: scanA, category: "seo", title: "Fix title" });
  await db.from("competitors").insert({ app_id: appA, source: "test" });
  await db.from("monitors").insert({ app_id: appA, kind: "keyword" });
  await db.from("outcomes").insert({ app_id: appA });
  await db.from("score_snapshots").insert({ app_id: appA, total: 42, breakdown: {} });
  await db.from("market_snapshots").insert({ app_id: appA, summary: "s" });

  // Claim-only scan: an app the user scanned but never added to app_ids, tagged
  // with their email. Reached ONLY by claim_email, not by the app delete.
  const appOrphan = await seedApp(`https://del-orphan-${s}.com`);
  const claimScan = (await db
    .from("scans")
    .insert({ app_id: appOrphan, claim_email: `del-a-${s}@test.local` })
    .select("id")
    .single()).data!.id;

  // --- Bystander: userB with their own app + children (must survive). ---
  const appB = await seedApp(`https://del-b-${s}.com`);
  const userB = await seedUser(`del-b-${s}@test.local`, [appB]);
  const scanB = (await db.from("scans").insert({ app_id: appB }).select("id").single()).data!.id;
  await db.from("competitors").insert({ app_id: appB, source: "test" });

  // --- Global shared cache (cross-user; must survive). ---
  const cacheKey = `del-cache-${s}`;
  await db.from("search_cache").insert({ key: cacheKey, response: { x: 1 } });
  createdCacheKeys.push(cacheKey);

  // --- Act. ---
  const result = await deleteAccount(userA);
  expect(result.deletedApps).toBe(1);
  expect(result.deletedClaimScans).toBe(1);
  expect(result.canceledSubscription).toBe(false);

  // --- Victim gone: user row, app, cascade subtree, claim scan. ---
  expect((await db.from("users").select("id").eq("id", userA).maybeSingle()).data).toBeNull();
  expect((await db.from("apps").select("id").eq("id", appA).maybeSingle()).data).toBeNull();
  expect((await db.from("scans").select("id").eq("id", scanA).maybeSingle()).data).toBeNull();
  expect((await db.from("scans").select("id").eq("id", claimScan).maybeSingle()).data).toBeNull();
  expect((await db.from("actions").select("id").eq("app_id", appA)).data).toEqual([]);
  expect((await db.from("competitors").select("id").eq("app_id", appA)).data).toEqual([]);
  expect((await db.from("monitors").select("id").eq("app_id", appA)).data).toEqual([]);
  expect((await db.from("outcomes").select("id").eq("app_id", appA)).data).toEqual([]);
  expect((await db.from("score_snapshots").select("id").eq("app_id", appA)).data).toEqual([]);
  expect((await db.from("market_snapshots").select("id").eq("app_id", appA)).data).toEqual([]);

  // --- Bystander untouched: no collateral. ---
  expect((await db.from("users").select("id").eq("id", userB).maybeSingle()).data?.id).toBe(userB);
  expect((await db.from("apps").select("id").eq("id", appB).maybeSingle()).data?.id).toBe(appB);
  expect((await db.from("scans").select("id").eq("id", scanB).maybeSingle()).data?.id).toBe(scanB);
  expect((await db.from("competitors").select("id").eq("app_id", appB)).data?.length).toBe(1);

  // --- Shared cache untouched. ---
  expect((await db.from("search_cache").select("key").eq("key", cacheKey).maybeSingle()).data?.key).toBe(cacheKey);
});

test("missing account throws AccountNotFoundError", async () => {
  const { AccountNotFoundError } = await import("@/lib/account/delete");
  await expect(deleteAccount("00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(AccountNotFoundError);
});
