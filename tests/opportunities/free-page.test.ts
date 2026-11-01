// SPEC §2 · §6 (#787) — the free report's one first page, chosen from what
// the scan measured and right-sized to the site.
import "./env";
import { describe, expect, it } from "vitest";
import { beatsOf, currentFreePage, freePageOf } from "../../src/lib/opportunities/free-page";
import { qualifyingDemand, winnableDemand } from "../../src/lib/opportunities/winnability/bars";
import { measured, unmeasured } from "../../src/lib/measure/measured";
import type { SerpResult } from "../../src/lib/vendors/dataforseo/types";
import { AT, SCAN_ID, question, reportOf, search, serp } from "./fixtures";

const noAnswer = serp({ aiOverview: { present: false, asynchronousAiOverview: false, referenceDomains: [] } });

describe("the free report offers the best right-sized Write target it measured", () => {
  it("an AI answer that cited a rival and not the site becomes the card: its question, its search, its rival", () => {
    const page = freePageOf(reportOf({ questions: [question()], serps: [serp()] }));

    expect(page).not.toBeNull();
    expect(page!.title.text).toBe(question().text);
    expect(page!.target).toEqual({ keyword: search().keyword, volume: search().volume });
    expect(page!.beats).toBe("appcues.com");
    expect(page!.format).toBe("answer_page");
    expect(page!.totalPages).toBe(1);
    expect(page!.opportunityId.startsWith(`${SCAN_ID}:`)).toBe(true);
  });

  it("a search outsized for a site that ranks for nothing is never offered", () => {
    const head = question({ search: search({ volume: qualifyingDemand(0) + 1 }) });
    expect(freePageOf(reportOf({ questions: [head], serps: [serp()] }))).toBeNull();
  });

  it("the smaller, winnable search is offered ahead of a larger reach search of the same type", () => {
    const big = question({
      id: "q1",
      text: "Which onboarding platform do enterprises use?",
      search: search({ keyword: "enterprise onboarding platform", volume: winnableDemand(0) + 1 }),
    });
    const small = question({
      id: "q2",
      text: "What is the best onboarding checklist tool?",
      search: search({ keyword: "best onboarding checklist tool", volume: 60 }),
    });
    const page = freePageOf(reportOf({ questions: [big, small], serps: [serp(), serp()] }));

    expect(page!.target.keyword).toBe("best onboarding checklist tool");
    expect(page!.totalPages).toBe(2);
  });

  it("with no rival sizing, a plain keyword page is not offered — the free scan cannot read its competition", () => {
    const report = reportOf({ questions: [question({ search: search({ keyword: "user onboarding software" }) })], serps: [noAnswer] });
    expect(freePageOf(report)).toBeNull();
  });

  it("a report whose twelve were not measured offers nothing", () => {
    const report = reportOf({ questions: [question()], serps: [serp()] }, { questions: { kind: "unmeasured", reason: "not_attempted", at: AT } });
    expect(freePageOf(report)).toBeNull();
  });

  it("a paid report reads the full band: a sized top ten of large rivals keeps an answer page out", () => {
    const report = reportOf(
      { questions: [question()], serps: [serp()] },
      {
        rivalSizes: measured(
          [
            { state: "sized", domain: "appcues.com", rankedCount: 90_000, countIs: "total", at: AT },
            { state: "sized", domain: "userpilot.com", rankedCount: 90_000, countIs: "total", at: AT },
          ] as never,
          AT
        ),
      }
    );
    expect(freePageOf(report)).toBeNull();
  });
});

describe("a stored free page names the business holding its search, as the missing pages do", () => {
  const report = reportOf({ questions: [question()], serps: [serp()] });
  const page = freePageOf(report)!;
  const row = (position: number, domain: string, title: string) => ({ position, domain, url: `https://${domain}/`, title });
  const storedWith = (beats: string, organic: SerpResult["organic"]) => ({ ...reportOf({ questions: [question()], serps: [serp({ organic })] }), freePage: { ...page, beats } });

  it("a business stored as the one it beats stays it", () => {
    expect(beatsOf({ ...report, freePage: page })).toBe("appcues.com");
  });

  it("a platform stored before the rule gives way to the first business below it", () => {
    expect(beatsOf(storedWith("google.com", [row(1, "www.google.com", "Maps"), row(2, "appcues.com", "Appcues")]))).toBe("appcues.com");
  });

  it("a job page stored over a top ten of sources reads as none", () => {
    expect(beatsOf(storedWith("bakingcareer.com.au", [row(1, "bakingcareer.com.au", "Baking Career - Everything you need to know"), row(2, "www.yelp.com", "Bakers")]))).toBeNull();
  });
});

describe("a stored free page is kept while what it was read from is not measured again", () => {
  it("a report whose market is unmeasured keeps its stored page: not measured is never none", () => {
    const report = reportOf({ questions: [question()], serps: [serp()] });
    const page = freePageOf(report)!;
    expect(currentFreePage({ ...report, market: unmeasured("not_attempted", AT), freePage: page })).toBe(page);
  });
});
