// Issue 1162 (owner, 2026-10-03): the rolling window reads one pass a week
// — a weekly pass or a founder's re-measure, whichever asked the prompts
// last — so a week measured twice is not a week counted twice.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PromptsSection } from "../../../src/lib/scan/report";

let deepRows: { created_at: string; prompts: unknown }[] = [];
let weekly = new Map<string, { report: { prompts?: PromptsSection; verdict: { measuredAt: Date } } }>();

vi.mock("@/lib/db", () => ({
  dbAdmin: () => ({
    from: () => {
      const query = { select: () => query, eq: () => query, gte: () => query, then: (r: (v: unknown) => unknown) => Promise.resolve({ data: deepRows, error: null }).then(r) };
      return query;
    },
  }),
}));
vi.mock("../../../src/lib/scan/weekly/store", () => ({
  readWeekScans: async () => weekly,
  readSiteZone: async () => "Europe/Berlin",
}));

const { readPromptWindow } = await import("../../../src/lib/scan/weekly/prompts");

function section(named: boolean): PromptsSection {
  return {
    siteName: "Example",
    asked: [{ id: "p1", kind: "category", text: "Which tools are best?" }],
    asks: 4,
    answers: [1, 2].map((run) => ({ promptId: "p1", engine: "ai_mode" as const, run, named, linked: false, ownUrls: [], rivals: [] })),
  };
}

beforeEach(() => {
  deepRows = [];
  weekly = new Map();
});

describe("the tracked prompts' window", () => {
  it("a re-measure on Saturday is that week's sample, before any weekly pass has asked", async () => {
    deepRows = [{ created_at: "2026-10-03T09:30:00Z", prompts: section(true) }];
    const window = await readPromptWindow({ siteId: "s", weekStart: "2026-09-28" });
    expect(window.weeks.map((week) => week.weekStart)).toEqual(["2026-09-28"]);
    expect(window.weeks[0]?.samples).toHaveLength(2);
    expect(window.prompts).toHaveLength(1);
  });

  it("a week with a weekly pass and a later re-measure counts the later one, once", async () => {
    weekly.set("2026-10-05", { report: { prompts: section(false), verdict: { measuredAt: new Date("2026-10-05T04:00:00Z") } } });
    deepRows = [
      { created_at: "2026-10-03T09:30:00Z", prompts: section(false) },
      { created_at: "2026-10-06T10:00:00Z", prompts: section(true) },
      { created_at: "2026-10-06T08:00:00Z", prompts: null },
    ];
    const window = await readPromptWindow({ siteId: "s", weekStart: "2026-10-05" });
    expect(window.weeks.map((week) => [week.weekStart, week.samples.length])).toEqual([
      ["2026-09-28", 2],
      ["2026-10-05", 2],
    ]);
    expect(window.weeks[1]?.samples.every((sample) => sample.named)).toBe(true);
  });
});
