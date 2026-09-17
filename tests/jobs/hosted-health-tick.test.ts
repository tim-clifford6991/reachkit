// tests/jobs/hosted-health-tick.test.ts — issue #791
//
// A founder points their record and never opens Settings. Before #791 the
// row kept `expired` until something read it, so `destination_working` held
// every page. Driven through the real `account/maintenance` tick, the real
// due query, the real `checkHealth` and the real `addProjectDomain`; the fakes
// are the database, the Domains API's one `safeFetch`, the resolver, and the
// tick's other obligations with nothing due.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";
import { fakeDb, type Row } from "../publish/harness";

applyEnvFixture();

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const vendor = vi.hoisted(() => ({
  verified: true,
  hosts: [] as string[],
}));

vi.mock("@/lib/config/env", async (importOriginal) => {
  const actual = await importOriginal<{ env: Record<string, unknown> }>();
  const bindings: Record<string, string> = { VERCEL_API_TOKEN: "token-791", VERCEL_PROJECT_ID: "prj_791" };
  return {
    ...actual,
    env: new Proxy({}, { get: (_t, key: string) => (key in bindings ? bindings[key] : actual.env[key]) }),
  };
});

vi.mock("@/lib/egress", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  // The customer's record, as this resolver sees it: not at all. Only the
  // domain list's verification makes the destination healthy.
  resolvesInDns: async () => false,
  safeFetch: async (url: string, opts: { method?: string; body?: string }) => {
    if (opts.method === "POST") vendor.hosts.push((JSON.parse(opts.body ?? "{}") as { name: string }).name);
    return {
      ok: true,
      status: 200,
      url,
      html: JSON.stringify({ verified: vendor.verified }),
      bytes: 0,
      readAt: new Date(),
      headers: {},
    };
  },
}));

// The tick's other obligations, with nothing due — the footing
// `setup-wiring.test.ts` stands them on.
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
// Issue #782's re-enqueue check reads `sites` and `scans` through its own module.
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

const { accountMaintenance } = await import("../../src/jobs/account-maintenance");
const { setBillingStore } = await import("../../src/lib/account/billing");
const { memoryBillingStore, newMemoryBilling } = await import("../account/billing/memory-store");
const { setLifecycleStore } = await import("../../src/lib/account/lifecycle");
const { memoryLifecycleStore, newMemoryLifecycle } = await import("../account/lifecycle/memory-store");
const { destinationWorking } = await import("@/lib/publish/destinations");
const { DESTINATION_HEALTH_MAX_AGE_H, DESTINATION_HOSTNAME_RECHECK_H } = await import(
  "@/lib/config/constants"
);

const HOUR_MS = 3_600_000;
const HOST = "blog.example.com";

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * HOUR_MS).toISOString();
}

function seed(destination: Row): void {
  db.seed("sites", [{ id: "site-1", user_id: "user-1", domain: "example.com", publishing_enabled: true }]);
  db.seed("destinations", [
    {
      id: "dest-1",
      site_id: "site-1",
      kind: "hosted",
      config: null,
      health: "expired",
      health_reason: "dns_unset",
      health_changed_at: hoursAgo(48),
      broken_mail_sent_at: null,
      last_checked_at: hoursAgo(DESTINATION_HOSTNAME_RECHECK_H + 1),
      created_at: hoursAgo(48),
      deleted_at: null,
      publish_capable: null,
      hostname: HOST,
      hostname_state: "pending_dns",
      hostname_checked_at: hoursAgo(DESTINATION_HOSTNAME_RECHECK_H + 1),
      ...destination,
    },
  ]);
}

function row(): Row {
  return db.rows("destinations").find((r) => r.id === "dest-1")!;
}

beforeEach(() => {
  db.reset();
  vendor.verified = true;
  vendor.hosts.length = 0;
  setBillingStore(memoryBillingStore(newMemoryBilling()));
  setLifecycleStore(memoryLifecycleStore(newMemoryLifecycle()));
});

describe("issue #791 — account/maintenance refreshes hosted health", () => {
  it("a waiting host the domain list now verifies becomes live and healthy on the tick, and its pages can publish", async () => {
    seed({});
    expect(await destinationWorking("site-1")).toBe(false);

    const outcome = await accountMaintenance.run({ data: {}, now: new Date() });

    expect(outcome).toEqual({ outcome: "ran", subjectId: null });
    expect(vendor.hosts).toEqual([HOST]);
    expect(row()).toMatchObject({ hostname_state: "live", health: "ok", health_reason: null });
    expect(await destinationWorking("site-1")).toBe(true);
  });

  it("a host still unverified is checked, stays waiting, and does not publish", async () => {
    seed({});
    vendor.verified = false;

    await accountMaintenance.run({ data: {}, now: new Date() });

    expect(vendor.hosts).toEqual([HOST]);
    expect(row()).toMatchObject({ hostname_state: "pending_dns", health: "expired", health_reason: "dns_unset" });
    expect(await destinationWorking("site-1")).toBe(false);
  });

  it("inside its window a destination is not checked: a waiting one for the recheck hour, a healthy one for the freshness day", async () => {
    seed({ last_checked_at: hoursAgo(DESTINATION_HOSTNAME_RECHECK_H / 2) });
    db.seed("destinations", [
      row(),
      {
        ...row(),
        id: "dest-2",
        site_id: "site-2",
        hostname: "news.example.org",
        health: "ok",
        health_reason: null,
        hostname_state: "live",
        last_checked_at: hoursAgo(DESTINATION_HEALTH_MAX_AGE_H - 1),
      },
    ]);

    const outcome = await accountMaintenance.run({ data: {}, now: new Date() });

    expect(outcome).toEqual({ outcome: "skipped", subjectId: null, reason: "no-subject" });
    expect(vendor.hosts).toEqual([]);
  });

  it("a disconnected destination is not refreshed", async () => {
    seed({ deleted_at: hoursAgo(2) });
    await accountMaintenance.run({ data: {}, now: new Date() });
    expect(vendor.hosts).toEqual([]);
  });
});
