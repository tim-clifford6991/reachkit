// One week's stored report, read as the three readings a recorded test is
// decided from.
//
// The property that matters is absent-key versus `unmeasured` value: a key
// that is absent is terminal, and a key carrying an unmeasured value is a
// week's miss. Dropping the key for a SERP that failed retires a live page
// forever and renders correctly on every screen.
// The bindings `env.ts` parses at module load, before anything that
// reaches `@/lib/db` is evaluated.
import "../env";
import { afterEach, describe, expect, it } from "vitest";
import { weekMeasurementsFrom } from "../../../src/lib/opportunities/verdicts/measurements";
import { placeOf } from "../../../src/lib/measure/page-reading";
import { measured, unmeasured } from "../../../src/lib/measure/measured";
import { AT, DOMAIN, question, reportOf, serp } from "../fixtures";
import { emptyReport, PAGE_URL, reportWithOwnPlace, releaseStore, WEEK } from "./harness";

afterEach(releaseStore);

describe("positions — each search's rows, from which a page takes its own place (issue 1518)", () => {
  const SEARCH = "best user onboarding software";
  const placeAt = (report: Parameters<typeof weekMeasurementsFrom>[0]["report"], url = PAGE_URL) => {
    const reading = weekMeasurementsFrom({ report, week: WEEK }).positions.get(SEARCH);
    return reading === undefined ? undefined : placeOf(reading, [url]);
  };

  it("a measured place is carried with the rank the SERP recorded", () => {
    const place = placeAt(reportWithOwnPlace(4));
    expect(place?.kind === "measured" && place.value).toBe(4);
  });

  it("a SERP the week read, with the page absent, is a measured zero and never a missing measurement", () => {
    expect(placeAt(reportWithOwnPlace(null))?.kind).toBe("zero");
  });

  it("a SERP the week could not read keeps its key, carrying an unmeasured reading", () => {
    const report = reportOf({ questions: [question()], serps: [] }, {
      serps: [unmeasured("undeterminable", AT)],
    });
    const week = weekMeasurementsFrom({ report, week: WEEK });
    // The key is there — the search is still tracked — and the value says
    // the week did not reach it. Dropping the key would say the search
    // left the tracked set, which is terminal.
    expect(week.positions.has(SEARCH)).toBe(true);
    expect(week.positions.get(SEARCH)?.kind).toBe("unmeasured");
  });

  it("the best of the page's own rows is its place — a page ranking twice holds the higher one", () => {
    const report = reportOf({
      questions: [question()],
      serps: [
        serp({
          organic: [
            { position: 2, domain: DOMAIN, url: `${PAGE_URL}/`, title: "Ours, higher" },
            { position: 7, domain: DOMAIN, url: PAGE_URL, title: "Ours, deeper" },
          ],
        }),
      ],
    });
    const place = placeAt(report);
    expect(place?.kind === "measured" && place.value).toBe(2);
  });

  it("another page of the same domain is not this page: the home page at #3 places the article nowhere", () => {
    const report = reportOf({
      questions: [question()],
      serps: [serp({ organic: [{ position: 3, domain: DOMAIN, url: `https://${DOMAIN}/`, title: "Home" }] })],
    });
    expect(placeAt(report)?.kind).toBe("zero");
    const home = placeAt(report, `https://www.${DOMAIN}`);
    expect(home?.kind === "measured" && home.value).toBe(3);
  });

  it("a page the ten-deep SERP does not hold is read from the ranked rows to depth 20 before it reads as absent", () => {
    const ranked = (position: number, url = PAGE_URL) => ({ keyword: SEARCH, position, searchVolume: 90, url });
    const at14 = placeAt(reportWithOwnPlace(null, { ownRanked: measured(2, AT), ownRankedRows: [ranked(14), ranked(2, `https://${DOMAIN}/`)] }));
    expect(at14?.kind === "measured" && at14.value).toBe(14);
    // Issue 1548: a row past twenty is the page's place, outside the top twenty.
    const at24 = placeAt(reportWithOwnPlace(null, { ownRanked: measured(1, AT), ownRankedRows: [ranked(24)] }));
    expect(at24?.kind === "measured" && at24.value).toBe(24);
    // The SERP is the week's own reading of Google, and is read first.
    const both = placeAt(reportWithOwnPlace(6, { ownRanked: measured(1, AT), ownRankedRows: [ranked(4)] }));
    expect(both?.kind === "measured" && both.value).toBe(6);
  });

  it("issue 1537 — a page in neither the ten-deep SERP nor capped ranked rows is not measured, never a measured zero", () => {
    const elsewhere = Array.from({ length: 300 }, (_, i) => ({ keyword: `other search ${i}`, position: 1 + (i % 50), searchVolume: 90, url: `https://${DOMAIN}/p${i}` }));
    expect(placeAt(reportWithOwnPlace(null, { ownRanked: measured(1200, AT), ownRankedRows: elsewhere }))?.kind).toBe("unmeasured");
    // A count the week did not measure cannot say the rows are complete either.
    expect(placeAt(reportWithOwnPlace(null, { ownRanked: unmeasured("undeterminable", AT), ownRankedRows: [] }))?.kind).toBe("unmeasured");
    // Where the rows are every search the site ranks for, absence is measured.
    expect(placeAt(reportWithOwnPlace(null, { ownRanked: measured(300, AT), ownRankedRows: elsewhere }))?.kind).toBe("zero");
  });

  it("issue 1537 — on its own question's result, read past twenty, a page on page two is seen there on a site of any size", () => {
    const TARGET = "water heater repair austin";
    const capped = { ownRanked: measured(1200, AT), ownRankedRows: Array.from({ length: 300 }, (_, i) => ({ keyword: `other search ${i}`, position: 1 + (i % 50), searchVolume: 90, url: `https://${DOMAIN}/p${i}` })) };
    const rival = { url: "https://rival.test/a", position: 1 };
    const withRow = (organic: { url: string; position: number }[], depth?: number) =>
      reportWithOwnPlace(null, {
        ...capped,
        pageQuestions: {
          measuredAt: AT,
          ownDomain: DOMAIN,
          tracked: 13,
          cap: 24,
          retired: [],
          rows: [
            {
              publicationId: "pub-1",
              liveUrl: PAGE_URL,
              question: { n: 13, wording: { source: "model", text: "Who repairs water heaters in Austin?" }, search: TARGET },
              cell: { kind: "no_answer" },
              engines: [],
              organic,
              ...(depth === undefined ? {} : { depth }),
            },
          ],
        } as never,
      });
    const placeOn = (report: ReturnType<typeof withRow>) => {
      const reading = weekMeasurementsFrom({ report, week: WEEK, targets: [TARGET] }).positions.get(TARGET);
      return reading === undefined ? undefined : placeOf(reading, [PAGE_URL]);
    };
    const at14 = placeOn(withRow([rival, { url: PAGE_URL, position: 14 }], 100));
    expect(at14?.kind === "measured" && at14.value).toBe(14);
    // Absent from a result read past the verdict's line is a measured zero.
    expect(placeOn(withRow([rival], 30))?.kind).toBe("zero");
    // A ten-deep row stored before cannot say the page is not at 11–20.
    expect(placeOn(withRow([rival]))?.kind).toBe("unmeasured");
    // Nor can a thin market's slot past the deep twelve, which says it read ten.
    expect(placeOn(withRow([rival], 10))?.kind).toBe("unmeasured");
  });

  it("an earlier address of the same page counts as the page (issue 1487)", () => {
    const report = reportOf({
      questions: [question()],
      serps: [serp({ organic: [{ position: 5, domain: DOMAIN, url: "https://content.example.com/old-slug", title: "Old" }] })],
    });
    const reading = weekMeasurementsFrom({ report, week: WEEK }).positions.get(SEARCH);
    const place = reading === undefined ? undefined : placeOf(reading, [PAGE_URL, "https://content.example.com/old-slug"]);
    expect(place?.kind === "measured" && place.value).toBe(5);
  });
});

describe("gatesCleared — the barriers the scan can observe, and only those", () => {
  it("robots and noindex are read off the same facts a Fix opportunity is derived from", () => {
    const week = weekMeasurementsFrom({ report: reportWithOwnPlace(3), week: WEEK });
    expect(week.gatesCleared.has("robots_disallow")).toBe(true);
    expect(week.gatesCleared.has("blocked_ai_agent")).toBe(true);
    expect(week.gatesCleared.has("noindex")).toBe(true);
  });

  it("the two barriers nothing measures get no key — a gate the product does not look at is not_measured", () => {
    const week = weekMeasurementsFrom({ report: reportWithOwnPlace(3), week: WEEK });
    expect(week.gatesCleared.has("login_wall")).toBe(false);
    expect(week.gatesCleared.has("js_only")).toBe(false);
  });
});

describe("the week's own identity", () => {
  it("carries the week it was asked about, the report's own measurement date and the domain it measured", () => {
    const report = reportWithOwnPlace(3);
    const week = weekMeasurementsFrom({ report, week: WEEK });
    expect(week.week).toBe(WEEK);
    expect(week.measuredAt).toEqual(report.verdict.measuredAt);
    expect(week.domain).toBe(DOMAIN);
  });

  it("a report that measured no question at all yields no search and no question — which judgeWeek never reaches, because such a week is no_week", () => {
    const week = weekMeasurementsFrom({ report: emptyReport(), week: WEEK });
    expect(week.positions.size).toBe(0);
  });
});
