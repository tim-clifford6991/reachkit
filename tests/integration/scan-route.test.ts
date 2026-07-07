import { afterAll, expect, test, vi } from "vitest";
vi.mock("@/lib/inngest/client", () => ({ inngest: { send: vi.fn(async () => ({})) } }));
// currentUser() calls next/headers' cookies(), which throws outside a real
// Next.js request scope (as we have here, invoking the handler directly with
// a raw Request). Anonymous is the behavior we want to exercise anyway, so
// stub it to null — equivalent to a real unauthenticated request.
vi.mock("@/lib/auth/server", () => ({ currentUser: vi.fn(async () => null) }));

import { serverDb } from "@/lib/db/client";

test("POST /api/scan classifies, creates a scan, returns scan_id", async () => {
  const { POST } = await import("@/app/api/scan/route");
  const req = new Request("http://localhost/api/scan", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ store_url: "https://apps.apple.com/us/app/sofa/id1276554886" }),
  });
  const res = await POST(req as never);
  const json = await res.json();
  expect(res.status).toBe(200);
  expect(json.scan_id).toBeTruthy();
});

test("POST /api/scan rejects a bad body with 400", async () => {
  const { POST } = await import("@/app/api/scan/route");
  const res = await POST(new Request("http://localhost/api/scan", { method: "POST", body: "{}" }) as never);
  expect(res.status).toBe(400);
});

// --- URL-canonicalization dedup + contract (Phase-3) ---------------------
//
// Real Supabase (local). Uses a unique test domain (nudgi3test.io) so its
// rows can be cleaned up in afterAll without colliding with other data.

const CANON_STORE_URL = "https://nudgi3test.io/";

afterAll(async () => {
  const db = serverDb();
  const { data: app } = await db.from("apps").select("id").eq("store_url", CANON_STORE_URL).maybeSingle();
  if (app) {
    await db.from("scans").delete().eq("app_id", app.id);
    await db.from("apps").delete().eq("id", app.id);
  }
});

test(
  "POST /api/scan dedupes www + path/query variants to ONE app/scan, and returns { scan_id, slug } with tier 'free' for an anonymous viewer",
  async () => {
    const { POST } = await import("@/app/api/scan/route");
    const post = (store_url: string) =>
      POST(
        new Request("http://localhost/api/scan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ store_url }),
        }) as never,
      );

    // First request: a "www." variant with no path.
    const res1 = await post("www.nudgi3test.io");
    const json1 = await res1.json();
    expect(res1.status).toBe(200);
    expect(json1).toMatchObject({ scan_id: expect.any(String), slug: expect.any(String) });
    expect(json1.deduped).toBeUndefined();

    // Second request: bare host + path/query variant. classifyUrl canonicalizes
    // both to the same bare origin (https://nudgi3test.io/), so this must
    // dedupe to the SAME app and return the SAME scan_id.
    const res2 = await post("https://nudgi3test.io/pricing?x=1");
    const json2 = await res2.json();
    expect(res2.status).toBe(200);
    expect(json2.deduped).toBe(true);
    expect(json2.scan_id).toBe(json1.scan_id);

    // Exactly one apps row for the canonical url, and exactly one scan on it.
    const db = serverDb();
    const { data: apps, error: appsErr } = await db
      .from("apps")
      .select("id")
      .eq("store_url", CANON_STORE_URL);
    if (appsErr) throw appsErr;
    expect(apps).toHaveLength(1);

    const { count, error: countErr } = await db
      .from("scans")
      .select("id", { count: "exact", head: true })
      .eq("app_id", apps![0]!.id);
    if (countErr) throw countErr;
    expect(count).toBe(1);

    // Contract: anonymous POST → the created scan row has tier "free".
    const { data: scan, error: scanErr } = await db
      .from("scans")
      .select("tier")
      .eq("id", json1.scan_id)
      .single();
    if (scanErr) throw scanErr;
    expect(scan.tier).toBe("free");
  },
  20_000,
);
