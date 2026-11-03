// tests/costs/ledger-unreadable-alert.test.ts — a spend ledger that cannot be read refuses every paid call, and the
// owner hears about it once per reason and UTC day. Through the real ledger reads, the real boot sink, the real
// `job_error_mails` claim and the real Resend request; only the database client and the vendor transport are doubles.
// No job runtime is installed anywhere here: the request path (free-scan admission) never runs `installHeartbeat`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";

const db = vi.hoisted(() => ({
  claims: new Set<string>(),
  ledgerReadable: false,
  claimTableDown: false,
}));

type Answer = { data: unknown; error: { message: string } | null };

/** A chainable query that answers when awaited; `job_error_mails` checks and inserts in one turn, as its primary key does. */
function query(table: string): unknown {
  const call: { op: string; row: Record<string, unknown>; eq: Record<string, unknown> } = { op: "select", row: {}, eq: {} };
  const answer = (): Answer => {
    if (table !== "job_error_mails") return { data: [], error: null };
    if (db.claimTableDown) return { data: null, error: { message: "stubbed claim failure" } };
    if (call.op === "delete") {
      db.claims.delete(`${String(call.eq.error_name)}|${String(call.eq.day)}`);
      return { data: null, error: null };
    }
    const id = `${String(call.row.error_name)}|${String(call.row.day)}`;
    if (db.claims.has(id)) return { data: [], error: null };
    db.claims.add(id);
    return { data: [{ job_id: call.row.job_id }], error: null };
  };
  const q: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return (resolve: (a: Answer) => unknown, reject: (e: unknown) => unknown) => Promise.resolve().then(answer).then(resolve, reject);
        return (...args: unknown[]) => {
          if (prop === "upsert") Object.assign(call, { op: "upsert", row: args[0] });
          if (prop === "delete") call.op = "delete";
          if (prop === "eq") call.eq[String(args[0])] = args[1];
          return q;
        };
      },
    }
  );
  return q;
}

vi.mock("@/lib/db", () => ({
  dbAdmin: () => ({
    from: (table: string) => query(table),
    rpc: async () => (db.ledgerReadable ? { data: 0, error: null } : { data: null, error: { message: "stubbed read failure" } }),
  }),
}));

applyEnvFixture();

type CanonicalDomain = import("@/lib/scan/domain").CanonicalDomain;

// Fresh modules per case: each is one cold process, so no case inherits another's memory of what it told.
let daily: typeof import("@/lib/costs/daily");
let heartbeat: typeof import("@/jobs/heartbeat");
let admission: typeof import("@/lib/scan/admission");

let mails: string[] = [];
let refuseNext = 0;

function ledgerLines(): { reason: string; outcome: string }[] {
  return vi
    .mocked(console.warn)
    .mock.calls.map(([line]) => JSON.parse(String(line)) as { event: string; reason: string; outcome: string })
    .filter((line) => line.event === "ops_ledger_unreadable");
}

/** The send is started, not awaited, by design; each report ends in exactly one line, so wait for `reads` of them. */
async function settled(reads: number): Promise<void> {
  await vi.waitFor(() => expect(ledgerLines()).toHaveLength(reads), { timeout: 5_000 });
}

/** One cold process: fresh modules, so nothing it remembers of what it told is shared, and its own vendor double. */
async function coldProcess(): Promise<typeof import("@/lib/mail/ops/spend-ceiling")> {
  vi.resetModules();
  daily = await import("@/lib/costs/daily");
  heartbeat = await import("@/jobs/heartbeat");
  admission = await import("@/lib/scan/admission");
  const vendor = await import("@/lib/mail/vendor/resend");
  vendors.push(vendor);
  vendor.__setVendorTransportForTesting(async (payload) => {
    if (refuseNext > 0) {
      refuseNext -= 1;
      return { status: 422, headers: {}, body: "{}" };
    }
    mails.push(payload);
    return { status: 200, headers: {}, body: JSON.stringify({ id: `vendor-${mails.length}` }) };
  });
  const ops = await import("@/lib/mail/ops/spend-ceiling");
  ops.installSpendAlerts();
  return ops;
}

const vendors: (typeof import("@/lib/mail/vendor/resend"))[] = [];

beforeEach(async () => {
  db.claims.clear();
  db.ledgerReadable = false;
  db.claimTableDown = false;
  mails = [];
  refuseNext = 0;
  await coldProcess();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-03T08:00:00Z"));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  daily.registerSpendAlertSink(null);
  daily.registerLedgerUnreadableSink(null);
  for (const vendor of vendors.splice(0)) vendor.__setVendorTransportForTesting(null);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("an unreadable product ledger mails the owner once per UTC day", () => {
  it("3 unreadable reads in one UTC day give 1 mail naming the reason; the next UTC day gives 1 more", async () => {
    // Distinct instants: a process memo keyed by the instant would pass where a day key is needed.
    for (const at of ["2026-11-03T00:05:00Z", "2026-11-03T12:00:00Z", "2026-11-03T23:59:00Z"]) {
      expect(await daily.readDaySpendCents(new Date(at))).toBeNull();
    }
    await settled(3);
    expect(mails).toHaveLength(1);
    expect(mails[0]).toContain("product/read-failed");
    // Not measured is never written as a figure.
    expect(mails[0]).not.toContain("spent today");

    expect(await daily.readDaySpendCents(new Date("2026-11-04T00:01:00Z"))).toBeNull();
    await settled(4);
    expect(mails).toHaveLength(2);
  });

  it("a readable ledger gives 0 mails", async () => {
    db.ledgerReadable = true;
    for (let i = 0; i < 3; i += 1) expect(await daily.readDaySpendCents(new Date())).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(ledgerLines()).toEqual([]);
    expect(mails).toEqual([]);
    expect(db.claims.size).toBe(0);
  });
});

describe("the once-a-day claim is the database's, and needs no job runtime", () => {
  it("two processes racing on an unreadable ledger give 1 mail: the claim decides, not either process's memory", async () => {
    const racers = [await coldProcess(), await coldProcess()];
    let turn = 0;
    daily.registerLedgerUnreadableSink((unreadable) => void racers[turn++ % 2]!.reportLedgerUnreadable(unreadable));
    const at = new Date("2026-11-03T09:00:00Z");
    await Promise.all([daily.readDaySpendCents(at), daily.readDaySpendCents(at)]);
    await settled(2);
    expect(mails).toHaveLength(1);
  });

  it("another process that already claimed today's key leaves this one silent", async () => {
    db.claims.add("product/read-failed|2026-11-03");
    expect(await daily.readDaySpendCents(new Date())).toBeNull();
    await settled(1);
    expect(mails).toEqual([]);
  });

  it("on the request path, with no heartbeat installed, 3 free-scan admissions are refused and give 1 mail", async () => {
    expect(heartbeat.heartbeatInstalled()).toBe(false);
    const network = admission.networkKeyOf(new Headers({ "x-forwarded-for": "203.0.113.10" }));
    for (let i = 0; i < 3; i += 1) {
      expect(await admission.admitFreeScan({ domain: "example.com" as CanonicalDomain, network })).toEqual({ refuse: "unreadable" });
    }
    await settled(3);
    expect(mails).toHaveLength(1);
    expect(db.claims).toEqual(new Set(["product/read-failed|2026-11-03"]));
  });

  it("a claim table that cannot answer either still mails once from this process, never once per read", async () => {
    db.claimTableDown = true;
    for (let i = 0; i < 3; i += 1) expect(await daily.readDaySpendCents(new Date())).toBeNull();
    await settled(3);
    expect(mails).toHaveLength(1);
  });

  it("a mail the vendor refused does not fail the read and does not use up the day", async () => {
    refuseNext = 1;
    expect(await daily.readDaySpendCents(new Date())).toBeNull();
    await settled(1);
    expect(mails).toHaveLength(0);
    expect(db.claims.size).toBe(0);
    expect(await daily.readDaySpendCents(new Date())).toBeNull();
    await settled(2);
    expect(mails).toHaveLength(1);
  });
});

describe("an unreadable site ledger is keyed by reason, not by site", () => {
  it("2 sites unreadable on one day give 1 mail", async () => {
    expect(await daily.readSiteDaySpendCents("11111111-1111-4111-8111-111111111111", new Date())).toBeNull();
    expect(await daily.readSiteDaySpendCents("22222222-2222-4222-8222-222222222222", new Date())).toBeNull();
    await settled(2);
    expect(mails).toHaveLength(1);
    expect(mails[0]).toContain("site/read-failed");
  });
});
