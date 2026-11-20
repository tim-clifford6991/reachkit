// A month that cannot be read is the month card's own state, not the tab's
// failure: the read answers `null` so the subscription card still draws.
import { afterEach, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

vi.mock("@/app/(account)/app/_session/account", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { LIVE_ACCOUNT } = await import("../accounts");
  return { ...actual, requireSetUpAccount: async () => LIVE_ACCOUNT };
});

const { setBillingStore } = await import("@/lib/account/billing");
const { memoryBillingStore, newMemoryBilling } = await import("../../account/billing/memory-store");
const { readMonthGot } = await import("@/app/(account)/app/settings/provider");

afterEach(() => setBillingStore(null));

it("a month the store cannot read resolves to no figures instead of throwing", async () => {
  const state = newMemoryBilling();
  state.failAccountRead = true;
  setBillingStore(memoryBillingStore(state));

  await expect(readMonthGot()).resolves.toEqual({ got: null, timeZone: "America/New_York" });
});
