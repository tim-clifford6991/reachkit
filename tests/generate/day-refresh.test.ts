// tests/generate/day-refresh.test.ts — SPEC §7 (owner, 2026-11-05; #2388 Tier B): a day whose select found no topic
// has spent nothing, so the writer refreshes one ready update of the committed week from stored research, inside the
// day's one CAP_DRAFT context. One synthetic customer of each kind, in the database double; the model is faked and
// ledgers what it would cost through the real cost seam, and every vendor is reached through fetch.
import "./env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAPS } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { fakeDb, installSiteSpendRpc, type Row } from "../publish/harness";
import { AT, fakeCost, opportunity, pack, pageParts, prose } from "./fixtures";
import { LIVE_DRAFT, LOCAL_WORDPRESS, SAAS_HOSTED, measuredText, seedWorld, type LiveSite } from "./live-edit-world";

const db = fakeDb();
const { site, llm } = vi.hoisted(() => ({ site: { current: null as LiveSite | null }, llm: vi.fn() }));
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/llm", () => ({ llm }));
vi.mock("@/lib/measure/text", () => ({ readMeasuredText: async () => (site.current === null ? [] : measuredText(site.current)) }));
vi.mock("next/cache", () => ({ revalidateTag: () => undefined, revalidatePath: () => undefined }));

import { refreshForDay } from "@/lib/generate";
import { generateDraft } from "@/lib/generate/pipeline";
import { siteRulesOf } from "@/lib/generate/pipeline/battery";
import { readAllFacts } from "@/lib/generate/pipeline/grounding";
import { generateStore, setGenerateStore } from "@/lib/generate/store";
import { insertFor } from "@/lib/opportunities/derive/persist";

const D = "2026-10-02";
const WRITE_ID = "88888888-8888-4888-8888-888888888888";
const SECOND_ID = "66666666-6666-4666-8666-666666666666";
const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE = () => pageParts(`${prose("seats", 300, 4)}\n\nTeams on the starter plan get 25 seats and unlimited projects for a flat monthly fee, per [the pricing page](${site.current!.sourceUrl}).`);
/** The update's page: the live page's sections under its own headings, rewritten where a new fact changes them. */
const PASSING = (over: Partial<ReturnType<typeof pageParts>> = {}) => {
  const parts = { ...pageParts(`${prose("budget", 300, 4)}\n\nTeams on the starter plan get 25 seats and unlimited projects for a flat monthly fee, per [the pricing page](${site.current!.sourceUrl}).`, {}, "budget"), titles: LIVE().titles };
  return { ...parts, sections: parts.sections.map((section) => ({ ...section, key: "live" })), faq: ["first", "second", "third"].map((nth) => ({ question: `What is the ${nth} thing to ask?`, answer: "Count the seats." })), ...over };
};
const row = (id: string): Row => db.rows("drafts").find((each) => each.id === id)!;
const statusOf = (id: string): unknown => db.rows("opportunities").find((each) => each.id === id)?.status;
let network: ReturnType<typeof vi.spyOn>;
let written: string;

/** The fake writer: each call ledgers 2¢ through the context it was given, as the model's own call would. */
function writer(answer: () => unknown = PASSING) {
  llm.mockReset().mockImplementation(async (cost: CostContext, call: { site: string }) => {
    const paid = await cost.recordFetch({ source: `anthropic/${call.site}`, cacheKey: `${call.site}:${llm.mock.calls.length}`, freshnessDays: 0, costCents: 2, run: async () => ({}) });
    if ("skipped" in paid) throw new Error("cap");
    return { kind: "measured", value: answer(), at: AT };
  });
}

/** A page the pipeline wrote and published at `url`, `days` ago, and one ready update of it committed as the week's
 *  spare. `cause` is why it is due: `structure` is one code mends. */
async function world(live: LiveSite, { days = 60, cause = "stale" }: { days?: number; cause?: string } = {}) {
  site.current = live;
  seedWorld(db, live);
  installSiteSpendRpc(db);
  db.seed("fetches", []);
  setGenerateStore(null);
  llm.mockReset().mockResolvedValue({ kind: "measured", value: LIVE(), at: AT });
  const store = generateStore();
  const facts = await readAllFacts({ siteId: live.siteId, scanId: "scan-1" });
  const made = await generateDraft(fakeCost(), { site: siteRulesOf((await store.siteFacts(live.siteId))!, (await store.latestReport(live.siteId))!), facts, opportunity: opportunity({ siteId: live.siteId }), siteId: live.siteId, scheduledFor: "2026-09-20", pack: pack(), links: [] });
  written = made.draftId!;
  const url = live.liveUrl.replace("onboarding-checklist", "which-tool-small-team");
  Object.assign(row(written), { state: "published" });
  const at = new Date(Date.now() - days * DAY_MS).toISOString();
  db.seed("publications", [...db.rows("publications"), { id: "p-written", draft_id: written, site_id: live.siteId, destination: live.destination, delivery_state: "delivered", attempt_no: 1, live_url: url, published_at: at, unpublished_at: null, mode: "autopilot", made_live_by_us: true }]);
  for (const each of db.rows("opportunities")) each.status = "done";
  const due = cause === "structure" ? { kind: "due", cause, defects: ["h1"] } : { kind: "due", cause };
  const refresh = opportunity({ id: WRITE_ID, siteId: live.siteId, type: "refresh_page", family: "improve", title: row(written).title as string, targetQuery: "which plan fits a small team", targetRef: url, evidence: { family: "improve", query: "which plan fits a small team", pageUrl: url, shortfall: due } } as never);
  db.seed("opportunities", [...db.rows("opportunities"), { ...(insertFor(refresh) as unknown as Row), id: WRITE_ID, status: "open", created_at: AT.toISOString(), plan_place: 9, planned_for: null, ready: true }]);
  writer();
  network = vi.spyOn(globalThis, "fetch");
  return { url };
}

const day = (live: LiveSite, trigger = "generate:no_opportunity", from: "select" | "write" = "select") =>
  refreshForDay({ siteId: live.siteId, publishDate: D, trigger, from, stopped: null });
const onDate = () => db.rows("drafts").filter((each) => each.scheduled_for === D);
const theirs = () => db.rows("drafts").filter((each) => each.opportunity_id === WRITE_ID);
const ledger = () => db.rows("fetches") as { source: string; cost_cents: number }[];

beforeEach(() => vi.spyOn(console, "log").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("a day that spent nothing takes a writer-made update from stored research, inside its one cap (Tier B)", () => {
  it.each([SAAS_HOSTED, LOCAL_WORDPRESS])("for $kind, a passing update is today's page, marked stored, costing what it spent, with no vendor read", async (live) => {
    await world(live);
    const taken = await day(live);
    expect(taken).toEqual({ ok: true, draftId: expect.any(String) });
    const page = row(taken?.ok ? taken.draftId : "");
    expect(onDate().map((each) => each.id)).toEqual([page.id]);
    expect(page).toMatchObject({ opportunity_id: WRITE_ID, state: "generating", hard_rules_passed: true, meta: { fallbackFor: "generate:no_opportunity", research: "stored" } });
    expect(statusOf(WRITE_ID)).toBe("queued");
    // One context, the draft's, whose ledger is every call it made: all the model's, none a vendor's, under the cap.
    const contexts = new Set(llm.mock.calls.map(([cost]) => cost as CostContext));
    expect([...contexts].map((cost) => cost.cap)).toEqual(["DRAFT"]);
    expect(ledger().length).toBe(llm.mock.calls.length);
    expect(ledger().every((each) => each.source.startsWith("anthropic/"))).toBe(true);
    const spent = ledger().reduce((sum, each) => sum + each.cost_cents, 0);
    expect(spent).toBeGreaterThan(0);
    expect(spent).toBeLessThanOrEqual(CAPS.DRAFT_C);
    expect(page.cost_cents).toBe(spent);
    expect(network).not.toHaveBeenCalled();
  });

  it.each([SAAS_HOSTED, LOCAL_WORDPRESS])("for $kind, an update the battery stops is not today's page: it rests with its cost and gives up the date", async (live) => {
    await world(live);
    // The writer's page has lost the short answer a page must open on, before and after its fix.
    writer(() => PASSING({ answer: "It depends." }));
    expect(await day(live)).toBeNull();
    const [stopped] = theirs();
    expect(stopped).toMatchObject({ hard_rules_passed: false, state: "needs_attention", scheduled_for: null, meta: { fallbackFor: "generate:no_opportunity", research: "stored" } });
    expect(stopped?.cost_cents).toBe(ledger().reduce((sum, each) => sum + each.cost_cents, 0));
    expect(onDate()).toEqual([]);
    expect(network).not.toHaveBeenCalled();
  });

  it.each<[string, "select" | "write"]>([
    ["generate:no_opportunity", "write"],
    ["generate:rules", "write"],
    ["generate:budget", "write"],
    ["generate:time", "write"],
    ["generate:vendor_funds", "write"],
    ["generate:step_failed:write", "write"],
    ["generate:rules", "select"],
    ["generate:step_failed:pack", "select"],
  ])("a %s day from %s has spent, or may have: the writer is never asked", async (trigger, from) => {
    await world(SAAS_HOSTED);
    expect(await day(SAAS_HOSTED, trigger, from)).toBeNull();
    expect([llm.mock.calls.length, theirs().length, ledger().length]).toEqual([0, 0, 0]);
  });

  it("a code-mendable update is taken at 0¢ first, and the writer is never asked", async () => {
    await world(SAAS_HOSTED, { cause: "structure" });
    row(written).body_md = `# ${row(written).title as string}\n\n${row(written).body_md as string}`;
    const taken = await day(SAAS_HOSTED);
    expect(taken?.ok).toBe(true);
    expect(row(taken?.ok ? taken.draftId : "")).toMatchObject({ cost_cents: 0, meta: { mendOf: written } });
    expect([llm.mock.calls.length, ledger().length]).toEqual([0, 0]);
  });

  it("one candidate, one page: a stopped update is not followed by the week's next, and its fix is the pipeline's one", async () => {
    const { url } = await world(SAAS_HOSTED);
    const second = opportunity({ id: SECOND_ID, siteId: SAAS_HOSTED.siteId, type: "refresh_page", family: "improve", title: row(written).title as string, targetQuery: "which plan fits a small team", targetRef: url, evidence: { family: "improve", query: "which plan fits a small team", pageUrl: url, shortfall: { kind: "due", cause: "stale" } } } as never);
    db.seed("opportunities", [...db.rows("opportunities"), { ...(insertFor(second) as unknown as Row), id: SECOND_ID, status: "open", created_at: AT.toISOString(), plan_place: 10, planned_for: null, ready: true }]);
    writer(() => PASSING({ answer: "It depends." }));
    expect(await day(SAAS_HOSTED)).toBeNull();
    const tried = db.rows("drafts").filter((each) => each.opportunity_id === WRITE_ID || each.opportunity_id === SECOND_ID);
    expect(tried).toHaveLength(1);
    expect(llm.mock.calls.map(([, call]) => (call as { site: string }).site)).toEqual(["generate.write", "generate.fix"]);
    expect([statusOf(WRITE_ID), statusOf(SECOND_ID)].sort()).toEqual(["open", "open"]);
  });

  it.each([SAAS_HOSTED, LOCAL_WORDPRESS])("for $kind, nothing is invented: no own live page past the refresh floor, no writer", async (live) => {
    await world(live, { days: 10 });
    expect(await day(live)).toBeNull();
    db.seed("publications", db.rows("publications").filter((each) => each.draft_id !== written && each.draft_id !== LIVE_DRAFT));
    expect(await day(live)).toBeNull();
    expect([llm.mock.calls.length, theirs().length, ledger().length]).toEqual([0, 0, 0]);
  });
});
