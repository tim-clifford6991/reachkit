// A pass whose site holds less than a week and its spares keeps one `supply_short` row naming the sources that ran dry.
import "./env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLAN_DEPTH } from "../../src/lib/config/constants";
import { measured } from "../../src/lib/measure/measured";
import { deriveForPass } from "../../src/lib/opportunities/pass";
import { setOpportunityStore } from "../../src/lib/opportunities/store";
import { fakeDb } from "../publish/harness";
import { cappedCost, fakeCost } from "./cost";
import { memoryStore, newMemoryState, type MemoryState } from "./memory-store";
import { AT, SITE_ID, defaultReport } from "./fixtures";
import { storedWriteRow } from "./stored-write-row";

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: () => Promise.reject(new Error("no model in this suite")) };
  },
}));

const db = vi.hoisted(() => ({ client: null as unknown, broken: false }));
const client = () => { if (db.broken) throw new Error("stubbed client failure"); return db.client; };
vi.mock("@/lib/db", () => ({ dbAdmin: () => client(), db: () => client() }));

const fake = fakeDb();
let state: MemoryState;

beforeEach(() => {
  fake.reset();
  db.client = fake.client;
  db.broken = false;
  state = newMemoryState();
  setOpportunityStore(memoryStore(state));
});

afterEach(() => {
  setOpportunityStore(null);
  vi.restoreAllMocks();
});

const sized = ["appcues.com", "userpilot.com"].map((domain) => ({ domain, state: "sized" as const, rankedCount: 40, band: "near" as const, at: AT, current: true }));
const report = () => defaultReport({ rivalSizes: measured(sized, AT) });

const pass = (cost = fakeCost()) => deriveForPass(cost.ctx, { tier: "weekly", siteId: SITE_ID, report: report(), hasActiveAccess: true });

/** Open Write rows on searches this report never read, from an earlier scan. */
const held = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const row = storedWriteRow("rival.example", `held-${i}`);
    const query = `held topic number ${["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][i]}`;
    return { ...row, site_id: SITE_ID, target_query: query, target_ref: query, evidence: { ...(row.evidence as object), query }, acceptance: { form: "top20", query } };
  });
const logged = (spy: { mock: { calls: unknown[][] } }, event: string) => spy.mock.calls.map(([text]) => JSON.parse(String(text))).filter((entry) => entry.event === event);

describe("the shortfall is stored by name", () => {
  it("a short pass writes exactly one row: the dry sources and how many pages short", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await pass();
    const rows = fake.rows("ops_events");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "supply_short", site_id: SITE_ID, code: String(PLAN_DEPTH - 1) });
    expect(String(rows[0]!.read).split(",")).toEqual(["product", "problem", "category", "ai_gap", "asked", "cited", "written", "offering"]);
  });

  it("a pass whose site holds a week and its spares writes none, and logs what it holds", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    state.rows.push(...held(PLAN_DEPTH));
    await pass();
    expect(fake.rows("ops_events")).toEqual([]);
    expect(logged(log, "supply_pass")).toEqual([expect.objectContaining({ have: PLAN_DEPTH + 1, short: 0, dry: expect.arrayContaining(["written"]) })]);
  });

  it("a pass that did not run writes no row and claims no shortfall", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await pass(cappedCost());
    expect(fake.rows("ops_events")).toEqual([]);
    expect(logged(log, "supply_pass")[0]).not.toHaveProperty("short");
  });

  it("a write that fails is logged and the pass still returns", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    db.broken = true;
    await expect(pass()).resolves.toMatchObject({ added: 1 });
    expect(logged(warn, "ops_event_write_failed")).toHaveLength(1);
  });
});
