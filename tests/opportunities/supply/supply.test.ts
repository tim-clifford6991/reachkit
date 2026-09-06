// BUILD §7 — depth, the weekly top-up, and the one supply statement.
import "../env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AI_READER_AGENTS,
  SUPPLY_SHORT_BELOW,
  SUPPLY_TARGET_DEPTH,
} from "../../../src/lib/config/constants";
import { measured } from "../../../src/lib/measure/measured";
import { setOpportunityStore } from "../../../src/lib/opportunities/store";
import { supplyDepth } from "../../../src/lib/opportunities/supply/depth";
import { supplyNotice } from "../../../src/lib/opportunities/supply/notice";
import { pursueDepth } from "../../../src/lib/opportunities/supply/pursue";
import { topUp } from "../../../src/lib/opportunities/supply/topup";
import { cappedCost, fakeCost } from "../cost";
import { memoryStore, newMemoryState, setStatus, type MemoryState } from "../memory-store";
import {
  AT,
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
  state = newMemoryState();
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

/** A report with `count` distinct qualifying Write targets. */
function reportWith(count: number) {
  const questions = [];
  const serps = [];
  for (let n = 0; n < count; n++) {
    questions.push(
      question({
        id: `q${n}`,
        text: `What is the best onboarding tool number ${n}?`,
        search: search({ keyword: `best onboarding tool ${n}` }),
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

  it("an arrival after a pass that fell short of a month is told once", async () => {
    const { ctx } = fakeCost();
    await deriveOnly(ctx, reportWith(SUPPLY_SHORT_BELOW));
    expect(await supplyNotice({ siteId: SITE_ID, firstArrivalAfter: SCAN_ID })).toEqual({
      kind: "arrival_shortfall",
      days: SUPPLY_SHORT_BELOW,
    });
    // And an ordinary read on the same day says nothing.
    expect(await supplyNotice({ siteId: SITE_ID })).toBeNull();
  });

  it("a full month says nothing, arrival or not", async () => {
    const { ctx } = fakeCost();
    await deriveOnly(ctx, reportWith(SUPPLY_TARGET_DEPTH));
    expect(await supplyNotice({ siteId: SITE_ID })).toBeNull();
    expect(await supplyNotice({ siteId: SITE_ID, firstArrivalAfter: SCAN_ID })).toBeNull();
  });

  it("the short line stops on its own, with no job and no clearing step", async () => {
    const { ctx } = fakeCost();
    await deriveOnly(ctx, reportWith(SUPPLY_SHORT_BELOW - 1));
    expect(await supplyNotice({ siteId: SITE_ID })).not.toBeNull();

    await topUp(ctx, { ...input({ report: reportWith(SUPPLY_SHORT_BELOW + 4) }), hasActiveAccess: true });
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

describe("§7: pursuing depth buys nothing and never fills a day", () => {
  it("a report with enough evidence stops at target_met", async () => {
    const { ctx, sources } = fakeCost();
    const result = await pursueDepth(ctx, {
      ...input({ report: reportWith(6) }),
      target: 5,
    });
    expect(result.stop).toBe("target_met");
    expect(result.unused).toBeGreaterThanOrEqual(5);
    // The only spend is the typing call site — no SERP, no ranked rows.
    expect(new Set(sources)).toEqual(new Set(["opportunity-typing"]));
  });

  it("a report with less evidence than a month stops at evidence_spent and does not throw", async () => {
    const { ctx } = fakeCost();
    const result = await pursueDepth(ctx, input({ report: reportWith(4) }));
    expect(result).toEqual({ unused: 4, stop: "evidence_spent", created: 4 });
  });

  it("the target defaults to the pinned month, not a literal", async () => {
    const { ctx } = fakeCost();
    const result = await pursueDepth(ctx, input({ report: reportWith(SUPPLY_TARGET_DEPTH) }));
    expect(result.unused).toBe(SUPPLY_TARGET_DEPTH);
    expect(result.stop).toBe("target_met");
  });

  it("a cap already spent stops the pass early and derives nothing", async () => {
    const { ctx } = cappedCost();
    const result = await pursueDepth(ctx, input({ report: reportWith(6) }));
    expect(result).toEqual({ unused: 0, stop: "pass_ended_early", created: 0 });
    expect(state.rows).toEqual([]);
  });

  it("a short pass is a disclosure, never a gate — nothing here throws", async () => {
    const { ctx } = fakeCost();
    await expect(pursueDepth(ctx, input({ report: reportWith(0) }))).resolves.toEqual({
      unused: 0,
      stop: "evidence_spent",
      created: 0,
    });
  });
});

describe("§11's weekly top-up is additive and idempotent", () => {
  it("a week that finds three new targets adds three", async () => {
    const { ctx } = fakeCost();
    await deriveOnly(ctx, reportWith(2));
    const result = await topUp(ctx, {
      ...input({ report: reportWith(5) }),
      hasActiveAccess: true,
    });
    expect(result.added).toBe(3);
    expect(result.unused).toBe(5);
  });

  it("running the same top-up twice adds nothing the second time", async () => {
    const { ctx } = fakeCost();
    const week = reportWith(4);
    const first = await topUp(ctx, { ...input({ report: week }), hasActiveAccess: true });
    const second = await topUp(ctx, { ...input({ report: week }), hasActiveAccess: true });
    expect(first.added).toBe(4);
    expect(second.added).toBe(0);
    expect(second.unused).toBe(first.unused);
  });

  it("it dismisses nothing that was already there", async () => {
    const { ctx } = fakeCost();
    await deriveOnly(ctx, reportWith(3));
    await topUp(ctx, { ...input({ report: reportWith(3) }), hasActiveAccess: true });
    expect(state.rows.every((row) => row.status === "open")).toBe(true);
  });

  it("a site without active access derives nothing", async () => {
    const { ctx, sources } = fakeCost();
    const result = await topUp(ctx, {
      ...input({ report: reportWith(5) }),
      hasActiveAccess: false,
    });
    expect(result).toEqual({ added: 0, unused: 0 });
    expect(state.rows).toEqual([]);
    expect(sources).toEqual([]);
  });
});

/** Derives without going through `pursueDepth`, so a suite can set supply
 *  up without asserting on the pursuit's own return. */
async function deriveOnly(
  ctx: Parameters<typeof pursueDepth>[0],
  report: ReturnType<typeof defaultReport>
): Promise<void> {
  const { deriveOpportunities } = await import("../../../src/lib/opportunities/derive");
  await deriveOpportunities(ctx, input({ report }) as never);
}
