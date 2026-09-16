// tests/app/setup/rivals.test.ts — issue 750
//
// Setup offers rivals on both ways in, through the code that ships: the
// real `POST /api/setup/rivals`, the real screen read, the real
// `suggestRivals` and the real onboarding claim. What is doubled sits
// below them — the session, the stored report, the rows, the one vendor
// endpoint and the cost seam's ledger — so a hard-coded answer anywhere in
// the path fails here.
//
// This file exists because the card sat on "Looking for rivals…" with every
// suite green: `screen.test.tsx` draws the fixture's suggestions, and
// nothing drew the provider's.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { fakeDb, type FakeDb } from "../../scan/deep/fake-db";
import { reportFactory, resetSetupSession, sessionFactory, setupSession, storeFactory } from "./session-door";
import type { CostContext } from "@/lib/costs";

applyEnvFixture();

let db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/account/identity", () => sessionFactory());
vi.mock("@/app/(account)/setup/_setup/store", async (importOriginal) =>
  storeFactory(await importOriginal<Record<string, unknown>>())
);
vi.mock("@/lib/scan/report", async (importOriginal) =>
  reportFactory(await importOriginal<Record<string, unknown>>())
);
vi.mock("@/lib/site-profile", () => ({ readSiteProfile: async () => null }));

const { competitorsDomain, opened } = vi.hoisted(() => ({
  competitorsDomain: vi.fn(),
  opened: [] as { scanId: string; cap: string; rollUp?: string }[],
}));

vi.mock("@/lib/vendors/dataforseo", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  competitorsDomain: (...a: unknown[]) => competitorsDomain(...a),
}));

/** The cost seam, recording which row and cap each context was opened
 *  against. The ledger's own rules are `tests/costs/**`'s. */
vi.mock("@/lib/costs", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withCostContext: async (
    ctx: { scanId: string; cap: string; rollUp?: string },
    body: (c: CostContext) => Promise<unknown>
  ) => {
    opened.push(ctx);
    return body({ cap: ctx.cap } as CostContext);
  },
}));

const { POST } = await import("@/app/api/setup/rivals/route");
const { readSetupScreen } = await import("@/app/(account)/setup/_setup/provider");
const { TIMING } = await import("@/lib/config/constants");

const AT = new Date("2026-09-16T09:00:00.000Z");

function rows(domains: readonly string[]) {
  const value = domains.map((domain) => ({ domain, overlapKeywords: 3 }));
  return domains.length === 0 ? { kind: "zero", value, at: AT } : { kind: "measured", value, at: AT };
}

function ask(body: unknown): Promise<Response> {
  return POST(
    new Request("https://reachkit.example/api/setup/rivals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    undefined
  );
}

async function candidates(body: unknown): Promise<unknown> {
  const response = await ask(body);
  expect(response.status).toBe(200);
  return ((await response.json()) as { candidates: unknown }).candidates;
}

/** A direct purchase: a site row with no address yet and no report. */
function directPurchase(): void {
  setupSession.address = { siteId: "site-1", domain: "" };
  db = fakeDb({
    sites: [{ id: "site-1", user_id: "user-1", domain: null, created_at: AT.toISOString(), setup_completed_at: null }],
    scans: [],
  });
}

beforeEach(() => {
  resetSetupSession();
  competitorsDomain.mockReset();
  opened.length = 0;
  db = fakeDb({
    sites: [
      { id: "site-1", user_id: "user-1", domain: "example.com", created_at: AT.toISOString(), setup_completed_at: null },
    ],
    scans: [],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("direct purchase — the founder states the market, and competitors_domain answers", () => {
  beforeEach(directPurchase);

  it("offers the vendor's rivals, never the founder's own address, spent against the claimed deep row", async () => {
    competitorsDomain.mockResolvedValue(rows(["rival-one.com", "founder.io", "www.rival-two.com"]));

    await expect(candidates({ domain: "founder.io", category: "bookkeeping for dentists" })).resolves.toEqual([
      "rival-one.com",
      "rival-two.com",
    ]);

    expect(db.tables.scans).toHaveLength(1);
    const row = db.tables.scans![0]!;
    expect(row).toMatchObject({ tier: "deep", status: "running", site_id: "site-1", domain: "founder.io" });
    expect(opened).toEqual([{ scanId: row.id, cap: "DEEP", policyVersion: 1, rollUp: "none" }]);
    expect(competitorsDomain).toHaveBeenCalledWith(expect.anything(), { domain: "founder.io" });
  });

  it("giving the address claims the row before any market exists, and seeks nothing (REQ-026 c10)", async () => {
    await expect(candidates({ domain: "founder.io", category: null })).resolves.toBeNull();
    expect(db.tables.scans).toHaveLength(1);
    expect(competitorsDomain).not.toHaveBeenCalled();
    expect(opened).toEqual([]);
  });

  it("stating the market after the address spends against the same row — a site has one", async () => {
    competitorsDomain.mockResolvedValue(rows(["rival-one.com"]));
    await candidates({ domain: "founder.io", category: null });
    await candidates({ domain: "founder.io", category: "bookkeeping for dentists" });
    await candidates({ domain: "renamed.io", category: "bookkeeping for dentists" });

    expect(db.tables.scans).toHaveLength(1);
    expect(db.tables.scans![0]).toMatchObject({ domain: "renamed.io", status: "running" });
    expect(new Set(opened.map((ctx) => ctx.scanId))).toEqual(new Set([db.tables.scans![0]!.id]));
  });

  it("a vendor that answers none settles the card as none found", async () => {
    competitorsDomain.mockResolvedValue(rows([]));
    await expect(candidates({ domain: "founder.io", category: "bookkeeping" })).resolves.toEqual([]);
  });

  it("a vendor that fails settles the card as none found, never seeking", async () => {
    competitorsDomain.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: AT });
    await expect(candidates({ domain: "founder.io", category: "bookkeeping" })).resolves.toEqual([]);
  });

  it("a vendor still running at the ceiling is abandoned and the card settles", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    competitorsDomain.mockReturnValue(new Promise(() => {}));
    const pending = candidates({ domain: "founder.io", category: "bookkeeping" });
    // The claim is real async work; the ceiling starts with the call.
    await vi.waitFor(() => expect(competitorsDomain).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(TIMING.suggestCeilingS * 1000);
    await expect(pending).resolves.toEqual([]);
  });

  it("a row that cannot be claimed spends nothing and settles the card", async () => {
    const client = db.client;
    db.client = {
      ...client,
      from: (table: string) => {
        if (table === "scans") throw new Error("scans unreachable");
        return client.from(table);
      },
    };
    await expect(candidates({ domain: "founder.io", category: "bookkeeping" })).resolves.toEqual([]);
    expect(competitorsDomain).not.toHaveBeenCalled();
  });
});

describe("free upgrade — the market is inferred from the report, and its rivals cost nothing", () => {
  it("the screen opens with the report's rivals offered, and buys and claims nothing", async () => {
    const model = await readSetupScreen();
    expect(model.state.market.state).toBe("inferred");
    expect(model.state.suggestions).toEqual({
      state: "offered",
      candidates: ["asana.com", "monday.com", "clickup.com"],
    });
    expect(competitorsDomain).not.toHaveBeenCalled();
    expect(opened).toEqual([]);
    expect(db.tables.scans).toEqual([]);
  });

  it("changing to another measured address offers that report's rivals, read on the server", async () => {
    setupSession.reports.set("other.com", { scanId: "scan-2", category: "time tracking", rivals: ["toggl.com"] });
    await expect(candidates({ domain: "other.com", category: null })).resolves.toEqual(["toggl.com"]);
    expect(competitorsDomain).not.toHaveBeenCalled();
    expect(opened).toEqual([]);
  });
});

describe("an account set up on an older version — every missing fact is a written state", () => {
  it("a report that named no rivals opens on none found, not seeking", async () => {
    setupSession.reports.set("example.com", { scanId: "scan-1", category: "agency CRM", rivals: [] });
    const model = await readSetupScreen();
    expect(model.state.suggestions.state).toBe("none_found");
  });

  it("an address with no report opens waiting on the market", async () => {
    setupSession.reports.clear();
    const model = await readSetupScreen();
    expect(model.state.suggestions.state).toBe("awaiting_market");
  });

  it("a report with no market opens waiting on the market", async () => {
    setupSession.reports.set("example.com", { scanId: "scan-1", category: null, rivals: ["asana.com"] });
    const model = await readSetupScreen();
    expect(model.state.suggestions.state).toBe("awaiting_market");
  });

  it("no site at all opens waiting, and seeking for it settles none found without a claim", async () => {
    setupSession.address = null;
    db = fakeDb({ sites: [], scans: [] });
    expect((await readSetupScreen()).state.suggestions.state).toBe("awaiting_market");
    await expect(candidates({ domain: "founder.io", category: "bookkeeping" })).resolves.toEqual([]);
    expect(db.tables.scans).toEqual([]);
  });

  it("a finished setup claims and spends nothing — its pass already ran", async () => {
    db.tables.sites![0]!.setup_completed_at = AT.toISOString();
    await expect(candidates({ domain: "example.com", category: "bookkeeping" })).resolves.toEqual([]);
    expect(db.tables.scans).toEqual([]);
    expect(competitorsDomain).not.toHaveBeenCalled();
  });
});

describe("the adapter", () => {
  it("no session is refused with a status and no sentence", async () => {
    setupSession.session = null;
    const response = await ask({ domain: "founder.io", category: null });
    expect(response.status).toBe(401);
  });

  it("a body without an address is malformed", async () => {
    expect((await ask({ category: "x" })).status).toBe(400);
    expect((await ask({ domain: "founder.io", category: 7 })).status).toBe(400);
  });
});
