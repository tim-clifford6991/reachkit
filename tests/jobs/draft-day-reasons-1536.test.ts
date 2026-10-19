// Issue 1536: each way a due hour ends without a page keeps why, through the
// real tick and engine seam (the day's page doubled at `generateDayPage`).
import { describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";
import type { DayPageOutcome } from "@/lib/generate";

applyEnvFixture();
const { generateDayPage, recordDraftDay } = vi.hoisted(() => ({ generateDayPage: vi.fn(), recordDraftDay: vi.fn() }));
vi.mock("@/lib/account/billing", () => ({ ensureActiveAccessGate: async () => {} }));
vi.mock("@/lib/publish/daily", () => ({
  sitesForDailyTick: async () => ({ sites: [{ siteId: "s1", timeZone: "UTC", publishTime: "18:00", vetoHours: 24 }], held: null }),
  recordDraftDay,
  alertMissingDrafts: async () => 0,
  alertStalledSites: async () => 0,
}));
vi.mock("@/lib/publish/destinations/health", () => ({ sendBreakageMail: async () => ({ sent: false }) }));
vi.mock("@/lib/generate", () => ({ generateDayPage, restartedDrafts: async () => [] }));
const { draftGenerate } = await import("@/jobs/draft-generate");

describe("issue 1536: no due hour ends without a page silently", () => {
  it("each no-draft path is kept under its date, naming the step and what a short pack lacked", async () => {
    const paths: [DayPageOutcome | Error, string, string][] = [
      [{ ok: false, because: "no_opportunity" }, "no_page", "generate:no_opportunity"],
      [{ ok: false, because: "no_scan" }, "no_page", "generate:no_scan"],
      [{ ok: false, because: "rules", draftId: "d1", attempts: 2 }, "no_page", "generate:rules"],
      [{ ok: false, because: "step_failed", draftId: null, step: "pack:buyer_questions" }, "no_page", "generate:step_failed:pack:buyer_questions"],
      [{ ok: false, because: "step_failed", draftId: "d2", step: "write" }, "no_page", "generate:step_failed:write"],
      [new TypeError("boom"), "failed", "TypeError"],
    ];
    const at = new Date("2026-09-07T18:00:00.000Z");
    for (const [result, outcome, reason] of paths) {
      recordDraftDay.mockReset();
      if (result instanceof Error) generateDayPage.mockRejectedValueOnce(result);
      else generateDayPage.mockResolvedValueOnce(result);
      await draftGenerate.run({ data: {}, now: at }).catch(() => undefined);
      expect(recordDraftDay.mock.calls).toEqual([[{ siteId: "s1", publishDate: "2026-09-08", outcome, reason, at }]]);
    }
  });
});
