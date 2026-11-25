// After a planner deploy the `scan/rescore` tick re-commits a paying site's week once however many ticks run, and tells
// the owner once, as one digest row naming the site.
import "../opportunities/env";
import { beforeEach, expect, it, vi } from "vitest";
import { fakeDb } from "../publish/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { replanSites } = await import("@/lib/scan/replan");
const { planWeek } = await import("@/lib/opportunities/plan");
const { setOpportunityStore } = await import("@/lib/opportunities/store");
const { __setVendorTransportForTesting } = await import("@/lib/mail/vendor/resend");
const { memoryStore, newMemoryState } = await import("../opportunities/memory-store");
const { AT, panelSite, SITE_ID, storedSerps } = await import("../golden/plan/panel");

const HOUR = 3_600_000;
const paying = async () => [{ siteId: SITE_ID, timeZone: "UTC", publishTime: "09:00", vetoHours: 24 }];
let mails: string[] = [];
let [commits, cut] = [0, 0];
let state: ReturnType<typeof newMemoryState>;

beforeEach(async () => {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("RK_PLANNER", "0fa1");
  vi.spyOn(console, "log").mockImplementation(() => {});
  __setVendorTransportForTesting(async (payload) => (mails.push(JSON.stringify(payload)), { status: 200, headers: {}, body: '{"id":"m"}' }));
  db.reset(); cut = 0;
  db.seed("sites", [{ id: SITE_ID, domain: "savvycal.com" }]);
  const site = panelSite("savvycal.com");
  state = newMemoryState({ profile: site.profile, market: site.market, now: AT, rows: site.rows, weeklyCommit: "2026-10-19" });
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
const told = () => db.queries.filter((q) => q.table === "ops_events" && q.verb === "insert" && JSON.stringify(q.values).includes('"read":"replan-committed","code":"savvycal.com"')).length;

it("re-commits the week once per planner, after an apply cut short too, and tells the owner once", async () => {
  expect(await tick(0).catch(() => tick(1))).toEqual({ replanned: [SITE_ID], held: [], empty: [] });
  expect(await tick(1)).toBeNull();
  expect([commits, told(), mails.length, events("week_replanned").length, events("week_replan_told").length]).toEqual([1, 1, 0, 1, 1]);
});

it("keeps every date whose topic still ranks and dates the lost day with a ready row", async () => {
  for (const row of state.rows) Object.assign(row, row.planned_for === "2026-10-21" ? { ready: false, unready_reason: "resting", rest_until: "2027-01-01T00:00:00Z" } : {});
  const dated = () => state.rows.filter((row) => row.planned_for != null && row.planned_for >= "2026-10-20" && row.ready);
  const before = Object.fromEntries(dated().map((row) => [row.planned_for, row.id]));
  expect(await tick(0).catch(() => tick(1))).toEqual({ replanned: [SITE_ID], held: [], empty: [] });
  expect(Object.fromEntries(dated().map((row) => [row.planned_for, row.id]))).toMatchObject({ ...before, "2026-10-21": expect.any(String) });
});

it("tells nothing more at a next planner that leaves the week as committed, and logs it once", async () => {
  await tick(0).catch(() => tick(1)).then(() => vi.stubEnv("RK_PLANNER", "0fa2"));
  expect([await tick(2), told(), vi.mocked(console.log).mock.calls.filter(([line]) => String(line).includes("week_replan_unchanged")).length]).toEqual([{ replanned: [SITE_ID], held: [], empty: [] }, 1, 1]);
});

it("claims a week that dates no day empty, commits nothing, and does not dry-run it again at the same planner", async () => {
  for (const row of state.rows) Object.assign(row, { ready: false, unready_reason: "resting", rest_until: "2027-01-01T00:00:00Z", ...(row.planned_for == null ? {} : { planned_for: "2026-10-01" }) });
  expect(await tick(0)).toEqual({ replanned: [], held: [], empty: [SITE_ID] });
  expect(await tick(1)).toEqual({ replanned: [], held: [], empty: [SITE_ID] });
  const dryRuns = vi.mocked(console.log).mock.calls.filter(([line]) => String(line).includes("week_replan_dry_run")).length;
  expect([commits, dryRuns, events("week_replanned").map((row) => row.read)]).toEqual([0, 1, ["empty"]]);
});

it("keeps the commit's research verdict and write-as on every committed row it re-plans", async () => {
  const research = { state: "met" as const, R: 4, Q: 6, F: 2, estWords: 1200, urls: ["https://a.example/"] };
  const committed = state.rows.filter((row) => row.plan_place != null);
  for (const row of committed) Object.assign(row, { plan_write_as: "listicle", plan_reason: { ...row.plan_reason, research } });
  await tick(0).catch(() => tick(1));
  expect(committed.filter((row) => row.plan_place != null).map((row) => [row.plan_reason?.research?.state, row.plan_write_as])).toEqual(committed.map(() => ["met", "listicle"]));
});
