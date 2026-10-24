// tests/publish/reads/crawler.test.ts — issue 1553.
//
// Googlebot and Bingbot are counted on a hosted page only from an address
// inside the engine's published ranges. An agent string is free text, so a
// "Googlebot" from anywhere else is not counted at all. The ranges are the
// engines' own JSON shape, answered by a fixture: no suite fetches them.
import { beforeEach, describe, expect, it } from "vitest";
import { classifyBlogRead } from "@/lib/publish/reads/classify";
import { forgetCrawlerRanges, crawlerVerdict } from "@/lib/publish/reads/crawler";
import { SEARCH_CRAWLER_RANGES } from "@/lib/config/constants";

const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const BINGBOT = "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)";

/** Each engine's published list, in its own shape. */
async function ranges(url: string): Promise<unknown> {
  if (url === SEARCH_CRAWLER_RANGES.google) {
    return { creationTime: "2026-10-18T00:00:00", prefixes: [{ ipv6Prefix: "2001:4860:4801:10::/64" }, { ipv4Prefix: "66.249.64.0/27" }] };
  }
  return { prefixes: [{ ipv4Prefix: "157.55.39.0/24" }] };
}

beforeEach(forgetCrawlerRanges);

describe("issue 1553 — a search crawler is a claim until its address proves it", () => {
  it("Googlebot and Bingbot are claimed as crawls by their agent strings", () => {
    expect(classifyBlogRead({ userAgent: GOOGLEBOT, referer: null, utmSource: null })).toEqual({ engine: "google", kind: "crawl" });
    expect(classifyBlogRead({ userAgent: BINGBOT, referer: null, utmSource: null })).toEqual({ engine: "bing", kind: "crawl" });
  });

  it("an address inside the engine's published ranges is counted", async () => {
    expect(await crawlerVerdict("google", "66.249.64.7", ranges)).toBe("verified");
    expect(await crawlerVerdict("google", "2001:4860:4801:10::2a", ranges)).toBe("verified");
    expect(await crawlerVerdict("bing", "157.55.39.200", ranges)).toBe("verified");
  });

  it("a Googlebot agent from an unverified address is not counted", async () => {
    expect(await crawlerVerdict("google", "203.0.113.9", ranges)).toBe("unverified_crawler");
    // Bing's address is not Google's crawler.
    expect(await crawlerVerdict("google", "157.55.39.200", ranges)).toBe("unverified_crawler");
    expect(await crawlerVerdict("google", null, ranges)).toBe("unverified_crawler");
    expect(await crawlerVerdict("google", "not-an-address", ranges)).toBe("unverified_crawler");
  });

  it("a list that could not be read verifies nobody, and is asked again next time", async () => {
    const failing = async (): Promise<unknown> => {
      throw new Error("offline");
    };
    expect(await crawlerVerdict("google", "66.249.64.7", failing)).toBe("ranges_unreadable");
    expect(await crawlerVerdict("google", "66.249.64.7", async () => ({ prefixes: [] }))).toBe("ranges_unreadable");
    expect(await crawlerVerdict("google", "66.249.64.7", ranges)).toBe("verified");
  });
});
