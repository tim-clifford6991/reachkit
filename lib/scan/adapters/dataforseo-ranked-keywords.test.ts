import { describe, it, expect } from "vitest";
import { parseRankedKeywords, parseRelevantPages } from "./dataforseo-ranked-keywords";

describe("parseRankedKeywords", () => {
  it("extracts keyword / position / volume / etv from the Labs shape", () => {
    const body = {
      tasks: [
        {
          result: [
            {
              items: [
                {
                  keyword_data: { keyword: "habit tracker", keyword_info: { search_volume: 12000 } },
                  ranked_serp_element: { serp_item: { rank_absolute: 4, etv: 800 } },
                },
                {
                  keyword_data: { keyword: "best habit app", keyword_info: { search_volume: 3000 } },
                  ranked_serp_element: { serp_item: { rank_absolute: 11, etv: 90 } },
                },
              ],
            },
          ],
        },
      ],
    };
    expect(parseRankedKeywords(body)).toEqual([
      { keyword: "habit tracker", position: 4, volume: 12000, etv: 800, url: "" },
      { keyword: "best habit app", position: 11, volume: 3000, etv: 90, url: "" },
    ]);
  });

  it("is defensive: unknown shapes → []", () => {
    expect(parseRankedKeywords(null)).toEqual([]);
    expect(parseRankedKeywords({})).toEqual([]);
    expect(parseRankedKeywords({ tasks: [{ result: [{ items: [{}] }] }] })).toEqual([]);
  });
});

describe("parseRelevantPages", () => {
  it("extracts url / keywordCount / etv", () => {
    const body = {
      tasks: [
        {
          result: [
            {
              items: [
                { page_address: "https://x.com/blog/a", metrics: { organic: { count: 40, etv: 600 } } },
                { page_address: "https://x.com/features", metrics: { organic: { count: 12, etv: 120 } } },
              ],
            },
          ],
        },
      ],
    };
    expect(parseRelevantPages(body)).toEqual([
      { url: "https://x.com/blog/a", keywordCount: 40, etv: 600 },
      { url: "https://x.com/features", keywordCount: 12, etv: 120 },
    ]);
  });

  it("skips rows without a page address", () => {
    expect(parseRelevantPages({ tasks: [{ result: [{ items: [{ metrics: {} }] }] }] })).toEqual([]);
  });
});
