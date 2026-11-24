// The commit's title call: one call and one re-ask for the week's untitled pages and those titled by older rules, inside `CAPS.WEEK_C`; none on a re-run; no page left untitled.
import "../../opportunities/env";
import { expect, it, vi } from "vitest";
import { fakeDb } from "../run/harness";
import { CAPS } from "../../../src/lib/config/constants";
import type { MarketConclusion } from "../../../src/lib/market/infer/types";
import { reportOf, SITE_ID } from "../../opportunities/fixtures";
import { memoryStore, newMemoryState } from "../../opportunities/memory-store";
import { toolUseMessage } from "../../llm/fixtures";
import { rowOf, type StoredTopic } from "../../golden/plan/panel";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create: (...a: unknown[]) => create(...a) }; } }));
const { titleWeek } = await import("../../../src/lib/scan/weekly/titles");
const { setOpportunityStore } = await import("../../../src/lib/opportunities/store");

it("titles every untitled page in one call and one re-ask inside the weekly cap, repairs what both reject, keeps names' casing, and asks nothing again", async () => {
  const report = JSON.parse(JSON.stringify(reportOf({ questions: [], serps: [] })));
  db.answer = (query) => (query.table === "scans" && query.verb === "select" ? [{ id: "scan", cost_cents: CAPS.WEEK_C - 1, site_id: SITE_ID, report }] : null);
  const topic = (query: string, n: number) => ({ ...rowOf("example.com", { query, type: "answer_page", status: "open", volume: null } as unknown as StoredTopic, n), site_id: SITE_ID, title: null, plan_place: n });
  const market = { buyer: "founders", job: "be found", category: "ai search visibility", synonyms: [], differentiators: [], notOurMarket: [], rivals: [] } as unknown as MarketConclusion;
  const state = newMemoryState({ rows: [topic("what is ai search visibility", 0), topic("can chatgpt do seo", 1)], market });
  setOpportunityStore(memoryStore(state));
  const angle = { pattern: "P2", title: "What Is Ai Search Visibility: How Founders Measure It", promise: "how founders measure AI visibility", fact: 0 };
  const hyped = { pattern: "P2", title: "Can Chatgpt Do Seo? Here's What Actually Works", promise: "what ChatGPT can do for SEO", fact: 0 };
  const misfit = { pattern: "P1", title: "Can Chatgpt Do Seo Without Hours Of Your Time", promise: "SEO without the hours", fact: 0 };
  create.mockResolvedValueOnce(toolUseMessage({ titles: [{ i: 0, angles: [angle] }, { i: 1, angles: [hyped] }] }, 5000, 1300, "topic-title"));
  create.mockResolvedValueOnce(toolUseMessage({ titles: [{ i: 1, angles: [misfit] }] }, 5000, 1300, "topic-title"));
  const logged = vi.spyOn(console, "log");

  expect(await titleWeek(SITE_ID)).toBe(2);
  expect(state.rows.map((row) => [row.title, row.plan_place])).toEqual([["What Is AI Search Visibility: How Founders Measure It", 0], ["Can ChatGPT Do SEO? Here's What Works", 1]]);
  expect(await titleWeek(SITE_ID)).toBe(0);
  expect(create).toHaveBeenCalledTimes(2);
  const lines = logged.mock.calls.flatMap(([line]) => (typeof line === "string" && line.startsWith("{") ? [JSON.parse(line)] : []));
  expect(lines.filter((line) => line.event === "week_title_rejected").map((line) => [line.search, line.angles])).toEqual([["can chatgpt do seo", [{ pattern: "P2", gates: ["banned"] }]]]);
  const spent = lines.flatMap((line) => (line.site === "topic-title" ? [line.costCents as number] : []));
  expect(spent.length === 2 && spent.every((cents) => cents > 0 && cents < CAPS.WEEK_C)).toBe(true);
});

it("asks again for a page whose stored title fails today's checks, and leaves a passing one unasked", async () => {
  create.mockClear();
  const topic = (query: string, n: number, title: string) => ({ ...rowOf("example.com", { query, type: "answer_page", status: "open", volume: null } as unknown as StoredTopic, n), site_id: SITE_ID, title, plan_place: n });
  const state = newMemoryState({ rows: [topic("generative engine optimization", 0, "Why Generative Engine Optimization Matters When Ai Hides You"), topic("what is ai search visibility", 1, "What Is AI Search Visibility: How Founders Measure It")], market: { buyer: "founders", job: "be found", category: "ai search visibility", synonyms: [], differentiators: [], notOurMarket: [], rivals: [] } as unknown as MarketConclusion });
  setOpportunityStore(memoryStore(state));
  create.mockResolvedValueOnce(toolUseMessage({ titles: [{ i: 0, angles: [{ pattern: "P2", title: "Generative Engine Optimization: How to Get Your Pages Cited", promise: "get your pages cited", fact: 0 }] }] }, 5000, 1300, "topic-title"));
  expect(await titleWeek(SITE_ID)).toBe(1);
  expect(state.rows.map((row) => row.title)).toEqual(["Generative Engine Optimization: How to Get Your Pages Cited", "What Is AI Search Visibility: How Founders Measure It"]);
  expect([await titleWeek(SITE_ID), create.mock.calls.length]).toEqual([0, 1]);
});
