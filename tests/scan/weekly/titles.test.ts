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
import { ownCasings, pageTitle } from "../../../src/lib/presentation/page-title";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create: (...a: unknown[]) => create(...a) }; } }));
const { staleTitle, titleWeek } = await import("../../../src/lib/scan/weekly/titles");
const { angleGates } = await import("../../../src/lib/market/questions/angle");
const { setOpportunityStore } = await import("../../../src/lib/opportunities/store");

it("titles every untitled page in one call and one re-ask inside the weekly cap, repairs what both reject and logs why, keeps names' casing beside a rival's domain, and asks nothing again", async () => {
  const report = JSON.parse(JSON.stringify(reportOf({ questions: [], serps: [] })));
  db.answer = (query) => (query.table === "scans" && query.verb === "select" ? [{ id: "scan", cost_cents: CAPS.WEEK_C - 1, site_id: SITE_ID, report }] : null);
  const topic = (query: string, n: number) => ({ ...rowOf("example.com", { query, type: "answer_page", status: "open", volume: null } as unknown as StoredTopic, n), site_id: SITE_ID, title: null, plan_place: n });
  const market = { buyer: "founders", job: "be found", category: "ai search visibility", synonyms: [], differentiators: [], notOurMarket: [], rivals: [{ name: "Peec AI", domain: "peec.ai" }] } as unknown as MarketConclusion;
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
  expect(lines.filter((line) => line.event === "week_title_rejected").map((line) => [line.round, line.search, line.angles.map((each: { gates: string[] }) => each.gates)])).toEqual([["first", "can chatgpt do seo", [["banned"]]], ["again", "can chatgpt do seo", [["pattern"]]]]);
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

it("keeps a stored title over the search restated when both rounds are rejected", async () => {
  const stored = "Can ChatGPT Do SEO: What It Misses and What to Check";
  const state = newMemoryState({ rows: [{ ...rowOf("example.com", { query: "can chatgpt do seo", type: "answer_page", status: "open", volume: null } as unknown as StoredTopic, 0), site_id: SITE_ID, title: stored, plan_place: 0 }], market: { buyer: "founders", job: "be found", category: "ai search visibility", synonyms: [], differentiators: [], notOurMarket: [], rivals: [] } as unknown as MarketConclusion });
  setOpportunityStore(memoryStore(state));
  const rejected = (title: string, pattern: string) => ({ titles: [{ i: 0, angles: [{ pattern, title, promise: "what ChatGPT can do for SEO", fact: 0 }] }] });
  create.mockResolvedValueOnce(toolUseMessage(rejected("How To Use ChatGPT And Google To Check Your SEO", "P4"), 5000, 1300, "topic-title")).mockResolvedValueOnce(toolUseMessage(rejected("How To Use ChatGPT And AI Answers To Win At SEO", "P4"), 5000, 1300, "topic-title"));
  expect([await titleWeek(SITE_ID), state.rows[0]!.title]).toEqual([1, "Can ChatGPT Do SEO? What It Misses and What to Check"]);
});

it("asks again for an angle that drops what its search asks for, and keeps the one that carries it", async () => {
  const state = newMemoryState({ rows: [{ ...rowOf("example.com", { query: "top answer engine optimization strategies for ai products", type: "answer_page", status: "open", volume: null } as unknown as StoredTopic, 0), site_id: SITE_ID, title: null, plan_place: 0 }], market: { buyer: "founders", job: "be found", category: "ai search visibility", synonyms: [], differentiators: [], notOurMarket: [], rivals: [] } as unknown as MarketConclusion });
  setOpportunityStore(memoryStore(state));
  const angle = (title: string) => ({ titles: [{ i: 0, angles: [{ pattern: "P2", title, promise: "which strategies work", fact: 0 }] }] });
  create.mockResolvedValueOnce(toolUseMessage(angle("What Answer Engine Optimization Means for AI Products"), 5000, 1300, "topic-title")).mockResolvedValueOnce(toolUseMessage(angle("Answer Engine Optimization Strategies for AI Products: Which Work"), 5000, 1300, "topic-title"));
  expect([await titleWeek(SITE_ID), state.rows[0]!.title]).toEqual([1, "Answer Engine Optimization Strategies for AI Products: Which Work"]);
});

it("keeps an angle that leads with the search's subject and drops its ranking words", async () => {
  const gates = (search: string, title: string) => angleGates({ pattern: "P3", title, promise: "how to choose one", fact: null }, { search, sources: [], ranks: [] });
  expect([gates("leading answer engine optimization platforms for ai products", "Answer Engine Optimization Platforms: How to Choose One for an AI Product"), gates("most effective generative engine optimization solutions", "Generative Engine Optimization Solutions: How to Choose One")]).toEqual([[], []]);
});

it("writes a known name in its known casing over the model's, keeps a casing nothing contradicts, and closes an opening yes-or-no question with its mark", () => {
  const titles = [pageTitle("Is chatGPT Worth It for iPhone Apps: What Founders Found", "en"), pageTitle("can chatGPT do seo", "en", ownCasings(["ChatGPT and SEO", "the model's chatGPT"])), pageTitle("How to Rank in chatGPT", "en"), pageTitle("Lohnt sich ChatGPT für Bäckereien", "de")];
  expect(titles).toEqual(["Is ChatGPT Worth It for iPhone Apps? What Founders Found", "Can ChatGPT Do SEO?", "How to Rank in ChatGPT", "Lohnt sich ChatGPT für Bäckereien?"]);
});

it("asks again for a news page's title that sells the business and drops its figure", () => {
  const hot = { event: "Google AI Overviews", claims: ["Google AI Overviews cut clicks to websites by about 40%."] }, title = "Not Cited in Google AI Overviews? Fix It with Weekly Pages";
  const a = { search: "not cited in google ai overviews", sources: [hot.event, ...hot.claims], ranks: [], hot, offering: { brand: "reachkit", says: ["weekly pages"], common: ["be found"] } };
  expect([staleTitle(title, a), angleGates({ pattern: "P2", title, promise: "", fact: null }, a)]).toEqual([true, ["promise_figure", "claim"]]);
});
