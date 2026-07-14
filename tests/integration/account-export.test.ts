/**
 * exportAccount — self-serve GDPR data export (launch P3b).
 *
 * Guard: the export is strictly scoped to the caller — it returns the user's own
 * profile, apps, scans (owned + claimed-by-email) and app-scoped children, and
 * NEVER another user's rows. Same footprint as the delete routine.
 *
 * Run with: pnpm test:int tests/integration/account-export.test.ts
 */
import { afterAll, expect, test } from "vitest";
import { serverDb } from "@/lib/db/client";
import { exportAccount } from "@/lib/account/export";

const db = serverDb();
const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createdUserIds: string[] = [];
const createdAppIds: string[] = [];

afterAll(async () => {
  for (const id of createdUserIds) await db.from("users").delete().eq("id", id);
  for (const id of createdAppIds) await db.from("apps").delete().eq("id", id);
});

async function seedApp(storeUrl: string): Promise<string> {
  const { data } = await db.from("apps").insert({ store_url: storeUrl, platform: "web" }).select("id").single();
  createdAppIds.push(data!.id);
  return data!.id;
}
async function seedUser(email: string, appIds: string[]): Promise<string> {
  const { data } = await db.from("users").insert({ email, app_ids: appIds }).select("id").single();
  createdUserIds.push(data!.id);
  return data!.id;
}

test("exports the caller's own data only — no cross-user leakage", async () => {
  const s = stamp();

  const appA = await seedApp(`https://exp-a-${s}.com`);
  const emailA = `exp-a-${s}@test.local`;
  const userA = await seedUser(emailA, [appA]);
  const scanA = (await db.from("scans").insert({ app_id: appA }).select("id").single()).data!.id;
  await db.from("competitors").insert({ app_id: appA, source: "test" });
  await db.from("score_snapshots").insert({ app_id: appA, total: 55, breakdown: {} });

  // A scan claimed by userA's email whose app isn't in app_ids — must be included.
  const appOrphan = await seedApp(`https://exp-orphan-${s}.com`);
  const claimScan = (await db.from("scans").insert({ app_id: appOrphan, claim_email: emailA }).select("id").single()).data!.id;

  // Bystander userB — must NEVER appear in userA's export.
  const appB = await seedApp(`https://exp-b-${s}.com`);
  await seedUser(`exp-b-${s}@test.local`, [appB]);
  const scanB = (await db.from("scans").insert({ app_id: appB }).select("id").single()).data!.id;

  const out = await exportAccount(userA);

  // Own profile + apps.
  expect(out.user.id).toBe(userA);
  expect(out.user.email).toBe(emailA);
  expect(out.apps.map((a) => a.id)).toEqual([appA]);

  // Own scans (owned + claimed), never the bystander's.
  const scanIds = out.scans.map((sc) => sc.id);
  expect(scanIds).toContain(scanA);
  expect(scanIds).toContain(claimScan);
  expect(scanIds).not.toContain(scanB);

  // App-scoped children present and scoped.
  expect(out.competitors.every((c) => c.app_id === appA)).toBe(true);
  expect(out.competitors.length).toBe(1);
  expect(out.scoreSnapshots.length).toBe(1);

  // No row anywhere references the bystander's app.
  const allAppRefs = [...out.scans, ...out.competitors, ...out.scoreSnapshots].map((r) => (r as { app_id: string | null }).app_id);
  expect(allAppRefs).not.toContain(appB);
});

test("app-less user exports just their profile (no apps, no scans)", async () => {
  const s = stamp();
  const userId = await seedUser(`exp-none-${s}@test.local`, []);
  const out = await exportAccount(userId);
  expect(out.user.id).toBe(userId);
  expect(out.apps).toEqual([]);
  expect(out.scans).toEqual([]);
});
