/**
 * Integration test for the `public_scans` view + listPublicScans/countPublicScans
 * (Plan 4 Task 1).
 *
 * Real Supabase. Seeds:
 *   - 3 web apps, each with ONE done scan (distinct completed_at);
 *   - 1 web app with TWO done scans (different completed_at) — dedupe must
 *     keep only the latest;
 *   - 1 non-web (ios) app with a done scan — excluded (view filters platform);
 *   - 1 web app whose only scan is 'queued' — excluded (view filters status).
 *
 * Run with: pnpm test:int tests/integration/public-scans.test.ts
 */

import { afterAll, describe, expect, test } from "vitest";
import { serverDb } from "@/lib/db/client";
import { countPublicScans, listPublicScans } from "@/lib/scan/public-scans";

const createdAppIds: string[] = [];

async function seedApp(storeUrl: string, platform = "web"): Promise<string> {
  const db = serverDb();
  const { data, error } = await db
    .from("apps")
    .insert({ store_url: storeUrl, platform })
    .select("id")
    .single();
  if (error) throw error;
  createdAppIds.push(data.id);
  return data.id;
}

async function seedScan(appId: string, status: string, completedAt?: string): Promise<string> {
  const db = serverDb();
  const row: { app_id: string; status: string; completed_at?: string; score_total?: number } = {
    app_id: appId,
    status,
  };
  if (completedAt) row.completed_at = completedAt;
  if (status === "done") row.score_total = 70;
  const { data, error } = await db.from("scans").insert(row).select("id").single();
  if (error) throw error;
  return data.id;
}

function isoAt(secondsAgo: number): string {
  return new Date(Date.now() - secondsAgo * 1000).toISOString();
}

afterAll(async () => {
  const db = serverDb();
  // scans cascade-delete with their app.
  for (const id of createdAppIds) await db.from("apps").delete().eq("id", id);
});

describe("public_scans view + listPublicScans/countPublicScans", () => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const urlA = `https://p4t-a-${suffix}.test/`;
  const urlB = `https://p4t-b-${suffix}.test/`;
  const urlC = `https://p4t-c-${suffix}.test/`;
  const urlDup = `https://p4t-dup-${suffix}.test/`;
  const urlIos = `https://p4t-ios-${suffix}.test/`;
  const urlQueued = `https://p4t-queued-${suffix}.test/`;

  test("seed fixtures", async () => {
    const appA = await seedApp(urlA);
    await seedScan(appA, "done", isoAt(400));

    const appB = await seedApp(urlB);
    await seedScan(appB, "done", isoAt(300));

    const appC = await seedApp(urlC);
    await seedScan(appC, "done", isoAt(200));

    const appDup = await seedApp(urlDup);
    await seedScan(appDup, "done", isoAt(150)); // older — must be excluded by dedupe
    await seedScan(appDup, "done", isoAt(100)); // newer — kept

    const appIos = await seedApp(urlIos, "ios");
    await seedScan(appIos, "done", isoAt(50));

    const appQueued = await seedApp(urlQueued);
    await seedScan(appQueued, "queued");
  }, 30_000);

  test(
    "listPublicScans() returns the deduped web set, completed_at DESC",
    async () => {
      const all = await listPublicScans({ limit: 100 });
      const slugs = all.map((s) => s.host);
      expect(slugs).toContain(`p4t-a-${suffix}.test`);
      expect(slugs).toContain(`p4t-b-${suffix}.test`);
      expect(slugs).toContain(`p4t-c-${suffix}.test`);
      expect(slugs).toContain(`p4t-dup-${suffix}.test`);
      expect(slugs).not.toContain(`p4t-ios-${suffix}.test`);
      expect(slugs).not.toContain(`p4t-queued-${suffix}.test`);

      // Exactly one dup entry (dedupe to latest).
      const dupEntries = all.filter((s) => s.host === `p4t-dup-${suffix}.test`);
      expect(dupEntries).toHaveLength(1);

      // completed_at DESC overall.
      const completedAts = all.map((s) => s.completedAt).filter(Boolean) as string[];
      const sorted = [...completedAts].sort((x, y) => new Date(y).getTime() - new Date(x).getTime());
      expect(completedAts).toEqual(sorted);
    },
    30_000,
  );

  test(
    "q filters to a substring match",
    async () => {
      const filtered = await listPublicScans({ q: `p4t-b-${suffix}`, limit: 100 });
      expect(filtered.map((s) => s.host)).toEqual([`p4t-b-${suffix}.test`]);
    },
    30_000,
  );

  test(
    "limit/offset pages are disjoint and cover the set",
    async () => {
      const ourSlugs = new Set([
        `p4t-a-${suffix}.test`,
        `p4t-b-${suffix}.test`,
        `p4t-c-${suffix}.test`,
        `p4t-dup-${suffix}.test`,
      ]);

      // Query scoped tightly to our suffix so paging is deterministic.
      const page1 = await listPublicScans({ q: suffix, limit: 2, offset: 0 });
      const page2 = await listPublicScans({ q: suffix, limit: 2, offset: 2 });
      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      const page1Hosts = page1.map((s) => s.host);
      const page2Hosts = page2.map((s) => s.host);
      // Disjoint
      for (const h of page1Hosts) expect(page2Hosts).not.toContain(h);
      // Cover the 4 qualifying entries (ios/queued excluded, dup deduped)
      const combined = new Set([...page1Hosts, ...page2Hosts]);
      expect(combined).toEqual(ourSlugs);
    },
    30_000,
  );

  test(
    "countPublicScans matches distinct qualifying apps, with and without q",
    async () => {
      const total = await countPublicScans({ q: suffix });
      expect(total).toBe(4);

      const filtered = await countPublicScans({ q: `p4t-b-${suffix}` });
      expect(filtered).toBe(1);
    },
    30_000,
  );
});
