// Two `scan/rescore` ticks at one planner fingerprint re-commit a paying site's week once, and the second records nothing.
import "../opportunities/env";
import { afterEach, expect, it, vi } from "vitest";
import { fakeDb } from "../publish/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { replanSites } = await import("@/lib/scan/replan");
const { planWeek } = await import("@/lib/opportunities/plan");
const { setOpportunityStore } = await import("@/lib/opportunities/store");
const { memoryStore, newMemoryState } = await import("../opportunities/memory-store");
const { AT, panelSite, SITE_ID, storedSerps } = await import("../golden/plan/panel");

afterEach(() => {
  setOpportunityStore(null);
  vi.unstubAllEnvs();
});

it("re-commits the week once per fingerprint", async () => {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("RK_PLANNER", "fp-1");
  const site = panelSite("savvycal.com");
  const state = newMemoryState({ profile: site.profile, market: site.market, now: AT, rows: site.rows, weeklyCommit: "2026-10-19" });
  const store = memoryStore(state);
  let commits = 0;
  setOpportunityStore({ ...store, topTenRows: async () => storedSerps(site.domain), commitPlan: (id, entries) => (commits++, store.commitPlan(id, entries)) });
  await planWeek(SITE_ID, { now: AT });
  commits = 0;
  const paying = async () => [{ siteId: SITE_ID, timeZone: "UTC", publishTime: "09:00", vetoHours: 24 }];

  expect(await replanSites(paying, { now: AT })).toEqual({ replanned: [SITE_ID], held: [] });
  expect(await replanSites(paying, { now: AT })).toBeNull();
  expect(commits).toBe(1);
  expect(db.rows("ops_events").map((row) => [row.kind, row.site_id, row.code, row.read])).toEqual([["week_replanned", SITE_ID, "fp-1", "2026-10-20"]]);
});
