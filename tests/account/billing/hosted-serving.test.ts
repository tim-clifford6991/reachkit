// tests/account/billing/hosted-serving.test.ts — REQ-076 c10, REQ-079 c6
//
// The one question the hosted edge asks, its two reasons, and the two
// failure directions BP-060's NFR budget fixes — which are the ones a later
// "simplification" would flatten into one.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { hostedServingState, setBillingStore } = await import("@/lib/account/billing");
const { memoryBillingStore, newMemoryBilling, site } = await import("./memory-store");

let state = newMemoryBilling();
const NOW = new Date("2026-09-06T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  state = newMemoryBilling();
  setBillingStore(memoryBillingStore(state));
});

afterEach(() => {
  vi.useRealTimers();
  setBillingStore(null);
});

describe("REQ-076 c10 — serving continues until the day it stops", () => {
  it("a site with no retention window is served", async () => {
    state.sites.push(site({ id: "s1", user_id: "u1" }));
    expect(await hostedServingState("s1")).toEqual({ serve: true });
  });

  it("served up to the instant before the window elapses", async () => {
    state.sites.push(
      site({ id: "s1", user_id: "u1", hosted_serving_ends_at: new Date(NOW.getTime() + 1).toISOString() })
    );
    expect(await hostedServingState("s1")).toEqual({ serve: true });
  });

  it("retention_elapsed on the boundary itself, and after it", async () => {
    state.sites.push(site({ id: "s1", user_id: "u1", hosted_serving_ends_at: NOW.toISOString() }));
    expect(await hostedServingState("s1")).toEqual({
      serve: false,
      because: "retention_elapsed",
    });

    vi.setSystemTime(new Date(NOW.getTime() + 24 * 60 * 60 * 1000));
    expect(await hostedServingState("s1")).toEqual({
      serve: false,
      because: "retention_elapsed",
    });
  });
});

describe("REQ-079 c6 — deletion takes precedence and needs no window", () => {
  it("a deleted account is not served, with no retention window at all", async () => {
    state.sites.push(site({ id: "s1", user_id: "u1", owner_deleted_at: NOW.toISOString() }));
    expect(await hostedServingState("s1")).toEqual({
      serve: false,
      because: "account_deleted",
    });
  });

  it("deletion outranks an elapsed window — the reason is the one the customer chose", async () => {
    state.sites.push(
      site({
        id: "s1",
        user_id: "u1",
        owner_deleted_at: NOW.toISOString(),
        hosted_serving_ends_at: NOW.toISOString(),
      })
    );
    expect(await hostedServingState("s1")).toEqual({
      serve: false,
      because: "account_deleted",
    });
  });
});

describe("BP-060's NFR budget — closed on deletion, open on retention", () => {
  it("a store that cannot be read does not serve: the tombstone is unknown", async () => {
    state.sites.push(site({ id: "s1", user_id: "u1" }));
    state.failHostingRead = true;
    // Somebody's erasure request may be behind this read. Serving through
    // it is the failure this direction exists to prevent.
    expect(await hostedServingState("s1")).toEqual({
      serve: false,
      because: "account_deleted",
    });
  });

  it("a live account whose window is simply not yet set goes on being served", async () => {
    // The open direction: the cost of a page served a day longer than
    // promised is a day; the cost of taking a paying customer's live pages
    // down is their business.
    state.sites.push(site({ id: "s1", user_id: "u1", hosted_serving_ends_at: null }));
    expect(await hostedServingState("s1")).toEqual({ serve: true });
  });

  it("a site that does not exist is not served", async () => {
    expect(await hostedServingState("nobody")).toEqual({
      serve: false,
      because: "account_deleted",
    });
  });
});

describe("the stop is a state, not a job", () => {
  it("the answer is right whether or not any tick ever ran", async () => {
    // BP-060: "`hostedServingState` computes from the timestamp; no job
    // flips a boolean." Nothing below runs a tick.
    state.sites.push(
      site({ id: "s1", user_id: "u1", hosted_serving_ends_at: new Date(NOW.getTime() + 1000).toISOString() })
    );
    expect((await hostedServingState("s1")).serve).toBe(true);
    vi.setSystemTime(new Date(NOW.getTime() + 2000));
    expect((await hostedServingState("s1")).serve).toBe(false);
  });
});
