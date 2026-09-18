// tests/scan/deep/remeasure.test.ts — SPEC §6 (owner ruling 2026-09-17,
// issue 837): a thin market is measured again now, one pass at a time and
// at most `REMEASURE.perDay` a day per site.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { topicOf } from "../../../src/lib/db/topics";
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

describe("issue 886 — the same maintenance tick delivered twice starts one pass", () => {
  it("both deliveries read no running pass, and only the first claims the cut-short pass's re-measure", async () => {
    // The window 837's bound leaves open: `remeasureAllowed` reads before
    // it writes, so two deliveries running together both see the cut-short
    // pass ended and nothing under way, and both go on to claim.
    // `scans_one_remeasure_per_pass` is what decides them.
    db.tables.scans = [pass("cut-short", "degraded", 40)];

    const both = await Promise.all([
      startRemeasure({ siteId: SITE, domain: DOMAIN, remeasureOf: "cut-short", now: NOW }),
      startRemeasure({ siteId: SITE, domain: DOMAIN, remeasureOf: "cut-short", now: NOW }),
    ]);

    expect(both.filter((one) => one.started)).toHaveLength(1);
    expect(both.filter((one) => !one.started)).toEqual([{ started: false, because: "running" }]);
    expect(db.tables.scans.filter((row) => row.remeasure_of === "cut-short")).toHaveLength(1);
    expect(sent).toHaveLength(1);
  });

  it("the pass records which one it is measuring again, and the founder's own press records none", async () => {
    db.tables.scans = [pass("cut-short", "degraded", 40)];
    const tick = (await startRemeasure({
      siteId: SITE,
      domain: DOMAIN,
      remeasureOf: "cut-short",
      now: NOW,
    })) as { scanId: string };
    expect(db.tables.scans.find((row) => row.id === tick.scanId)).toMatchObject({ remeasure_of: "cut-short" });

    db.tables.scans = [pass("onboarding", "done", 70)];
    const press = (await startRemeasure({ siteId: SITE, domain: DOMAIN, now: NOW })) as { scanId: string };
    expect(db.tables.scans.find((row) => row.id === press.scanId)?.remeasure_of).toBeUndefined();
  });

  it("a later cut-short pass is its own key, so 855 still measures again", async () => {
    db.tables.scans = [pass("first", "degraded", 200)];
    expect(await startRemeasure({ siteId: SITE, domain: DOMAIN, remeasureOf: "first", now: NOW })).toMatchObject({
      started: true,
    });
    db.tables.scans = [pass("second", "degraded", 40)];
    expect(await startRemeasure({ siteId: SITE, domain: DOMAIN, remeasureOf: "second", now: NOW })).toMatchObject({
      started: true,
    });
  });
});

describe("issue 886 — the rule is the database's, not this module's", () => {
  const MIGRATION = "20260918120100_scans_remeasure.sql";
  const sql = readFileSync(path.resolve(import.meta.dirname, "../../../supabase/migrations", MIGRATION), "utf8")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

  it("carries an assigned topic token", () => {
    expect(topicOf(MIGRATION)).toEqual({ token: "scans", owner: "BP-012" });
  });

  it("records which pass a re-measure is measuring again, and holds one re-measure per pass", () => {
    expect(sql).toMatch(/add column if not exists remeasure_of uuid references scans \(id\)/);
    expect(sql).toMatch(
      /create unique index if not exists scans_one_remeasure_per_pass\s+on scans \(remeasure_of\)\s+where remeasure_of is not null/
    );
  });

  it("no pass that is not an automatic re-measure is in the index — the founder's press keeps its own bound", () => {
    expect(sql).toMatch(/where remeasure_of is not null/);
    expect(sql).not.toMatch(/on scans \(site_id\)/);
  });
});
