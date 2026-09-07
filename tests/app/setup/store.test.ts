// tests/app/setup/store.test.ts — BUILD §4.3, issue #36
//
// The implementation behind `SetupStore` that writes rows: the three
// answers, `applySetupChoice()`'s transaction, the completion stamp, and
// the deep pass on the queue. Issue #14 supplied a fixture that recorded
// what it was asked to do; this is what actually does it.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { applyEnvFixture } from "../../mail/env-fixture";
import { fakeDb, type FakeDb } from "../../scan/deep/fake-db";

applyEnvFixture();

let db: FakeDb = fakeDb();
const queued = vi.fn();
const resolved = vi.fn<(host: string) => Promise<boolean>>(async () => true);

vi.mock("@/lib/db", () => ({
  dbAdmin: () => db.client,
  db: () => db.client,
}));

vi.mock("@/jobs/client", () => ({
  sendJobEvent: (event: string, data: unknown) => queued(event, data),
}));

vi.mock("@/lib/egress/dns", () => ({
  resolvesInDns: (host: string) => resolved(host),
}));

/** #133: the store's `hasActiveAccess` port now defaults to the billing
 *  leaf's own gate — ADR-050's `users.paid_through > now()`, keyed by
 *  site. Mocked here so this file keeps testing the setup store rather
 *  than re-testing `tests/account/billing/gate.test.ts`. */
const paid = vi.fn<(siteId: string) => Promise<boolean>>(async () => true);

vi.mock("@/lib/account/billing", () => ({
  hasActiveAccess: (siteId: string) => paid(siteId),
}));

const { liveSetupStore, resetActiveAccessReader, setActiveAccessReader } = await import(
  "../../../src/app/(account)/setup/_setup/store"
);
const { completeSetup } = await import("../../../src/app/(account)/setup/submit");

const USER = "user-1";
const SITE = "site-1";
const CREATED = new Date(Date.UTC(2026, 8, 5, 9, 30, 0));

const SUBMISSION = {
  domain: "example.com",
  category: "project management software for agencies",
  competitors: ["asana.com", "monday.com"],
  mode: "copilot" as const,
  destination: { kind: "wordpress" as const, connectLater: true as const },
};

function site(overrides: Record<string, unknown> = {}) {
  return {
    id: SITE,
    user_id: USER,
    domain: "old.example",
    category: null,
    competitors: [],
    mode: "autopilot",
    created_at: CREATED.toISOString(),
    setup_completed_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  queued.mockReset();
  resolved.mockClear();
  paid.mockClear();
  paid.mockResolvedValue(true);
  db = fakeDb({ sites: [site()], destinations: [] });
  setActiveAccessReader(async () => true);
});

describe("readProgress — the one predicate every account route consults", () => {
  it("an unfinished founder reports incomplete, with the moment their site was provisioned", async () => {
    expect(await liveSetupStore().readProgress(USER)).toEqual({
      complete: false,
      siteId: SITE,
      paidAt: CREATED,
    });
  });

  it("a finished founder reports complete, with when they finished", async () => {
    const done = new Date(Date.UTC(2026, 8, 6, 8, 0, 0));
    db = fakeDb({ sites: [site({ setup_completed_at: done.toISOString() })] });
    expect(await liveSetupStore().readProgress(USER)).toEqual({
      complete: true,
      siteId: SITE,
      completedAt: done,
    });
  });

  it("a user with no site is an error, never a second provisioning path", async () => {
    db = fakeDb({ sites: [] });
    await expect(liveSetupStore().readProgress(USER)).rejects.toThrow(/provisioning has not run/);
  });
});

describe("commitSetup — the three answers, the transaction, then the stamp", () => {
  it("writes the answers, applies the mode-and-destination pair, and stamps completion", async () => {
    await liveSetupStore().commitSetup({ siteId: SITE, submission: SUBMISSION });

    const row = db.tables.sites![0]!;
    expect(row.domain).toBe("example.com");
    expect(row.category).toBe(SUBMISSION.category);
    expect(row.competitors).toEqual(["asana.com", "monday.com"]);
    expect(row.mode).toBe("copilot");
    expect(row.setup_completed_at).not.toBeNull();

    expect(db.tables.destinations).toHaveLength(1);
    expect(db.tables.destinations![0]!.kind).toBe("wordpress");
    expect(db.tables.destinations![0]!.config).toBeNull();
  });

  it("the stamp is written last, so a crash before it leaves a founder who is asked again rather than one whose choices are missing", async () => {
    const order: string[] = [];
    const original = db.client.from;
    db.client.from = ((table: string) => {
      order.push(table);
      return (original as (t: string) => unknown)(table);
    }) as typeof db.client.from;
    const originalRpc = db.rpc;
    db.rpc = ((fn: string, args: Record<string, unknown>) => {
      order.push(`rpc:${fn}`);
      return originalRpc(fn, args);
    }) as typeof db.rpc;

    await liveSetupStore().commitSetup({ siteId: SITE, submission: SUBMISSION });
    expect(order).toEqual(["sites", "rpc:apply_setup_choice", "sites"]);
  });
});

describe("enqueueDeepPass — the pass goes on the queue, at tier deep", () => {
  it("sends one scan/run event carrying the tier as a parameter", async () => {
    await liveSetupStore().enqueueDeepPass(SITE);

    expect(queued).toHaveBeenCalledTimes(1);
    const [event, data] = queued.mock.calls[0]! as [string, Record<string, unknown>];
    expect(event).toBe("scan/run");
    expect(data.tier).toBe("deep");
    expect(data.siteId).toBe(SITE);
    expect(data.domain).toBe("old.example");
  });

  it("the idempotency key is stable for one founder, so a second delivery of their submit starts no second pass", async () => {
    await liveSetupStore().enqueueDeepPass(SITE);
    await liveSetupStore().enqueueDeepPass(SITE);
    const first = queued.mock.calls[0]![1] as Record<string, unknown>;
    const second = queued.mock.calls[1]![1] as Record<string, unknown>;
    expect(first.scanId).toBe(second.scanId);
  });

  it("a site that does not exist is an error, never a pass for nobody", async () => {
    db = fakeDb({ sites: [] });
    await expect(liveSetupStore().enqueueDeepPass(SITE)).rejects.toThrow(/no site/);
    expect(queued).not.toHaveBeenCalled();
  });
});

describe("hasActiveAccess is the billing leaf's gate, asked about this account's own site (#133)", () => {
  it("resolves the site from the account and asks billing about that site, never about the user", async () => {
    resetActiveAccessReader();
    paid.mockResolvedValueOnce(true);
    expect(await liveSetupStore().hasActiveAccess(USER)).toBe(true);
    expect(paid).toHaveBeenCalledWith(SITE);
  });

  it("billing's answer is the store's answer, both ways", async () => {
    resetActiveAccessReader();
    paid.mockResolvedValueOnce(false);
    expect(await liveSetupStore().hasActiveAccess(USER)).toBe(false);
  });

  it("an account provisioning has not given a site is refused, not thrown at", async () => {
    // `completeSetup` asks this first, and "no account here" is exactly
    // what it wants to hear — a throw would be a 500 where a refusal
    // belongs.
    resetActiveAccessReader();
    db = fakeDb({ sites: [] });
    expect(await liveSetupStore().hasActiveAccess(USER)).toBe(false);
    expect(paid).not.toHaveBeenCalled();
  });

  it("so a submit without access is refused for want of it, not silently allowed", async () => {
    resetActiveAccessReader();
    paid.mockResolvedValue(false);
    expect(await completeSetup(liveSetupStore(), { userId: USER, submission: SUBMISSION })).toEqual({
      ok: false,
      refused: "no_active_access",
    });
    expect(db.tables.sites![0]!.setup_completed_at).toBeNull();
    paid.mockResolvedValue(true);
  });
});

describe("the whole submit path, through this store", () => {
  it("a well-formed submission commits and queues the pass, in that order", async () => {
    const result = await completeSetup(liveSetupStore(), {
      userId: USER,
      submission: SUBMISSION,
    });
    expect(result).toEqual({ ok: true, siteId: SITE });
    expect(db.tables.sites![0]!.setup_completed_at).not.toBeNull();
    expect(queued).toHaveBeenCalledTimes(1);
  });

  it("a second submit starts no second pass", async () => {
    await completeSetup(liveSetupStore(), { userId: USER, submission: SUBMISSION });
    queued.mockClear();
    expect(await completeSetup(liveSetupStore(), { userId: USER, submission: SUBMISSION })).toEqual({
      ok: false,
      refused: "already_complete",
    });
    expect(queued).not.toHaveBeenCalled();
  });
});

describe("the provider still hands out the fixture, and says why in one place", () => {
  it("`setupStore()` names the one-line switch and the issue that unblocks it", () => {
    const provider = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/app/(account)/setup/_setup/provider.ts"),
      "utf8"
    );
    expect(provider).toContain("liveSetupStore()");
    expect(provider).toContain("#35");
  });
});
