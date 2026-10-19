// BUILD §7 — depth, what a pass adds, and the one supply statement.
import "../env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AI_READER_AGENTS,
  PLAN_DEPTH,
  SUPPLY_SHORT_BELOW,
} from "../../../src/lib/config/constants";
import { measured } from "../../../src/lib/measure/measured";
import { setOpportunityStore } from "../../../src/lib/opportunities/store";
import { supplyDepth } from "../../../src/lib/opportunities/supply/depth";
import { supplyNotice } from "../../../src/lib/opportunities/supply/notice";
import { deriveForPass } from "../../../src/lib/opportunities/pass";
import { cappedCost, fakeCost } from "../cost";
import { memoryStore, newMemoryState, setStatus, type MemoryState } from "../memory-store";
import {
  AT,
  PROFILE,
  SCAN_ID,
  SITE_ID,
  defaultReport,
  question,
  reportOf,
  search,
  serp,
  smallCounts,
} from "../fixtures";

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: () => Promise.reject(new Error("no model in this suite")) };
  },
}));

let state: MemoryState;

beforeEach(() => {
  state = newMemoryState({ profile: PROFILE });
  setOpportunityStore(memoryStore(state));
});

afterEach(() => {
  setOpportunityStore(null);
});

const input = (over: Record<string, unknown> = {}) => ({
  siteId: SITE_ID,
  scanId: SCAN_ID,
  report: defaultReport(),
  ownRanked: measured(0, AT),
  rankedCounts: smallCounts(),
  ...over,
});

/** A report with `count` distinct qualifying Write targets, each written
 *  as a page that answers — a day of its own (issue 1549). */
function reportWith(count: number) {
  const questions = [];
  const serps = [];
  for (let n = 0; n < count; n++) {
    questions.push(
      question({
        id: `q${n}`,
        text: `Which onboarding software fits plan ${n}?`,
        search: search({ keyword: `onboarding software plan ${n}` }),
      })
    );
    serps.push(serp());
  }
  return reportOf({ questions, serps });
}

describe("§7: supply is counted in days of pages, and an instruction is not one", () => {
  it("a site holding only instructions has zero days of pages", async () => {
    const { ctx } = fakeCost();
    await deriveOnly(ctx, defaultReport({ blockedAgents: [AI_READER_AGENTS[0]!] }));
    expect(state.rows.filter((row) => row.family === "fix").length).toBeGreaterThan(0);

    // The one Write target is what makes this a real test of exclusion:
    // remove it and the count would be zero for the wrong reason.
    const onlyFix = state.rows.filter((row) => row.family !== "fix").map((row) => row.id);
    for (const id of onlyFix) setStatus(state, id, "dismissed", AT);

    expect(await supplyDepth(SITE_ID)).toEqual({ unused: 0, exhaustedSince: AT });
  });

  it("a queued page is no longer unused supply", async () => {
    const { ctx } = fakeCost();
    await deriveOnly(ctx, reportWith(3));
    expect((await supplyDepth(SITE_ID)).unused).toBe(3);

    setStatus(state, "opp-0001", "queued", new Date("2026-09-07T09:00:00.000Z"));
    expect((await supplyDepth(SITE_ID)).unused).toBe(2);
  });
});

describe("exhaustedSince is derived, and never stands while supply does", () => {
  it("it is null while any day of pages is left", async () => {
    const { ctx } = fakeCost();
    await deriveOnly(ctx, reportWith(2));
    expect((await supplyDepth(SITE_ID)).exhaustedSince).toBeNull();
  });

  it("it is the moment the last non-fix opportunity left open", async () => {
    const { ctx } = fakeCost();
    await deriveOnly(ctx, reportWith(2));
    const first = new Date("2026-09-07T09:00:00.000Z");
    const last = new Date("2026-09-09T09:00:00.000Z");
    setStatus(state, "opp-0001", "queued", first);
    setStatus(state, "opp-0002", "queued", last);
    expect((await supplyDepth(SITE_ID)).exhaustedSince).toEqual(last);
  });

  it("a site that has never held one falls back to its latest completed scan", async () => {
    const scannedAt = new Date("2026-09-01T06:00:00.000Z");
    state.latestScanAt = scannedAt;
    expect(await supplyDepth(SITE_ID)).toEqual({ unused: 0, exhaustedSince: scannedAt });
  });

  it("a site with neither answers null rather than inventing a date", async () => {
    expect(await supplyDepth(SITE_ID)).toEqual({ unused: 0, exhaustedSince: null });
  });
});

describe("ADR-061: exhausted supply is a proven arm, and there is at most one statement", () => {
  it("nothing left returns the exhausted notice, carrying the date it ran out", async () => {
    const { ctx } = fakeCost();
    await deriveOnly(ctx, reportWith(1));
    const ranOut = new Date("2026-09-08T09:00:00.000Z");
    setStatus(state, "opp-0001", "done", ranOut);

    expect(await supplyNotice({ siteId: SITE_ID })).toEqual({
      kind: "exhausted",
      days: 0,
      since: ranOut,
    });
  });

  it("the exhausted statement outranks the short one, and the arrival one", async () => {
    // At zero, a customer reads that supply ran out — not that it is
    // short, and not two lines.
    const notice = await supplyNotice({ siteId: SITE_ID, firstArrivalAfter: SCAN_ID });
    expect(notice).toEqual({ kind: "exhausted", days: 0, since: null });
  });

  it("a short month is one statement carrying the count", async () => {
    const { ctx } = fakeCost();
    await deriveOnly(ctx, reportWith(SUPPLY_SHORT_BELOW - 1));
    expect(await supplyNotice({ siteId: SITE_ID })).toEqual({
      kind: "short",
      days: SUPPLY_SHORT_BELOW - 1,
    });
  });

  it("an arrival into a short month reads the short line, not a second one", async () => {
    const { ctx } = fakeCost();
    await deriveOnly(ctx, reportWith(3));
    expect(await supplyNotice({ siteId: SITE_ID, firstArrivalAfter: SCAN_ID })).toEqual({
      kind: "short",
      days: 3,
    });
  });

  it("an arrival after a pass that fell short of a week and its spares is told once", async () => {
    const { ctx } = fakeCost();
    await deriveOnly(ctx, reportWith(SUPPLY_SHORT_BELOW));
    expect(await supplyNotice({ siteId: SITE_ID, firstArrivalAfter: SCAN_ID })).toEqual({
      kind: "arrival_shortfall",
      days: SUPPLY_SHORT_BELOW,
    });
    // And an ordinary read on the same day says nothing.
    expect(await supplyNotice({ siteId: SITE_ID })).toBeNull();
  });

  it("a full week and its spares says nothing, arrival or not", async () => {
    const { ctx } = fakeCost();
    await deriveOnly(ctx, reportWith(PLAN_DEPTH));
    expect(await supplyNotice({ siteId: SITE_ID })).toBeNull();
    expect(await supplyNotice({ siteId: SITE_ID, firstArrivalAfter: SCAN_ID })).toBeNull();
  });

  it("the short line stops on its own, with no job and no clearing step", async () => {
    const { ctx } = fakeCost();
    await deriveOnly(ctx, reportWith(SUPPLY_SHORT_BELOW - 1));
    expect(await supplyNotice({ siteId: SITE_ID })).not.toBeNull();

    await pass(ctx, reportWith(SUPPLY_SHORT_BELOW + 4));
    expect(await supplyNotice({ siteId: SITE_ID })).toBeNull();
  });

  it("a repeated read while supply stays at zero returns the same date", async () => {
    const { ctx } = fakeCost();
    await deriveOnly(ctx, reportWith(1));
    const ranOut = new Date("2026-09-08T09:00:00.000Z");
    setStatus(state, "opp-0001", "done", ranOut);

    const first = await supplyNotice({ siteId: SITE_ID });
    const second = await supplyNotice({ siteId: SITE_ID });
    expect(second).toEqual(first);
  });

  it("it is one value and never a list", async () => {
    const notice = await supplyNotice({ siteId: SITE_ID });
    expect(Array.isArray(notice)).toBe(false);
  });
});

describe("§7: a pass buys nothing beyond its judgements and pads no day", () => {
  it("the only spend is the fit, typing and same-question calls — no SERP, no ranked rows", async () => {
    const { ctx, sources } = fakeCost();
    const result = await pass(ctx, reportWith(6), "deep");
    expect(result.unused).toBe(6);
    expect(new Set(sources)).toEqual(new Set(["topic-fit", "opportunity-typing", "topic-same-question"]));
  });

  it("a report with less evidence than a week and its spares writes what it has and does not throw", async () => {
    const { ctx } = fakeCost();
    expect(await pass(ctx, reportWith(4), "deep")).toEqual({ tier: "deep", added: 4, unused: 4 });
  });

  it("the count stops at the one depth number, a week and its spares", async () => {
    const { ctx } = fakeCost();
    const result = await pass(ctx, reportWith(PLAN_DEPTH + 2), "deep");
    expect(result.unused).toBe(PLAN_DEPTH);
  });

  it("a cap already spent derives nothing", async () => {
    const { ctx } = cappedCost();
    expect(await pass(ctx, reportWith(6), "deep")).toEqual({ tier: "deep", added: 0, unused: 0 });
    expect(state.rows).toEqual([]);
  });

  it("a short pass is a disclosure, never a gate — nothing here throws", async () => {
    const { ctx } = fakeCost();
    await expect(pass(ctx, reportWith(0), "deep")).resolves.toEqual({ tier: "deep", added: 0, unused: 0 });
  });
});

describe("§11's weekly pass is additive and idempotent", () => {
  it("a week that finds three new targets adds three", async () => {
    const { ctx } = fakeCost();
    await deriveOnly(ctx, reportWith(2));
    const result = await pass(ctx, reportWith(5));
    expect(result.added).toBe(3);
    expect(result.unused).toBe(5);
  });

  it("running the same pass twice adds nothing the second time", async () => {
    const { ctx } = fakeCost();
    const week = reportWith(4);
    const first = await pass(ctx, week);
    const second = await pass(ctx, week);
    expect(first.added).toBe(4);
    expect(second.added).toBe(0);
    expect(second.unused).toBe(first.unused);
  });

  it("it dismisses nothing that was already there", async () => {
    const { ctx } = fakeCost();
    await deriveOnly(ctx, reportWith(3));
    await pass(ctx, reportWith(3));
    expect(state.rows.every((row) => row.status === "open")).toBe(true);
  });

  it("a site without active access derives nothing", async () => {
    const { ctx, sources } = fakeCost();
    const result = await pass(ctx, reportWith(5), "weekly", false);
    expect(result).toEqual({ tier: "weekly", added: 0, unused: 0 });
    expect(state.rows).toEqual([]);
    expect(sources).toEqual([]);
  });
});

/** One pass over `report` (`deriveForPass`), its rivals sized as
 *  `smallCounts` sizes them. */
function pass(
  ctx: Parameters<typeof deriveForPass>[0],
  report: ReturnType<typeof defaultReport>,
  tier: "deep" | "weekly" = "weekly",
  hasActiveAccess = true
) {
  const rivalSizes = measured(
    [...smallCounts().keys()].map((domain) => ({ domain, state: "sized" as const, rankedCount: 40, band: "near" as const, at: AT, current: true })),
    AT
  );
  return deriveForPass(ctx, { tier, siteId: SITE_ID, report: { ...report, rivalSizes }, hasActiveAccess });
}

/** Derives without going through a pass, so a suite can set supply up
 *  without asserting on the pass's own return. */
async function deriveOnly(
  ctx: Parameters<typeof deriveForPass>[0],
  report: ReturnType<typeof defaultReport>
): Promise<void> {
  const { deriveOpportunities } = await import("../../../src/lib/opportunities/derive");
  await deriveOpportunities(ctx, input({ report }) as never);
  // SPEC §6: depth counts ready rows, so the rows get their answer.
  const { assessReadiness } = await import("../../../src/lib/opportunities/readiness");
  await assessReadiness(SITE_ID, { at: AT });
}
