// Issue 1548 — a page's place is read from the Google result already bought
// for its own question, a target the keyword database does not track is not
// a measured zero, and a page no stored result has held is never not working.
import "../env";
import { afterEach, describe, expect, it } from "vitest";
import { weekMeasurementsFrom } from "../../../src/lib/opportunities/verdicts/measurements";
import { placeOf, type PageReading } from "../../../src/lib/measure/page-reading";
import { judgeWeek } from "../../../src/lib/opportunities/verdicts/judge";
import { urlsIn } from "../../../src/lib/opportunities/verdicts/seen";
import { pageQuestionsSectionOf } from "../../../src/lib/scan/sections";
import { measured } from "../../../src/lib/measure/measured";
import type { StoredReport } from "../../../src/lib/scan/report";
import { serp } from "../fixtures";
import { AT, DOMAIN, SITE_ID, WEEK, fakeStore, pageOf, readingAt, releaseStore, reportWithOwnPlace } from "./harness";

afterEach(releaseStore);

const TARGET = "onboarding checklist for saas teams";
const PAGE = "https://content.example.com/onboarding-checklist";

/** A week whose twelve do not include the page's target, with the page's own
 *  question asked and its Google result bought: `organic` is that result. */
function weekWithPageSerp(organic: { position: number; url: string }[], over: Partial<StoredReport> = {}): StoredReport {
  const pageQuestions = pageQuestionsSectionOf({
    asked: [{ publicationId: "pub-1", liveUrl: PAGE, question: "What goes in an onboarding checklist?", search: TARGET, position: null }],
    serps: [measured(serp({ organic: organic.map((row) => ({ ...row, domain: new URL(row.url).hostname, title: "A page" })) }), AT)],
    battery: [],
    retired: [],
    selected: 1,
    ownDomain: DOMAIN,
    measuredAt: AT,
  });
  // A site the keyword database holds no ranked row for: its rows are
  // complete, and silent.
  return { ...reportWithOwnPlace(null, { ownRanked: measured(0, AT), ownRankedRows: [] }), pageQuestions, ...over };
}

const placeIn = (report: StoredReport, withDemand: readonly string[] = []) => {
  const reading = weekMeasurementsFrom({ report, week: WEEK, targets: [TARGET], withDemand }).positions.get(TARGET);
  return reading === undefined ? undefined : placeOf(reading, [PAGE]);
};

describe("condition 1 — the result already bought for the page's question is its place", () => {
  it("a bought result holding the page at 37 gives a measured place of 37, on a search outside the twelve", () => {
    const place = placeIn(weekWithPageSerp([{ position: 1, url: "https://appcues.com/a" }, { position: 37, url: PAGE }]));
    expect(place).toMatchObject({ kind: "measured", value: 37 });
  });

  it("the page is found through its own addresses, and that result counts as the page seen", () => {
    const report = weekWithPageSerp([{ position: 6, url: "http://www.content.example.com/onboarding-checklist/" }]);
    expect(placeIn(report)).toMatchObject({ kind: "measured", value: 6 });
    expect(urlsIn({ serps: [], ranked: [], pages: report.pageQuestions?.rows })).toContain(
      "http://www.content.example.com/onboarding-checklist/"
    );
  });
});

describe("condition 2 — a target the keyword database does not track is not measured, never a zero", () => {
  it("a bought result without the page, and no tracked demand, is not measured; tracked demand makes it a measured zero", () => {
    const report = weekWithPageSerp([{ position: 1, url: "https://appcues.com/a" }]);
    expect(placeIn(report)?.kind).toBe("unmeasured");
    expect(placeIn(report, [TARGET])?.kind).toBe("zero");
  });
});

describe("condition 3 — a page never seen in any stored result is never not working", () => {
  const week = weekWithPageSerp([{ position: 1, url: "https://appcues.com/a" }]);
  const page = (reading: PageReading) => pageOf({ acceptance: { form: "top20", query: TARGET }, liveUrl: PAGE, volume: 90, reading });

  it("never held: too early, so its cluster is not suppressed and no refresh is due; held at 40 for 8 weeks, it is not working", async () => {
    const store = fakeStore({ pages: [page(readingAt(null))], report: week });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing).toMatchObject({ kind: "verdict", verdict: "too_early" });
    expect(store.inserted[0]).toMatchObject({ verdict: "too_early", measured: { kind: "zero" } });
    releaseStore();

    fakeStore({ pages: [page(readingAt(40, { weeksAgo: 8 }))], report: week });
    const seen = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(seen.standings[0]?.standing).toMatchObject({ kind: "verdict", verdict: "not_working" });
  });
});
