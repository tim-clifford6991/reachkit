// tests/mail/onboarding/once.test.ts — the onboarding mails' duplicate-run case: a second delivery of the pass's end, or
// two at once, sends each mail once. The transport counts every request, so the claim is proven, not Resend's key.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";
import { fakeDb, type FakeDb } from "../../scan/deep/fake-db";

applyEnvFixture();

let db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { sendOnboardingMails } = await import("@/lib/mail/onboarding");
const { __setVendorTransportForTesting } = await import("@/lib/mail/vendor/resend");

let delivered: string[] = [];

beforeEach(() => {
  delivered = [];
  __setVendorTransportForTesting(async (payload) => {
    delivered.push(payload);
    return { status: 200, headers: {}, body: JSON.stringify({ id: `vendor-${delivered.length}` }) };
  });
  db = fakeDb({
    sites: [{ id: "site-1", user_id: "user-1", domain: "acme.example", category: "Plumbers", competitors: ["rival.example"],
      setup_completed_at: "2026-11-14T09:00:00Z",
      setup_done_mail_sent_at: null, connected_mail_sent_at: null, timezone: null }],
    users: [{ id: "user-1", email: "founder@example.com" }],
    scans: [{ site_id: "site-1", tier: "deep", status: "done", stopped_reason: "complete", finished_at: "2026-11-14T09:05:00Z" }],
    destinations: [{ id: "dest-1", site_id: "site-1", kind: "hosted", health: "ok", hostname: "blog.acme.example",
      hostname_state: "live", deleted_at: null }],
    opportunities: [],
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("onboarding mails: once per site", () => {
  it("two deliveries in turn send setup-done and connected once each", async () => {
    expect((await sendOnboardingMails("site-1")).sent).toEqual(["setup_done_mail_sent_at", "connected_mail_sent_at"]);
    expect((await sendOnboardingMails("site-1")).sent).toEqual([]);
    expect(delivered).toHaveLength(2);
  });

  it("two deliveries at once send each mail once", async () => {
    await Promise.all([sendOnboardingMails("site-1"), sendOnboardingMails("site-1")]);
    expect(delivered).toHaveLength(2);
  });
});
