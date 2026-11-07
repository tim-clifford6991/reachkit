// Issue 1536: each way a due hour ends without a page keeps why, through the
// real tick and engine seam (the day's page doubled at `generateDayPage`).
import { describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";
import type { DayPageOutcome } from "@/lib/generate";

applyEnvFixture();
const { generateDayPage, recordDraftDay, decideDayPage, refreshForDay, dayHold, enterReview, publishDueAt } = vi.hoisted(() => ({
  generateDayPage: vi.fn(),
  recordDraftDay: vi.fn(),
  decideDayPage: vi.fn(async () => ({ ok: true, opportunityId: "o1" }) as unknown),
  refreshForDay: vi.fn(async () => null as unknown),
  dayHold: vi.fn(async () => null as string | null),
  enterReview: vi.fn(async () => ({ kind: "told" }) as unknown),
  publishDueAt: vi.fn(async () => null),
}));
vi.mock("@/lib/account/billing", () => ({ ensureActiveAccessGate: async () => {} }));
vi.mock("@/lib/publish/daily", () => ({
  sitesForDailyTick: async () => ({ sites: [{ siteId: "s1", timeZone: "UTC", publishTime: "18:00", vetoHours: 24 }], held: null }),
  recordDraftDay,
  alertSiteDay: async () => 0,
  missedDays: async () => [],
  dayHold,
}));
vi.mock("@/lib/publish/attempt/window", () => ({ enterReview, publishDueAt }));
vi.mock("@/lib/publish/destinations/health", () => ({ sendBreakageMail: async () => ({ sent: false }) }));
vi.mock("@/lib/generate/recheck", () => ({ recheckStopped: async () => null }));
vi.mock("@/lib/generate", () => ({
  decideDayPage,
  generateDayPage,
  refreshForDay,
  restartedDrafts: async () => [],
}));
const { draftGenerate } = await import("@/jobs/draft-generate");

describe("issue 1536: no due hour ends without a page silently", () => {
  it("each no-draft path is kept under its date, naming the step and what a short pack lacked", async () => {
    const paths: [DayPageOutcome | Error, string, string][] = [
      [{ ok: false, because: "no_opportunity" }, "no_page", "generate:no_opportunity"],
      [{ ok: false, because: "no_scan" }, "no_page", "generate:no_scan"],
      [{ ok: false, because: "rules", draftId: "d1", attempts: 2 }, "no_page", "generate:rules"],
      // Issue 2341: a page the budget or the clock left without its fix call is not a rules day.
      [{ ok: false, because: "rules", draftId: "d3", attempts: 1, stop: "budget" }, "no_page", "generate:budget"],
      [{ ok: false, because: "rules", draftId: "d4", attempts: 1, stop: "time" }, "no_page", "generate:time"],
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

describe("issue 2388: a day without a passing page of its own takes a committed update, in the same run", () => {
  const at = new Date("2026-09-07T18:00:00.000Z");
  const day = async () => {
    const steps: string[] = [];
    recordDraftDay.mockReset();
    // As the platform memoizes a step: its answer is what JSON keeps of it.
    const step = async <T,>(name: string, body: () => Promise<T>): Promise<T> => (steps.push(name), JSON.parse(JSON.stringify((await body()) ?? null)) as T);
    await draftGenerate.perSubject!({ data: { key: "draft:s1:2026-09-08", siteId: "s1", publishDate: "2026-09-08", hour: at.toISOString(), timeZone: "UTC", publishTime: "18:00", vetoHours: 24 }, now: at, step }).catch(() => undefined);
    return { steps: steps.filter((name) => name !== "notice" && name !== "alert"), day: recordDraftDay.mock.calls[0]?.[0] as { outcome: string; reason: string | null } };
  };
  const written = (result: DayPageOutcome | Error) => (result instanceof Error ? generateDayPage.mockRejectedValueOnce(result) : generateDayPage.mockResolvedValueOnce(result));

  it.each<[string, DayPageOutcome | null, DayPageOutcome | null, { trigger: string; from: string; stopped: string | null }]>([
    ["select", { ok: false, because: "no_opportunity" }, null, { trigger: "generate:no_opportunity", from: "select", stopped: null }],
    ["write", null, { ok: false, because: "no_opportunity" }, { trigger: "generate:no_opportunity", from: "write", stopped: null }],
    ["write", null, { ok: false, because: "rules", draftId: "d1", attempts: 2 }, { trigger: "generate:rules", from: "write", stopped: "d1" }],
    ["write", null, { ok: false, because: "rules", draftId: "d3", attempts: 1, stop: "budget" }, { trigger: "generate:budget", from: "write", stopped: "d3" }],
    ["write", null, { ok: false, because: "rules", draftId: "d4", attempts: 1, stop: "time" }, { trigger: "generate:time", from: "write", stopped: "d4" }],
    ["write", null, { ok: false, because: "vendor_funds" }, { trigger: "generate:vendor_funds", from: "write", stopped: null }],
    ["write", null, { ok: false, because: "step_failed", draftId: "d2", step: "write" }, { trigger: "generate:step_failed:write", from: "write", stopped: "d2" }],
  ])("a %s day ending %j / %j asks the committed week, naming why, where it ended and the row holding the date", async (_from, decided, page, input) => {
    if (decided !== null) decideDayPage.mockResolvedValueOnce(decided);
    if (page !== null) written(page);
    refreshForDay.mockClear();
    const { day: kept } = await day();
    expect(refreshForDay.mock.calls).toEqual([[{ siteId: "s1", publishDate: "2026-09-08", ...input, now: at }]]);
    expect(kept).toMatchObject({ outcome: "no_page", reason: input.trigger });
  });

  it.each<[string, () => void]>([
    ["a hold", () => dayHold.mockResolvedValueOnce("hold:address")],
    ["no site", () => decideDayPage.mockResolvedValueOnce({ ok: false, because: "no_site" })],
    ["no scan", () => decideDayPage.mockResolvedValueOnce({ ok: false, because: "no_scan" })],
    ["a date already drafted", () => decideDayPage.mockResolvedValueOnce({ ok: false, because: "already_drafted" })],
    ["a page that passed", () => written({ ok: true, draftId: "d5" })],
    ["a page held from review", () => (written({ ok: true, draftId: "d5" }), enterReview.mockResolvedValueOnce({ kind: "not_entered", reason: "no_destination" }))],
    ["a page not told", () => (written({ ok: true, draftId: "d5" }), enterReview.mockResolvedValueOnce({ kind: "untold", reason: "mail" }))],
    ["a throw", () => written(new TypeError("boom"))],
  ])("%s takes no update", async (_name, arrange) => {
    arrange();
    refreshForDay.mockClear();
    await day();
    expect(refreshForDay).not.toHaveBeenCalled();
  });

  it("the update the week gave is the day's page: in review, scheduled, and recorded as what it stands in for", async () => {
    decideDayPage.mockResolvedValueOnce({ ok: false, because: "no_opportunity" });
    refreshForDay.mockResolvedValueOnce({ ok: true, draftId: "d9" });
    publishDueAt.mockClear();
    const { steps, day: kept } = await day();
    expect(steps).toEqual(["hold", "recheck", "select", "refresh", "refresh-review"]);
    expect(enterReview).toHaveBeenLastCalledWith({ draftId: "d9", at });
    expect(publishDueAt).toHaveBeenCalledWith("d9");
    expect(kept).toMatchObject({ outcome: "drafted", reason: "refresh:generate:no_opportunity" });
  });

  it("after a stopped page, the update's steps follow the day's own, whose names and order stay", async () => {
    written({ ok: false, because: "rules", draftId: "d1", attempts: 2 });
    refreshForDay.mockResolvedValueOnce({ ok: true, draftId: "d9" });
    const { steps, day: kept } = await day();
    expect(steps).toEqual(["hold", "recheck", "select", "write", "review", "refresh", "refresh-review"]);
    expect(kept).toMatchObject({ outcome: "drafted", reason: "refresh:generate:rules" });
  });

  it("a date another delivery took while the update was read is a day done", async () => {
    decideDayPage.mockResolvedValueOnce({ ok: false, because: "no_opportunity" });
    refreshForDay.mockResolvedValueOnce({ ok: false, because: "already_drafted" });
    const { steps, day: kept } = await day();
    expect(steps).toEqual(["hold", "recheck", "select", "refresh"]);
    expect(kept).toMatchObject({ outcome: "drafted", reason: null });
  });

  it("a select whose ladder below the update ends without a page keeps the ladder's reason, never a bare no_opportunity", async () => {
    decideDayPage.mockResolvedValueOnce({ ok: false, because: "no_opportunity" });
    refreshForDay.mockResolvedValueOnce({ ok: false, because: "no_own_facts", step: "pack:facts_on_topic" });
    const { day: kept } = await day();
    expect(kept).toMatchObject({ outcome: "no_page", reason: "generate:no_own_facts:pack:facts_on_topic" });
  });
});
