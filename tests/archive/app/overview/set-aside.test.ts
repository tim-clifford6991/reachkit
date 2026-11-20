// Owner O7, read from rows: Overview says nothing about a page set aside, and only a critical cause is a Needs you,
// in its alerts and in its week strip alike.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type FakeDb, type Row } from "../../publish/harness";
import { readAlerts } from "@/app/(account)/app/_overview/alerts";

const db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/opportunities", () => ({
  supplyDepth: async () => ({ unused: 9, total: 12 }),
  supplyMeasured: async () => true,
  supplyState: async () => "measured",
  readWeek: async () => [],
}));

const { readOverviewFacts } = await import("@/app/(account)/app/_overview/store");

const NOW = new Date(Date.UTC(2026, 8, 9, 10, 0, 0));
const WEEK = ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13"];

const draft = (id: string, day: string, state: string, moves: Row[]): Row => ({
  id,
  site_id: "site-1",
  state,
  title: `page ${id}`,
  scheduled_for: day,
  opportunity_id: null,
  created_at: "2026-09-01T08:00:00.000Z",
  veto_deadline: null,
  meta: {},
  transitions: [{ at: "2026-09-01T08:05:00.000Z", from: "generating", to: "needs_attention", reason: "rules:plain_prose" }, ...moves],
});

beforeEach(() => {
  db.reset();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  db.seed("sites", [{ id: "site-1", user_id: "user-1", domain: "example.com", timezone: "UTC" }]);
  db.seed("publications", []);
  db.seed("scans", []);
  db.seed("drafts", [
    draft("set-aside", "2026-09-08", "skipped", [{ at: "2026-09-08T03:00:00.000Z", from: "needs_attention", to: "skipped", actor: { kind: "system", job: "draft/recheck" }, reason: "retired:plain_prose" }]),
    draft("rules", "2026-09-09", "needs_attention", []),
    draft("destination", "2026-09-10", "needs_attention", [{ at: "2026-09-02T08:00:00.000Z", from: "failed", to: "needs_attention", reason: "reason_needs_customer" }]),
  ]);
});

describe("Overview and a page the system sets aside or rescues", () => {
  it("alerts only the critical page, and the strip says Needs you only on its day", async () => {
    const read = await readOverviewFacts({ siteId: "site-1", timeZone: "UTC", domain: "example.com" });
    expect(readAlerts(read.waiting, NOW).alerts.map((alert) => alert.href)).toEqual(["/app/draft/destination"]);
    expect(read.weekPages).toEqual(
      WEEK.map((day) => ({ "2026-09-09": "calendar.stage.planned", "2026-09-10": "calendar.stage.needs-you" })[day] ?? null)
    );
  });
});
