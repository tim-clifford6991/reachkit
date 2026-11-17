// After a planner deploy the `scan/rescore` tick re-commits a paying site's week once however many ticks run, and mails
// the owner once the committed week as stored (a hand-set one included) beside the new one.
import "../opportunities/env";
import { beforeEach, expect, it, vi } from "vitest";
import { fakeDb } from "../publish/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { replanSites } = await import("@/lib/scan/replan");
const { planWeek } = await import("@/lib/opportunities/plan");
const { opportunityStore, setOpportunityStore } = await import("@/lib/opportunities/store");
const { __setVendorTransportForTesting } = await import("@/lib/mail/vendor/resend");
const { memoryStore, newMemoryState } = await import("../opportunities/memory-store");
const { AT, panelSite, SITE_ID, storedSerps } = await import("../golden/plan/panel");

const HOUR = 3_600_000;
const paying = async () => [{ siteId: SITE_ID, timeZone: "UTC", publishTime: "09:00", vetoHours: 24 }];
let mails: string[] = [];
let [commits, cut] = [0, 0];

beforeEach(async () => {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("RK_PLANNER", "0fa1");
  vi.spyOn(console, "log").mockImplementation(() => {});
  __setVendorTransportForTesting(async (payload) => (mails.push(JSON.stringify(payload)), { status: 200, headers: {}, body: '{"id":"m"}' }));
  db.reset();
  db.seed("sites", [{ id: SITE_ID, domain: "savvycal.com" }]);
  const site = panelSite("savvycal.com");
  const state = newMemoryState({ profile: site.profile, market: site.market, now: AT, rows: site.rows, weeklyCommit: "2026-10-19" });
  const store = memoryStore(state);
  setOpportunityStore({ ...store, footprintOpened: async () => true, topTenRows: async () => storedSerps(site.domain), commitPlan: (id, entries) => (cut-- === 1 ? Promise.reject(new Error("cut")) : (commits++, store.commitPlan(id, entries))) });
  await planWeek(SITE_ID, { now: AT });
  // The owner's hand-set day: a spare moved onto 20 Oct, with no reason the planner gave.
  const spare = state.rows.find((row) => row.plan_place != null && row.planned_for == null)!;
  Object.assign(state.rows.find((row) => row.planned_for === "2026-10-20")!, { plan_place: null, planned_for: null });
  Object.assign(spare, { planned_for: "2026-10-20", plan_reason: null });
  [mails, commits, cut] = [[], 0, 1];
  return () => {
    setOpportunityStore(null);
    __setVendorTransportForTesting(null);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  };
});

// As Inngest runs it without checkpointing: each new step is memoized, then the body runs again from the top.
const replay = <T>(body: (step: <S>(name: string, run: () => Promise<S>) => Promise<S>) => Promise<T>, memo = new Map<string, unknown>()): Promise<T> => body(async <S,>(name: string, run: () => Promise<S>) => (memo.has(name) ? (memo.get(name) as S) : Promise.reject(memo.set(name, await run())))).catch((e: unknown) => (e === memo ? replay(body, memo) : Promise.reject(e)));
const tick = (hours: number) => replay((step) => replanSites(paying, { now: new Date(AT.getTime() + hours * HOUR), step }));
const events = (kind: string) => db.rows("ops_events").filter((row) => row.kind === kind);

it("re-commits the week once per planner, after an apply cut short too, and tells the owner once, with the committed week as it stood", async () => {
  const handSet = (await opportunityStore().plannedRows(SITE_ID)).find((row) => row.planned_for === "2026-10-20")!;
  expect(await tick(0).catch(() => tick(1))).toEqual({ replanned: [SITE_ID], held: [] });
  expect(await tick(1)).toBeNull();
  expect([commits, mails.length, events("week_replanned").length, events("week_replan_told").length]).toEqual([1, 1, 1, 1]);
  expect(mails[0]).toContain(`2026-10-20 · ${handSet.target_query}`);
});
