/**
 * Integration test for scan abuse controls (Cycle 5 Task 1, R4 / §12).
 *
 * Real Supabase. Verifies against actual rows:
 *   - Dedupe: a second request for the same store_url returns the SAME existing
 *     scan id without creating a new scan row (via findAppByUrl +
 *     findExistingScanForApp, the helpers the route uses) — but ONLY when a
 *     reusable scan exists (a finished `done` scan, or a still-running scan
 *     created in the last 15 min). A lone `failed`/stale-stuck scan must NOT
 *     dedupe, so the url stays re-scannable.
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

async function seedScan(
  appId: string,
  ipHash: string,
  createdAt?: string,
  status = "queued",
): Promise<string> {
  const db = serverDb();
  const row: { app_id: string; status: string; ip_hash: string; created_at?: string } = {
    app_id: appId,
    status,
    ip_hash: ipHash,
  };
  if (createdAt) row.created_at = createdAt;
  const { data, error } = await db.from("scans").insert(row).select("id").single();
  if (error) throw error;
  return data.id;
}

/** A timestamp `minutes` in the past, as an ISO string. */
function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
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
    "among in-flight scans, the MOST RECENT (created_at desc) is returned",
    async () => {
      const url = `https://dedupe-recent-${Date.now()}.example.com/app`;
      const ipHash = hashIp(`dedupe-recent-${Date.now()}`);
      const appId = await seedApp(url);
      // Both still-running and within the 15-min window → newer wins.
      const older = await seedScan(appId, ipHash, minutesAgo(2), "queued");
      const newer = await seedScan(appId, ipHash, minutesAgo(1), "queued");

      const latest = await findExistingScanForApp(appId);
      expect(latest).toBe(newer);
      expect(latest).not.toBe(older);
    },
    20_000,
  );

  test(
    "a finished ('done') scan IS returned",
    async () => {
      const url = `https://dedupe-done-${Date.now()}.example.com/app`;
      const ipHash = hashIp(`dedupe-done-${Date.now()}`);
      const appId = await seedApp(url);
      // Old timestamp proves finished scans dedupe regardless of age.
      const doneScan = await seedScan(appId, ipHash, minutesAgo(60), "done");

      expect(await findExistingScanForApp(appId)).toBe(doneScan);
    },
    20_000,
  );

  test(
    "a lone 'failed' scan returns null (url stays re-scannable)",
    async () => {
      const url = `https://dedupe-failed-${Date.now()}.example.com/app`;
      const ipHash = hashIp(`dedupe-failed-${Date.now()}`);
      const appId = await seedApp(url);
      await seedScan(appId, ipHash, undefined, "failed");

      expect(await findExistingScanForApp(appId)).toBeNull();
    },
    20_000,
  );

  test(
    "a stale-stuck 'queued' scan (older than 15 min) returns null",
    async () => {
      const url = `https://dedupe-stale-${Date.now()}.example.com/app`;
      const ipHash = hashIp(`dedupe-stale-${Date.now()}`);
      const appId = await seedApp(url);
      // Stuck just past the in-flight window → treated as dead.
      await seedScan(appId, ipHash, minutesAgo(16), "queued");

      expect(await findExistingScanForApp(appId)).toBeNull();
    },
    20_000,
  );

  test(
    "a fresh 'queued' scan (within 15 min) IS returned",
    async () => {
      const url = `https://dedupe-fresh-${Date.now()}.example.com/app`;
      const ipHash = hashIp(`dedupe-fresh-${Date.now()}`);
      const appId = await seedApp(url);
      const fresh = await seedScan(appId, ipHash, minutesAgo(1), "queued");

      expect(await findExistingScanForApp(appId)).toBe(fresh);
    },
    20_000,
  );

  test(
    "with both a finished scan and an OLDER in-flight scan, the finished one wins",
    async () => {
      const url = `https://dedupe-mixed-${Date.now()}.example.com/app`;
      const ipHash = hashIp(`dedupe-mixed-${Date.now()}`);
      const appId = await seedApp(url);
      // In-flight row is NEWER than the finished one; finished must still win.
      const doneScan = await seedScan(appId, ipHash, minutesAgo(5), "done");
      const running = await seedScan(appId, ipHash, minutesAgo(1), "collecting");

      const found = await findExistingScanForApp(appId);
      expect(found).toBe(doneScan);
      expect(found).not.toBe(running);
    },
    20_000,
  );

  test("findAppByUrl returns null for an unknown url", async () => {
    expect(await findAppByUrl(`https://never-seen-${Date.now()}.example.com`)).toBeNull();
  });
});

describe("per-IP rate limit", () => {
  // Rate limiting is intentionally disabled in fixtures mode (assertRateLimit
  // short-circuits on fixturesEnabled()), so force fixtures OFF here to assert
  // the REAL behavior regardless of the ambient REACHKIT_USE_FIXTURES in
  // .env.local. Mirrors the "fixture/dev escape" block, which mocks it true.
  beforeEach(() => {
    vi.spyOn(fixtures, "fixturesEnabled").mockReturnValue(false);
  });

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
