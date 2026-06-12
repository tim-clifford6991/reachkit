/**
 * Integration test: POST /api/scan/[id]/claim
 *
 * Strategy: call the real local signInWithOtp — Supabase local routes magic
 * links to its built-in Inbucket mailbox, so no real email is sent.
 * This avoids mocking the Supabase SDK and still verifies the end-to-end flow:
 *   1. OTP is accepted by local Supabase without error
 *   2. scans.claim_email is updated to the submitted email
 *   3. The route returns { ok: true }
 */

import { afterAll, expect, test } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { POST } from "@/app/api/scan/[id]/claim/route";

const svc = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Track rows to clean up.
const appIds: string[] = [];

afterAll(async () => {
  for (const id of appIds) {
    await svc.from("apps").delete().eq("id", id);
  }
});

test(
  "POST /api/scan/[id]/claim: returns 200 and records claim_email",
  async () => {
    // 1. Insert prerequisite app + scan.
    const { data: appRow, error: appErr } = await svc
      .from("apps")
      .insert({ store_url: `https://apps.apple.com/us/app/claim-test/id${Date.now()}`, platform: "ios" })
      .select("id")
      .single();
    expect(appErr).toBeNull();
    if (!appRow) throw new Error("No app row");
    appIds.push(appRow.id);

    const { data: scanRow, error: scanErr } = await svc
      .from("scans")
      .insert({ app_id: appRow.id, status: "queued" })
      .select("id")
      .single();
    expect(scanErr).toBeNull();
    if (!scanRow) throw new Error("No scan row");

    const scanId = scanRow.id as string;
    const email = `claim-test-${Date.now()}@example.com`;

    // 2. Call the route handler directly (Next.js integration pattern).
    const req = new Request(`http://localhost/api/scan/${scanId}/claim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const res = await POST(req as never, {
      params: Promise.resolve({ id: scanId }),
    });

    // 3. Assert 200 + { ok: true }.
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json["ok"]).toBe(true);

    // 4. Assert claim_email was recorded on the scan row.
    const { data: updatedScan, error: scanReadErr } = await svc
      .from("scans")
      .select("claim_email")
      .eq("id", scanId)
      .single();

    expect(scanReadErr).toBeNull();
    expect(updatedScan?.claim_email).toBe(email);
  },
  15_000,
);

test(
  "POST /api/scan/[id]/claim: returns 400 for invalid email",
  async () => {
    const req = new Request("http://localhost/api/scan/fake-id/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });

    const res = await POST(req as never, {
      params: Promise.resolve({ id: "fake-id" }),
    });

    expect(res.status).toBe(400);
  },
  10_000,
);

test(
  "POST /api/scan/[id]/claim: returns 400 for missing body",
  async () => {
    const req = new Request("http://localhost/api/scan/fake-id/claim", {
      method: "POST",
      body: "{}",
    });

    const res = await POST(req as never, {
      params: Promise.resolve({ id: "fake-id" }),
    });

    expect(res.status).toBe(400);
  },
  10_000,
);
