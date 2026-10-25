// tests/jobs/weekly-late-answers.test.ts — #1160: the Monday tick reads the
// answers its pass paid for and did not wait for, in steps of their own,
// before it judges and tells the week.
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../opportunities/env";

const seen = vi.hoisted(() => ({ order: [] as string[], left: [] as number[], outcome: {} as unknown }));

// Issue 1553's search-engine step reaches the database and the vendors;
// these suites judge the week, so it is a no-op here (its own suite is
// `tests/hosted/indexing/search-engines.test.ts`).
vi.mock("@/lib/publish/destinations/hosted/search-engines", () => ({ readSearchEngines: async () => undefined }));
vi.mock("@/lib/scan/weekly", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scan/weekly")>()),
  runWeekly: async () => {
    seen.order.push("pass");
    return seen.outcome;
  },
  refreshWeeklyKnowledge: async (a: { scanId: string }) => {
    seen.order.push(`knowledge:${a.scanId}`);
    return null;
  },
}));
vi.mock("@/lib/scan/weekly/collect", () => ({
  collectLateAnswers: async (a: { scanId: string }) => {
    seen.order.push(`read:${a.scanId}`);
    return { asks: 3, answered: 1, left: seen.left.shift() ?? 0 };
  },
}));
vi.mock("@/lib/opportunities", () => ({
  judgeWeek: async () => void seen.order.push("judge"),
  planRefreshes: async () => {},
  planWeek: async () => [],
}));
vi.mock("@/lib/mail/weekly", () => ({
  sendWeeklyDigest: async () => {
    seen.order.push("digest");
    return { sent: true, id: "vendor-1" };
  },
}));

const { startWeeklyScan } = await import("@/jobs/engine");

const steps: string[] = [];
const tick = () =>
  startWeeklyScan({
    siteId: "site-1",
    domain: "example.com",
    zone: "UTC",
    weekStart: "2026-10-05",
    now: new Date("2026-10-05T04:00:00Z"),
    step: async (name, body) => {
      steps.push(name);
      return body();
    },
  });

beforeEach(() => {
  seen.order = [];
  seen.left = [];
  seen.outcome = { ran: true, scanId: "scan-1", status: "done" };
  steps.length = 0;
});

describe("the weekly tick reads its late answers before it tells the week (#1160)", () => {
  it("reads again while asks are still queued, each round a step, then judges and sends", async () => {
    seen.left = [2, 0];
    expect(await tick()).toEqual({ done: true });
    expect(seen.order).toEqual(["pass", "knowledge:scan-1", "read:scan-1", "read:scan-1", "judge", "digest"]);
    expect(steps).toEqual([
      "measure-site-1",
      "knowledge-site-1",
      "late-answers-site-1-1",
      "late-answers-site-1-2",
      "search-site-1",
      "tell-site-1",
    ]);
  });
});

describe("the weekly tick reads the knowledge base in a step of its own, after the pass (SPEC §5, 2026-10-25)", () => {
  it("a pass that stored no report reads nothing into the knowledge base", async () => {
    seen.outcome = { ran: true, scanId: "scan-1", status: "failed" };
    await tick();
    expect(seen.order).not.toContain("knowledge:scan-1");
    expect(steps).not.toContain("knowledge-site-1");
  });

  it("a week already measured reads nothing again", async () => {
    seen.outcome = { ran: false, because: "already_measured" };
    await tick();
    expect(steps).toEqual(["measure-site-1", "search-site-1", "tell-site-1"]);
  });
});
