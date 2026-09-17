// SPEC §2 · §6 (#787) — the free report's one first page, chosen from what
// the scan measured and right-sized to the site.
import "./env";
import { describe, expect, it } from "vitest";
import { freePageOf } from "../../src/lib/opportunities/free-page";
import { qualifyingDemand, winnableDemand } from "../../src/lib/opportunities/winnability/bars";
import { measured } from "../../src/lib/measure/measured";
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
