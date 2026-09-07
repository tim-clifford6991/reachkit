// BUILD §4.7 — an unreadable store is its own answer, not a 'send'.
//
// This store is the only record of a choice the customer made. Mailing
// them because we could not read it spends their trust on our outage; and
// an absent object and an unreachable store are different facts, so they
// never collapse into one.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, newState, type FakeDbState } from "./fake-db";

const state: FakeDbState = newState();
// Both exports, one fake: the notification store reads `users.notify`
// through `dbAdmin()` (#228 — `db()` is the anon key, and RLS
// `users_select_own` matches no row without a user JWT, so that read
// answered `absent` for everyone on every server path).
vi.mock("@/lib/db", () => ({
  db: () => fakeDbRef.current(),
  dbAdmin: () => fakeDbRef.current(),
}));
const fakeDbRef = { current: fakeDb(state) };

const { stoppedByPreference } = await import("../../../src/lib/mail/notifications/index");

beforeEach(() => {
  state.rows = { u1: { notify: {} } };
  state.reads = [];
  state.failRead = false;
});

describe("BUILD §4.7 — the outage answer", () => {
  it("a query error stops a togglable send and reports distinctly from 'stopped'", async () => {
    state.failRead = true;
    await expect(stoppedByPreference({ userId: "u1", kind: "weekly" })).resolves.toBe("unreadable");
  });

  it("a user row that is not there is unreadable, not 'all on'", async () => {
    await expect(stoppedByPreference({ userId: "nobody", kind: "weekly" })).resolves.toBe("unreadable");
  });

  it("an empty notify object is readable and means every mail is on", async () => {
    await expect(stoppedByPreference({ userId: "u1", kind: "weekly" })).resolves.toBe("send");
  });

  it("the outage reaches only the three — a sign-in mail is unaffected by it", async () => {
    state.failRead = true;
    await expect(stoppedByPreference({ userId: "u1", kind: "magic-link" })).resolves.toBe("send");
    expect(state.reads).toEqual([]);
  });
});
