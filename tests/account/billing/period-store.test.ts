// The month card's reads, through the real store: Monday mails sent in the
// period, and the newest finished pass's report, never a failed or running one.
import { expect, it, vi } from "vitest";
import { fakeDb } from "../../publish/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { supabaseBillingStore } = await import("@/lib/account/billing/store");

const FROM = new Date("2026-09-07T12:00:00.000Z");
const TO = new Date("2026-10-07T12:00:00.000Z");

it("reads the period's Monday mails and its newest finished pass, never a failed or running one", async () => {
  db.seed("scans", [
    { id: "s1", site_id: "site-1", status: "done", created_at: "2026-09-10T00:00:00.000Z", digest_sent_at: "2026-09-14T08:00:00.000Z", report: { pass: "s1" } },
    { id: "s2", site_id: "site-1", status: "degraded", created_at: "2026-09-20T00:00:00.000Z", digest_sent_at: "2026-09-21T08:00:00.000Z", report: { pass: "s2" } },
    { id: "s3", site_id: "site-1", status: "failed", created_at: "2026-09-21T00:00:00.000Z", digest_sent_at: null, report: { pass: "s3" } },
    { id: "s4", site_id: "site-1", status: "running", created_at: "2026-10-01T00:00:00.000Z", digest_sent_at: null, report: null },
    { id: "s5", site_id: "site-1", status: "done", created_at: "2026-10-08T00:00:00.000Z", digest_sent_at: "2026-10-12T08:00:00.000Z", report: { pass: "s5" } },
    { id: "s6", site_id: "site-2", status: "done", created_at: "2026-09-10T00:00:00.000Z", digest_sent_at: "2026-09-14T08:00:00.000Z", report: { pass: "s6" } },
  ]);
  db.seed("publications", []);

  const read = await supabaseBillingStore().period("site-1", FROM, TO);

  expect(read).toEqual({
    ok: true,
    pages: [],
    reports: ["2026-09-14T08:00:00.000Z", "2026-09-21T08:00:00.000Z"],
    newestReport: { pass: "s2" },
  });
});
