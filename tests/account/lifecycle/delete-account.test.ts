// tests/account/lifecycle/delete-account.test.ts — REQ-079 c6, c7
//
// "the customer is signed out, a sign-in request at that address finds no
// account, the subscription ends at once with no further charge and no
// remaining paid access, and pages are taken down at their destinations as
// criterion 4 describes."
//
// The order is asserted by call sequence, because every step is a
// precondition of the next — and the assertion that carries ADR-051 is the
// one that looks redundant: **no row is deleted by this path**.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import type { UnpublishResult } from "@/lib/publish/types";

applyEnvFixture();

const calls: string[] = [];
const outcomes = new Map<string, UnpublishResult>();
let subscription: { ok: true; endedAt: Date } | { ok: false; reason: "store" } = {
  ok: true,
  endedAt: new Date("2026-09-06T12:00:00.000Z"),
};

vi.mock("@/lib/publish/attempt/unpublish", () => ({
  unpublish: async (a: { draftId: string }): Promise<UnpublishResult> => {
    calls.push("unpublish");
    return outcomes.get(a.draftId) ?? { ok: true, outcome: "removed" };
  },
}));

vi.mock("@/lib/publish/switch", () => ({
  setPublishing: async () => {
    calls.push("setPublishing");
    return { recordedAt: new Date() };
  },
}));

vi.mock("@/lib/account/billing", () => ({
  endSubscriptionNow: async () => {
    calls.push("endSubscriptionNow");
    return subscription;
  },
}));

vi.mock("@/lib/mail/send", () => ({
  sendEmail: async () => {
    calls.push("sendEmail");
    return { sent: true, id: "mail-1" };
  },
}));

const { deleteAccount } = await import("@/lib/account/lifecycle/delete-account");
const { setLifecycleStore } = await import("@/lib/account/lifecycle");
const { memoryLifecycleStore, newMemoryLifecycle, account } = await import("./memory-store");

const NOW = new Date("2026-09-06T12:00:00.000Z");
let state = newMemoryLifecycle();

beforeEach(() => {
  calls.length = 0;
  outcomes.clear();
  subscription = { ok: true, endedAt: NOW };
  state = newMemoryLifecycle();
  state.sites.push({ id: "site-1", user_id: "u-1" });
  state.accounts.push(account({ id: "u-1", email: "leaving@example.com" }));
  state.publications.push({ draft_id: "a", destination: "hosted", live_url: null });
  setLifecycleStore(memoryLifecycleStore(state));
});

afterEach(() => {
  setLifecycleStore(null);
});

describe("REQ-079 c6 — the fixed order, each step a precondition of the next", () => {
  it("take-down, then the subscription, then the tombstone, then the sessions", async () => {
    const run = await deleteAccount({ siteId: "site-1", now: NOW });
    expect(run.ok).toBe(true);
    expect(calls).toEqual(["unpublish", "setPublishing", "endSubscriptionNow"]);
    expect(state.writes).toEqual(["stampTombstone", "endSessions"]);
  });

  it("the customer is signed out — every session, not this one alone", async () => {
    const run = await deleteAccount({ siteId: "site-1", now: NOW });
    expect(run.ok && run.result.signedOut).toBe(true);
    expect(state.signedOutEverywhere).toEqual([state.accounts[0]?.id]);
  });

  it("the subscription's end comes back on the result", async () => {
    const run = await deleteAccount({ siteId: "site-1", now: NOW });
    expect(run.ok && run.result.subscriptionEndedAt).toEqual(NOW);
  });

  it("a failing take-down stops the sequence before the tombstone", async () => {
    state.unreadable = true;
    const run = await deleteAccount({ siteId: "site-1", now: NOW });
    expect(run).toEqual({ ok: false, reason: "store" });
    expect(state.writes).toEqual([]);
  });

  it("a subscription that will not end stops the sequence before the tombstone", async () => {
    subscription = { ok: false, reason: "store" };
    const run = await deleteAccount({ siteId: "site-1", now: NOW });
    expect(run).toEqual({ ok: false, reason: "subscription" });
    expect(state.writes).toEqual([]);
    expect(state.accounts[0]?.deleted_at).toBeNull();
  });
});

describe("REQ-079 c7 / ADR-051 — a tombstone and a stored date, and no DELETE of any kind", () => {
  it("deleted_at and purge_due_at are stamped, exactly 30 days apart", async () => {
    const run = await deleteAccount({ siteId: "site-1", now: NOW });
    expect(state.accounts[0]?.deleted_at).toBe(NOW.toISOString());
    expect(state.accounts[0]?.purge_due_at).toBe("2026-10-06T12:00:00.000Z");
    expect(run.ok && run.result.purgeDueAt).toEqual(new Date("2026-10-06T12:00:00.000Z"));
  });

  it("the date is stored, so a second deletion cannot move a promise already made", async () => {
    await deleteAccount({ siteId: "site-1", now: NOW });
    await deleteAccount({ siteId: "site-1", now: new Date("2026-09-20T12:00:00.000Z") });
    expect(state.accounts[0]?.purge_due_at).toBe("2026-10-06T12:00:00.000Z");
  });

  it("no row is deleted by this path — the whole of ADR-051's first consequence", async () => {
    await deleteAccount({ siteId: "site-1", now: NOW });
    expect(state.deleted).toEqual([]);
    expect(state.accounts).toHaveLength(1);
    expect(state.sites).toHaveLength(1);
  });

  it("a site that is not there is refused rather than half-deleted", async () => {
    expect(await deleteAccount({ siteId: "site-9", now: NOW })).toEqual({
      ok: false,
      reason: "no_site",
    });
  });
});
