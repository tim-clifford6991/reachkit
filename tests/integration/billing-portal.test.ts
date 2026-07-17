/**
 * Integration test for createPortalSession (Cycle 4 Task 5).
 *
 * Runs in FIXTURES mode — no Stripe keys required. Seeds a real users row in
 * Supabase, then verifies the fixture portal path returns the demo URL.
 *
 * Run with: pnpm test:int tests/integration/billing-portal.test.ts
 */

import { expect, test, vi, afterEach } from "vitest";
import { installFixtures, resetFixtures } from "@/lib/scan/fixture-seam";
import { makeFixtureProvider } from "@/lib/dev/fixtures";
import { serverDb } from "@/lib/db/client";
import { env } from "@/lib/config/env";

// ---------------------------------------------------------------------------
// Seed / cleanup helpers — keep tests idempotent.
// ---------------------------------------------------------------------------
async function seedUser(suffix: string): Promise<string> {
  const db = serverDb();
  const { data, error } = await db
    .from("users")
    .insert({ email: `portal-test-${suffix}@example.com`, tier: "free" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function deleteUser(id: string): Promise<void> {
  await serverDb().from("users").delete().eq("id", id);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  resetFixtures();
});

test(
  "createPortalSession (fixtures) returns the demo portal url",
  async () => {
    vi.stubEnv("REACHKIT_USE_FIXTURES", "true");
    installFixtures(makeFixtureProvider());

    const { createPortalSession } = await import("@/lib/billing/portal");

    const userId = await seedUser(`demo-${Date.now()}`);
    try {
      const result = await createPortalSession(userId);
      // Default return path is /app (safeReturnPath fallback) — the portal
      // returns to the surface the user opened it from, not a hard-coded page.
      expect(result.url).toBe(`${env.appUrl}/app?portal=demo`);
    } finally {
      await deleteUser(userId);
    }
  },
  20_000,
);
