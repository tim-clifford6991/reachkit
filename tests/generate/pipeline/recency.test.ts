// SPEC §7 *Two pools of facts*: a page published 2026-11-21 cited a Pew page its own markup dates 2025-07-22 as if
// undated, beside newer claims on the same subject. The page is dated from its markup, and the old claim gives way.
import { describe, expect, it } from "vitest";
import { admittedClaims, agesOf, newestCredible } from "../../../src/lib/generate/pipeline/claims";
import { datedOf } from "../../../src/lib/generate/pipeline/dated";
import { withSources } from "../../../src/lib/generate/pipeline/sources";

const now = new Date("2026-11-21T00:00:00Z");
const pew = '<script type="application/ld+json">{"@graph":[{"@type":"Article","datePublished":"2025-07-22T10:00:00-04:00"}]}</script>';

describe("the newest credible source on a subject is cited first", () => {
  it("dates a page from its JSON-LD and lets an old claim give way to a newer one on its subject", () => {
    expect(datedOf(pew, { url: "https://www.pewresearch.org/short-reads/x/", readAt: now })).toEqual({ publishedAt: "2025-07-22", datedBy: "jsonld" });
    const claim = (url: string, publishedAt: string) => ({ url, publishedAt, tier: "original" as const, timeliness: "dated" as const, passage: "Google users click a link less often when an AI summary appears in the results." });
    const kept = newestCredible([claim("https://old.example/", "2025-07-22"), claim("https://new.example/", "2026-10-01")], now);
    expect(kept.map((each) => each.url)).toEqual(["https://new.example/"]);
  });

  // Production, 24 Nov: a page's first claim was a second-hand projection, so its Sources line read "no date found".
  it("dates a source from its dated claims and never ages a projection by the year it is about", () => {
    const url = "https://searchify.ai/blog/ai-competitor-analysis", base = { url, title: "AI Competitor Analysis", readAt: now, timeliness: "dated" as const };
    const claims = [{ ...base, secondHand: true as const, passage: "Over 75% of Google searches could feature AI summaries by 2028." }, ...[23, 24].map((at) => ({ ...base, publishedAt: "2025-10-29", datedBy: "jsonld" as const, passage: `AI share of voice is ${at}% of answers.` }))];
    expect(withSources(`See [it](${url}).`, claims, { language: "en", tag: "en-GB", timeZone: "UTC" })).toMatch(/· published October 2025 ·/);
    expect(agesOf(newestCredible(claims, now), now).oldest).toEqual({ url, days: 388 });
  });
  it("ages a 2023 'after 2021' claim (production, 24 Nov) by its published day, not a 2026 modified one, and names both", () => {
    const url = "https://digimor.in/chatgpt-seo/", quote = "ChatGPT loses its ability to give information about events after 2021.";
    const page = { url, title: "ChatGPT for SEO", text: quote, readAt: now.toISOString(), kind: "top_result" as const, publishedAt: "2023-04-28", modifiedAt: "2026-11-20", datedBy: "jsonld" as const };
    const [claim] = admittedClaims([{ page: 1, quote, year: null, about: "other" as const, plan: null, rival: null }], [page], now);
    expect(claim).toMatchObject({ timeliness: "dated", ageAt: "2023-04-28" });
    expect(withSources(`See [it](${url}).`, [claim!], { language: "en", tag: "en-GB", timeZone: "UTC" })).toMatch(/· published April 2023 · updated November 2026 ·/);
  });
});
