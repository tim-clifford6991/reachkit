// ADR-042 — exactly one store per send, chosen by the register row.
//
// The third case below is the one this ADR exists to protect: on
// magic-link auth the sign-in mail *is* the credential, so a customer with
// every toggle off and their address suppressed must still receive it. A
// merged "unsubscribe" mechanism takes that mail away silently, and the
// customer finds out when they cannot get back in.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";
import { fakeDb, newState, type FakeDbState } from "../notifications/fake-db";
import * as f from "../fixtures";

applyEnvFixture();

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

const { sendEmail, registerSuppressionReader } = await import("../../../src/lib/mail/send");
const { MAIL_KINDS } = await import("../../../src/lib/mail/kinds");
const { __setVendorTransportForTesting } = await import("../../../src/lib/mail/vendor/resend");

const USER = "1b1f5c2e-0000-4000-8000-000000000001";
const TO = "reader@example.com";

let sent = 0;
let suppressionAsked: string[] = [];

beforeEach(() => {
  sent = 0;
  suppressionAsked = [];
  state.rows = { [USER]: { notify: {} } };
  state.reads = [];
  state.failRead = false;
  __setVendorTransportForTesting(async () => {
    sent += 1;
    return { status: 200, headers: {}, body: JSON.stringify({ id: "vendor-1" }) };
  });
  registerSuppressionReader(async (address) => {
    suppressionAsked.push(address);
    return "send";
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  __setVendorTransportForTesting(null);
  registerSuppressionReader(null);
  vi.restoreAllMocks();
});

describe("ADR-042 — one store per send", () => {
  it("a 'toggle' kind switched off returns preference-off and never reaches the vendor", async () => {
    state.rows = { [USER]: { notify: { published: false } } };
    await expect(
      sendEmail({ kind: "published", to: TO, userId: USER, subject: f.HEADING_KEY, blocks: [f.HEADING] })
    ).resolves.toEqual({ sent: false, reason: "preference-off" });
    expect(sent).toBe(0);
    // The other store was not asked.
    expect(suppressionAsked).toEqual([]);
  });

  it("a 'toggle' kind consults the toggles and never the address store", async () => {
    await expect(
      sendEmail({ kind: "published", to: TO, userId: USER, subject: f.HEADING_KEY, blocks: [f.HEADING] })
    ).resolves.toEqual({ sent: true, id: "vendor-1" });
    expect(state.reads).toEqual([USER]);
    expect(suppressionAsked).toEqual([]);
  });

  it("an 'opt-out' kind consults the address store and never the toggles", async () => {
    registerSuppressionReader(async (address) => {
      suppressionAsked.push(address);
      return "suppressed";
    });
    await expect(
      sendEmail({ kind: "nurture", to: TO, subject: f.HEADING_KEY, blocks: [f.HEADING] })
    ).resolves.toEqual({ sent: false, reason: "suppressed" });
    expect(suppressionAsked).toEqual([TO]);
    expect(state.reads).toEqual([]);
    expect(sent).toBe(0);
  });

  it("magic-link, account and setup-reminder reach the vendor with every toggle off and the address suppressed", async () => {
    state.rows = { [USER]: { notify: { "draft-ready": false, published: false, weekly: false } } };
    registerSuppressionReader(async () => "suppressed");

    for (const kind of ["magic-link", "account", "setup-reminder"] as const) {
      state.reads = [];
      suppressionAsked = [];
      await expect(
        sendEmail({ kind, to: TO, subject: f.HEADING_KEY, blocks: [f.HEADING] }),
        kind
      ).resolves.toEqual({ sent: true, id: "vendor-1" });
      // Neither store was consulted at all — not "consulted and allowed".
      expect(state.reads, kind).toEqual([]);
      expect(suppressionAsked, kind).toEqual([]);
    }
    expect(sent).toBe(3);
  });

  it("the giveaway page a reader asked for is not stopped by their opt-out", async () => {
    registerSuppressionReader(async () => "suppressed");
    for (const kind of ["first-page", "first-page-unavailable", "report"] as const) {
      await expect(
        sendEmail({ kind, to: TO, subject: f.HEADING_KEY, blocks: [f.HEADING] }),
        kind
      ).resolves.toEqual({ sent: true, id: "vendor-1" });
    }
    expect(sent).toBe(3);
  });

  it("suppressible: false skips both consults and reaches the vendor", async () => {
    state.rows = { [USER]: { notify: { "draft-ready": false } } };
    await expect(
      sendEmail({
        kind: "draft-ready",
        to: TO,
        userId: USER,
        subject: f.HEADING_KEY,
        blocks: [f.HEADING],
        suppressible: false,
      })
    ).resolves.toEqual({ sent: true, id: "vendor-1" });
    expect(state.reads).toEqual([]);
    expect(MAIL_KINDS["draft-ready"].unsuppressibleWhen).toBeTruthy();
  });

  it("an unreadable toggle store stops the send, and says so distinctly", async () => {
    state.failRead = true;
    await expect(
      sendEmail({ kind: "weekly", to: TO, userId: USER, subject: f.HEADING_KEY, blocks: [f.HEADING], measurement: { state: "complete" } })
    ).resolves.toEqual({ sent: false, reason: "preference-unreadable" });
    expect(sent).toBe(0);
  });

  it("an unwired suppression store fails closed — the nurture mail is not sent on a guess", async () => {
    registerSuppressionReader(null);
    await expect(
      sendEmail({ kind: "nurture", to: TO, subject: f.HEADING_KEY, blocks: [f.HEADING] })
    ).resolves.toEqual({ sent: false, reason: "suppression-unreadable" });
    expect(sent).toBe(0);
  });

  it("the consult happens at send time, not at schedule time", async () => {
    // Two sends, one store read each: nothing is cached between them, so a
    // customer who switches a mail off between the two does not get it.
    await sendEmail({ kind: "published", to: TO, userId: USER, subject: f.HEADING_KEY, blocks: [f.HEADING] });
    state.rows = { [USER]: { notify: { published: false } } };
    await expect(
      sendEmail({ kind: "published", to: TO, userId: USER, subject: f.HEADING_KEY, blocks: [f.HEADING] })
    ).resolves.toEqual({ sent: false, reason: "preference-off" });
    expect(state.reads).toEqual([USER, USER]);
  });

  it("no send asks both stores", async () => {
    for (const kind of Object.keys(MAIL_KINDS) as (keyof typeof MAIL_KINDS)[]) {
      state.reads = [];
      suppressionAsked = [];
      await sendEmail(
        MAIL_KINDS[kind].stoppable === "toggle"
          ? ({ kind, to: TO, userId: USER, subject: f.HEADING_KEY, blocks: [f.HEADING], measurement: { state: "complete" } } as Parameters<typeof sendEmail>[0])
          : ({ kind, to: TO, subject: f.HEADING_KEY, blocks: [f.HEADING] } as Parameters<typeof sendEmail>[0])
      );
      expect(state.reads.length + suppressionAsked.length, kind).toBeLessThanOrEqual(1);
    }
  });
});
