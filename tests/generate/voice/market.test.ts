// tests/generate/voice/market.test.ts — SPEC §7 (2026-10-04, issue 1248):
// a page is written for the site's market in force (`sites.market`), and
// the stored report's category stands in only where none is stored.
//
// The first case reads reachkit.app's own stored rows, frozen for round 2
// (`scripts/eval-content/snapshot/reachkit.app.round-2.json`): a report
// bought under one category and a `sites.market` that has since moved.
import "../env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));

const { parseStoredMarket } = await import("../../../src/lib/market/infer/stored");
const { writingMarket } = await import("../../../src/lib/generate/voice/market");

const FROZEN = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../../scripts/eval-content/snapshot/reachkit.app.round-2.json"), "utf8")
) as { market: unknown; report: { market: { value: { profile: { category: string } } } } };
const REPORT_CATEGORY = FROZEN.report.market.value.profile.category;

function site(over: { category?: string | null; competitors?: string[]; market?: unknown } = {}) {
  return {
    category: over.category ?? null,
    competitors: over.competitors ?? [],
    stored: parseStoredMarket("market" in over ? over.market : FROZEN.market),
  };
}

beforeEach(() => {
  llmMock.mockReset();
  llmMock.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: new Date() });
});

describe("the market a page is written for", () => {
  it("is the site's current market, not the category its stored report was bought under", () => {
    const stored = parseStoredMarket(FROZEN.market);
    const writing = writingMarket({ site: site({ competitors: ["aeoengine.ai", "peec.ai"] }), reportCategory: REPORT_CATEGORY });

    expect(REPORT_CATEGORY).not.toBe(stored.current!.category);
    expect(writing.from).toBe("site");
    expect(writing.category).toBe(stored.current!.category);
    expect(writing.market).toMatchObject({
      category: stored.current!.category,
      buyer: stored.current!.buyer,
      job: stored.current!.job,
      notOurMarket: stored.current!.notOurMarket,
    });
    // The category's other names ride beside it, for the news search (D48).
    expect(writing.synonyms).toEqual(stored.current!.synonyms);
    expect(writing.synonyms.length).toBeGreaterThan(0);
    // This site's founder chose the rivals: theirs stand, named where the
    // conclusion knows the name.
    expect(stored.rivalsOverridden).toBe(true);
    expect(writing.market!.rivals).toEqual([
      { name: "AEO Engine", domain: "aeoengine.ai" },
      { name: "peec.ai", domain: "peec.ai" },
    ]);
  });

  it("is the report's category only where no market is stored, or the read failed", () => {
    const none = { from: "report", category: REPORT_CATEGORY, synonyms: [], unsearched: [], concluded: [], market: null };
    expect(writingMarket({ site: site({ market: null }), reportCategory: REPORT_CATEGORY })).toEqual(none);
    expect(writingMarket({ site: null, reportCategory: REPORT_CATEGORY })).toEqual(none);
  });

  it("keeps a category the founder set over the one ReachKit concluded", () => {
    const market = { ...(FROZEN.market as object), categoryOverridden: true, rivalsOverridden: false };
    const writing = writingMarket({ site: site({ category: "answer engine optimization", market }), reportCategory: REPORT_CATEGORY });
    expect(writing.category).toBe("answer engine optimization");
    expect(writing.market!.category).toBe("answer engine optimization");
    expect(writing.market!.rivals.map((rival) => rival.domain)).toEqual(
      parseStoredMarket(market).current!.rivals.map((rival) => rival.domain)
    );
  });
});
