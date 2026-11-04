// A day's second topic starts only where its write and its one fix still fit the day's CAP_DRAFT, so the day never
// pays for a page it could not repair. Through the engine's `generateDayPage`; the model and the cost context are
// doubled at their doors, as `day-page.test.ts` doubles them.
import "./env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AT, CLEAN_MARKDOWN, GROUNDED, SOURCE_TEXT, SITE_ID, memoryStore, opportunity, pageParts, type MemoryStore } from "./fixtures";

const { llmMock, pickMock, withCostContextMock, transitionMock } = vi.hoisted(() => ({
  llmMock: vi.fn(),
  pickMock: vi.fn(),
  withCostContextMock: vi.fn(),
  transitionMock: vi.fn(),
}));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));
vi.mock("@/lib/generate/pipeline/pack", async (importOriginal) => (await import("./fixtures")).packStandIn(await importOriginal<object>()));
vi.mock("@/lib/generate/pipeline/research", async (importOriginal) => (await import("./fixtures")).researchStandIn(await importOriginal<object>()));
vi.mock("@/lib/generate/voice/confirmed", () => ({ confirmedForWriting: async () => ({ profile: null, factsOff: [] }), refusedPassages: async () => [] }));
vi.mock("@/lib/measure/text", () => ({ readMeasuredText: async () => [{ url: GROUNDED.url, text: SOURCE_TEXT, measuredAt: GROUNDED.readAt }] }));
vi.mock("@/lib/generate/pipeline/report-facts", () => ({ readReportPage: async () => null }));
vi.mock("@/lib/opportunities", () => ({
  pageForDay: (siteId: string, date: string, now?: Date) => pickMock(siteId, date, now),
  queueForDraft: async () => {},
  restTopic: async () => {},
  updateInstead: async () => null,
  opportunityById: async () => null,
  sitePagesFor: async () => [],
  assessFixPages: async () => ({ done: 0, ready: 0 }),
  assessReadiness: async () => ({ ready: 1, unready: 0 }),
}));
vi.mock("@/lib/costs", () => ({ withCostContext: withCostContextMock }));
vi.mock("@/lib/publish/machine", () => ({ transition: transitionMock }));
vi.mock("@/lib/site-profile/crawl", () => ({ crawlSite: vi.fn() }));
vi.mock("@/lib/mail/ops", () => ({ reportIncident: async () => true }));

const { generateDayPage } = await import("../../src/lib/generate");
const { setGenerateStore } = await import("../../src/lib/generate/store");

const NEXT = opportunity({ id: "44444444-4444-4444-8444-444444444444", targetQuery: "project management software plan" });
let store: MemoryStore;

const queueAttempt = (markdown: string, topic = "seats") =>
  llmMock.mockResolvedValueOnce({ kind: "measured", value: pageParts(markdown, { slug: "a-title" }, topic), at: AT });

beforeEach(() => {
  llmMock.mockReset();
  transitionMock.mockReset().mockImplementation(async (draftId: string, to: string) => {
    const row = store.rows.get(draftId);
    if (row !== undefined) store.rows.set(draftId, { ...row, state: to });
    return { ok: true, state: to };
  });
  store = memoryStore();
  setGenerateStore(store);
});

afterEach(() => {
  setGenerateStore(null);
});

/** Topic 1 written and stopped after its fix, with `leftCents` of the day's 45¢ left. */
async function dayWithLeft(leftCents: number) {
  withCostContextMock.mockImplementation(async (ctx: { cap: string }, run: (c: unknown) => Promise<unknown>) =>
    run({ cap: ctx.cap, capHit: () => false, spentCents: () => 45 - leftCents, degraded: () => false })
  );
  pickMock.mockReset().mockResolvedValueOnce(opportunity()).mockResolvedValueOnce(NEXT);
  queueAttempt("We tested every tool for months, and this one won.");
  queueAttempt("We tested every tool again, and this one won.");
  // Its own words, so it is not a near-duplicate of topic 1's row.
  queueAttempt(CLEAN_MARKDOWN, "budgets");
  return generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
}

describe("a second topic starts only where its write and its fix still fit the day's CAP_DRAFT", () => {
  it("a day with less left than a write and a fix ends on topic 1's stop, which keeps the date", async () => {
    const outcome = await dayWithLeft(12);
    expect(outcome).toMatchObject({ ok: false, because: "rules", attempts: 2 });
    expect(llmMock.mock.calls.map((call) => call[1].site)).toEqual(["generate.write", "generate.fix"]);
    expect([...store.rows.values()].map((row) => [row.opportunity_id, row.scheduled_for])).toEqual([[opportunity().id, "2026-09-07"]]);
  });

  it("a day with 11-04's 31.4¢ left writes topic 2, which takes the date", async () => {
    const outcome = await dayWithLeft(31.4);
    expect(outcome.ok).toBe(true);
    expect(llmMock.mock.calls.map((call) => call[1].site)).toEqual(["generate.write", "generate.fix", "generate.write"]);
    expect([...store.rows.values()].find((row) => row.opportunity_id === NEXT.id)?.scheduled_for).toBe("2026-09-07");
  });
});
