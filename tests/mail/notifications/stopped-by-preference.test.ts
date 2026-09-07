// BUILD §4.7 · §12 — the question the send seam asks, and the six kinds it never asks about.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, newState, type FakeDbState } from "./fake-db";
import { MAIL_KINDS, type MailKind } from "../../../src/lib/mail/kinds";

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

const { stoppedByPreference, TOGGLABLE_KINDS } = await import(
  "../../../src/lib/mail/notifications/index"
);

beforeEach(() => {
  state.rows = { u1: { notify: {} } };
  state.reads = [];
  state.writes = [];
  state.failRead = false;
});

describe("BUILD §4.7 — a switched-off mail is stopped, and nothing else is", () => {
  it("a togglable kind that is off answers 'stopped'", async () => {
    state.rows = { u1: { notify: { weekly: false } } };
    await expect(stoppedByPreference({ userId: "u1", kind: "weekly" })).resolves.toBe("stopped");
  });

  it("a togglable kind that is on answers 'send'", async () => {
    await expect(stoppedByPreference({ userId: "u1", kind: "weekly" })).resolves.toBe("send");
  });

  it("switching one off leaves the other two sending", async () => {
    state.rows = { u1: { notify: { weekly: false } } };
    await expect(stoppedByPreference({ userId: "u1", kind: "published" })).resolves.toBe("send");
    await expect(stoppedByPreference({ userId: "u1", kind: "draft-ready" })).resolves.toBe("send");
  });

  it("every kind outside the three answers 'send' without reading the store at all", async () => {
    const outside = (Object.keys(MAIL_KINDS) as MailKind[]).filter(
      (kind) => !(TOGGLABLE_KINDS as readonly string[]).includes(kind)
    );
    expect(outside).toHaveLength(7);
    for (const kind of outside) {
      state.reads = [];
      await expect(stoppedByPreference({ userId: "u1", kind }), kind).resolves.toBe("send");
      // Not merely the right answer — the store was not consulted. This
      // is what makes these three toggles unable to reach the sign-in mail
      // even while the database is down (ADR-042).
      expect(state.reads, kind).toEqual([]);
    }
  });

  it("with every toggle off, the sign-in, account and setup mails still send", async () => {
    state.rows = { u1: { notify: { "draft-ready": false, published: false, weekly: false } } };
    for (const kind of ["magic-link", "account", "setup-reminder"] as const) {
      await expect(stoppedByPreference({ userId: "u1", kind }), kind).resolves.toBe("send");
    }
  });
});
