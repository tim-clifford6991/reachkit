/**
 * Integration test for scan abuse controls (Cycle 5 Task 1, R4 / §12).
 *
 * Real Supabase. Verifies against actual rows:
 *   - Dedupe: a second request for the same store_url returns the SAME existing
 *     scan id without creating a new scan row (via findAppByUrl +
 *     findExistingScanForApp, the helpers the route uses).
 *   - Rate limit: >RATE_LIMIT scans for one ip_hash in the last hour →
 *     assertRateLimit throws AbuseError; under the limit → resolves.
 *   - Fixture mode: assertRateLimit resolves regardless of count.
 *
 * Run with: pnpm test:int tests/integration/scan-abuse.test.ts
 */

import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { serverDb } from "@/lib/db/client";
import {
  AbuseError,
  RATE_LIMIT,
  assertRateLimit,
  findAppByUrl,
  findExistingScanForApp,
  hashIp,
} from "@/lib/scan/abuse";
import * as fixtures from "@/lib/dev/fixtures";

const createdAppIds: string[] = [];

async function seedApp(storeUrl: string): Promise<string> {
  const db = serverDb();
  const { data, error } = await db
    .from("apps")
    .insert({ store_url: storeUrl, platform: "web" })
    .select("id")
    .single();
  if (error) throw error;
  createdAppIds.push(data.id);
  return data.id;
}

async function seedScan(appId: string, ipHash: string, createdAt?: string): Promise<string> {
  const db = serverDb();
  const row: { app_id: string; status: string; ip_hash: string; created_at?: string } = {
    app_id: appId,
    status: "queued",
    ip_hash: ipHash,
  };
  if (createdAt) row.created_at = createdAt;
  const { data, error } = await db.from("scans").insert(row).select("id").single();
  if (error) throw error;
  return data.id;
}

async function countScansForApp(appId: string): Promise<number> {
  const db = serverDb();
  const { count, error } = await db
    .from("scans")
    .select("id", { count: "exact", head: true })
    .eq("app_id", appId);
  if (error) throw error;
  return count ?? 0;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  const db = serverDb();
  // scans cascade-delete with their app.
  for (const id of createdAppIds) await db.from("apps").delete().eq("id", id);
});

describe("dedupe — one scan per app", () => {
  test(
    "an existing scan is returned for a known store_url; no duplicate is created",
    async () => {
      const url = `https://dedupe-${Date.now()}.example.com/app`;
      const ipHash = hashIp(`dedupe-${Date.now()}`);
      const appId = await seedApp(url);
      const firstScanId = await seedScan(appId, ipHash);

      // The route's find-or-create path: app exists → return existing scan id.
      const foundAppId = await findAppByUrl(url);
      expect(foundAppId).toBe(appId);
      if (!foundAppId) throw new Error("expected app to be found");
      const existingScanId = await findExistingScanForApp(foundAppId);
      expect(existingScanId).toBe(firstScanId);

      // Re-requesting must not create a new scan row.
      expect(await countScansForApp(appId)).toBe(1);
    },
    20_000,
  );

  test(
    "findExistingScanForApp returns the MOST RECENT scan (created_at desc)",
    async () => {
      const url = `https://dedupe-recent-${Date.now()}.example.com/app`;
      const ipHash = hashIp(`dedupe-recent-${Date.now()}`);
      const appId = await seedApp(url);
      const older = await seedScan(appId, ipHash, new Date(Date.now() - 60_000).toISOString());
      const newer = await seedScan(appId, ipHash, new Date().toISOString());

      const latest = await findExistingScanForApp(appId);
      expect(latest).toBe(newer);
      expect(latest).not.toBe(older);
    },
    20_000,
  );

  test("findAppByUrl returns null for an unknown url", async () => {
    expect(await findAppByUrl(`https://never-seen-${Date.now()}.example.com`)).toBeNull();
  });
});

describe("per-IP rate limit", () => {
  test(
    "throws AbuseError once >= RATE_LIMIT scans exist for the ip_hash in the last hour",
    async () => {
      const ipHash = hashIp(`rate-${Date.now()}-${Math.random()}`);
      const appId = await seedApp(`https://rate-${Date.now()}.example.com/app`);

      // Seed exactly RATE_LIMIT scans within the window → at the cap.
      for (let i = 0; i < RATE_LIMIT; i++) await seedScan(appId, ipHash);

      await expect(assertRateLimit(ipHash)).rejects.toBeInstanceOf(AbuseError);
      await expect(assertRateLimit(ipHash)).rejects.toMatchObject({ kind: "rate_limit" });
    },
    30_000,
  );

  test(
    "resolves when under the limit, and ignores scans older than the 1h window",
    async () => {
      const ipHash = hashIp(`rate-under-${Date.now()}-${Math.random()}`);
      const appId = await seedApp(`https://rate-under-${Date.now()}.example.com/app`);

      // RATE_LIMIT-1 recent (under cap) + a pile of OLD ones that must not count.
      for (let i = 0; i < RATE_LIMIT - 1; i++) await seedScan(appId, ipHash);
      const old = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      for (let i = 0; i < 5; i++) await seedScan(appId, ipHash, old);

      await expect(assertRateLimit(ipHash)).resolves.toBeUndefined();
    },
    30_000,
  );
});

describe("fixture/dev escape", () => {
  test(
    "assertRateLimit resolves regardless of count when fixtures are enabled",
    async () => {
      vi.spyOn(fixtures, "fixturesEnabled").mockReturnValue(true);
      const ipHash = hashIp(`fixture-${Date.now()}-${Math.random()}`);
      const appId = await seedApp(`https://fixture-${Date.now()}.example.com/app`);
      for (let i = 0; i < RATE_LIMIT + 3; i++) await seedScan(appId, ipHash);

      await expect(assertRateLimit(ipHash)).resolves.toBeUndefined();
    },
    30_000,
  );
});
