/**
 * keywords adapter tests (TDD)
 * - parseKeywords maps fields from a DataForSEO keywords_data/google_ads/search_volume/live response
 * - keywordsData returns fixture data when fixturesEnabled()=true (no network call)
 */
import { expect, test, describe, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// parseKeywords — pure unit test, no mocking needed
// ---------------------------------------------------------------------------

test("parseKeywords maps keyword/search_volume/cpc/competition from tasks[0].result[]", async () => {
  const { parseKeywords } = await import("./keywords");

  const body = {
    tasks: [
      {
        result: [
          { keyword: "habit tracker app", search_volume: 12100, cpc: 1.45, competition: 0.62 },
          { keyword: "daily habit tracker", search_volume: 4400, cpc: 0.98, competition: 0.45 },
          { keyword: "best habit app", search_volume: 2900, cpc: 1.12, competition: 0.38 },
        ],
      },
    ],
  };

  const rows = parseKeywords(body);
  expect(rows).toHaveLength(3);
  expect(rows[0]).toEqual({ keyword: "habit tracker app", volume: 12100, cpc: 1.45, competition: 0.62 });
  expect(rows[1]).toEqual({ keyword: "daily habit tracker", volume: 4400, cpc: 0.98, competition: 0.45 });
  expect(rows[2]).toEqual({ keyword: "best habit app", volume: 2900, cpc: 1.12, competition: 0.38 });
});

test("parseKeywords returns empty array when tasks is missing", async () => {
  const { parseKeywords } = await import("./keywords");
  expect(parseKeywords({})).toEqual([]);
  expect(parseKeywords({ tasks: [] })).toEqual([]);
  expect(parseKeywords({ tasks: [{}] })).toEqual([]);
});

test("parseKeywords coerces missing numeric fields to 0 / empty string", async () => {
  const { parseKeywords } = await import("./keywords");

  const body = {
    tasks: [{ result: [{ keyword: "foo" }] }],
  };

  const rows = parseKeywords(body);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toEqual({ keyword: "foo", volume: 0, cpc: 0, competition: 0 });
});

// ---------------------------------------------------------------------------
// keywordsData — fixture gating test (no network call)
// ---------------------------------------------------------------------------

describe("keywordsData short-circuits to fixture when fixturesEnabled()=true", () => {
  const KEYWORDS_FIXTURE = {
    keywords: [
      { keyword: "habit tracker app", volume: 1200, cpc: 1.2, competition: 0.4 },
      { keyword: "daily habit tracker", volume: 1100, cpc: 1.2, competition: 0.4 },
      { keyword: "best habit app", volume: 1000, cpc: 1.2, competition: 0.4 },
    ],
    raw: { fixture: true },
  };

  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/dev/fixtures", () => ({
      fixturesEnabled: () => true,
      fixtureKeywords: (_seeds: string[]) => KEYWORDS_FIXTURE,
    }));
  });

  test("returns fixture without making a network call", async () => {
    // fetch is NOT stubbed — if the adapter calls fetch, vitest will error
    const { keywordsData } = await import("./keywords");
    const seeds = ["habit tracker app", "daily habit tracker", "best habit app"];
    const result = await keywordsData(seeds);
    expect(result).toEqual(KEYWORDS_FIXTURE);
    expect(result.keywords).toHaveLength(3);
    expect(result.raw).toEqual({ fixture: true });
  });
});
