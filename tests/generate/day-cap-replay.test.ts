// tests/generate/day-cap-replay.test.ts — BUILD §8 "CAP_DRAFT enforced before the pipeline runs" is per day's page:
// an attempt the job platform replays after a throw opens the day's one context at what the site's drafts already
// ledgered since the run's due hour, never at 0, and an unreadable ledger leaves it nothing to spend. One synthetic
// customer in the database double; the model is faked and ledgers through the real cost seam; no vendor is reached.
import "./env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAPS } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { unmeasured } from "@/lib/measure/measured";
import { fakeDb, type Row } from "../publish/harness";
import { AT, fakeCost, opportunity, pack, pageParts, prose } from "./fixtures";
import { SAAS_HOSTED, measuredText, seedWorld } from "./live-edit-world";

const db = fakeDb();
const { llm, pick, ledgerDown } = vi.hoisted(() => ({ llm: vi.fn(), pick: vi.fn(), ledgerDown: { on: false } }));
/** The client, but the day's read of its drafts' spend answers an error, as an unreachable ledger does. */
const client = () => {
  const real = db.client as { from: (table: string) => Record<string, unknown> & { select: (columns: string) => unknown } };
  if (!ledgerDown.on) return real;
  const failing: Record<string, unknown> = { then: (done: (value: unknown) => unknown) => Promise.resolve({ data: null, error: { message: "down" } }).then(done) };
  for (const op of ["eq", "gte"]) failing[op] = () => failing;
  return { ...real, from: (table: string) => { const query = real.from(table); return table === "fetches" ? { ...query, select: (columns: string) => (columns === "cost_cents" ? failing : query.select(columns)) } : query; } };
};
vi.mock("@/lib/db", () => ({ dbAdmin: () => client(), db: () => client() }));
vi.mock("@/lib/llm", () => ({ llm }));
vi.mock("@/lib/measure/text", () => ({ readMeasuredText: async () => measuredText(SAAS_HOSTED) }));
vi.mock("@/lib/opportunities", async (original) => ({ ...(await original<object>()), pageForDay: (...args: unknown[]) => pick(...args) }));
vi.mock("@/lib/generate/pipeline/research", async (original) => ({ ...(await original<object>()), researchMarket: async () => (await original<{ NO_RESEARCH: unknown }>()).NO_RESEARCH }));
vi.mock("next/cache", () => ({ revalidateTag: () => undefined, revalidatePath: () => undefined }));

import { generateDayPage, refreshForDay } from "@/lib/generate";
import { askDayResearch } from "@/lib/generate/research-queue";
import { openDayCost } from "@/lib/generate/cost";
import { generateDraft } from "@/lib/generate/pipeline";
import { siteRulesOf } from "@/lib/generate/pipeline/battery";
import { readAllFacts } from "@/lib/generate/pipeline/grounding";
import { generateStore, setGenerateStore } from "@/lib/generate/store";
import { missingFrom } from "@/lib/generate/standard";
import { insertFor } from "@/lib/opportunities/derive/persist";

const SITE = SAAS_HOSTED.siteId;
const D = "2026-10-02";
const HOUR = new Date(Date.now() - 60_000);
const UPDATE_ID = "88888888-8888-4888-8888-888888888888";
const NEW_ID = "44444444-4444-4444-8444-444444444444";
const DAY_MS = 24 * 60 * 60 * 1000;
const FACT = `Teams on the starter plan get 25 seats and unlimited projects for a flat monthly fee, per [the pricing page](${SAAS_HOSTED.sourceUrl}).`;
/** An update's page: the live page's sections under its own headings, rewritten where a new fact changes them. */
const PAGE = () => {
  const parts = { ...pageParts(`${prose("budget", 300, 4)}\n\n${FACT}`, {}, "budget"), titles: pageParts(`${prose("seats", 300, 4)}\n\n${FACT}`).titles };
  return { ...parts, sections: parts.sections.map((section) => ({ ...section, key: "live" })), faq: ["first", "second", "third"].map((nth) => ({ question: `What is the ${nth} thing to ask?`, answer: "Count the seats." })) };
};
const ledger = () => db.rows("fetches") as { cost_cents: number }[];
const spent = () => ledger().reduce((sum, row) => sum + Number(row.cost_cents), 0);
let network: ReturnType<typeof vi.spyOn>;

/** The fake model: each call ledgers `price()` cents through the context it was given, as the model's own call does. */
function model(price: () => number) {
  llm.mockReset().mockImplementation(async (cost: CostContext, call: { site: string }) => {
    const paid = await cost.recordFetch({ source: `anthropic/${call.site}`, cacheKey: `${call.site}:${llm.mock.calls.length}:${Math.random()}`, freshnessDays: 0, costCents: price(), run: async () => ({}) });
    if ("skipped" in paid) return unmeasured("not_attempted", AT);
    return { kind: "measured", value: PAGE(), at: AT };
  });
}

/** The site's rows of the ledger, as the database fills them on insert: the scan's site, at the time it was written. */
const stamp = () => ledger().forEach((row: Row) => Object.assign(row, { site_id: row.site_id ?? SITE, created_at: row.created_at ?? new Date().toISOString() }));

/** A page of ours live for 60 days and its ready update committed for a later date; `structure` is one code mends. */
async function world(cause = "stale") {
  seedWorld(db, SAAS_HOSTED);
  db.seed("fetches", []);
  setGenerateStore(null);
  ledgerDown.on = false;
  llm.mockReset().mockResolvedValue({ kind: "measured", value: pageParts(`${prose("seats", 300, 4)}\n\n${FACT}`), at: AT });
  const store = generateStore();
  const facts = await readAllFacts({ siteId: SITE, scanId: "scan-1" });
  const made = await generateDraft(fakeCost(), { site: siteRulesOf((await store.siteFacts(SITE))!, (await store.latestReport(SITE))!), facts, opportunity: opportunity({ siteId: SITE }), siteId: SITE, scheduledFor: "2026-09-20", pack: pack(), links: [] });
  const written = db.rows("drafts").find((row) => row.id === made.draftId)!;
  if (cause === "structure") written.body_md = `# ${written.title as string}\n\n${written.body_md as string}`;
  const url = SAAS_HOSTED.liveUrl.replace("onboarding-checklist", "which-tool-small-team");
  Object.assign(written, { state: "published" });
  db.seed("publications", [...db.rows("publications"), { id: "p-written", draft_id: written.id, site_id: SITE, destination: SAAS_HOSTED.destination, delivery_state: "delivered", attempt_no: 1, live_url: url, published_at: new Date(Date.now() - 60 * DAY_MS).toISOString(), unpublished_at: null, mode: "autopilot", made_live_by_us: true }]);
  // The page is ours: the row it was written for is on file.
  db.seed("opportunities", [...db.rows("opportunities"), { ...(insertFor(opportunity({ siteId: SITE })) as unknown as Row), id: written.opportunity_id }]);
  for (const each of db.rows("opportunities")) each.status = "done";
  const due = cause === "structure" ? { kind: "due", cause, defects: ["h1"] } : { kind: "due", cause };
  const refresh = (id: string, place: number) => {
    const row = opportunity({ id, siteId: SITE, type: "refresh_page", family: "improve", title: written.title as string, targetQuery: "which plan fits a small team", targetRef: url, evidence: { family: "improve", query: "which plan fits a small team", pageUrl: url, shortfall: due } } as never);
    db.seed("opportunities", [...db.rows("opportunities"), { ...(insertFor(row) as unknown as Row), id, status: "open", created_at: AT.toISOString(), plan_place: place, planned_for: "2026-10-05", ready: true }]);
    return row;
  };
  const fresh = opportunity({ id: NEW_ID, siteId: SITE, type: "comparison_page", targetQuery: "acme vs rival for small teams", targetRef: "acme-vs-rival", title: "Acme vs Rival", absorbedQueries: [] });
  db.seed("opportunities", [...db.rows("opportunities"), { ...(insertFor(fresh) as unknown as Row), id: NEW_ID, status: "open", created_at: AT.toISOString() }]);
  pick.mockReset().mockResolvedValue(null);
  network = vi.spyOn(globalThis, "fetch");
  return { update: refresh(UPDATE_ID, 3), fresh };
}

/** The store, but the first page it is asked to save throws a plain error, as a lost connection does. */
function throwOnFirstSave() {
  const real = generateStore();
  let thrown = false;
  setGenerateStore({ ...real, insertDraft: async (draft) => (thrown ? real.insertDraft(draft) : ((thrown = true), Promise.reject(new Error("connection reset")))) });
}

const attempt = () => generateDayPage({ siteId: SITE, publishDate: D, now: HOUR });
/** The due hour's update fallback for a day whose select found no topic. */
const fallback = () => refreshForDay({ siteId: SITE, publishDate: D, trigger: "generate:no_opportunity", from: "select", stopped: null, now: HOUR });
/** The vendor's standard queue: a post is queued, and a later read of its task answers once `ready`. */
const queue = (ready: () => boolean) => async (url: unknown) => {
  const task = (status: number, result: unknown = null) => ({ ok: true, status: 200, json: async () => ({ tasks: [{ id: String(url).endsWith("task_post") ? `t${Math.random()}` : String(url).split("/").at(-1), status_code: status, result }] }) });
  return (String(url).endsWith("task_post") ? task(20100) : ready() ? task(20000, [{ items: [{ type: "organic", rank_group: 1, domain: "rival.com", url: "https://rival.com/" }] }]) : task(40602)) as never;
};
/** The research step's asks, which post and then read the update candidate's one SERP, so the fallback reads the cache. */
async function asked(): Promise<void> {
  let ready = false;
  network.mockImplementation(queue(() => ready));
  await askDayResearch({ siteId: SITE, opportunityId: NEW_ID, now: HOUR, waitMs: 30 });
  ready = true;
  await askDayResearch({ siteId: SITE, opportunityId: NEW_ID, now: HOUR, waitMs: 30 });
  stamp();
  network.mockClear();
}

beforeEach(() => vi.spyOn(console, "log").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("a replayed day's page spends at most CAP_DRAFT for its date in total", () => {
  it.each<[string, (w: Awaited<ReturnType<typeof world>>) => unknown, () => Promise<unknown>]>([
    ["its topic", (w) => pick.mockResolvedValueOnce(w.update), attempt],
    ["a select that found nothing (Tier B), its update read from the cache", () => undefined, fallback],
  ])("for %s: attempt 2 opens at what attempt 1 ledgered and refuses a call past the cap", async (_entry, arrange, run) => {
    const w = await world();
    if (run === fallback) await asked();
    let first = true;
    model(() => (first ? ((first = false), 30) : 1));
    arrange(w);
    throwOnFirstSave();
    await expect(run()).rejects.toThrow("connection reset");
    expect(spent()).toBeGreaterThanOrEqual(30);
    stamp();
    const before = spent();
    // It opens at what attempt 1 ledgered, and a 20¢ call that would carry the date past the cap is refused.
    const twenty = (cost: CostContext) => cost.recordFetch({ source: "anthropic/probe", cacheKey: `probe:${Math.random()}`, freshnessDays: 0, costCents: 20, run: async () => ({}) });
    expect(await openDayCost({ scanId: "scan-1", siteId: SITE, since: HOUR }, async (cost) => [cost.spentCents(), await twenty(cost)])).toEqual([before, { skipped: "cap" }]);
    // A due hour of its own opens at 0: a clean first attempt is unchanged.
    expect(await openDayCost({ scanId: "scan-1", siteId: SITE, since: new Date(Date.now() + 60_000) }, async (cost) => cost.spentCents())).toBe(0);
    model(() => 20);
    arrange(w);
    await run();
    stamp();
    expect(spent()).toBe(before);
    expect(spent()).toBeLessThanOrEqual(CAPS.DRAFT_C);
    // No paid post: the update's one SERP is the research step's, read free from its task.
    expect(network.mock.calls.filter(([url]: unknown[]) => String(url).endsWith("task_post"))).toEqual([]);
  });

  it("a replayed research ask reads the task its first ask posted (free `task_get`) and ledgers no second paid row", async () => {
    await world();
    let ready = false;
    network.mockImplementation(queue(() => ready));
    const ask = () => askDayResearch({ siteId: SITE, opportunityId: NEW_ID, now: HOUR, waitMs: 30 });
    expect(await ask()).toBe(2);
    stamp();
    const [rows, paid, posts] = [ledger().length, spent(), network.mock.calls.length];
    const reposts = () => network.mock.calls.slice(posts).filter(([url]: unknown[]) => String(url).endsWith("task_post")).length;
    // The next tick, past the queue's 45-minute deadline: the task is still read, never posted again.
    const clock = Date.now.bind(Date);
    vi.spyOn(Date, "now").mockImplementation(() => clock() + 46 * 60_000);
    expect(await ask()).toBe(2);
    expect([ledger().length, spent(), reposts()]).toEqual([rows, paid, 0]);
    ready = true;
    expect(await ask()).toBe(0);
    expect([ledger().length, spent(), reposts()]).toEqual([rows, paid, 0]);
    expect(ledger().every((row) => Array.isArray((row as Row).payload))).toBe(true);
  });

  it("an unreadable ledger is never 0: no paid call, and the day keeps its reason", async () => {
    await world();
    model(() => 1);
    ledgerDown.on = true;
    expect(await fallback()).toMatchObject({ ok: false, why: "update:cap;last:no_topic" });
    expect([ledger().length, db.rows("drafts").filter((row) => row.scheduled_for === D).length]).toEqual([0, 0]);
  });

  it("a page whose retarget rests still takes its own aged update for the day", async () => {
    await world();
    await asked();
    model(() => 1);
    Object.assign(db.rows("opportunities").find((row) => row.id === UPDATE_ID)!, { rest_until: new Date(Date.now() + 7 * DAY_MS).toISOString(), ready: false, unready_reason: "resting" });
    await fallback();
    const aged = db.rows("opportunities").find((row) => row.type === "refresh_page" && (row.evidence as { shortfall: { cause: string } }).shortfall.cause === "aged");
    expect(db.rows("drafts").some((row) => row.opportunity_id === aged?.id)).toBe(true);
  });
});
it("a planned refresh with no title packs its address's live text, so live_page and new_fact hold (reached production)", async () => {
  const w = await world();
  model(() => 1);
  pick.mockResolvedValueOnce({ ...w.update, title: null });
  await attempt();
  const live = db.rows("drafts").find((row) => row.id === db.rows("publications").find((row) => row.id === "p-written")!.draft_id)!;
  const pack = (db.rows("drafts").find((row) => row.opportunity_id === UPDATE_ID)!.meta as { pack: Parameters<typeof missingFrom>[0] }).pack;
  expect([pack.live?.markdown, missingFrom(pack).filter((need) => need === "live_page" || need === "new_fact")]).toEqual([live.body_md, []]);
});
it("a day whose own committed update is under the floor writes it as its last step, never an empty one (reached production)", async () => {
  await world().then(() => Object.assign(db.rows("publications").find((row) => row.id === "p-written")!, { published_at: new Date(Date.now() - 10 * DAY_MS).toISOString() }));
  db.rows("opportunities").forEach((row) => Object.assign(row, row.id === UPDATE_ID ? { planned_for: D } : row.id === NEW_ID ? { status: "done" } : {}));
  expect([await fallback(), db.rows("drafts").find((row) => row.scheduled_for === D)?.opportunity_id]).toMatchObject([{ ok: true }, UPDATE_ID]);
});
it("a day decided again counts its spend from its own run, and the same date not decided again stays refused", async () => {
  const w = await world();
  model(() => 9);
  db.seed("fetches", [{ site_id: SITE, activity: "draft", cost_cents: 40, created_at: HOUR.toISOString() }]);
  pick.mockResolvedValue(w.update);
  expect([(await attempt()).ok, (await generateDayPage({ siteId: SITE, publishDate: D, now: HOUR, since: new Date(HOUR.getTime() + 1) })).ok]).toEqual([false, true]);
});
