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
import { openDayCost } from "@/lib/generate/cost";
import { generateDraft } from "@/lib/generate/pipeline";
import { siteRulesOf } from "@/lib/generate/pipeline/battery";
import { readAllFacts } from "@/lib/generate/pipeline/grounding";
import { generateStore, setGenerateStore } from "@/lib/generate/store";
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

beforeEach(() => vi.spyOn(console, "log").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("a replayed day's page spends at most CAP_DRAFT for its date in total", () => {
  it.each<[string, (w: Awaited<ReturnType<typeof world>>) => unknown, () => Promise<unknown>]>([
    ["its topic", (w) => pick.mockResolvedValueOnce(w.update), attempt],
    ["a select that found nothing (Tier B)", () => undefined, fallback],
    ["a short pack (own facts)", (w) => pick.mockResolvedValueOnce(w.fresh), attempt],
  ])("for %s: attempt 2 opens at what attempt 1 ledgered and refuses a call past the cap", async (_entry, arrange, run) => {
    const w = await world();
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
    expect(network).not.toHaveBeenCalled();
  });

  it("an unreadable ledger is never 0: no paid call, and the day keeps its reason", async () => {
    await world();
    model(() => 1);
    ledgerDown.on = true;
    expect(await fallback()).toBeNull();
    expect([ledger().length, db.rows("drafts").filter((row) => row.scheduled_for === D).length]).toEqual([0, 0]);
  });

  it("an unreadable ledger still lets the 0¢ mend take the day", async () => {
    await world("structure");
    model(() => 1);
    ledgerDown.on = true;
    const taken = await fallback();
    expect(taken?.ok).toBe(true);
    expect([llm.mock.calls.length, ledger().length]).toEqual([0, 0]);
  });
});
