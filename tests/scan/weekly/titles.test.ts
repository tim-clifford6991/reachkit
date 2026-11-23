// The commit's title call: one call for the week's untitled pages, inside `CAPS.WEEKLY_C`; none on a re-run; a page it titles nothing for stays planned.
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

it("titles a week's untitled pages in one call inside the weekly cap, asks nothing again, and keeps an untitled page planned", async () => {
  const report = JSON.parse(JSON.stringify(reportOf({ questions: [], serps: [] })));
  db.answer = (query) => (query.table === "scans" && query.verb === "select" ? [{ id: "scan", cost_cents: CAPS.WEEKLY_C - 1, site_id: SITE_ID, report }] : null);
  const topic = (query: string, n: number) => ({ ...rowOf("example.com", { query, type: "answer_page", status: "open", volume: null } as unknown as StoredTopic, n), site_id: SITE_ID, title: null, plan_place: n });
  const market = { buyer: "founders", job: "be found", category: "ai search visibility", synonyms: [], differentiators: [], notOurMarket: [], rivals: [] } as unknown as MarketConclusion;
  const state = newMemoryState({ rows: [topic("what is ai search visibility", 0), topic("ai visibility agency", 1)], market });
  setOpportunityStore(memoryStore(state));
  const angle = { pattern: "P2", title: "What Is AI Search Visibility: How Founders Measure It", promise: "how founders measure it", fact: 0 };
  const agency = { pattern: "P2", title: "AI Visibility Agency: What A Done-For-You Service Covers", promise: "what a managed service covers", fact: 0 };
  create.mockResolvedValueOnce(toolUseMessage({ titles: [{ i: 0, angles: [angle] }] }, 5000, 1300, "topic-title"));
  create.mockResolvedValueOnce(toolUseMessage({ titles: [{ i: 0, angles: [agency] }] }, 5000, 1300, "topic-title"));
  const logged = vi.spyOn(console, "log");

  expect(await titleWeek(SITE_ID)).toBe(1);
  expect(state.rows.map((row) => [row.title, row.plan_place])).toEqual([[angle.title, 0], [null, 1]]);
  expect(await titleWeek(SITE_ID)).toBe(1);
  expect(await titleWeek(SITE_ID)).toBe(0);
  expect(create).toHaveBeenCalledTimes(2);
  expect(state.rows.map((row) => row.title)).toEqual([angle.title, agency.title]);
  const spent = logged.mock.calls.flatMap(([line]) => (typeof line === "string" && line.includes('"site":"topic-title"') ? [JSON.parse(line).costCents as number] : []));
  expect(spent.length).toBe(2);
  expect(spent.every((cents) => cents > 0 && cents < CAPS.WEEKLY_C)).toBe(true);
});
