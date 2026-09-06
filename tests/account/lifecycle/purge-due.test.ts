// tests/account/lifecycle/purge-due.test.ts — REQ-079 c7
//
// The boundary, against a fixed clock and `purge_due_at` — never against a
// tick. The maintenance tick runs more often than the promise falls due, so
// which cadence is configured cannot decide any case here.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { accountsDueForPurge, setLifecycleStore } = await import("@/lib/account/lifecycle");
const { memoryLifecycleStore, newMemoryLifecycle, account } = await import("./memory-store");

const DELETED_AT = "2026-09-06T12:00:00.000Z";
const DUE_AT = "2026-10-06T12:00:00.000Z";
let state = newMemoryLifecycle();

beforeEach(() => {
  state = newMemoryLifecycle();
  setLifecycleStore(memoryLifecycleStore(state));
});

afterEach(() => {
  setLifecycleStore(null);
});

describe("REQ-079 c7 — due at 30 days and not at 29 days 23:59", () => {
  beforeEach(() => {
    state.accounts.push(account({ id: "u-1", deleted_at: DELETED_AT, purge_due_at: DUE_AT }));
  });

  it("not due at 29 days 23:59", async () => {
    expect(await accountsDueForPurge(new Date("2026-10-06T11:59:00.000Z"))).toEqual([]);
  });

  it("due at exactly 30 days — the boundary is inclusive", async () => {
    expect(await accountsDueForPurge(new Date(DUE_AT))).toEqual(["u-1"]);
  });

  it("due at 30 days and one minute", async () => {
    expect(await accountsDueForPurge(new Date("2026-10-06T12:01:00.000Z"))).toEqual(["u-1"]);
  });
});

describe("REQ-079 c7 — who is never due", () => {
  it("a live account is never due, however old", async () => {
    state.accounts.push(account({ id: "u-2" }));
    expect(await accountsDueForPurge(new Date("2030-01-01T00:00:00.000Z"))).toEqual([]);
  });

  it("a tombstoned account with no promised date is never due", async () => {
    state.accounts.push(account({ id: "u-3", deleted_at: DELETED_AT }));
    expect(await accountsDueForPurge(new Date("2030-01-01T00:00:00.000Z"))).toEqual([]);
  });

  it("a date with no tombstone behind it is never due either", async () => {
    state.accounts.push(account({ id: "u-4", purge_due_at: DUE_AT }));
    expect(await accountsDueForPurge(new Date("2030-01-01T00:00:00.000Z"))).toEqual([]);
  });
});
