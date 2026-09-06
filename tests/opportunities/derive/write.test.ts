// BUILD §7 — the Write family, from measured evidence only.
import "../env";
import { describe, expect, it } from "vitest";
import { WRITE_VOLUME_FLOOR_PER_MONTH } from "../../../src/lib/config/constants";
import { writeCandidates } from "../../../src/lib/opportunities/derive/write";
import {
  AT,
  SCAN_ID,
  SITE_ID,
  bigCounts,
  question,
  reportOf,
  search,
  serp,
  smallCounts,
  unreadableCounts,
} from "../fixtures";

const base = { siteId: SITE_ID, scanId: SCAN_ID, ownRanked: 0 };

describe('§7: `answer_page` — "AI answer for a question names rivals, not customer"', () => {
  it("an answer that cited a rival and not the customer yields one, with the question as its test", () => {
    const report = reportOf({ questions: [question()], serps: [serp()] });
    const { candidates } = writeCandidates({ ...base, report, rankedCounts: smallCounts() });

    expect(candidates).toHaveLength(1);
    const only = candidates[0]!;
    expect(only.type).toBe("answer_page");
    expect(only.family).toBe("write");
    expect(only.acceptance).toEqual({ form: "named_on", question: question().text });
  });

  it("an answer that already names the customer yields no answer_page", () => {
    const named = serp({
      aiOverview: {
        present: true,
        asynchronousAiOverview: true,
        referenceDomains: ["example.com"],
      },
    });
    const report = reportOf({ questions: [question()], serps: [named] });
    const { candidates } = writeCandidates({ ...base, report, rankedCounts: smallCounts() });
    expect(candidates.map((c) => c.type)).not.toContain("answer_page");
  });
});

describe('§7: `keyword_page` — "Rival top-20 for a query >=10/mo; customer absent"', () => {
  const noAnswer = serp({
    aiOverview: { present: false, asynchronousAiOverview: false, referenceDomains: [] },
  });

  it("a search the customer is absent from yields one, with a top-20 test", () => {
    const report = reportOf({
      questions: [question({ search: search({ keyword: "user onboarding software" }) })],
      serps: [noAnswer],
    });
    const { candidates } = writeCandidates({ ...base, report, rankedCounts: smallCounts() });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.type).toBe("keyword_page");
    expect(candidates[0]!.acceptance).toEqual({
      form: "top20",
      query: "user onboarding software",
    });
  });

  it("a search the customer already holds a place in yields none", () => {
    const present = serp({
      organic: [
        { position: 1, domain: "appcues.com", url: "https://appcues.com/a", title: "A" },
        { position: 2, domain: "example.com", url: "https://example.com/x", title: "X" },
      ],
      aiOverview: { present: false, asynchronousAiOverview: false, referenceDomains: [] },
    });
    const report = reportOf({
      questions: [question({ search: search({ keyword: "user onboarding software" }) })],
      serps: [present],
    });
    expect(writeCandidates({ ...base, report, rankedCounts: smallCounts() }).candidates).toEqual([]);
  });

  it("a search below the volume floor yields none", () => {
    const report = reportOf({
      questions: [
        question({
          search: search({
            keyword: "user onboarding software",
            volume: WRITE_VOLUME_FLOOR_PER_MONTH - 1,
          }),
        }),
      ],
      serps: [noAnswer],
    });
    expect(writeCandidates({ ...base, report, rankedCounts: smallCounts() }).candidates).toEqual([]);
  });
});

describe('§7: `comparison_page` — "Gap query names a rival or contains vs/alternative"', () => {
  const noAnswer = serp({
    aiOverview: { present: false, asynchronousAiOverview: false, referenceDomains: [] },
  });

  it("a vs search becomes a comparison, not a keyword page", () => {
    const report = reportOf({
      questions: [question({ search: search({ keyword: "appcues vs userpilot" }) })],
      serps: [noAnswer],
    });
    const { candidates } = writeCandidates({ ...base, report, rankedCounts: smallCounts() });
    expect(candidates[0]!.type).toBe("comparison_page");
  });

  it("an alternatives search does too", () => {
    const report = reportOf({
      questions: [question({ search: search({ keyword: "onboarding tool alternatives" }) })],
      serps: [noAnswer],
    });
    expect(
      writeCandidates({ ...base, report, rankedCounts: smallCounts() }).candidates[0]!.type
    ).toBe("comparison_page");
  });
});

describe("§7: `format_page` is not derived from measurement", () => {
  it("no report produces one — the trigger names a page type nothing measures", () => {
    // "Rivals have a page type customer lacks entirely" states a page
    // *type*, and no measurement in the stored report is one. It arises
    // only where the model refines an already-derived candidate.
    for (const keyword of ["best onboarding software", "appcues vs userpilot", "onboarding guide"]) {
      const report = reportOf({
        questions: [question({ search: search({ keyword }) })],
        serps: [serp()],
      });
      const { candidates } = writeCandidates({ ...base, report, rankedCounts: smallCounts() });
      expect(candidates.map((c) => c.type)).not.toContain("format_page");
    }
  });
});

describe("winnability gates every Write candidate", () => {
  it("a top ten of large rivals produces nothing and counts a not_yet", () => {
    const report = reportOf({ questions: [question()], serps: [serp()] });
    const result = writeCandidates({ ...base, report, rankedCounts: bigCounts() });
    expect(result.candidates).toEqual([]);
    expect(result.rejected.not_yet).toBe(1);
    expect(result.rejected.unmeasured_top10).toBe(0);
    expect(result.assessed).toBe(1);
  });

  it("a top ten we could not size produces nothing and counts an unmeasured_top10", () => {
    const report = reportOf({ questions: [question()], serps: [serp()] });
    const result = writeCandidates({ ...base, report, rankedCounts: unreadableCounts() });
    expect(result.candidates).toEqual([]);
    expect(result.rejected.unmeasured_top10).toBe(1);
    expect(result.rejected.not_yet).toBe(0);
  });

  it("a qualified candidate carries the band it qualified into", () => {
    const report = reportOf({ questions: [question()], serps: [serp()] });
    const { candidates } = writeCandidates({ ...base, report, rankedCounts: smallCounts() });
    expect(candidates[0]!.fitBand).toBe("winnable");
  });
});

describe("evidence is copied out of the report, with its own dates", () => {
  it("the query, its measured volume and the rival page that shows the gap", () => {
    const report = reportOf({ questions: [question()], serps: [serp()] });
    const { candidates } = writeCandidates({ ...base, report, rankedCounts: smallCounts() });
    const evidence = candidates[0]!.evidence;
    expect(evidence).toEqual({
      family: "write",
      query: "best user onboarding software",
      volume: { kind: "measured", value: 1900, at: AT },
      rival: {
        domain: "appcues.com",
        url: { kind: "measured", value: "https://appcues.com/a", at: AT },
        position: { kind: "measured", value: 1, at: AT },
      },
    });
  });

  it("the rival is the best-placed result that is not the customer's own", () => {
    const ownFirst = serp({
      organic: [
        { position: 1, domain: "example.com", url: "https://example.com/", title: "us" },
        { position: 2, domain: "appcues.com", url: "https://appcues.com/a", title: "A" },
      ],
    });
    const report = reportOf({ questions: [question()], serps: [ownFirst] });
    const { candidates } = writeCandidates({ ...base, report, rankedCounts: smallCounts() });
    const evidence = candidates[0]!.evidence;
    expect(evidence.family).toBe("write");
    if (evidence.family !== "write") throw new Error("unreachable");
    expect(evidence.rival.domain).toBe("appcues.com");
  });
});

describe("nothing to derive from is not an error", () => {
  it("a pass that never phrased the twelve produces nothing and no counts", () => {
    const report = reportOf({ questions: [question()], serps: [serp()] });
    const unphrased = { ...report, questions: { kind: "unmeasured", reason: "not_attempted", at: AT } } as typeof report;
    const result = writeCandidates({ ...base, report: unphrased, rankedCounts: smallCounts() });
    expect(result).toEqual({
      candidates: [],
      assessed: 0,
      rejected: { not_yet: 0, unmeasured_top10: 0, duplicate_open: 0 },
    });
  });

  it("a question whose SERP was never bought is skipped, not guessed at", () => {
    const report = reportOf({ questions: [question()], serps: [] });
    expect(writeCandidates({ ...base, report, rankedCounts: smallCounts() }).candidates).toEqual([]);
  });
});

describe("at most one Write candidate per search", () => {
  it("a search that fires two triggers yields one page, not two near-duplicates", () => {
    // "appcues vs userpilot" is both a comparison shape and a search the
    // customer is absent from, on a question whose AI answer cited a rival.
    const report = reportOf({
      questions: [question({ search: search({ keyword: "appcues vs userpilot" }) })],
      serps: [serp()],
    });
    const { candidates } = writeCandidates({ ...base, report, rankedCounts: smallCounts() });
    expect(candidates).toHaveLength(1);
  });
});
