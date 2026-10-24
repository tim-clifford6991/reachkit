// tests/scan/weekly/late-answers.test.ts — #1160: a tracked-prompt ask the
// pass paid for and left queued is read afterwards, and its answer joins
// the week's list once.
import { describe, expect, it, vi } from "vitest";
import "../../opportunities/env";
import type { PromptAnswer, PromptsSection } from "@/lib/scan/report";

// The two tables the read touches, and what was written to each.
const db = vi.hoisted(() => ({
  rows: { fetches: [] as Record<string, unknown>[], scans: [] as Record<string, unknown>[] },
  updates: [] as { table: string; values: Record<string, unknown>; id: string }[],
}));
vi.mock("@/lib/db", () => {
  const from = (table: "fetches" | "scans") => {
    let values: Record<string, unknown> | undefined;
    const query = {
      select: () => query,
      in: () => query,
      not: () => query,
      update: (next: Record<string, unknown>) => ((values = next), query),
      eq: (column: string, id: string) => {
        if (values !== undefined && column === "id") {
          db.updates.push({ table, values, id });
          Object.assign(db.rows[table].find((row) => row.id === id) ?? {}, values);
        }
        return query;
      },
      then: (resolve: (result: { data: unknown[]; error: null }) => unknown) =>
        resolve({ data: db.rows[table], error: null }),
    };
    return query;
  };
  return { dbAdmin: () => ({ from }) };
});
const queue = vi.hoisted(() => ({ ready: new Map<string, unknown>() }));
vi.mock("@/lib/vendors/dataforseo/ai", () => ({
  AI_ANSWER_SOURCES: { ai_mode: "serp/google/ai_mode", chatgpt: "ai_optimization/chat_gpt/llm_scraper" },
  collectAiAnswer: async (a: { taskId: string }) => queue.ready.get(a.taskId) ?? { kind: "pending" },
}));
vi.mock("@/lib/market/infer/stored", () => ({ readSiteMarket: async () => null }));
vi.mock("@/lib/scan/health-record", () => ({ recordPassHealth: async () => null }));

const { collectLateAnswers } = await import("@/lib/scan/weekly/collect");
type LateRow = import("@/lib/scan/weekly/collect").LateRow;

const SOURCES = { ai_mode: "serp/google/ai_mode", chatgpt: "ai_optimization/chat_gpt/llm_scraper" } as const;
const TEXT = "Which AI visibility tools do people recommend?";

const answer = (engine: PromptAnswer["engine"], run: number): PromptAnswer => ({
  promptId: "p1",
  engine,
  run,
  named: false,
  linked: false,
  ownUrls: [],
  rivals: [],
});

const section: PromptsSection = {
  siteName: "ReachKit",
  asked: [{ id: "p1", kind: "category", text: TEXT }],
  asks: 4,
  answers: [answer("ai_mode", 1)],
};

const row = (id: string, source: string, key: string, payload: unknown): LateRow => ({ id, source, cache_key: key, payload });
const queued = (taskId: string) => ({ vendorFailure: "deadline", endpoint: "x", billed: true, taskId });

describe("reading the late answers of one pass (#1160)", () => {
  it("an answer that is ready joins the report and its row; one still queued is left for the next round", async () => {
    db.updates.length = 0;
    db.rows.scans = [{ id: "scan-1", report: { version: 13, prompts: section } }];
    db.rows.fetches = [
      row("r1", SOURCES.chatgpt, `${TEXT}|en|US|site:s|asof:2026-10-05`, queued("t1")),
      row("r2", SOURCES.chatgpt, `${TEXT}|en|US|site:s|asof:2026-10-05|run:2`, queued("t2")),
      // Answered inside the pass, so not owed.
      row("r3", SOURCES.ai_mode, `${TEXT}|us|site:s|asof:2026-10-05`, queued("t3")),
      // A page question the pass asked the same engine: not a tracked prompt.
      row("r4", SOURCES.chatgpt, "saas seo tool|en|US|site:s", queued("t4")),
    ] as unknown as Record<string, unknown>[];
    const rows = [{ answered: true, text: "ReachKit and others.", citedDomains: ["reachkit.app"], citedUrls: ["https://www.semrush.com/kb/keyword-research/"] }];
    queue.ready = new Map([["t1", { kind: "answer", rows }]]);

    const first = await collectLateAnswers({ scanId: "scan-1", siteId: "site-1", domain: "reachkit.app", untilMs: 0 });
    expect(first).toEqual({ asks: 2, answered: 1, left: 1 });

    const stored = (db.rows.scans[0]!.report as { version: number; prompts: PromptsSection });
    expect(stored.version).toBe(13);
    expect(stored.prompts.answers).toEqual([
      answer("ai_mode", 1),
      { ...answer("chatgpt", 1), named: true, linked: true, cited: ["https://www.semrush.com/kb/keyword-research/"] },
    ]);
    expect(db.updates.filter((update) => update.table === "fetches")).toEqual([
      { table: "fetches", values: { payload: rows }, id: "r1" },
    ]);

    // The next round asks only for the one still queued.
    queue.ready = new Map();
    expect(await collectLateAnswers({ scanId: "scan-1", siteId: "site-1", domain: "reachkit.app", untilMs: 0 })).toEqual({
      asks: 1,
      answered: 0,
      left: 1,
    });
  });
});
