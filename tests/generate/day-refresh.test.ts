// tests/generate/day-refresh.test.ts — SPEC §7 (owner, 2026-11-05 and 2026-11-08): a day whose own page and spare end
// without one, for any `generate:*` reason, takes the writer's update of the site's own live page longest past the
// refresh floor, committed or not, from stored research, inside the day's one CAP_DRAFT. One synthetic customer of each
// kind, in the database double; the model is faked and ledgers what it would cost through the real cost seam, and
// every vendor is reached through fetch.
import "./env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAPS } from "@/lib/config/constants";
import { measured } from "@/lib/measure/measured";
import type { CostContext } from "@/lib/costs";
import { fakeDb, installSiteSpendRpc, type Row } from "../publish/harness";
import { AT, fakeCost, opportunity, pack, pageParts, prose } from "./fixtures";
import { LOCAL_WORDPRESS, SAAS_HOSTED, measuredText, seedWorld, type LiveSite } from "./live-edit-world";

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
import stored from "./fixtures/dogfood-days-2026-11.json";
import ecf4f99d from "./fixtures/q4-ecf4f99d-2026-11.json";
import f0f95686d from "./fixtures/q4-0f95686d-2026-11.json";

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
  // The page is ours: the row it was written for is on file.
  db.seed("opportunities", [...db.rows("opportunities"), { ...(insertFor(opportunity({ siteId: live.siteId })) as unknown as Row), id: row(written).opportunity_id, status: "done" }]);
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

const day = (live: LiveSite, trigger = "generate:no_opportunity", from: "select" | "write" = "select", more: { stopped?: string; now?: Date } = {}) =>
  refreshForDay({ siteId: live.siteId, publishDate: D, trigger, from, stopped: more.stopped ?? null, ...(more.now === undefined ? {} : { now: more.now }) });
const onDate = () => db.rows("drafts").filter((each) => each.scheduled_for === D);
const theirs = () => db.rows("drafts").filter((each) => each.opportunity_id === WRITE_ID);
const ledger = () => db.rows("fetches") as { source: string; cost_cents: number }[];
/** A search this small site can win: a refresh planned of its page is ready under today's report. */
const SMALL = JSON.parse(JSON.stringify(measured(40, AT))) as unknown;
/** The scan is the site's current one, which readiness reads a newly planned row against, and these rows were written
 *  for a search of this `volume`. */
function current(volumes: Record<string, unknown>) {
  Object.assign(db.rows("scans")[0]!, { is_current: true });
  for (const [id, volume] of Object.entries(volumes)) {
    const each = db.rows("opportunities").find((o) => o.id === id)!;
    Object.assign(each, { volume: 40, evidence: { ...(each.evidence as object), volume } });
  }
}

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
    ["generate:time", "write"],
    ["generate:vendor_funds", "write"],
    ["generate:step_failed:write", "write"],
    ["generate:no_own_facts:pack:facts_on_topic", "write"],
    ["generate:rules", "select"],
    ["generate:step_failed:pack", "select"],
  ])("a %s day from %s takes the same update, marked with what it stands in for, and nothing else", async (trigger, from) => {
    await world(SAAS_HOSTED);
    const taken = await day(SAAS_HOSTED, trigger, from);
    expect(taken).toEqual({ ok: true, draftId: expect.any(String) });
    expect(onDate().map((each) => each.id)).toEqual([taken?.ok ? taken.draftId : ""]);
    expect(row(taken?.ok ? taken.draftId : "")).toMatchObject({ opportunity_id: WRITE_ID, hard_rules_passed: true, meta: { fallbackFor: trigger, research: "stored" } });
    expect(network).not.toHaveBeenCalled();
  });

  it("the row the rules stopped gives up its date to the update, which takes it: one draft on the date", async () => {
    await world(SAAS_HOSTED);
    db.seed("drafts", [...db.rows("drafts"), { ...row(written), id: "d-stopped", state: "needs_attention", scheduled_for: D, hard_rules_passed: false }]);
    const taken = await day(SAAS_HOSTED, "generate:rules", "write", { stopped: "d-stopped" });
    expect(taken?.ok).toBe(true);
    expect(row("d-stopped")).toMatchObject({ state: "needs_attention", scheduled_for: null });
    expect(onDate().map((each) => each.id)).toEqual([taken?.ok ? taken.draftId : ""]);
  });

  it("the update is paid from what the day has left: the day's spend so far counts, and the whole day stays under CAP_DRAFT", async () => {
    await world(SAAS_HOSTED);
    const now = new Date(Date.now() - 60_000);
    // The day's own topic and spare already spent most of the cap before they stopped.
    const before = 10;
    db.seed("fetches", [{ id: "f-day", site_id: SAAS_HOSTED.siteId, activity: "draft", source: "dataforseo/serp", cost_cents: before, created_at: new Date(now.getTime() + 1_000).toISOString() }]);
    const taken = await day(SAAS_HOSTED, "generate:rules", "write", { now });
    const spent = ledger().reduce((sum, each) => sum + each.cost_cents, 0);
    expect(spent).toBeGreaterThan(before);
    expect(spent).toBeLessThanOrEqual(CAPS.DRAFT_C);
    expect(onDate().length).toBeLessThanOrEqual(1);
    expect(taken === null || taken.ok).toBe(true);
  });

  it("a day whose cap has no room left for a write and its fix asks no writer, and keeps the date's stopped row", async () => {
    await world(SAAS_HOSTED);
    const now = new Date(Date.now() - 60_000);
    db.seed("fetches", [{ id: "f-day", site_id: SAAS_HOSTED.siteId, activity: "draft", source: "anthropic/generate.write", cost_cents: CAPS.DRAFT_C - 1, created_at: new Date(now.getTime() + 1_000).toISOString() }]);
    db.seed("drafts", [...db.rows("drafts"), { ...row(written), id: "d-stopped", state: "needs_attention", scheduled_for: D, hard_rules_passed: false }]);
    expect(await day(SAAS_HOSTED, "generate:budget", "write", { stopped: "d-stopped", now })).toBeNull();
    expect([llm.mock.calls.length, theirs().length]).toEqual([0, 0]);
    expect(row("d-stopped").scheduled_for).toBe(D);
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

  it("the page longest past its floor is the one updated, whether or not the week committed it", async () => {
    // Two pages past the floor, 60 days and since 2026-09-12; nothing committed, and neither has a row yet.
    const { url } = await world(SAAS_HOSTED, { days: 60 });
    db.seed("opportunities", db.rows("opportunities").filter((each) => each.id !== WRITE_ID));
    current({ [row(written).opportunity_id as string]: SMALL, "o-write": SMALL });
    const taken = await day(SAAS_HOSTED, "generate:rules", "write");
    expect(taken).toEqual({ ok: true, draftId: expect.any(String) });
    const planned = db.rows("opportunities").find((each) => each.id === row(taken?.ok ? taken.draftId : "").opportunity_id)!;
    expect(planned).toMatchObject({ type: "refresh_page", target_ref: url, status: "queued" });
    expect(planned.planned_for ?? null).toBeNull();
    expect(onDate()).toHaveLength(1);
  });

  it.each([SAAS_HOSTED, LOCAL_WORDPRESS])("for $kind, nothing is invented: with no own live page past the refresh floor the day names it, and no writer is asked", async (live) => {
    await world(live, { days: 10 });
    Object.assign(db.rows("publications").find((each) => each.id === "p-live")!, { published_at: new Date(Date.now() - 20 * DAY_MS).toISOString() });
    expect(await day(live)).toEqual({ ok: false, because: "no_update_candidate" });
    expect(await day(live, "generate:rules", "write")).toEqual({ ok: false, because: "no_update_candidate" });
    db.seed("publications", []);
    expect(await day(live, "generate:no_own_facts:pack:facts_on_topic", "write")).toEqual({ ok: false, because: "no_update_candidate" });
    expect([llm.mock.calls.length, theirs().length, ledger().length]).toEqual([0, 0, 0]);
  });
});

type StoredDay = (typeof stored.days)[number];
const STOPS = [ecf4f99d, f0f95686d];
const age = (ms: number) => `${Math.floor(ms / DAY_MS)} d ${Math.floor((ms % DAY_MS) / 3_600_000)} h`;

/** A stored day replayed on the SaaS customer: the site's live pages as they stood at `tick`, the day's stopped rows
 *  (the last written holds the date), and what the day had spent; then the update fallback, as the engine calls it. */
async function replayDay(at: StoredDay, tick: Date, heading: string): Promise<string> {
  await world(SAAS_HOSTED);
  const origin = new URL(SAAS_HOSTED.liveUrl).origin;
  const pages = stored.pages.filter((page) => Date.parse(page.publishedAt) <= tick.getTime());
  const down = (page: { unpublishedAt?: string }) => (page.unpublishedAt !== undefined && Date.parse(page.unpublishedAt) <= tick.getTime() ? page.unpublishedAt : null);
  // Nothing of these pages is committed: the week's slot and spares were used, and no refresh is planned.
  db.seed("opportunities", [...db.rows("opportunities").filter((each) => each.id !== WRITE_ID), ...pages.map((page, n) => ({ ...(insertFor(opportunity({ siteId: SAAS_HOSTED.siteId, targetQuery: page.path.replaceAll("-", " "), targetRef: page.path })) as unknown as Row), id: `o-${n}`, status: "done" }))]);
  current(Object.fromEntries(pages.map((_, n) => [`o-${n}`, SMALL])));
  const stops = at.stopped.map((id, n) => ({ ...row(written), id, title: STOPS.find((each) => each.id === id)!.title, rule_failures: STOPS.find((each) => each.id === id)!.rule_failures, state: "needs_attention", hard_rules_passed: false, scheduled_for: n === at.stopped.length - 1 ? at.date : null }));
  db.seed("drafts", [...db.rows("drafts"), ...pages.map((page, n) => ({ ...row(written), id: `d-${n}`, opportunity_id: `o-${n}`, state: "published", scheduled_for: page.publishedAt.slice(0, 10) })), ...stops]);
  db.seed("publications", pages.map((page, n) => ({ id: `p-${n}`, draft_id: `d-${n}`, site_id: SAAS_HOSTED.siteId, destination: "hosted", delivery_state: "delivered", attempt_no: 1, live_url: `${origin}/${page.path}`, published_at: page.publishedAt, unpublished_at: down(page), mode: "autopilot", made_live_by_us: true })));
  db.seed("fetches", at.spentCents === 0 ? [] : [{ id: "f-day", site_id: SAAS_HOSTED.siteId, activity: "draft", source: "dataforseo/serp", cost_cents: at.spentCents, created_at: new Date(tick.getTime() + 1_000).toISOString() }]);

  const live = pages.filter((page) => down(page) === null).map((page) => ({ path: page.path, old: tick.getTime() - Date.parse(page.publishedAt) })).sort((x, y) => y.old - x.old);
  const due = live.filter((page) => page.old >= 30 * DAY_MS);
  const outcome = await refreshForDay({ siteId: SAAS_HOSTED.siteId, publishDate: at.date, trigger: at.trigger, from: at.from as "select" | "write", stopped: at.stopped.at(-1) ?? null, now: tick });
  const lines = [`## ${heading}`, "", `- ${at.trigger} from ${at.from}, ${at.spentCents}¢ already spent, ${at.stopped.length} stopped row(s)`];
  lines.push(due.length === 0 ? `- Own live pages past the 30-day floor: none; the oldest, ${live[0]!.path}, was ${age(live[0]!.old)} old` : `- Own live pages past the 30-day floor, oldest first: ${due.map((page) => `${page.path} (${age(page.old)})`).join(", ")}`);
  if (outcome === null || !outcome.ok) return [...lines, `- Ends: ${outcome === null ? "no page" : outcome.because}`, ""].join("\n");
  const page = row(outcome.draftId);
  const target = db.rows("opportunities").find((each) => each.id === page.opportunity_id)!.target_ref as string;
  const spent = ledger().reduce((sum, each) => sum + Number(each.cost_cents), 0);
  return [
    ...lines,
    `- Ends: the update of ${new URL(target).pathname.slice(1)} for ${page.scheduled_for}, rules passed: ${page.hard_rules_passed}, research ${(page.meta as { research?: string }).research}, standing in for ${(page.meta as { fallbackFor?: string }).fallbackFor}`,
    `- The day: ${onDateOf(at.date).length} draft on its date, ${Math.round(spent * 100) / 100}¢ of CAP_DRAFT ${CAPS.DRAFT_C}, ${network.mock.calls.length} vendor reads`,
    "",
  ].join("\n");
}
const onDateOf = (date: string) => db.rows("drafts").filter((each) => each.scheduled_for === date && each.state !== "published");

describe("the stored days that shipped nothing (2026-11-04, 2026-11-05, 2026-11-08), replayed at 0¢", () => {
  it("each takes the update of the site's oldest page past the floor where one was, and names the day where none was", async () => {
    const [nov4, nov5, nov8] = stored.days as [StoredDay, StoredDay, StoredDay];
    const out = [
      "# The update fallback over reachkit.app's stored days",
      "",
      "Generated by tests/generate/day-refresh.test.ts from tests/generate/fixtures/dogfood-days-2026-11.json. The writer is faked at 2¢ a call; nothing is bought.",
      "",
      await replayDay(nov4, new Date(nov4.tick), `2026-11-04 at its tick, ${nov4.tick}`),
      await replayDay(nov4, new Date(Date.parse(nov4.tick) + DAY_MS), "2026-11-04's stops, one tick later"),
      await replayDay(nov5, new Date(nov5.tick), `2026-11-05 at its tick, ${nov5.tick}`),
      await replayDay(nov8, new Date(nov8.tick), `2026-11-08 at its tick, ${nov8.tick}`),
    ];
    await expect(out.join("\n")).toMatchFileSnapshot("../golden/day-fallback/2026-11.md");
  });

  it.each([1, 2])("stored day %i ends with one passing update on its date, under CAP_DRAFT, with no vendor read", async (index) => {
    const at = stored.days[index] as StoredDay;
    const text = await replayDay(at, new Date(at.tick), at.date);
    expect(text).toContain("rules passed: true");
    expect(onDateOf(at.date)).toHaveLength(1);
    expect(ledger().reduce((sum, each) => sum + Number(each.cost_cents), 0)).toBeLessThanOrEqual(CAPS.DRAFT_C);
    expect(network).not.toHaveBeenCalled();
  });

  it("2026-11-04's topic and spare, stopped by the rules, give the date to the update once a page is past the floor", async () => {
    const at = stored.days[0] as StoredDay;
    expect(await replayDay(at, new Date(at.tick), at.date)).toContain("Ends: no_update_candidate");
    const text = await replayDay(at, new Date(Date.parse(at.tick) + DAY_MS), at.date);
    expect(text).toContain("rules passed: true");
    expect(onDateOf(at.date)).toHaveLength(1);
    expect(row(at.stopped.at(-1)!).scheduled_for).toBeNull();
  });
});
