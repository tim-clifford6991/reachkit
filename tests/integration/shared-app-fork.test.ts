/**
 * updateProductUrlForUser on a SHARED apps row — fork, never mutate in place.
 *
 * Since the attach path (PR #72) two users tracking the same URL share one
 * `apps` row. The Settings same-host URL edit used to update `store_url` in
 * place, letting any co-owner silently rewrite the product the OTHER user
 * tracks (cross-tenant tamper, security review 2026-07-15). This guard proves:
 *   - a same-host edit on a shared row FORKS: the editor moves to a fresh app
 *     row carrying the new URL, the victim's row is byte-identical untouched;
 *   - a same-host edit on a sole-owner row still updates in place (the cheap
 *     correction path is preserved).
 *
 * Run with: pnpm test:int tests/integration/shared-app-fork.test.ts
 */
import { afterAll, expect, test } from "vitest";
import { serverDb } from "@/lib/db/client";
import { updateProductUrlForUser } from "@/lib/app/update-product-url";

const db = serverDb();
const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createdUserIds: string[] = [];
const createdAppIds: string[] = [];

afterAll(async () => {
  for (const id of createdUserIds) await db.from("users").delete().eq("id", id);
  for (const id of createdAppIds) await db.from("apps").delete().eq("id", id);
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

test("forks instead of mutating in place when 2+ users track the same app", async () => {
  const s = stamp();
  const sharedUrl = `https://shared-fork-${s}.example.com`;

  const appId = await seedApp(sharedUrl);
  const userA = await seedUser(`fork-a-${s}@test.local`, [appId]);
  const userB = await seedUser(`fork-b-${s}@test.local`, [appId]);

  // User A edits the URL — same host (classifyUrl canonicalizes web URLs to
  // the bare origin, so any same-host variant lands on the in-place branch —
  // the shape that used to mutate the shared row).
  const result = await updateProductUrlForUser(userA, appId, `${sharedUrl}/new-page`);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("unreachable");
  expect(result.switched).toBe(true);
  expect(result.newAppId).toBeTruthy();
  createdAppIds.push(result.newAppId!);

  // Victim's row untouched — B still tracks the original URL on the original row.
  const { data: original } = await db.from("apps").select("store_url").eq("id", appId).single();
  expect(original!.store_url).toBe(sharedUrl);
  const { data: rowB } = await db.from("users").select("app_ids").eq("id", userB).single();
  expect(rowB!.app_ids).toContain(appId);

  // Editor moved to a forked row carrying the new URL.
  const { data: rowA } = await db.from("users").select("app_ids").eq("id", userA).single();
  expect(rowA!.app_ids).not.toContain(appId);
  expect(rowA!.app_ids).toContain(result.newAppId);
  const { data: forked } = await db.from("apps").select("store_url").eq("id", result.newAppId!).single();
  expect(forked!.store_url).toBe(`${sharedUrl}/`); // canonical bare origin (classifyUrl)
});

test("sole owner still gets the cheap in-place correction (no fork)", async () => {
  const s = stamp();
  const url = `https://solo-edit-${s}.example.com`;

  const appId = await seedApp(url);
  const user = await seedUser(`solo-${s}@test.local`, [appId]);

  const result = await updateProductUrlForUser(user, appId, `${url}/pricing`);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("unreachable");
  expect(result.switched).toBe(false);
  expect(result.newAppId).toBeNull();

  // Same row, canonicalized URL; the user's app_ids are unchanged.
  const { data: app } = await db.from("apps").select("store_url").eq("id", appId).single();
  expect(app!.store_url).toBe(`${url}/`); // canonical bare origin (classifyUrl)
  const { data: row } = await db.from("users").select("app_ids").eq("id", user).single();
  expect(row!.app_ids).toContain(appId);
});
