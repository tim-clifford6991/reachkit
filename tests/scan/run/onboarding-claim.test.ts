// tests/scan/run/onboarding-claim.test.ts — issue 750
//
// Owner ruling, 2026-09-16: the deep pass's `scans` row is claimed when
// setup accepts the founder's address, the rival suggestion spends against
// it, and the pass adopts it. What this suite holds is the row itself: one
// per site however many times it is claimed, the address it is for moving
// with the founder's, and a pass that has ended never re-opened.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { fakeDb, type FakeDb } from "../deep/fake-db";

applyEnvFixture();

let db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { claimOnboardingPass } = await import("../../../src/lib/scan/run");
const { weeklyRefresh } = await import("@/jobs/weekly-refresh");
const { startRemeasure } = await import("@/lib/scan/deep/remeasure");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

beforeEach(() => {
  db = fakeDb({ scans: [] });
});

describe("claimOnboardingPass — one onboarding row per site", () => {
  it("inserts one running deep row for the site, at the address given, and answers its id", async () => {
    const id = await claimOnboardingPass({ siteId: "site-1", domain: "founder.com" });
    expect(id).toMatch(UUID);
    expect(db.tables.scans).toEqual([
      { id, domain: "founder.com", tier: "deep", status: "running", site_id: "site-1" },
    ]);
  });

  it("a second claim — a new address, a racing request, the pass itself — adds no row and moves the address", async () => {
    const first = await claimOnboardingPass({ siteId: "site-1", domain: "founder.com" });
    const second = await claimOnboardingPass({ siteId: "site-1", domain: "renamed.com" });
    expect(second).toBe(first);
    expect(db.tables.scans).toHaveLength(1);
    expect(db.tables.scans![0]).toMatchObject({ id: first, domain: "renamed.com", status: "running" });
  });

  it("two sites never share a row", async () => {
    const one = await claimOnboardingPass({ siteId: "site-1", domain: "founder.com" });
    const two = await claimOnboardingPass({ siteId: "site-2", domain: "founder.com" });
    expect(one).not.toBe(two);
    expect(db.tables.scans).toHaveLength(2);
  });

  it("a pass that has ended is not re-opened, so the pass started for it adopts nothing", async () => {
    const id = await claimOnboardingPass({ siteId: "site-1", domain: "founder.com" });
    Object.assign(db.tables.scans![0]!, { status: "done" });
    await expect(claimOnboardingPass({ siteId: "site-1", domain: "other.com" })).resolves.toBe(id);
    expect(db.tables.scans).toHaveLength(1);
    expect(db.tables.scans![0]).toMatchObject({ status: "done", domain: "founder.com" });
  });

  it("an address that is not a domain claims nothing", async () => {
    await expect(claimOnboardingPass({ siteId: "site-1", domain: "not a domain" })).rejects.toThrow();
    expect(db.tables.scans).toHaveLength(0);
  });

  it("a first pass for a domain with no public suffix stops once: it resolves, so the queue never retries it", async () => {
    const outcome = await weeklyRefresh.perSubject!({ data: { siteId: "s", domain: "x.example", first: true, again: true }, now: new Date(), attempt: 0 });
    expect(outcome).toEqual({ outcome: "stopped", subjectId: "s", by: "domain_unlisted" });
    expect(db.tables.scans).toHaveLength(0);
  });

  it("a fourth Measure again inside a day is refused, and claims no row, so nothing is sent or spent", async () => {
    const now = new Date("2026-11-24T12:00:00Z"), hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
    const site = { id: "site-1", category: "plumbing", setup_stage: null };
    db = fakeDb({ scans: [1, 5, 20].map((h) => ({ id: `p${h}`, domain: "founder.com", tier: "deep", status: "done", site_id: "site-1", created_at: hoursAgo(h) })), sites: [site] });
    expect(await startRemeasure({ siteId: "site-1", domain: "founder.com", category: "roofing", now })).toEqual({ started: false, because: "daily_limit", nextAt: new Date(now.getTime() + 4 * 3_600_000) });
    expect(db.tables.scans).toHaveLength(3);
    expect(db.tables.sites).toEqual([{ id: "site-1", category: "plumbing", setup_stage: null }]);
  });
});
