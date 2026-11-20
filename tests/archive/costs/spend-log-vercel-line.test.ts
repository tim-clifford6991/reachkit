// Archived: it pinned the Active CPU month line's wording, which now counts the days read.
import { describe, expect, it } from "vitest";
import { reconcile, render, type Snapshot } from "../../../scripts/costs/report";

describe("npm run costs — Vercel Active CPU", () => {
  const at = new Date("2026-11-10T12:00:00.000Z");
  const vercel: Snapshot = {
    at: "2026-11-10T11:00:02.000Z",
    vercel: {
      days: { "2026-11-07": { cpuSeconds: 1440, projectCpuSeconds: 1440 }, "2026-11-08": { cpuSeconds: 900, projectCpuSeconds: 720 }, "2026-11-09": { cpuSeconds: 720, projectCpuSeconds: 540 } },
      month: "2026-11",
      monthToDate: { cpuSeconds: 7200, projectCpuSeconds: 6480 },
      sitesOnAutopilot: 4,
      cpuSecondsPerSite: 135,
    },
  };

  it("prints yesterday, the 7-day mean, the month against the budget, reachkit's share and per site", () => {
    const text = render(reconcile({ spend: [], ledger: [], snapshots: [vercel], adminKey: true, now: at }));
    expect(text).toContain("Yesterday (2026-11-09): 0.20 CPU-hours; reachkit 0.15 CPU-hours (75%)");
    expect(text).toContain("7-day mean: 0.28 CPU-hours a day (3 of 7 days measured)");
    expect(text).toContain("Month to date (2026-11): 2.00 CPU-hours of the 4 CPU-hour budget (50%); reachkit 1.80 CPU-hours (90%)");
    expect(text).toContain("Per site yesterday: 135.0 CPU-seconds across 4 sites on autopilot");
  });
});
