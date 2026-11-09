// SPEC §7 (owner, 2026-11-05: every customer, every day, new or updated content): a day whose topics come up short
// ends in a page written from the same reads — a spare first, then the topic as a reference page of the site's own
// facts, then an update of one of our live pages — or in a reason the founder is told. Replayed over the day-1 packs
// the panel stored; the model, the research and every fetch are faked, and nothing is bought.
import "../env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseStoredMarket } from "../../../src/lib/market/infer/stored";
import type { Opportunity } from "../../../src/lib/opportunities/types";
import type { StoredReport } from "../../../src/lib/scan/report";
import { AT, fakeCost, memoryStore, opportunity, pageParts, prose, report, type MemoryStore } from "../fixtures";
import stored from "./fixtures/day1-listicles-2026-11-05.json";

const { llm, research, pick, week, restTopic, days } = vi.hoisted(() => ({ llm: vi.fn(), research: vi.fn(), pick: vi.fn(), week: vi.fn(), restTopic: vi.fn(), days: { reason: null as string | null, report: null as unknown } }));
const site = { current: null as null | Site };
vi.mock("@/lib/llm", () => ({ llm }));
// The research the short attempt read is the one the panel stored: the replay's only vendor answer.
vi.mock("@/lib/generate/pipeline/research", async (importOriginal) => ({ ...(await importOriginal<object>()), researchMarket: research }));
vi.mock("@/lib/generate/voice/confirmed", () => ({ confirmedForWriting: async () => ({ profile: site.current?.profile ?? null, factsOff: [] }), refusedPassages: async () => [] }));
// Each page the panel read, as its stored passages.
vi.mock("@/lib/measure/text", () => ({
  readMeasuredText: async () => {
    const pages = new Map<string, { passage: string; readAt: string }[]>();
    for (const fact of (site.current?.facts ?? []) as { passage: string; url: string; readAt: string }[]) pages.set(fact.url, [...(pages.get(fact.url) ?? []), fact]);
    return [...pages].map(([url, facts]) => ({ url, text: facts.map((fact) => fact.passage).join("\n\n"), measuredAt: new Date(facts[0]!.readAt) }));
  },
}));
vi.mock("@/lib/generate/pipeline/report-facts", () => ({ readReportPage: async () => null }));
vi.mock("@/lib/opportunities", () => ({
  pageForDay: pick, committedWeek: week, restTopic, queueForDraft: async () => {},
  updateInstead: async () => null, opportunityById: async () => null, sitePagesFor: async () => [],
}));
vi.mock("@/lib/costs", () => ({ withCostContext: async (_ctx: unknown, run: (cost: unknown) => unknown) => run(fakeCost()) }));
vi.mock("@/lib/publish/machine", () => ({ transition: async (_id: string, to: string) => ({ ok: true, state: to }) }));
vi.mock("@/lib/mail/ops", () => ({ reportIncident: async () => true }));
// What the Overview's notice reads: the current report and the site's newest kept day.
vi.mock("@/lib/db", () => ({
  dbAdmin: () => ({
    from: (table: string) => {
      const rows = table === "draft_days" ? [{ reason: days.reason }] : [{ report: days.report }];
      const self = { select: () => self, eq: () => self, is: () => self, not: () => self, order: () => self, limit: () => self, then: (done: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(done) };
      return self;
    },
  }),
}));

const { generateDayPage, refreshForDay } = await import("../../../src/lib/generate");
const { setGenerateStore } = await import("../../../src/lib/generate/store");
const { NO_RESEARCH } = await import("../../../src/lib/generate/pipeline/research");
const { releaseNotice } = await import("../../../src/lib/scan/deep/notice");

type Site = (typeof stored)["baeckerei-hinkel.de"] | (typeof stored)["tattly.com"];
const DATE = "2026-11-06";
const TOPIC = "44444444-4444-4444-8444-444444444444";
const SPARE = "55555555-5555-4555-8555-555555555555";
const UPDATE = "66666666-6666-4666-8666-666666666666";
let store: MemoryStore;
let fetched: ReturnType<typeof vi.spyOn>;

/** A stored report that measured these questions. */
function measuring(questions: readonly (readonly string[])[]): StoredReport {
  const base = report();
  if (base.questions.kind === "unmeasured") throw new Error("the fixture report measures questions");
  const like = base.questions.value[0]!;
  return { ...base, questions: { ...base.questions, value: questions.map(([text, keyword], n) => ({ ...like, id: `q${n + 1}`, text: text!, search: { ...like.search, keyword: keyword! } })) } };
}

/** The stored site as the day reads it, its day-1 listicle the week's slot and nothing after it; `readNothing` is a
 *  day whose research read no page. */
function world(from: Site, { readNothing = false, ...over }: Partial<MemoryStore> & { readNothing?: boolean } = {}): Opportunity {
  site.current = from;
  const { business } = from;
  store = memoryStore({ ...over, storedReport: measuring(from.measured) });
  store.site = { id: store.site!.id, domain: business.domain, category: business.category, voiceText: null, doNotClaim: [], rivals: business.rivals, market: parseStoredMarket({ current: business.market }) } as MemoryStore["site"];
  setGenerateStore(store);
  research.mockReset().mockResolvedValue(readNothing ? NO_RESEARCH : { ...from.research, facts: from.research.facts.map((fact) => ({ ...fact, readAt: new Date(fact.readAt) })) });
  const topic = opportunity({ id: TOPIC, siteId: store.site!.id, type: "comparison_page", targetQuery: from.target, targetRef: from.target, title: from.target, absorbedQueries: [] });
  pick.mockReset().mockResolvedValueOnce(topic).mockResolvedValue(null);
  week.mockReset().mockResolvedValue({ days: [], spares: [] });
  return topic;
}

const day = () => generateDayPage({ siteId: store.site!.id, publishDate: DATE });
/** What the writer was handed, per row it wrote. */
const written = () => [...store.rows.values()].map((row) => ({ opportunity: row.opportunity_id, type: (row.meta as { pack: { type: string; missing: string[] } }).pack.type, missing: (row.meta as { pack: { missing: string[] } }).pack.missing }));
const BAKERY: Site = stored["baeckerei-hinkel.de"];
/** The bakery with only its first three passages and no knowledge base. */
const THIN: Site = { ...BAKERY, facts: BAKERY.facts.slice(0, 3), profile: { ...BAKERY.profile, knowledge: undefined } as never };

beforeEach(() => {
  llm.mockReset().mockResolvedValue({ kind: "measured", value: pageParts(prose("bäckerei", 0, 40)), at: AT });
  restTopic.mockReset();
  fetched = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network in a replay"));
});
afterEach(() => {
  setGenerateStore(null);
  fetched.mockRestore();
});

describe("a short day ends in a written pack or a named reason", () => {
  it.each([
    ["as stored", "qa", false],
    ["on a day its research read nothing", "documentation", true],
  ] as const)("the bakery's day-1 page %s is written from a pack that holds, as a %s", async (_when, type, readNothing) => {
    world(BAKERY, { readNothing });
    await day();
    expect(written()).toEqual([{ opportunity: TOPIC, type, missing: [] }]);
    // A new page, so it stands in for no page: no `fallbackFor`.
    expect([...store.rows.values()].map((row) => (row.meta as { fallbackFor?: unknown }).fallbackFor)).toEqual([undefined]);
  });

  it("the shop, whose stored passages are all page chrome, has no own fact: the day names grounding before any research is bought, and the founder's notice says it", async () => {
    world(stored["tattly.com"]);
    const outcome = await day();
    expect(outcome).toEqual({ ok: false, because: "no_own_facts", step: "grounding" });
    expect(written()).toEqual([]);
    expect(research).not.toHaveBeenCalled();
    expect(llm).not.toHaveBeenCalled();
    // As the due hour keeps it (`reviewWritten`), and as the Overview reads it back.
    Object.assign(days, { reason: "generate:no_own_facts:grounding", report: JSON.parse(JSON.stringify(report())) });
    expect((await releaseNotice({ domain: "tattly.com", siteId: store.site!.id }))?.key).toBe("setup.release.own-facts");
  });

  it("the fallback reads nothing the short attempt did not: no fetch, and the one research call it made", async () => {
    world(BAKERY, { readNothing: true });
    let atShort = -1;
    restTopic.mockImplementation(async () => void (atShort = research.mock.calls.length));
    await day();
    expect(atShort).toBe(1);
    expect(research).toHaveBeenCalledTimes(atShort);
    expect(fetched).not.toHaveBeenCalled();
  });

  it("a spare whose pack holds is the day's page, never the fallback", async () => {
    const topic = world(BAKERY, { readNothing: true });
    const spare = opportunity({ id: SPARE, siteId: store.site!.id, type: "keyword_page", targetQuery: "was ist eine bäckerei in düsseldorf", title: "Bäckerei in Düsseldorf", absorbedQueries: [] });
    pick.mockReset().mockResolvedValueOnce(topic).mockResolvedValueOnce(spare).mockResolvedValue(null);
    await day();
    expect(written()).toEqual([{ opportunity: SPARE, type: "documentation", missing: [] }]);
  });

  it("with three facts there is no reference page, the day names too few facts, and the founder's notice says it", async () => {
    world(THIN, { readNothing: true });
    expect(await day()).toEqual({ ok: false, because: "no_own_facts", step: "pack:facts_few" });
    expect(written()).toEqual([]);
    Object.assign(days, { reason: "generate:no_own_facts:pack:facts_few", report: JSON.parse(JSON.stringify(report())) });
    expect((await releaseNotice({ domain: BAKERY.business.domain, siteId: store.site!.id }))?.key).toBe("setup.release.own-facts");
  });

  it.each([
    [60, [{ opportunity: UPDATE, type: "update", missing: [] }]],
    [3, []],
  ])("an update is the last rung only for one of our pages live past its floor (%i days)", async (age, rows) => {
    const live = "https://baeckerei-hinkel.de/blog/brot-frisch-halten";
    const publishedAt = new Date(Date.now() - age * 86_400_000);
    world(THIN, {
      readNothing: true,
      published: [{ ref: "d-live", title: "Brot frisch halten", markdown: "# Brot frisch halten\n\nTrocken lagern." }],
      liveVersionAt: async () => ({ draft: { id: "d-live", meta: {} }, publishedAt }) as never,
    });
    const update = opportunity({ id: UPDATE, siteId: store.site!.id, type: "refresh_page", family: "improve", title: "Brot frisch halten", targetQuery: "brot frisch halten", targetRef: live, ready: true });
    week.mockResolvedValue({ days: [], spares: [update] });
    await day();
    expect(written()).toEqual(rows);
    // As the update fallback marks its page (#2411, #2415): what it stands in for, and that it read stored research.
    for (const row of store.rows.values()) expect(row.meta).toMatchObject({ fallbackFor: expect.stringMatching(/^generate:step_failed:pack:/), research: "stored" });
  });

  it("a select whose committed update wrote nothing goes on down the ladder past the update guard", async () => {
    const topic = world(BAKERY, { readNothing: true });
    pick.mockReset().mockImplementation(async (_s: string, _d: string, _n: Date, updatesTried?: boolean) => (updatesTried === true ? topic : null));
    expect(await refreshForDay({ siteId: store.site!.id, publishDate: DATE, trigger: "generate:no_opportunity", from: "select", stopped: null })).not.toBeNull();
    expect(written()).toEqual([{ opportunity: TOPIC, type: "documentation", missing: [] }]);
  });
});
