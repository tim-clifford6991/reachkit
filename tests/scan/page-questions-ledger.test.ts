// What a week of page-question reads and tracked prompts costs on the ledger,
// before and after owner B2 (2026-10-19): page results read 100 deep, paid
// for by one run on the 23 unbranded prompts. Every call goes through the
// real vendor functions and a stubbed wire, so the cents are the ones the
// ledger would record. Nothing is bought.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { envelope, fakeCostContext, setEnvFixture, stubVendorFetch, taskCreated } from "../vendors/harness.ts";

let serp: typeof import("../../src/lib/vendors/dataforseo/serp.ts");
let ai: typeof import("../../src/lib/vendors/dataforseo/ai.ts");
let constants: typeof import("../../src/lib/config/constants.ts");
let tracked: typeof import("../../src/lib/market/questions/tracked.ts");

beforeAll(async () => {
  setEnvFixture();
  serp = await import("../../src/lib/vendors/dataforseo/serp.ts");
  ai = await import("../../src/lib/vendors/dataforseo/ai.ts");
  constants = await import("../../src/lib/config/constants.ts");
  tracked = await import("../../src/lib/market/questions/tracked.ts");
});

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  stubVendorFetch((request) => (request.url.includes("task_post") ? taskCreated() : envelope({ items: [] })));
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const LOCALE = { country: "US", language: "en" } as const;
const SCOPE = { site: "site-ledger" } as const;
const UNBRANDED = 23;
const BRANDED = 2;

type Schedule = { selected: number; deep: boolean; unbrandedRuns: number; brandedRuns: number };

/** One weekly pass's page slots — each a SERP read plus its ChatGPT and AI
 *  Mode asks — and its tracked prompt asks, as the ledger records them. */
async function week(schedule: Schedule): Promise<{ serps: number; asks: number }> {
  const serpCost = fakeCostContext("WEEKLY");
  const askCost = fakeCostContext("WEEKLY");
  const calls: Promise<unknown>[] = [];
  const slots = constants.TRACKED_QUESTIONS_MAX - schedule.selected;
  for (let slot = 0; slot < slots; slot += 1) {
    const depth = schedule.deep ? tracked.slotDepth({ position: null }, slot) : 10;
    calls.push(
      serp.serpOrganic(serpCost.ctx, {
        query: `page search ${slot}`,
        locale: LOCALE,
        mode: "std",
        loadAsyncAiOverview: true,
        scope: SCOPE,
        freshnessDays: constants.CACHE_WINDOWS_D.serpWeeklyRecheck,
        ...(depth === 10 ? {} : { depth }),
      })
    );
    calls.push(ai.llmScraper(askCost.ctx, { query: `page question ${slot}`, mode: "std", scope: SCOPE, locale: LOCALE }));
    calls.push(ai.aiMode(askCost.ctx, { query: `page question ${slot}`, mode: "std", scope: SCOPE, locale: LOCALE }));
  }
  const prompts = [
    ...Array.from({ length: UNBRANDED }, (_, i) => ({ text: `unbranded ${i}`, runs: schedule.unbrandedRuns })),
    ...Array.from({ length: BRANDED }, (_, i) => ({ text: `branded ${i}`, runs: schedule.brandedRuns })),
  ];
  for (const prompt of prompts) {
    for (let run = 1; run <= prompt.runs; run += 1) {
      calls.push(ai.llmScraper(askCost.ctx, { query: prompt.text, mode: "std", scope: SCOPE, locale: LOCALE, run }));
      calls.push(ai.aiMode(askCost.ctx, { query: prompt.text, mode: "std", scope: SCOPE, locale: LOCALE, run }));
    }
  }
  const settled = Promise.all(calls);
  await vi.advanceTimersByTimeAsync(constants.VENDOR.stdQueuePollIntervalS * 1000 * 2);
  await settled;
  const sum = (cents: readonly number[]) => cents.reduce((total, c) => total + c, 0);
  return { serps: sum(serpCost.ledgered), asks: sum(askCost.ledgered) };
}

/** The schedule before B2 (ten deep, every prompt twice on each engine) and
 *  today's, read off the product's own rules. */
const before = (selected: number): Schedule => ({ selected, deep: false, unbrandedRuns: 2, brandedRuns: 2 });
const after = (selected: number): Schedule => ({
  selected,
  deep: true,
  unbrandedRuns: constants.TRACKED_PROMPTS.RUNS,
  brandedRuns: constants.TRACKED_PROMPTS.BRANDED_RUNS,
});
const total = (spend: { serps: number; asks: number }) => spend.serps + spend.asks;

describe("owner B2 — the weekly ledger moves by about +0.96¢ a site, and only from B2", () => {
  it("a full market: 12 page slots read 100 deep, against one run of the 23 unbranded prompts", async () => {
    const was = await week(before(12));
    const now = await week(after(12));

    expect(now.serps - was.serps).toBeCloseTo(6.48, 6);
    expect(now.asks - was.asks).toBeCloseTo(-5.52, 6);
    expect(total(now) - total(was)).toBeCloseTo(0.96, 6);
    // 12 slots × (0.66¢ read + 0.24¢ AI Mode and ChatGPT) + 6.48¢ of prompts.
    expect(total(now)).toBeCloseTo(17.28, 6);
  });

  it("a thin market that selects none: 24 page slots, of which only twelve read deep, still moves by no more", async () => {
    const was = await week(before(0));
    const now = await week(after(0));

    expect(total(now) - total(was)).toBeLessThanOrEqual(0.96 + 1e-9);
    // 12 deep slots × 0.9¢ + 12 ten-deep slots × 0.36¢ + 6.48¢ of prompts.
    expect(total(now)).toBeCloseTo(21.6, 6);
    expect(total(now)).toBeLessThan(constants.CAPS.WEEKLY_C);
  });

  it("the AI Overview surcharge is one base price per read, not one per page of ten (operations Q-C1)", async () => {
    const deep = await week({ selected: 12, deep: true, unbrandedRuns: 0, brandedRuns: 0 });
    const perSlot = deep.serps / 12;
    expect(perSlot).toBeCloseTo(constants.PRICE_BOOK.SERP_STD_C * (10 + constants.ASYNC_AIO_SURCHARGE_MULTIPLIER - 1), 6);
  });
});
