// tests/app/setup/rivals-spend.test.ts — issue 798
//
// Setup's one paid call, through the code that ships: the real
// `POST /api/setup/rivals`, the real onboarding claim and the real cost
// seam. `rivals.test.ts` doubles the seam to see which row a context opens
// on; this file keeps it, so what the call cost is seen on the row it was
// spent against — the deep pass's, which carries it into the pass's own
// total — and the kill switch is seen refusing the call before it is made.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { fakeDb, type FakeDb } from "../../scan/deep/fake-db";
import { resetSetupSession, sessionFactory, setupSession, storeFactory } from "./session-door";
import type { CostContext } from "@/lib/costs";

applyEnvFixture();

let db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/account/identity", () => sessionFactory());
vi.mock("@/app/(account)/setup/_setup/store", async (importOriginal) =>
  storeFactory(await importOriginal<Record<string, unknown>>())
);
vi.mock("@/lib/site-profile", () => ({ readSiteProfile: async () => null }));

const AT = new Date("2026-09-16T09:00:00.000Z");
const COMPETITORS_C = 1.5;

/** The vendor endpoint, spending through the context it is handed the way
 *  the real wrapper does — a reservation, a ledgered row — and answering
 *  without reaching the network. */
const { competitorsDomain } = vi.hoisted(() => ({ competitorsDomain: vi.fn() }));
vi.mock("@/lib/vendors/dataforseo", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  competitorsDomain: (...a: unknown[]) => competitorsDomain(...a),
}));

let calls = 0;
async function spendingVendor(c: CostContext) {
  const fetched = await c.recordFetch({
    source: "dataforseo_labs/google/competitors_domain",
    cacheKey: `competitors-${++calls}`,
    freshnessDays: 30,
    costCents: COMPETITORS_C,
    run: async () => [{ domain: "rival-one.com", overlapKeywords: 3 }],
  });
  if ("skipped" in fetched) return { kind: "unmeasured", reason: "undeterminable", at: AT };
  return { kind: "measured", value: fetched.payload, at: AT };
}

async function candidates(body: unknown): Promise<unknown> {
  const { POST } = await import("@/app/api/setup/rivals/route");
  const response = await POST(
    new Request("https://reachkit.example/api/setup/rivals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    undefined
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { candidates: unknown }).candidates;
}

beforeEach(() => {
  resetSetupSession();
  calls = 0;
  competitorsDomain.mockReset();
  competitorsDomain.mockImplementation(spendingVendor);
  setupSession.address = { siteId: "site-1", domain: "" };
  db = fakeDb({
    sites: [{ id: "site-1", user_id: "user-1", domain: null, created_at: AT.toISOString(), setup_completed_at: null }],
    scans: [],
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("a stated market's rival suggestion is counted on the row it was spent against", () => {
  it("the claimed deep row carries what each call cost, and stays running for the pass", async () => {
    await expect(candidates({ domain: "founder.io", category: "bookkeeping for dentists" })).resolves.toEqual([
      "rival-one.com",
    ]);
    const row = db.tables.scans![0]!;
    expect(db.tables.fetches).toHaveLength(1);
    expect(db.tables.fetches![0]).toMatchObject({ scan_id: row.id, cost_cents: COMPETITORS_C });
    expect(row).toMatchObject({ tier: "deep", status: "running", cost_cents: COMPETITORS_C });

    // A second market stated is a second call, added to the first.
    await candidates({ domain: "founder.io", category: "bookkeeping for vets" });
    expect(db.tables.scans).toHaveLength(1);
    expect(db.tables.scans![0]).toMatchObject({ status: "running", cost_cents: 2 * COMPETITORS_C });
  });
});

describe("the kill switch stops setup's paid call", () => {
  it("nothing is bought, nothing is ledgered, and the card settles on none found", async () => {
    vi.stubEnv("KILL_SWITCH", "true");
    vi.resetModules();

    await expect(candidates({ domain: "founder.io", category: "bookkeeping for dentists" })).resolves.toEqual([]);
    expect(competitorsDomain).not.toHaveBeenCalled();
    expect(db.tables.fetches ?? []).toEqual([]);
  });
});
