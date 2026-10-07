// tests/vendors/news.test.ts — SPEC §7 (owner, D48; issue 1259): the news
// search *current insights* reads.
//
// What the caller can observe: one live request, ten results deep, ledgered
// at the price book's figure; each result with the day the search dates it;
// and a result the search does not date is not a result.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { envelope, fakeCostContext, setEnvFixture, stubVendorFetch } from "./harness";

let news: typeof import("../../src/lib/vendors/dataforseo/news.ts");
let constants: typeof import("../../src/lib/config/constants.ts");

beforeAll(async () => {
  setEnvFixture();
  news = await import("../../src/lib/vendors/dataforseo/news.ts");
  constants = await import("../../src/lib/config/constants.ts");
});
afterEach(() => vi.unstubAllGlobals());

const RESULT = {
  keyword: "ai answer visibility",
  items: [
    {
      type: "top_stories",
      items: [
        { type: "top_stories_element", source: "The Register", domain: "www.theregister.com", title: "Search changes again", url: "https://www.theregister.com/a", timestamp: "2026-10-02 07:15:00 +00:00" },
      ],
    },
    { type: "news_search", domain: "searchengineland.com", title: "AI Overviews now cite fewer sites", url: "https://searchengineland.com/b", time_published: "3 days ago", timestamp: "2026-09-30 23:40:00 +00:00" },
    // The same story twice is one result.
    { type: "news_search", domain: "searchengineland.com", title: "AI Overviews now cite fewer sites", url: "https://searchengineland.com/b", timestamp: "2026-09-30 23:40:00 +00:00" },
    // No date: nothing this search is bought for.
    { type: "news_search", domain: "undated.example", title: "Undated", url: "https://undated.example/c", timestamp: null },
  ],
};

describe("the news search returns dated results, in order, with who published them", () => {
  it("asks once, live, ten deep, at the price book's figure, and keeps only what it dates", async () => {
    const stub = stubVendorFetch(() => envelope(RESULT));
    const fake = fakeCostContext("DRAFT");
    const found = await news.serpNews(fake.ctx, { locale: { country: "US", language: "en" }, query: "ai answer visibility", scope: { site: "site-1" }, freshnessDays: constants.CACHE_WINDOWS_D.news });

    expect(stub.requests.map((request) => request.url)).toEqual(["https://api.dataforseo.com/v3/serp/google/news/live/advanced"]);
    expect(stub.tasks[0]).toEqual({
      keyword: "ai answer visibility",
      location_name: "United States",
      language_code: "en",
      depth: 10,
    });
    expect(fake.calls[0]).toMatchObject({ source: "serp/google/news", costCents: constants.PRICE_BOOK.NEWS_LIVE_C, freshnessDays: 1 });
    expect(fake.calls[0]?.cacheKey).toContain("site-1");
    expect(found.kind).toBe("measured");
    expect(found.kind === "measured" ? found.value : []).toEqual([
      { url: "https://www.theregister.com/a", domain: "theregister.com", title: "Search changes again", source: "The Register", publishedAt: "2026-10-02" },
      { url: "https://searchengineland.com/b", domain: "searchengineland.com", title: "AI Overviews now cite fewer sites", source: "searchengineland.com", publishedAt: "2026-09-30" },
    ]);
  });

  it("a search with no results is a measured nothing, and a shape it does not know is not a result", async () => {
    stubVendorFetch(() => envelope({ keyword: "x", items: null }));
    const none = await news.serpNews(fakeCostContext("DRAFT").ctx, { locale: { country: "US", language: "en" }, query: "x", scope: { site: "site-1" }, freshnessDays: 1 });
    expect(none).toMatchObject({ kind: "zero", value: [] });
    expect(news.parseNews("not a result")).toBeUndefined();
  });
});
