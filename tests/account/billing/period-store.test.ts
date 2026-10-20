// The month card's scan count, read through the real store: only scans that
// finished count, so a failed or still-running scan is never "a scan run".
import { expect, it, vi } from "vitest";
import { fakeDb } from "../../publish/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { supabaseBillingStore } = await import("@/lib/account/billing/store");

const FROM = new Date("2026-09-07T12:00:00.000Z");
const TO = new Date("2026-10-07T12:00:00.000Z");

it("counts done and degraded scans in the period, never failed or running ones", async () => {
  db.seed("scans", [
    { id: "s1", site_id: "site-1", status: "done", created_at: "2026-09-10T00:00:00.000Z" },
    { id: "s2", site_id: "site-1", status: "degraded", created_at: "2026-09-20T00:00:00.000Z" },
    { id: "s3", site_id: "site-1", status: "failed", created_at: "2026-09-21T00:00:00.000Z" },
    { id: "s4", site_id: "site-1", status: "running", created_at: "2026-10-01T00:00:00.000Z" },
    { id: "s5", site_id: "site-1", status: "done", created_at: "2026-10-08T00:00:00.000Z" },
    { id: "s6", site_id: "site-2", status: "done", created_at: "2026-09-10T00:00:00.000Z" },
  ]);
  db.seed("publications", []);

  const read = await supabaseBillingStore().period("site-1", FROM, TO);

  expect(read).toEqual({ ok: true, pages: [], scans: 2 });
});
