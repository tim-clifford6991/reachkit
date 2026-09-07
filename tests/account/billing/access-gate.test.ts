// tests/account/billing/access-gate.test.ts — ADR-050, issue #180
//
// The registration itself: that billing installs the gate the weekly
// selection reads, that what it installs is `hasActiveAccess()` and not a
// second expression of ADR-050's rule, and that installing it proves it
// took.
//
// The rule's own three cases — a cancelled customer inside their paid
// month, a bounced renewal, a store that cannot be read — are
// `gate.test.ts`'s and are not restated here. What is restated is that this
// gate gives the *same* answers, because a set-shaped gate that quietly
// disagreed with the per-site one would be the second definition ADR-050
// exists to forbid.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { hasActiveAccess, installActiveAccessGate, setBillingStore } = await import(
  "@/lib/account/billing"
);
const { ActiveAccessGateNotRegistered, registerActiveAccessGate, sitesWithActiveAccess } =
  await import("@/lib/scan/weekly/access");
const { memoryBillingStore, newMemoryBilling, site } = await import("./memory-store");

let state = newMemoryBilling();
const NOW = new Date("2026-09-06T12:00:00.000Z");
const IN_A_MONTH = new Date("2026-10-06T12:00:00.000Z");
const LAST_MONTH = new Date("2026-08-06T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  state = newMemoryBilling();
  setBillingStore(memoryBillingStore(state));
  registerActiveAccessGate(null);
});

afterEach(() => {
  vi.useRealTimers();
  setBillingStore(null);
  registerActiveAccessGate(null);
});

function given(id: string, paidThrough: Date): string {
  state.sites.push(
    site({ id, user_id: `u-${id}`, owner_paid_through: paidThrough.toISOString() })
  );
  return id;
}

describe("nothing answers for billing until billing has said so", () => {
  it("the selection's own door throws while the gate is unregistered", async () => {
    await expect(sitesWithActiveAccess("dueSites", ["site-1"])).rejects.toBeInstanceOf(
      ActiveAccessGateNotRegistered
    );
  });

  it("installing it makes the same door answer", async () => {
    given("site-1", IN_A_MONTH);
    await installActiveAccessGate();
    await expect(sitesWithActiveAccess("dueSites", ["site-1"])).resolves.toEqual(
      new Set(["site-1"])
    );
  });

  it("installing twice is installing once — a second boot of the same instance is harmless", async () => {
    given("site-1", IN_A_MONTH);
    await installActiveAccessGate();
    await installActiveAccessGate();
    await expect(sitesWithActiveAccess("dueSites", ["site-1"])).resolves.toEqual(
      new Set(["site-1"])
    );
  });

  it("the install proves it took, through the door the selection reads and without a database", async () => {
    // The empty set never reaches the store: `sitesWithActiveAccess` throws
    // on an unregistered gate first and short-circuits after. So the probe
    // establishes readability and nothing about any customer — which is
    // what makes it safe to run on every boot.
    setBillingStore(null);
    await expect(installActiveAccessGate()).resolves.toBeUndefined();
  });
});

describe("what is installed is ADR-050's one reader, asked once per site", () => {
  it("a paying owner is in the set and an ended one is not", async () => {
    given("paying", IN_A_MONTH);
    given("ended", LAST_MONTH);
    await installActiveAccessGate();

    await expect(sitesWithActiveAccess("dueSites", ["paying", "ended"])).resolves.toEqual(
      new Set(["paying"])
    );
  });

  it("the set-shaped gate agrees with `hasActiveAccess()` site by site", async () => {
    given("paying", IN_A_MONTH);
    given("ended", LAST_MONTH);
    await installActiveAccessGate();
    const ids = ["paying", "ended", "no-such-site"];
    const answered = await sitesWithActiveAccess("dueSites", ids);

    for (const id of ids) {
      expect(answered.has(id), id).toBe(await hasActiveAccess(id));
    }
  });

  it("a site the store does not hold is not in the set — the gate fails closed", async () => {
    await installActiveAccessGate();
    await expect(sitesWithActiveAccess("dueSites", ["no-such-site"])).resolves.toEqual(new Set());
  });

  it("an empty candidate set is answered without asking about anybody", async () => {
    await installActiveAccessGate();
    setBillingStore(null);
    await expect(sitesWithActiveAccess("dueSites", [])).resolves.toEqual(new Set());
  });
});
