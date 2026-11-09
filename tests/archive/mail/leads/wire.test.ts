// BUILD §4.2 — the address-wide store, plugged into the send seam.
//
// The one suite that drives the **real** `sendEmail()`, with only the
// vendor client stood in for. It is what proves the dispatch ADR-042
// describes is real: a `'opt-out'` kind asks this feature's store and a
// `false` kind asks nothing, chosen by the register row and by nothing
// else.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";
import { memoryStore, newMemoryState, type MemoryState } from "./memory-store";

applyEnvFixture();

const vendorCalls: { kind: string; to: string }[] = [];

vi.mock("@/lib/mail/vendor/resend", () => ({
  sendViaVendor: async (m: { kind: string; to: string }) => {
    vendorCalls.push({ kind: m.kind, to: m.to });
    return { ok: true, id: "vendor-1" };
  },
  recipientDigest: () => "digest",
}));

// The toggle store reaches `users.notify` through `@/lib/db`, and this
// suite has no database. It is stood in for with a client that reports a
// read error, so a togglable kind answers `'preference-unreadable'` — which
// is the point of the case below: whatever the toggle store answers, it is
// never this feature's `'suppressed'`.
vi.mock("@/lib/db", () => {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "limit", "update", "upsert", "in", "is", "order"]) {
    builder[method] = () => builder;
  }
  builder.then = (resolve: (r: unknown) => void) =>
    resolve({ data: null, error: { message: "no database in this suite" } });
  const client = { from: () => builder };
  return { db: () => client, dbAdmin: () => client };
});

// §12 composes from copy keys and every sentence these three mails speak is
// owner-owed, so a real compose refuses them. The shell is stood in for
// here — its own suites cover composition — leaving the stoppability
// dispatch, which is what this file is about, running for real.
vi.mock("@/lib/mail/shell/compose", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    composeMail: () => ({
      subject: "subject",
      html: "<p></p>",
      text: "",
      omitted: [],
      wholeMailLine: null,
    }),
  };
});

const { sendEmail } = await import("../../../src/lib/mail/send");
const { wireSuppressionReader, unwireSuppressionReader } = await import(
  "../../../src/lib/mail/leads/wire"
);
const { setLeadStore } = await import("../../../src/lib/mail/leads/store");

let state: MemoryState;

const NURTURE = {
  kind: "nurture",
  to: "anna@example.com",
  subject: "mail.nurture.subject.1" as const,
  blocks: [],
} as const;

beforeEach(() => {
  state = newMemoryState();
  setLeadStore(memoryStore(state));
  vendorCalls.length = 0;
  unwireSuppressionReader();
});

afterEach(() => {
  setLeadStore(null);
  unwireSuppressionReader();
});

describe("until this feature fills the port, a stoppable: 'opt-out' mail is not sent at all", () => {
  it("the unwired seam fails closed: 'we cannot tell' is never mailed on", async () => {
    await expect(sendEmail({ ...NURTURE })).resolves.toEqual({
      sent: false,
      reason: "suppression-unreadable",
    });
    expect(vendorCalls).toEqual([]);
  });
});

describe("ADR-042 — the register row chooses the store, and exactly one store is asked", () => {
  it("a wired seam sends a nurture mail to an address the store does not hold", async () => {
    wireSuppressionReader();
    await expect(sendEmail({ ...NURTURE })).resolves.toEqual({ sent: true, id: "vendor-1" });
    expect(vendorCalls).toEqual([{ kind: "nurture", to: "anna@example.com" }]);
  });

  it("a wired seam refuses a nurture mail to a suppressed address", async () => {
    wireSuppressionReader();
    state.suppressions.set("anna@example.com", "opt_out");

    await expect(sendEmail({ ...NURTURE })).resolves.toEqual({ sent: false, reason: "suppressed" });
    expect(vendorCalls).toEqual([]);
  });

  it("an unreadable store still fails closed once wired", async () => {
    wireSuppressionReader();
    state.failSuppressionRead = true;

    await expect(sendEmail({ ...NURTURE })).resolves.toEqual({
      sent: false,
      reason: "suppression-unreadable",
    });
    expect(vendorCalls).toEqual([]);
  });

  it("the page and the unavailable notice ask no store at all — a suppressed address still receives both (ADR-041)", async () => {
    wireSuppressionReader();
    state.suppressions.set("anna@example.com", "opt_out");

    await expect(
      sendEmail({
        kind: "first-page",
        to: "anna@example.com",
        subject: "mail.firstPage.subject",
        blocks: [],
      })
    ).resolves.toEqual({ sent: true, id: "vendor-1" });

    await expect(
      sendEmail({
        kind: "first-page-unavailable",
        to: "anna@example.com",
        subject: "mail.firstPageUnavailable.subject",
        blocks: [],
      })
    ).resolves.toEqual({ sent: true, id: "vendor-1" });

    expect(vendorCalls.map((call) => call.kind)).toEqual(["first-page", "first-page-unavailable"]);
  });

  it("this store never reaches a customer's own three switches", async () => {
    wireSuppressionReader();
    state.suppressions.set("anna@example.com", "opt_out");

    // A togglable kind consults `users.notify`, not this store: the same
    // address, suppressed here, is not what stops a weekly mail. With no
    // user preference store reachable in this suite the answer is the
    // toggle store's own, and it is never `'suppressed'`.
    const weekly = await sendEmail({
      kind: "weekly",
      to: "anna@example.com",
      subject: "mail.nurture.subject.1",
      blocks: [],
      userId: "1b1f5c2e-0000-4000-8000-000000000001",
      measurement: { state: "complete" },
    });
    expect(weekly).toEqual({ sent: false, reason: "preference-unreadable" });
  });
});

describe("wiring is idempotent and has one home", () => {
  it("calling it twice is the same as calling it once", async () => {
    wireSuppressionReader();
    wireSuppressionReader();
    await expect(sendEmail({ ...NURTURE })).resolves.toEqual({ sent: true, id: "vendor-1" });
  });

  it("importing the feature's entry point wires it", async () => {
    unwireSuppressionReader();
    await import("../../../src/lib/mail/leads/index");
    // The module's own top-level call; nothing else in the feature has a
    // side effect at import time.
    await expect(sendEmail({ ...NURTURE })).resolves.toEqual({ sent: true, id: "vendor-1" });
  });
});
