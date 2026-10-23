// The month card's reads, through the real store: Monday mails sent in the
// period, and the newest finished weekly or deep pass's report, never a
// failed, running or free one, and the same pass Overview counts.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, expect, it, vi } from "vitest";
import { fakeDb } from "../../publish/harness";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { supabaseBillingStore, setBillingStore } = await import("@/lib/account/billing/store");
const { monthGot } = await import("@/lib/account/billing");
const { readDoneFacts } = await import("@/app/(account)/app/_overview/done-store");

const FROM = new Date("2026-09-07T12:00:00.000Z");
const TO = new Date("2026-10-07T12:00:00.000Z");

/** A stored report from the customer panel's walk, raw as the `scans.report` column holds it. */
function storedReport(walk: string, domain: string): unknown {
  const file = path.resolve(import.meta.dirname, `../../../docs/walk/free/${walk}.json`);
  const sites = (JSON.parse(readFileSync(file, "utf8")) as { sites: { domain: string; stored: { scan: { report: unknown } } | null }[] }).sites;
  return sites.find((s) => s.domain === domain && s.stored !== null)!.stored!.scan.report;
}

const WEEKLY = storedReport("2026-10-15-1449-after", "savvycal.com");
const FREE = storedReport("2026-10-15", "austinplumbery.com");

beforeEach(() => {
  db.seed("users", [{ id: "u1", email: "owner@harborplumbing.example", plan_status: "active", paid_through: TO.toISOString(), created_at: "2026-08-07T12:00:00.000Z" }]);
  db.seed("publications", []);
});

it("reads the period's Monday mails and its newest finished pass, never a failed or running one", async () => {
  db.seed("scans", [
    { id: "s1", site_id: "site-1", tier: "weekly", status: "done", created_at: "2026-09-10T00:00:00.000Z", digest_sent_at: "2026-09-14T08:00:00.000Z", report: { pass: "s1" } },
    { id: "s2", site_id: "site-1", tier: "deep", status: "degraded", created_at: "2026-09-20T00:00:00.000Z", digest_sent_at: "2026-09-21T08:00:00.000Z", report: { pass: "s2" } },
    { id: "s3", site_id: "site-1", tier: "weekly", status: "failed", created_at: "2026-09-21T00:00:00.000Z", digest_sent_at: null, report: { pass: "s3" } },
    { id: "s4", site_id: "site-1", tier: "weekly", status: "running", created_at: "2026-10-01T00:00:00.000Z", digest_sent_at: null, report: null },
    { id: "s5", site_id: "site-1", tier: "weekly", status: "done", created_at: "2026-10-08T00:00:00.000Z", digest_sent_at: "2026-10-12T08:00:00.000Z", report: { pass: "s5" } },
    { id: "s6", site_id: "site-2", tier: "weekly", status: "done", created_at: "2026-09-10T00:00:00.000Z", digest_sent_at: "2026-09-14T08:00:00.000Z", report: { pass: "s6" } },
  ]);

  const read = await supabaseBillingStore().period("site-1", FROM, TO);

  expect(read).toEqual({
    ok: true,
    pages: [],
    reports: ["2026-09-14T08:00:00.000Z", "2026-09-21T08:00:00.000Z"],
    newestReport: { pass: "s2" },
  });
});

it("a free-tier scan in the period is not the newest pass", async () => {
  db.seed("scans", [
    { id: "w1", site_id: "site-1", tier: "weekly", status: "done", created_at: "2026-09-14T06:00:00.000Z", digest_sent_at: null, report: WEEKLY },
    { id: "f1", site_id: "site-1", tier: "free", status: "done", created_at: "2026-09-16T10:00:00.000Z", digest_sent_at: null, report: FREE },
  ]);

  const read = await supabaseBillingStore().period("site-1", FROM, TO);

  expect(read.ok && read.newestReport).toBe(WEEKLY);
});

it("with only free-tier scans in the period, nothing is measured, never zero", async () => {
  db.seed("scans", [
    { id: "f1", site_id: "site-1", tier: "free", status: "done", created_at: "2026-09-16T10:00:00.000Z", digest_sent_at: null, report: FREE },
  ]);
  setBillingStore(supabaseBillingStore());
  try {
    expect((await monthGot("u1", "site-1"))?.asked).toBeNull();
  } finally {
    setBillingStore(null);
  }
});

it("Billing and Overview count the same pass from the same rows", async () => {
  db.seed("scans", [
    { id: "w1", site_id: "site-1", tier: "weekly", status: "done", created_at: "2026-09-14T06:00:00.000Z", digest_sent_at: null, report: WEEKLY },
    { id: "f1", site_id: "site-1", tier: "free", status: "done", created_at: "2026-09-16T10:00:00.000Z", digest_sent_at: null, report: FREE },
  ]);
  setBillingStore(supabaseBillingStore());
  try {
    const billing = (await monthGot("u1", "site-1"))?.asked;
    const overview = (await readDoneFacts({ siteId: "site-1", domain: "savvycal.com", timeZone: "UTC" })).lastMeasured;
    expect(billing).not.toBeNull();
    expect(billing).toEqual({ searches: overview?.searches, questions: overview?.questions });
  } finally {
    setBillingStore(null);
  }
});
