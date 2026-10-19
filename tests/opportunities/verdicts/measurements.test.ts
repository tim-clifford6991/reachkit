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
import { placeOf } from "../../../src/lib/opportunities/verdicts/evaluate";
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

describe("namesCustomer — this week's AI answer, keyed by the question a named_on test records", () => {
  it("the key is the question's own wording, which is what the acceptance test recorded", () => {
    const week = weekMeasurementsFrom({ report: reportWithOwnPlace(3), week: WEEK });
    expect(week.namesCustomer.has(question().text)).toBe(true);
  });
});

describe("ownPagesCited — the site's own pages this week's answer cited (SPEC §4 2026-09-29, D16)", () => {
  const cited = (referenceUrls?: string[]) =>
    weekMeasurementsFrom({
      report: reportOf({
        questions: [question()],
        serps: [
          serp({
            aiOverview: {
              present: true,
              asynchronousAiOverview: true,
              referenceDomains: [DOMAIN, "appcues.com"],
              ...(referenceUrls === undefined ? {} : { referenceUrls }),
            },
          }),
        ],
      }),
      week: WEEK,
    }).ownPagesCited.get(question().text);

  it("keeps the site's own addresses and no one else's", () => {
    expect(cited([`https://${DOMAIN}/guides/p`, "https://appcues.com/a"])).toMatchObject({
      kind: "measured",
      value: [`https://${DOMAIN}/guides/p`],
    });
  });

  it("an answer stored without its addresses names the site and says nothing about which page", () => {
    expect(cited()?.kind).toBe("unmeasured");
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
    expect(week.namesCustomer.size).toBe(0);
  });
});
