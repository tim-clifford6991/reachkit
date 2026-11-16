// After a planner deploy the `scan/rescore` tick holds every site's re-planned week for the owner's OK: it mails the
// owner the committed week as stored (a hand-set one included) and the new one, commits nothing until the OK row,
// alerts once after 48 h, and once approved commits each site once however many ticks run.
import "../opportunities/env";
import { beforeEach, expect, it, vi } from "vitest";
import { fakeDb } from "../publish/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { OWNER_OK, replanSites } = await import("@/lib/scan/replan");
const { planWeek } = await import("@/lib/opportunities/plan");
const { opportunityStore, setOpportunityStore } = await import("@/lib/opportunities/store");
const { __setVendorTransportForTesting } = await import("@/lib/mail/vendor/resend");
const { memoryStore, newMemoryState } = await import("../opportunities/memory-store");
const { AT, panelSite, SITE_ID, storedSerps } = await import("../golden/plan/panel");

const HOUR = 3_600_000;
const paying = async () => [{ siteId: SITE_ID, timeZone: "UTC", publishTime: "09:00", vetoHours: 24 }];
let mails: string[] = [];
let commits = 0;

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
  setOpportunityStore({ ...store, topTenRows: async () => storedSerps(site.domain), commitPlan: (id, entries) => (commits++, store.commitPlan(id, entries)) });
  await planWeek(SITE_ID, { now: AT });
  // The owner's hand-set day: a spare moved onto 20 Oct, with no reason the planner gave.
  const spare = state.rows.find((row) => row.plan_place != null && row.planned_for == null)!;
  Object.assign(state.rows.find((row) => row.planned_for === "2026-10-20")!, { plan_place: null, planned_for: null });
  Object.assign(spare, { planned_for: "2026-10-20", plan_reason: null });
  [mails, commits] = [[], 0];
  return () => {
    setOpportunityStore(null);
    __setVendorTransportForTesting(null);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  };
});

const tick = (hours: number) => replanSites(paying, { now: new Date(AT.getTime() + hours * HOUR) });
const events = (kind: string) => db.rows("ops_events").filter((row) => row.kind === kind);

it("holds the week for the owner's OK, mails the committed week as stored, and alerts once after 48 h", async () => {
  expect(await tick(0)).toEqual({ replanned: [], held: [], waiting: [SITE_ID] });
  for (const row of db.rows("ops_events")) row.at = AT.toISOString();
  expect(await tick(1)).toEqual({ replanned: [], held: [], waiting: [SITE_ID] });
  expect([commits, mails.length, events("week_replanned").length]).toEqual([0, 1, 1]);
  const handSet = (await opportunityStore().plannedRows(SITE_ID)).find((row) => row.planned_for === "2026-10-20")!;
  expect(mails[0]).toContain(`2026-10-20 · ${handSet.target_query}`);

  await tick(48);
  await tick(49);
  expect([commits, mails.length]).toEqual([0, 2]);
});

it("commits each site once after the OK, however many ticks run", async () => {
  await tick(0);
  db.rows("ops_events").push({ id: "ok", kind: OWNER_OK, read: "owner", code: "0fa1", site_id: null });
  expect(await tick(1)).toEqual({ replanned: [SITE_ID], held: [], waiting: [] });
  expect(await tick(2)).toBeNull();
  expect([commits, events("week_replan_applied").length]).toEqual([1, 1]);
});
