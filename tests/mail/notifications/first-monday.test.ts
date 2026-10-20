// D3 (SPEC §8, decision 2026-10-19-1593): the page-ready mail is on until the
// customer's first Monday mail is sent, then off — unless they chose.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";
import { fakeDb, type Row } from "../../publish/harness";
import * as f from "../fixtures";

applyEnvFixture();

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { sendEmail } = await import("../../../src/lib/mail/send");
const { readNotifyPrefs } = await import("../../../src/lib/mail/notifications");
const { __setVendorTransportForTesting } = await import("../../../src/lib/mail/vendor/resend");

const USER = "1b1f5c2e-0000-4000-8000-000000000001";
let vendorCalls = 0;

function account(a: { notify: Row; digestSentAt: string | null }): void {
  db.reset();
  db.seed("users", [{ id: USER, email: "dana@example.com", notify: a.notify }]);
  db.seed("sites", [{ id: "s1", user_id: USER }]);
  db.seed("scans", [{ id: "w1", site_id: "s1", tier: "weekly", week_start: "2026-10-19", digest_sent_at: a.digestSentAt }]);
}

const pageReady = () =>
  sendEmail({ kind: "draft-ready", to: "dana@example.com", userId: USER, subject: f.HEADING_KEY, blocks: [f.HEADING] });

beforeEach(() => {
  vendorCalls = 0;
  __setVendorTransportForTesting(async () => {
    vendorCalls += 1;
    return { status: 200, headers: {}, body: JSON.stringify({ id: "vendor-1" }) };
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  __setVendorTransportForTesting(null);
  vi.restoreAllMocks();
});

describe("D3 — the page-ready mail by default", () => {
  it("is sent on day 1, before any Monday mail", async () => {
    account({ notify: {}, digestSentAt: null });
    await expect(pageReady()).resolves.toEqual({ sent: true, id: "vendor-1" });
    expect(vendorCalls).toBe(1);
  });

  it("is preference-off once the first Monday mail is sent, and Settings reads it off", async () => {
    account({ notify: {}, digestSentAt: "2026-10-19T08:00:00Z" });
    await expect(pageReady()).resolves.toEqual({ sent: false, reason: "preference-off" });
    expect(vendorCalls).toBe(0);
    await expect(readNotifyPrefs(USER)).resolves.toEqual({ "draft-ready": false, published: true, weekly: true });
  });

  it("stays on after the first Monday mail for a customer who switched it on", async () => {
    account({ notify: { "draft-ready": true }, digestSentAt: "2026-10-19T08:00:00Z" });
    await expect(pageReady()).resolves.toEqual({ sent: true, id: "vendor-1" });
    await expect(readNotifyPrefs(USER)).resolves.toMatchObject({ "draft-ready": true });
  });

  it("stays off before the first Monday mail for a customer who switched it off", async () => {
    account({ notify: { "draft-ready": false }, digestSentAt: null });
    await expect(pageReady()).resolves.toEqual({ sent: false, reason: "preference-off" });
  });

  it("leaves the other two mails on after the first Monday mail", async () => {
    account({ notify: {}, digestSentAt: "2026-10-19T08:00:00Z" });
    await expect(
      sendEmail({ kind: "published", to: "dana@example.com", userId: USER, subject: f.HEADING_KEY, blocks: [f.HEADING] })
    ).resolves.toEqual({ sent: true, id: "vendor-1" });
  });
});
