// The evidence a market is concluded from counts each result under its own
// site: a row behind Google's redirect is that site or nobody, never google.com.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { measured } from "@/lib/measure/measured";
import { marketEvidence } from "@/lib/scan/market-evidence";
import type { SerpResult } from "@/lib/vendors/dataforseo/types";

const AT = new Date(Date.UTC(2026, 10, 1));
const stored = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../market/rivals/fixtures/au-baker-d149c119.json"), "utf8")) as { organic: SerpResult["organic"] };
const behindGoogle = { position: 2, domain: "google.com", url: "https://google.com/goto?url=https://www.brumbys.com.au/", title: "Brumby's Bakeries" };

describe("market evidence skips a result whose site is not known", () => {
  it("stored AU baker top ten (d149c119): the hidden rows count for nobody, the one that resolves counts for its site", () => {
    const serps = [measured({ organic: [stored.organic[0]!, behindGoogle, ...stored.organic.slice(2)] }, AT)];
    const report = { aiAnswers: null, serps, measuredCategory: null, market: measured({ profile: { category: null } }, AT), ownRankedRows: [] };
    const evidence = marketEvidence({ domain: "bakersdelight.com.au", siteName: null, headline: null, pages: [], products: [], claims: [], report });
    expect(evidence.topTens.map((row) => row.domain)).toEqual(["brumbys.com.au", "yourcareer.gov.au", "en.wikipedia.org", "bakingcareer.com.au"]);
  });
});
