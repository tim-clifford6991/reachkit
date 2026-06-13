/**
 * Integration test for tier entitlements (Cycle 4 Task 6).
 *
 * Seeds real `users` rows in Supabase and verifies that `entitlementsFor`,
 * `assertPaid`, and `assertCanAddApp` reflect tier + subscription_status +
 * app_ids correctly.
 *
 * Run with: pnpm test:int tests/integration/entitlements.test.ts
 */

import { afterAll, expect, test } from "vitest";
import { serverDb } from "@/lib/db/client";
import {
  entitlementsFor,
  assertPaid,
  assertCanAddApp,
  EntitlementError,
} from "@/lib/billing/entitlements";

type SeedInput = {
  tier: "free" | "solo" | "growth";
  subscription_status?: string | null;
  app_ids?: string[];
};

const createdUserIds: string[] = [];

async function seedUser(suffix: string, input: SeedInput): Promise<string> {
  const db = serverDb();
  const { data, error } = await db
    .from("users")
    .insert({
      email: `entitlements-test-${suffix}-${Date.now()}@example.com`,
      tier: input.tier,
      subscription_status: input.subscription_status ?? null,
      app_ids: input.app_ids ?? [],
    })
    .select("id")
    .single();
  if (error) throw error;
  createdUserIds.push(data.id);
  return data.id;
}

afterAll(async () => {
  const db = serverDb();
  for (const id of createdUserIds) {
    await db.from("users").delete().eq("id", id);
  }
});

test(
  "entitlementsFor + assertPaid reflect tier and subscription_status",
  async () => {
    const freeId = await seedUser("free", { tier: "free" });
    const soloActiveId = await seedUser("solo-active", {
      tier: "solo",
      subscription_status: "active",
    });
    const soloCanceledId = await seedUser("solo-canceled", {
      tier: "solo",
      subscription_status: "canceled",
    });

    // ---- entitlementsFor.active ----------------------------------------
    const free = await entitlementsFor(freeId);
    expect(free.tier).toBe("free");
    expect(free.active).toBe(false);
    expect(free.limits.apps).toBe(1);

    const soloActive = await entitlementsFor(soloActiveId);
    expect(soloActive.tier).toBe("solo");
    expect(soloActive.active).toBe(true);

    const soloCanceled = await entitlementsFor(soloCanceledId);
    expect(soloCanceled.tier).toBe("solo");
    expect(soloCanceled.active).toBe(false);

    // ---- assertPaid ----------------------------------------------------
    await expect(assertPaid(freeId)).rejects.toBeInstanceOf(EntitlementError);
    await expect(assertPaid(soloActiveId)).resolves.toBeUndefined();
    await expect(assertPaid(soloCanceledId)).rejects.toBeInstanceOf(
      EntitlementError,
    );
  },
  20_000,
);

test(
  "assertCanAddApp throws when app_ids.length >= limits.apps",
  async () => {
    // solo allows 1 app. Empty → can add; one app → at limit.
    const underId = await seedUser("under-limit", {
      tier: "solo",
      subscription_status: "active",
      app_ids: [],
    });
    const atLimitId = await seedUser("at-limit", {
      tier: "solo",
      subscription_status: "active",
      app_ids: ["11111111-1111-1111-1111-111111111111"],
    });

    await expect(assertCanAddApp(underId)).resolves.toBeUndefined();
    await expect(assertCanAddApp(atLimitId)).rejects.toBeInstanceOf(
      EntitlementError,
    );
  },
  20_000,
);
