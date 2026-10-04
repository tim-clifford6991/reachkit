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
import { GROUNDED, fakeCost, opportunity } from "../fixtures";

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));

const { parseStoredMarket } = await import("../../../src/lib/market/infer/stored");
const { writingMarket } = await import("../../../src/lib/generate/voice/market");
const { buildPromptInputs } = await import("../../../src/lib/generate/voice/inputs");
const steps = await import("../../../src/lib/generate/pipeline/steps");

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
    // This site's founder chose the rivals: theirs stand, named where the
    // conclusion knows the name.
    expect(stored.rivalsOverridden).toBe(true);
    expect(writing.market!.rivals).toEqual([
      { name: "AEO Engine", domain: "aeoengine.ai" },
      { name: "peec.ai", domain: "peec.ai" },
    ]);
  });

  it("is the report's category only where no market is stored, or the read failed", () => {
    const none = { from: "report", category: REPORT_CATEGORY, market: null };
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

  it("reaches the brief, the outline and the draft", async () => {
    const writing = writingMarket({ site: site(), reportCategory: REPORT_CATEGORY });
    const inputs = buildPromptInputs({
      businessName: "ReachKit",
      domain: "reachkit.app",
      category: writing.category,
      voiceText: null,
      opportunity: opportunity(),
      grounded: GROUNDED,
      links: [],
      profile: null,
      market: writing.market,
    });
    const brief = { readerQuestion: "Which tool?", angle: "a", mustCover: ["b"], factIndexes: [0] };

    await steps.brief(
      fakeCost(),
      steps.briefProjection({ opportunity: opportunity(), facts: [GROUNDED.passage], doNotClaim: [], voice: null, profile: null, market: writing.market })
    );
    await steps.outline(fakeCost(), inputs, { brief, skeleton: ["answer"] });
    await steps.draft(fakeCost(), inputs, {
      brief,
      outline: { sections: [{ role: "answer", heading: "Which tool?" }] },
      facts: [{ url: GROUNDED.url, passage: GROUNDED.passage }],
    });

    expect(llmMock.mock.calls.length).toBeGreaterThanOrEqual(3);
    for (const call of llmMock.mock.calls) {
      const input = call[1].input as { market: unknown; category?: string };
      expect(input.market).toEqual(writing.market);
      if ("category" in input) expect(input.category).toBe(writing.category);
    }
  });
});
