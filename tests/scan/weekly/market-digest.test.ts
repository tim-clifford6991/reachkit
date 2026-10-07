// tests/scan/weekly/market-digest.test.ts — issue #796
//
// #770 mailed the owner on every paid pass that found too little market, so
// a thin site mailed every Monday. Driven through the real `account/maintenance`
// tick, the real due query, the real digest and the real send seam; the fakes
// are the database, the mail vendor's transport, and the tick's other
// obligations with nothing due. Nothing is bought and nothing leaves.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { fakeDb, type Row } from "../../publish/harness";
import { AT, fullSections } from "../report/fixtures";
import { measuredZero } from "../../../src/lib/measure/measured";

applyEnvFixture();

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

vi.mock("@/lib/account/provisioning/due-work", () => ({
  paymentsAwaitingSignIn: async () => [],
  paymentsWithoutAccounts: async () => [],
}));
vi.mock("@/lib/mail/setup/reminders", () => ({
  sitesDueSetupReminder: async () => [],
  sendSetupReminder: async () => ({ sent: false }),
}));
vi.mock("@/lib/scan/stuck", () => ({
  scansLeftRunning: async () => [],
  finishScanLeftRunning: async () => ({ finished: false }),
}));
vi.mock("@/lib/scan/deep/backstop", () => ({
  sitesWithoutDeepPass: async () => [],
  deepPassDomain: async () => null,
}));
vi.mock("@/lib/mail/retention", () => ({
  accountsDueInactivity: async () => [],
  draftsDueVetoReminder: async () => [],
  accountsDuePaymentFailed: async () => [],
  accountsDueCancellation: async () => [],
  accountsDueWinback: async () => [],
}));
vi.mock("@/lib/publish/destinations/health", () => ({
  hostedDestinationsDueHealth: async () => [],
  checkHealth: async () => ({ health: "ok", reason: null, checkedAt: new Date() }),
}));

const { accountMaintenance } = await import("../../../src/jobs/account-maintenance");
const { lastEndedMonday } = await import("../../../src/lib/scan/weekly/market-digest");
const { assembleReport } = await import("../../../src/lib/scan/store");
const { __setVendorTransportForTesting } = await import("../../../src/lib/mail/vendor/resend");
const { setBillingStore } = await import("../../../src/lib/account/billing");
const { memoryBillingStore, newMemoryBilling } = await import("../../account/billing/memory-store");
const { setLifecycleStore } = await import("../../../src/lib/account/lifecycle");
const { memoryLifecycleStore, newMemoryLifecycle } = await import("../../account/lifecycle/memory-store");

const MONDAY = "2026-09-14";
/** Monday has ended in UTC−12. */
const TUESDAY_NOON_UTC = new Date("2026-09-15T12:00:00.000Z");
const THIN_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THIN_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const HEALTHY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const DEEP_THIN = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function blob(scanId: string, thin: boolean): unknown {
  const sections = fullSections({ scanId, tier: "weekly" });
  const report = assembleReport(thin ? { ...sections, questions: measuredZero([], AT) } : sections);
  return JSON.parse(JSON.stringify(report));
}

function weekly(id: string, thin: boolean, over: Row = {}): Row {
  return { id, tier: "weekly", week_start: MONDAY, status: "done", market_digest_at: null, report: blob(id, thin), ...over };
}

let mails: Record<string, unknown>[] = [];
let vendorStatus = 200;

beforeEach(() => {
  db.reset();
  mails = [];
  vendorStatus = 200;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TUESDAY_NOON_UTC);
  setBillingStore(memoryBillingStore(newMemoryBilling()));
  setLifecycleStore(memoryLifecycleStore(newMemoryLifecycle()));
  __setVendorTransportForTesting(async (payload) => {
    if (vendorStatus !== 200) return { status: vendorStatus, headers: {}, body: "{}" };
    mails.push(JSON.parse(payload) as Record<string, unknown>);
    return { status: 200, headers: {}, body: JSON.stringify({ id: `vendor-${mails.length}` }) };
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  __setVendorTransportForTesting(null);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function tick() {
  return accountMaintenance.run({ data: {}, now: new Date() });
}

function row(id: string): Row {
  return db.rows("scans").find((r) => r.id === id)!;
}

describe("#796 — a Monday's thin weekly passes are one owner digest", () => {
  it("one mail lists every thin weekly pass of the week; a second tick sends nothing", async () => {
    db.seed("scans", [
      weekly(THIN_A, true),
      weekly(THIN_B, true),
      weekly(HEALTHY, false),
      // A deep pass mailed at once (#770) and is never in the digest.
      { id: DEEP_THIN, tier: "deep", week_start: null, status: "done", market_digest_at: null, report: blob(DEEP_THIN, true) },
    ]);

    expect(await tick()).toEqual({ outcome: "ran", subjectId: null });

    expect(mails).toHaveLength(1);
    const html = String(mails[0]!.html);
    expect(html).toContain(MONDAY);
    expect(html).toContain(THIN_A);
    expect(html).toContain(THIN_B);
    expect(html).not.toContain(HEALTHY);
    expect(html).not.toContain(DEEP_THIN);
    expect(html).not.toContain("TODO(copy)");
    for (const id of [THIN_A, THIN_B, HEALTHY]) expect(row(id).market_digest_at).toBe(TUESDAY_NOON_UTC.toISOString());
    expect(row(DEEP_THIN).market_digest_at).toBeNull();

    expect(await tick()).toEqual({ outcome: "skipped", subjectId: null, reason: "no-subject" });
    expect(mails).toHaveLength(1);
  });

  it("nothing is sent while the Monday is still running somewhere", async () => {
    vi.setSystemTime(new Date("2026-09-15T11:59:00.000Z"));
    db.seed("scans", [weekly(THIN_A, true)]);

    await tick();

    expect(mails).toHaveLength(0);
    expect(row(THIN_A).market_digest_at).toBeNull();
  });

  it("a week with no thin pass sends nothing, and is settled", async () => {
    db.seed("scans", [weekly(HEALTHY, false), weekly(THIN_A, true, { status: "running", report: null })]);

    await tick();

    expect(mails).toHaveLength(0);
    expect(row(HEALTHY).market_digest_at).not.toBeNull();
    expect(row(THIN_A).market_digest_at).toBeNull();
  });

  it("a digest the vendor refused stamps nothing and goes out on the next tick", async () => {
    db.seed("scans", [weekly(THIN_A, true)]);
    vendorStatus = 422;

    expect(await tick()).toEqual({ outcome: "degraded", subjectId: null, step: "market-digest-not-sent" });
    expect(row(THIN_A).market_digest_at).toBeNull();

    vendorStatus = 200;
    await tick();
    expect(mails).toHaveLength(1);
    expect(row(THIN_A).market_digest_at).not.toBeNull();
  });

  it("issue 1184: the digest says why the week before's pages stalled, with no thin pass at all", async () => {
    const SITE = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const stoppedBy = (reason: string) => [{ from: "generating", to: "needs_attention", at: "2026-09-09T06:00:00.000Z", reason }];
    db.seed("scans", [weekly(HEALTHY, false)]);
    db.seed("sites", [{ id: SITE, domain: "stalled.example" }]);
    db.seed("drafts", [
      { id: "d1", site_id: SITE, scheduled_for: "2026-09-07", state: "needs_attention", transitions: stoppedBy("rules:no_private_figure,brand_gap") },
      { id: "d2", site_id: SITE, scheduled_for: "2026-09-13", state: "needs_attention", transitions: stoppedBy("rules:no_private_figure") },
      { id: "d3", site_id: SITE, scheduled_for: "2026-09-10", state: "published", transitions: [] },
      // This Monday's own page is next week's count.
      { id: "d4", site_id: SITE, scheduled_for: MONDAY, state: "needs_attention", transitions: stoppedBy("rules:page_frame") },
    ]);

    await tick();

    expect(mails).toHaveLength(1);
    const html = String(mails[0]!.html);
    expect(html).toContain("stalled.example");
    expect(html).toContain("2026-09-07");
    expect(html).toContain("2 / 3");
    expect(html).toContain("no_private_figure: 2");
    expect(html).toContain("brand_gap: 1");
    expect(html).not.toContain("page_frame");
    expect(html).not.toContain(HEALTHY);
    expect(html).not.toContain("too little search demand");
    expect(row(HEALTHY).market_digest_at).not.toBeNull();
  });

  it("issue 1286: the digest says what the week before cost, per site, with free scans and smoke tests apart", async () => {
    const SITE = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const scan = (over: Row): Row => ({ status: "done", week_start: null, market_digest_at: null, report: null, smoke: false, ...over });
    db.seed("scans", [
      weekly(HEALTHY, false, { domain: "paying.example", created_at: "2026-09-14T06:00:00.000Z", cost_cents: 99 }),
      scan({ id: "s1", tier: "weekly", domain: "paying.example", created_at: "2026-09-07T06:00:00.000Z", cost_cents: 38.5 }),
      scan({ id: "s2", tier: "deep", domain: "paying.example", created_at: "2026-09-10T09:00:00.000Z", cost_cents: 121.5 }),
      scan({ id: "s3", tier: "free", domain: "visitor-a.example", created_at: "2026-09-08T10:00:00.000Z", cost_cents: 9 }),
      scan({ id: "s4", tier: "free", domain: "visitor-b.example", created_at: "2026-09-12T10:00:00.000Z", cost_cents: 11 }),
      scan({ id: "s5", tier: "free", domain: "basecamp.com", created_at: "2026-09-09T10:00:00.000Z", cost_cents: 8, smoke: true }),
    ]);
    db.seed("sites", [{ id: SITE, domain: "paying.example" }]);
    db.seed("drafts", [
      { id: "d1", site_id: SITE, scheduled_for: "2026-09-08", state: "published", transitions: [], cost_cents: 20 },
      { id: "d2", site_id: SITE, scheduled_for: "2026-09-09", state: "published", transitions: [], cost_cents: 10 },
    ]);
    db.rpcs.set("fetches_spend_since", (args: Row) => (String(args.p_since) < "2026-09-14" ? 318 : 99));
    // D63 (issue 1298): the week's SERP reads. The fake filters on a column
    // name, so the failure kind is seeded under the path the query names.
    const serp = (created_at: string, over: Row = {}): Row => ({ source: "serp/google/organic", created_at, cost_cents: 0.2, ...over });
    const timedOut = { "payload->>vendorFailure": "timeout" };
    db.seed("fetches", [
      serp("2026-09-08T10:00:01.000Z"),
      serp("2026-09-08T10:00:02.000Z", timedOut),
      serp("2026-09-09T10:00:00.000Z", timedOut),
      serp("2026-09-10T09:00:00.000Z"),
      serp("2026-09-12T10:00:00.000Z", { ...timedOut, cost_cents: 0.06 }),
      serp("2026-09-14T06:00:00.000Z", timedOut), // this Monday's: next week's
      { source: "labs/keyword_overview", created_at: "2026-09-08T10:00:00.000Z", cost_cents: 1, ...timedOut },
    ]);

    await tick();

    expect(mails).toHaveLength(1);
    const html = String(mails[0]!.html);
    expect(html).toContain("paying.example");
    expect(html).toContain("80.0¢ × 2"); // two measurements, 160¢
    expect(html).toContain("15.0¢ × 2"); // two pages, 30¢
    expect(html).toContain("190.0¢"); // the site
    expect(html).toContain("20.0¢ × 2"); // free scans
    expect(html).toContain("8.0¢ × 1"); // the smoke test, apart
    expect(html).toContain("219.0¢"); // the ledger's week
    expect(html).toContain("60% (3 / 5)"); // SERP reads that timed out
    expect(html).toContain("0.5¢"); // what they were billed: 0.2 + 0.2 + 0.06
    // A visitor's domain is not the owner's site, and this Monday's own pass is next week's.
    expect(html).not.toContain("visitor-a.example");
    expect(html).not.toContain("99.0¢");
    expect(html).not.toContain("too little search demand");
    expect(html).not.toContain("TODO(copy)");
  });

  it("the due Monday is the latest one that has ended in every zone", () => {
    expect(lastEndedMonday(new Date("2026-09-15T11:59:59.000Z"))).toBe("2026-09-07");
    expect(lastEndedMonday(TUESDAY_NOON_UTC)).toBe(MONDAY);
    expect(lastEndedMonday(new Date("2026-09-21T09:00:00.000Z"))).toBe(MONDAY);
    expect(lastEndedMonday(new Date("2026-09-22T12:00:00.000Z"))).toBe("2026-09-21");
  });
});
