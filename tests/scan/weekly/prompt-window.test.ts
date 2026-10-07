// Issue 1162 (owner, 2026-10-03): the rolling window reads one pass a week
// — a weekly pass or a founder's re-measure, whichever asked the prompts
// last — so a week measured twice is not a week counted twice.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PromptsSection } from "../../../src/lib/scan/report";

let deepRows: { id?: string; created_at: string; prompts: unknown; health?: unknown }[] = [];
let weekly = new Map<string, { scanId?: string; report: { prompts?: PromptsSection; verdict: { measuredAt: Date } } }>();

vi.mock("@/lib/db", () => ({
  dbAdmin: () => ({
    from: () => {
      const query = { select: () => query, eq: () => query, gte: () => query, not: () => query, then: (r: (v: unknown) => unknown) => Promise.resolve({ data: deepRows, error: null }).then(r) };
      return query;
    },
  }),
}));
vi.mock("../../../src/lib/scan/weekly/store", () => ({
  readWeekScans: async () => weekly,
  readSiteZone: async () => "Europe/Berlin",
}));

const { readPromptWindow } = await import("../../../src/lib/scan/weekly/prompts");
const { assemblePrompts } = await import("../../../src/app/(account)/app/_overview/prompts-model");

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

  it("D58: a pass a health check failed on is nobody's sample; the last healthy pass stands", async () => {
    const failing = { at: "2026-10-06T11:26:00.000Z", checks: [{ check: "prompt_rivals", pass: false, detail: "", items: ["x"] }] };
    const healthy = { at: "2026-10-05T04:05:00.000Z", checks: [{ check: "prompt_rivals", pass: true, detail: "", items: [] }] };
    weekly.set("2026-09-28", { scanId: "w1", report: { prompts: section(true), verdict: { measuredAt: new Date("2026-09-28T04:00:00Z") } } });
    weekly.set("2026-10-05", { scanId: "w2", report: { prompts: section(false), verdict: { measuredAt: new Date("2026-10-05T04:00:00Z") } } });
    deepRows = [
      { id: "w1", created_at: "2026-09-28T04:00:00Z", prompts: null, health: healthy },
      { id: "w2", created_at: "2026-10-05T04:00:00Z", prompts: null, health: failing },
      { id: "d1", created_at: "2026-10-06T11:21:00Z", prompts: section(false), health: failing },
    ];
    const window = await readPromptWindow({ siteId: "s", weekStart: "2026-10-05" });
    expect(window.weeks.map((week) => week.weekStart)).toEqual(["2026-09-28"]);
    expect(window.weeks[0]?.samples.every((sample) => sample.named)).toBe(true);
    // A healthy re-measure of the same week stands in for the pass that failed.
    deepRows.push({ id: "d2", created_at: "2026-10-06T12:00:00Z", prompts: section(true), health: healthy });
    expect((await readPromptWindow({ siteId: "s", weekStart: "2026-10-05" })).weeks.map((week) => week.weekStart)).toEqual(["2026-09-28", "2026-10-05"]);
  });

  it("D58: one week of the current set shows the count and its sample, never a rate; two weeks show the rate", async () => {
    weekly.set("2026-10-05", { report: { prompts: section(false), verdict: { measuredAt: new Date("2026-10-05T04:00:00Z") } } });
    const one = assemblePrompts(await readPromptWindow({ siteId: "s", weekStart: "2026-10-05" }));
    expect(one).toMatchObject({ kind: "measured", rateShown: false, rate: { samples: 2, linked: 0, named: 0 } });
    weekly.set("2026-09-28", { report: { prompts: section(true), verdict: { measuredAt: new Date("2026-09-28T04:00:00Z") } } });
    expect(assemblePrompts(await readPromptWindow({ siteId: "s", weekStart: "2026-10-05" }))).toMatchObject({ rateShown: true, rate: { samples: 4 } });
  });

  it("D54: after a rebuild the rate starts again; a week that asked the old set is left out", async () => {
    const at = (day: string) => ({ measuredAt: new Date(`${day}T04:00:00Z`) });
    weekly.set("2026-09-28", { report: { prompts: section(true), verdict: at("2026-09-28") } });
    weekly.set("2026-10-05", { report: { prompts: { ...section(false), restartedAt: "2026-10-05T04:00:00.000Z" }, verdict: at("2026-10-05") } });
    weekly.set("2026-10-12", { report: { prompts: { ...section(false), restartedAt: "2026-10-05T04:00:00.000Z" }, verdict: at("2026-10-12") } });
    const window = await readPromptWindow({ siteId: "s", weekStart: "2026-10-12" });
    expect(window.weeks.map((week) => week.weekStart)).toEqual(["2026-10-05", "2026-10-12"]);
    expect(window.weeks.flatMap((week) => week.samples).some((sample) => sample.named)).toBe(false);
  });
});
