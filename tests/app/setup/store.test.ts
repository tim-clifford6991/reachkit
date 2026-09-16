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
  destination: { kind: "wordpress" as const, connectLater: true as const },
  // SPEC.md §5 (2026-09-12): the voice the founder confirmed or edited.
  // A value the stored profile does not already carry, so these rows
  // exercise the arm that actually writes one.
  voiceText: "Plain and direct, second person. Short sentences.",
  // Issue #783 has its own rows below; the rest submit no zone.
  timezone: null,
};

function site(overrides: Record<string, unknown> = {}) {
  return {
    id: SITE,
    user_id: USER,
    domain: "old.example",
    category: null,
    competitors: [],
    // A row left copilot from before #476: setup records autopilot over it.
    mode: "copilot",
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

describe("commitSetup — the transaction, the three answers, then the stamp", () => {
  it("writes the answers, applies the mode-and-destination pair, and stamps completion", async () => {
    await liveSetupStore().commitSetup({ siteId: SITE, submission: SUBMISSION });

    const row = db.tables.sites![0]!;
    expect(row.domain).toBe("example.com");
    expect(row.category).toBe(SUBMISSION.category);
    expect(row.competitors).toEqual(["asana.com", "monday.com"]);
    expect(row.mode).toBe("autopilot");
    expect(row.setup_completed_at).not.toBeNull();

    expect(db.tables.destinations).toHaveLength(1);
    expect(db.tables.destinations![0]!.kind).toBe("wordpress");
    expect(db.tables.destinations![0]!.config).toBeNull();
  });

  it("a founder who confirms the summary without typing still has the voice stored — unstamped, so a later refresh still reaches it", async () => {
    // SPEC.md §5 (2026-09-12): the voice is shown and editable, and what
    // is stored is what Settings shows and drafting reads. Confirming it
    // unchanged is the ordinary path, and it must still seed
    // `sites.voice_text` — otherwise the founder who typed nothing gets an
    // empty Settings box and a draft prompt with no voice in it.
    const READ_VOICE = "Plain and direct, second person.";
    db = fakeDb({
      sites: [site({ voice_text: null, voice_edited_at: null })],
      destinations: [],
      site_profiles: [
        {
          domain: "example.com",
          site_name: "Example",
          products: [],
          claims: [],
          voice: { text: READ_VOICE, tone: "plain", person: "second" },
          inventory: [],
          pages_read: 4,
          refreshed_at: "2026-09-12T09:00:00.000Z",
        },
      ],
    });

    await liveSetupStore().commitSetup({
      siteId: SITE,
      submission: { ...SUBMISSION, voiceText: READ_VOICE },
    });

    const row = db.tables.sites![0]!;
    expect(row.voice_text).toBe(READ_VOICE);
    // Stored, not claimed: the stamp is what makes a customer's own words
    // survive a refresh, and a confirmation is not an edit.
    expect(row.voice_edited_at ?? null).toBeNull();
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
    // The mode-and-destination transaction (first since issue 608: it is
    // the write the hostname index can refuse), the three answers, the
    // voice (read from the profile first, so an unchanged summary writes
    // nothing — SPEC.md §5, 2026-09-12), and the stamp last. The stamp
    // being last is what this row is for: a crash anywhere above it
    // leaves a founder who is asked again, never one whose choices are
    // half-written.
    expect(order).toEqual([
      "rpc:apply_setup_choice",
      "sites",
      "site_profiles",
      "sites",
      "sites",
    ]);
    expect(order.at(-1)).toBe("sites");
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

  it("issue 737 — a paid founder whose domain has only the free scan's profile (no voice yet) completes, queues the pass, and has no voice invented", async () => {
    db = fakeDb({
      sites: [site({ voice_text: null, voice_edited_at: null })],
      destinations: [],
      site_profiles: [{ domain: "example.com", site_name: "Example", products: [], claims: [], voice: null, inventory: [{ url: "https://example.com/pricing", title: "Pricing", h1: "Pricing", purpose: "pricing" }], pages_read: 9, refreshed_at: "2026-09-12T09:00:00.000Z" }],
    });
    const result = await completeSetup(liveSetupStore(), { userId: USER, submission: { ...SUBMISSION, voiceText: "" } });
    expect(result).toEqual({ ok: true, siteId: SITE });
    expect(queued).toHaveBeenCalledWith("scan/run", expect.objectContaining({ tier: "deep", siteId: SITE }));
    expect(db.tables.sites![0]!.voice_text ?? null).toBeNull();
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

describe("issue #783 — the browser's zone is stored at submit, while the site has none", () => {
  const ZONED = { ...SUBMISSION, timezone: "Europe/Lisbon" };

  it("a site with no zone takes the browser's, before the pass is queued", async () => {
    db = fakeDb({ sites: [site({ timezone: null })], destinations: [] });
    let zoneWhenQueued: unknown = "never queued";
    queued.mockImplementation(() => {
      zoneWhenQueued = db.tables.sites![0]!.timezone;
    });

    const result = await completeSetup(liveSetupStore(), { userId: USER, submission: ZONED });

    expect(result).toEqual({ ok: true, siteId: SITE });
    expect(db.tables.sites![0]!.timezone).toBe("Europe/Lisbon");
    expect(zoneWhenQueued).toBe("Europe/Lisbon");
  });

  it("a zone already set is never overwritten by the browser's", async () => {
    db = fakeDb({ sites: [site({ timezone: "America/Denver" })], destinations: [] });
    await completeSetup(liveSetupStore(), { userId: USER, submission: ZONED });
    expect(db.tables.sites![0]!.timezone).toBe("America/Denver");
  });

  it("a value that is not a zone is not stored, and setup still completes and queues the pass", async () => {
    db = fakeDb({ sites: [site({ timezone: null })], destinations: [] });
    const result = await completeSetup(liveSetupStore(), {
      userId: USER,
      submission: { ...SUBMISSION, timezone: "Mars/Olympus_Mons" },
    });
    expect(result).toEqual({ ok: true, siteId: SITE });
    expect(db.tables.sites![0]!.timezone).toBeNull();
    expect(db.tables.sites![0]!.setup_completed_at).not.toBeNull();
    expect(queued).toHaveBeenCalledTimes(1);
  });
});

describe("a hostname collision at setup is label_taken, and writes no row (issue 608)", () => {
  const HOSTED = {
    ...SUBMISSION,
    destination: { kind: "hosted" as const, label: "blog" },
  };

  it("a host another site holds is refused before any row is written", async () => {
    db = fakeDb({
      sites: [site()],
      destinations: [{ id: "dest-9", site_id: "site-9", hostname: "blog.example.com", deleted_at: null }],
    });
    expect(await completeSetup(liveSetupStore(), { userId: USER, submission: HOSTED })).toEqual({
      ok: false,
      refused: "label_taken",
    });
    expect(db.rpcCalls).toHaveLength(0);
    expect(db.tables.sites![0]!.domain).toBe("old.example");
    expect(db.tables.sites![0]!.setup_completed_at).toBeNull();
  });

  it("a check that could not read is not a free name — the submit stops before writing", async () => {
    const original = db.client.from;
    db.client.from = ((table: string) => {
      if (table !== "destinations") return (original as (t: string) => unknown)(table);
      const failed = { data: null, error: { message: "connection reset" } };
      const chain: Record<string, unknown> = {
        then: (resolve: (v: unknown) => unknown) => resolve(failed),
      };
      for (const m of ["select", "eq", "is", "limit"]) chain[m] = () => chain;
      return chain;
    }) as typeof db.client.from;

    await expect(
      completeSetup(liveSetupStore(), { userId: USER, submission: HOSTED })
    ).rejects.toThrow(/connection reset/);
    expect(db.rpcCalls).toHaveLength(0);
    expect(db.tables.sites![0]!.domain).toBe("old.example");
  });

  it("a host claimed between the check and the commit answers label_taken, with the answers unwritten", async () => {
    // The race the check cannot close: the unique index refuses the
    // transaction, which rolls back, and nothing of this submit landed.
    db.rpc = (async (fn: string, args: Record<string, unknown>) => {
      db.rpcCalls.push({ fn, args });
      return {
        data: null,
        error: {
          message:
            'duplicate key value violates unique constraint "destinations_one_live_hostname"',
        },
      };
    }) as unknown as typeof db.rpc;

    expect(await completeSetup(liveSetupStore(), { userId: USER, submission: HOSTED })).toEqual({
      ok: false,
      refused: "label_taken",
    });
    expect(db.tables.sites![0]!.domain).toBe("old.example");
    expect(db.tables.sites![0]!.setup_completed_at).toBeNull();
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
