/**
 * Integration test for createCheckout (Cycle 4 Tasks 2+3).
 *
 * Runs in FIXTURES mode — no Stripe keys required.
 * Verifies that after createCheckout completes, the user row has the expected
 * tier and subscription_status, and the returned URL is correct.
 *
 * Run with: pnpm test:int tests/integration/billing-checkout.test.ts
 */

import { expect, test, vi, afterEach } from "vitest";
import { serverDb } from "@/lib/db/client";
import { env } from "@/lib/config/env";

// ---------------------------------------------------------------------------
// Seed helper — inserts a minimal users row and returns its id.
// ---------------------------------------------------------------------------
async function seedUser(suffix: string): Promise<string> {
  const db = serverDb();
  const { data, error } = await db
    .from("users")
    .insert({ email: `billing-test-${suffix}@example.com`, tier: "free" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// ---------------------------------------------------------------------------
// Cleanup helper — removes seeded rows so tests are idempotent.
// ---------------------------------------------------------------------------
async function deleteUser(id: string): Promise<void> {
  await serverDb().from("users").delete().eq("id", id);
}

// ---------------------------------------------------------------------------
// Tests — fixtures mode, no Stripe keys needed.
// ---------------------------------------------------------------------------
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

test(
  "createCheckout (fixtures) upgrades user to solo, returns demo url",
  async () => {
    vi.stubEnv("REACHKIT_USE_FIXTURES", "true");

    const { createCheckout } = await import("@/lib/billing/checkout");

    const userId = await seedUser(`solo-${Date.now()}`);
    try {
      const result = await createCheckout({ userId, plan: "solo" });

      // URL should point to the fixture billing demo page.
      expect(result.url).toBe(`${env.appUrl}/app?billing=demo`);

      // The user row should now have tier="solo" and subscription_status="active".
      const db = serverDb();
      const { data: row, error } = await db
        .from("users")
        .select("tier, subscription_status")
        .eq("id", userId)
        .single();

      expect(error).toBeNull();
      expect(row?.tier).toBe("solo");
      expect(row?.subscription_status).toBe("active");
    } finally {
      await deleteUser(userId);
    }
  },
  20_000,
);

test(
  "createCheckout (fixtures) upgrades user to growth, returns demo url",
  async () => {
    vi.stubEnv("REACHKIT_USE_FIXTURES", "true");

    const { createCheckout } = await import("@/lib/billing/checkout");

    const userId = await seedUser(`growth-${Date.now()}`);
    try {
      const result = await createCheckout({ userId, plan: "growth" });

      // URL should point to the fixture billing demo page.
      expect(result.url).toBe(`${env.appUrl}/app?billing=demo`);

      // The user row should now have tier="growth" and subscription_status="active".
      const db = serverDb();
      const { data: row, error } = await db
        .from("users")
        .select("tier, subscription_status")
        .eq("id", userId)
        .single();

      expect(error).toBeNull();
      expect(row?.tier).toBe("growth");
      expect(row?.subscription_status).toBe("active");
    } finally {
      await deleteUser(userId);
    }
  },
  20_000,
);
