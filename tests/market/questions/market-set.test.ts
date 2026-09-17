// tests/market/questions/market-set.test.ts — BUILD §6.7 step 2, issue #26
// (WO-072's `## Test plan`, criteria quoted from the archived REQ-006).
//
// No network: `@/lib/vendors/dataforseo` is mocked whole, so neither the
// transport nor `env` is ever loaded and `tests/setup.ts`'s refusal never has
// to fire. The `CostContext` double's `recordFetch` throws — `deriveMarketSet`
// must reach the vendor through `keywordSuggestions()` and nowhere else.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VENDOR } from "../../../src/lib/config/constants.ts";
import type { CostContext } from "../../../src/lib/costs/index.ts";
import type { Measured } from "../../../src/lib/measure/measured.ts";
import type { SuggestionRow } from "../../../src/lib/market/questions/market-set.ts";

const { suggestionsMock } = vi.hoisted(() => ({ suggestionsMock: vi.fn() }));
vi.mock("@/lib/vendors/dataforseo", () => ({ keywordSuggestions: suggestionsMock }));

let deriveMarketSet: typeof import("../../../src/lib/market/questions/market-set.ts").deriveMarketSet;

beforeEach(async () => {
  suggestionsMock.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  ({ deriveMarketSet } = await import("../../../src/lib/market/questions/market-set.ts"));
});

const AT = new Date("2026-09-05T00:00:00.000Z");

interface VendorRow {
  keyword: string;
  searchVolume: number;
}

function vendorRows(...rows: [string, number][]): Measured<VendorRow[]> {
  return { kind: "measured", at: AT, value: rows.map(([keyword, searchVolume]) => ({ keyword, searchVolume })) };
}

function fakeCostContext(): CostContext {
  return {
    cap: "FREE",
    async recordFetch() {
      throw new Error("deriveMarketSet must call keywordSuggestions(), not CostContext.recordFetch directly");
    },
    capHit: () => false,
    spentCents: () => 0,
    degraded: () => false,
  };
}

describe("deriveMarketSet — the vendor's rows, and only the vendor's rows", () => {
  it("deriveMarketSet/returns-exactly-what-was-returned — a stub returning 7 rows produces 7 rows in vendor order, with no synthesised row", async () => {
    suggestionsMock.mockResolvedValueOnce(
      vendorRows(
        ["user onboarding software", 2400],
        ["onboarding tool", 1900],
        ["product tours", 880],
        ["in app guidance", 720],
        ["user onboarding checklist", 590],
        ["saas onboarding", 480],
        ["onboarding platform", 320]
      )
    );

    const result = await deriveMarketSet(fakeCostContext(), { seeds: ["user onboarding"], ownRanked: 0 });

    expect(result.kind).toBe("measured");
    const rows = (result as { value: SuggestionRow[] }).value;
    expect(rows).toHaveLength(7);
    expect(rows.map((r) => r.keyword)).toEqual([
      "user onboarding software",
      "onboarding tool",
      "product tours",
      "in app guidance",
      "user onboarding checklist",
      "saas onboarding",
      "onboarding platform",
    ]);
    expect(rows[0]).toEqual({ keyword: "user onboarding software", volume: 2400 });
  });

  it("buys through keywordSuggestions() at the pinned row count, one seed at a time, with the caller's own CostContext", async () => {
    suggestionsMock.mockResolvedValue(vendorRows(["a", 100]));
    const c = fakeCostContext();

    await deriveMarketSet(c, { seeds: ["seed one", "seed two"], ownRanked: 0 });

    expect(suggestionsMock).toHaveBeenCalledTimes(2);
    const volume = { min: 10, max: 300, maxDifficulty: 30 };
    expect(suggestionsMock.mock.calls[0]).toEqual([c, { seed: "seed one", rows: VENDOR.suggestionsRows, volume }]);
    expect(suggestionsMock.mock.calls[1]).toEqual([c, { seed: "seed two", rows: VENDOR.suggestionsRows, volume }]);
  });

  it("applies no floor, no filter and no ranking — a 1/mo row and an own-brand row both survive this step", async () => {
    suggestionsMock.mockResolvedValueOnce(vendorRows(["acme pricing", 1], ["onboarding software", 2400]));

    const result = await deriveMarketSet(fakeCostContext(), { seeds: ["acme"], ownRanked: 0 });

    expect((result as { value: SuggestionRow[] }).value).toEqual([
      { keyword: "acme pricing", volume: 1 },
      { keyword: "onboarding software", volume: 2400 },
    ]);
  });
});

describe("deriveMarketSet — every purchase asks for the site's right-sizing window (issue 846)", () => {
  it("a site ranking for 848 buys between the lowest volume step and its demand ceiling, 10 to 8480/mo", async () => {
    suggestionsMock.mockResolvedValue(vendorRows(["a", 100]));

    await deriveMarketSet(fakeCostContext(), { seeds: ["project management software", "project management"], ownRanked: 848 });

    for (const call of suggestionsMock.mock.calls) expect(call[1]).toMatchObject({ volume: { min: 10, max: 8480 } });
  });
});

describe("deriveMarketSet — the cold-start law: an empty market is a measurement", () => {
  it("deriveMarketSet/empty-market-is-zero-not-error — a vendor zero yields zero with [], mints no placeholder row and throws nothing", async () => {
    suggestionsMock.mockResolvedValueOnce({ kind: "zero", at: AT, value: [] });

    const result = await deriveMarketSet(fakeCostContext(), { seeds: ["a market nobody searches"], ownRanked: 0 });

    expect(result).toEqual({ kind: "zero", at: AT, value: [] });
  });

  it("no seeds spends nothing and returns zero — a domain with no vocabulary still completes the step", async () => {
    const result = await deriveMarketSet(fakeCostContext(), { seeds: [], ownRanked: 0 });

    expect(suggestionsMock).not.toHaveBeenCalled();
    expect(result.kind).toBe("zero");
    expect((result as { value: SuggestionRow[] }).value).toEqual([]);
  });
});

describe("deriveMarketSet — the fold across seeds", () => {
  it("any measured arm makes the whole set measured, and the failed seed contributes no row", async () => {
    suggestionsMock
      .mockResolvedValueOnce({ kind: "unmeasured", at: AT, reason: "undeterminable" })
      .mockResolvedValueOnce(vendorRows(["onboarding tool", 1900]));

    const result = await deriveMarketSet(fakeCostContext(), { seeds: ["dead seed", "live seed"], ownRanked: 0 });

    expect(result.kind).toBe("measured");
    expect((result as { value: SuggestionRow[] }).value).toEqual([{ keyword: "onboarding tool", volume: 1900 }]);
  });

  it("every seed unmeasured is unmeasured — never zero, which would claim an empty market was measured", async () => {
    suggestionsMock
      .mockResolvedValueOnce({ kind: "unmeasured", at: AT, reason: "not_attempted" })
      .mockResolvedValueOnce({ kind: "unmeasured", at: AT, reason: "undeterminable" });

    const result = await deriveMarketSet(fakeCostContext(), { seeds: ["one", "two"], ownRanked: 0 });

    // BP-024 decision 3: `undeterminable` outranks `not_attempted`.
    expect(result).toEqual({ kind: "unmeasured", at: AT, reason: "undeterminable" });
  });

  it("a zero seed beside a failed seed is unmeasured, not zero", async () => {
    suggestionsMock
      .mockResolvedValueOnce({ kind: "zero", at: AT, value: [] })
      .mockResolvedValueOnce({ kind: "unmeasured", at: AT, reason: "undeterminable" });

    const result = await deriveMarketSet(fakeCostContext(), { seeds: ["one", "two"], ownRanked: 0 });

    expect(result.kind).toBe("unmeasured");
  });

  it("deriveMarketSet/exact-duplicate-collapsed-once — a keyword two seeds both return appears once, at its first occurrence", async () => {
    suggestionsMock
      .mockResolvedValueOnce(vendorRows(["onboarding tool", 1900], ["product tours", 880]))
      .mockResolvedValueOnce(vendorRows(["onboarding tool", 1750], ["user onboarding", 2400]));

    const result = await deriveMarketSet(fakeCostContext(), { seeds: ["one", "two"], ownRanked: 0 });

    const rows = (result as { value: SuggestionRow[] }).value;
    expect(rows).toEqual([
      { keyword: "onboarding tool", volume: 1900 },
      { keyword: "product tours", volume: 880 },
      { keyword: "user onboarding", volume: 2400 },
    ]);
  });

  it("deriveMarketSet/multi-seed-order-stable — two seeds produce an identical row order on every run", async () => {
    const runs: string[][] = [];
    for (let run = 0; run < 3; run++) {
      suggestionsMock.mockReset();
      suggestionsMock
        .mockResolvedValueOnce(vendorRows(["b", 100], ["a", 900]))
        .mockResolvedValueOnce(vendorRows(["c", 500], ["a", 900]));
      const result = await deriveMarketSet(fakeCostContext(), { seeds: ["one", "two"], ownRanked: 0 });
      runs.push((result as { value: SuggestionRow[] }).value.map((r) => r.keyword));
    }

    expect(runs[0]).toEqual(["b", "a", "c"]);
    expect(runs[1]).toEqual(runs[0]);
    expect(runs[2]).toEqual(runs[0]);
  });
});

describe("deriveMarketSet — observability (BP-025 `## NFR budget`: suggestion row count)", () => {
  it("logs the row count and the arm, and never a keyword", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    suggestionsMock.mockResolvedValueOnce(vendorRows(["MARKET-KEYWORD-MARKER-7f31", 900]));

    await deriveMarketSet(fakeCostContext(), { seeds: ["seed"], ownRanked: 0 });

    const logged = JSON.parse(logSpy.mock.calls.at(-1)![0] as string) as Record<string, unknown>;
    expect(logged.event).toBe("market_set");
    expect(logged.rows).toBe(1);
    expect(logged.kind).toBe("measured");
    expect(JSON.stringify(logged)).not.toContain("MARKET-KEYWORD-MARKER-7f31");
  });
});
