// SPEC §0 · issue 478 — the Earn family: a platform names a rival and not the
// customer, and the answer is a citable asset on the customer's own domain.
import "../env";
import { describe, expect, it } from "vitest";
import { earnAssetFor, earnCandidates } from "../../../src/lib/opportunities/derive/earn";
import { onePerSearch } from "../../../src/lib/opportunities/derive";
import { writeCandidates } from "../../../src/lib/opportunities/derive/write";
import { SCAN_ID, SITE_ID, bigCounts, question, reportOf, search, serp, smallCounts } from "../fixtures";

const base = { siteId: SITE_ID, scanId: SCAN_ID, ownRanked: 0 };
const counts = () => smallCounts(["appcues.com", "userpilot.com", "g2.com"]);

const answerCitingPlatform = serp({
  aiOverview: { present: true, asynchronousAiOverview: true, referenceDomains: ["g2.com", "appcues.com"] },
});

describe("one Earn candidate per market question, from the measured surfaces alone", () => {
  it("an AI answer citing a platform beside a rival, and not the customer, yields one named-on row", () => {
    const report = reportOf({ questions: [question()], serps: [answerCitingPlatform] });
    const { candidates } = earnCandidates({ ...base, report, rankedCounts: counts() });

    expect(candidates).toHaveLength(1);
    const only = candidates[0]!;
    expect(only).toMatchObject({ type: "listed_page", family: "earn", fitBand: "winnable" });
    expect(only.evidence).toMatchObject({
      source: { surface: "ai_answer", ref: "g2.com" },
      rival: { domain: "appcues.com" },
      asset: "comparison_table",
    });
    expect(only.acceptance).toEqual({ form: "named_on", question: question().text });
  });

  it("with no such answer, a top ten holding a platform and a rival but not the customer yields a top-20 row", () => {
    const listed = serp({
      organic: [
        { position: 1, domain: "g2.com", url: "https://g2.com/c", title: "G2" },
        { position: 2, domain: "appcues.com", url: "https://appcues.com/a", title: "Appcues" },
      ],
      aiOverview: { present: false, asynchronousAiOverview: false, referenceDomains: [] },
    });
    const report = reportOf({ questions: [question()], serps: [listed] });
    const [only] = earnCandidates({ ...base, report, rankedCounts: counts() }).candidates;
    expect(only?.evidence).toMatchObject({ source: { surface: "search_result", ref: "g2.com" } });
    expect(only?.acceptance).toEqual({ form: "top20", query: question().search.keyword });
  });

  it("no platform on either surface, or an answer that names the customer, yields nothing", () => {
    const noPlatform = reportOf({ questions: [question()], serps: [serp()] });
    expect(earnCandidates({ ...base, report: noPlatform, rankedCounts: counts() }).candidates).toEqual([]);

    const named = serp({
      organic: [{ position: 1, domain: "example.com", url: "https://example.com/", title: "Us" }],
      aiOverview: { present: true, asynchronousAiOverview: true, referenceDomains: ["g2.com", "example.com", "appcues.com"] },
    });
    const report = reportOf({ questions: [question()], serps: [named] });
    expect(earnCandidates({ ...base, report, rankedCounts: counts() }).candidates).toEqual([]);
  });

  it("carries Write's own winnability: a market too big to win yields no row and counts the rejection", () => {
    const report = reportOf({ questions: [question()], serps: [answerCitingPlatform] });
    const out = earnCandidates({ ...base, report, rankedCounts: bigCounts(["appcues.com", "userpilot.com", "g2.com"]) });
    expect(out.candidates).toEqual([]);
    expect(out.rejected.not_yet).toBe(1);
  });
});

describe("the asset is chosen from the query's shape", () => {
  it.each([
    ["hubspot integration for onboarding", "integration_page"],
    ["appcues vs userpilot", "comparison_table"],
    ["best user onboarding software", "comparison_table"],
    ["user onboarding completion rates", "original_data_page"],
  ])("%j asks for %s", (query, asset) => {
    expect(earnAssetFor(query)).toBe(asset);
  });
});

describe("one search plans one page: Improve, then Earn, then Write", () => {
  it("an Earn row for a search displaces the Write row for the same search", () => {
    const report = reportOf({
      questions: [question({ search: search({ keyword: "best user onboarding software" }) })],
      serps: [answerCitingPlatform],
    });
    const earn = earnCandidates({ ...base, report, rankedCounts: counts() }).candidates;
    const write = writeCandidates({ ...base, report, rankedCounts: counts() }).candidates;
    expect(write).toHaveLength(1);
    expect(onePerSearch([...earn, ...write]).map((c) => c.type)).toEqual(["listed_page"]);
  });
});
