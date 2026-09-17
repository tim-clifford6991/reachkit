// tests/scan/deep/remeasure.test.ts — SPEC §6 (owner ruling 2026-09-17,
// issue 837): a thin market is measured again now, one pass at a time and
// at most `REMEASURE.perDay` a day per site.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { fakeDb, type FakeDb, type Row } from "./fake-db";

applyEnvFixture();

let db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const sent: { name: string; data: Record<string, unknown> }[] = [];
let sendFails = false;
vi.mock("@/jobs/client", () => ({
  sendJobEvent: async (name: string, data: Record<string, unknown>) => {
    if (sendFails) throw new Error("queue down");
    sent.push({ name, data });
  },
}));

const { startRemeasure } = await import("../../../src/lib/scan/deep/remeasure");
const { passProgressFor } = await import("../../../src/lib/scan/deep/progress");
const { REMEASURE } = await import("../../../src/lib/config/constants");

const SITE = "site-1";
const DOMAIN = "quietbooks.com";
const RELEASED = new Date(Date.UTC(2026, 8, 17, 9, 0, 0));
const NOW = new Date(RELEASED.getTime() + 60 * 60_000);
const MIN = 60_000;

function pass(id: string, status: string, minutesAgo: number): Row {
  return { id, site_id: SITE, tier: "deep", status, created_at: new Date(NOW.getTime() - minutesAgo * MIN).toISOString() };
}

beforeEach(() => {
  sent.length = 0;
  sendFails = false;
  db = fakeDb({
    sites: [
      {
        id: SITE,
        domain: DOMAIN,
        category: "bookkeeping software for therapists",
        setup_completed_at: new Date(RELEASED.getTime() - 5 * MIN).toISOString(),
        setup_released_at: RELEASED.toISOString(),
        setup_released_reason: "completed",
        setup_stage: null,
        setup_stage_times: {},
      },
    ],
    scans: [pass("onboarding", "done", 70)],
  });
});

describe("a press starts one pass now", () => {
  it("saves the chosen category, claims a fresh running row and sends scan/run for it", async () => {
    const started = await startRemeasure({ siteId: SITE, domain: DOMAIN, category: "bookkeeping software", now: NOW });
    expect(started).toEqual({ started: true, scanId: expect.any(String) });
    const scanId = (started as { scanId: string }).scanId;

    expect(db.tables.sites![0]!.category).toBe("bookkeeping software");
    expect(db.tables.scans!.find((row) => row.id === scanId)).toMatchObject({ tier: "deep", status: "running", site_id: SITE });
    expect(sent).toEqual([
      { name: "scan/run", data: { scanId, domain: DOMAIN, tier: "deep", siteId: SITE, remeasure: true } },
    ]);
  });

  it("a released founder's panel shows the pass's steps while it runs, and nothing once it ends", async () => {
    const started = (await startRemeasure({ siteId: SITE, domain: DOMAIN, now: NOW })) as { scanId: string };
    const row = db.tables.scans!.find((scan) => scan.id === started.scanId)!;
    row.created_at = NOW.toISOString();
    expect(await passProgressFor(SITE, NOW)).toMatchObject({ running: true, stage: "reading_your_site" });

    row.status = "done";
    expect(await passProgressFor(SITE, NOW)).toEqual({ running: false, degraded: false });
  });

  it("a send that fails closes the row it claimed and clears the step, so the next press is not blocked", async () => {
    sendFails = true;
    await expect(startRemeasure({ siteId: SITE, domain: DOMAIN, now: NOW })).rejects.toThrow("queue down");
    const claimed = db.tables.scans!.find((row) => row.id !== "onboarding")!;
    expect(claimed.status).toBe("failed");
    expect(db.tables.sites![0]!.setup_stage).toBeNull();
  });
});

describe("the bound: one at a time, and a few a day", () => {
  it("refuses while a pass is still under way, and changes nothing", async () => {
    db.tables.scans!.push(pass("running", "running", 2));
    const refused = await startRemeasure({ siteId: SITE, domain: DOMAIN, category: "other", now: NOW });
    expect(refused).toEqual({ started: false, because: "running" });
    expect(db.tables.sites![0]!.category).toBe("bookkeeping software for therapists");
    expect(sent).toEqual([]);
  });

  it("a pass the platform lost stops counting as under way after the hold", async () => {
    db.tables.scans!.push(pass("lost", "running", REMEASURE.runningHoldMin + 1));
    expect(await startRemeasure({ siteId: SITE, domain: DOMAIN, now: NOW })).toMatchObject({ started: true });
  });

  it("refuses the day's next pass and names when the oldest leaves the window", async () => {
    db.tables.scans = [pass("a", "done", 23 * 60), pass("b", "done", 120), pass("c", "done", 60)];
    const refused = await startRemeasure({ siteId: SITE, domain: DOMAIN, now: NOW });
    expect(refused).toEqual({
      started: false,
      because: "daily_limit",
      nextAt: new Date(NOW.getTime() + 60 * MIN),
    });
    expect(sent).toEqual([]);
  });

  it("passes older than a day do not count", async () => {
    db.tables.scans = [pass("a", "done", 25 * 60), pass("b", "done", 26 * 60), pass("c", "done", 27 * 60)];
    expect(await startRemeasure({ siteId: SITE, domain: DOMAIN, now: NOW })).toMatchObject({ started: true });
  });
});
