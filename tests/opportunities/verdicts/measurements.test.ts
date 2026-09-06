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
import { unmeasured } from "../../../src/lib/measure/measured";
import { AT, DOMAIN, question, reportOf, serp } from "../fixtures";
import { emptyReport, reportWithOwnPlace, releaseStore, WEEK } from "./harness";

afterEach(releaseStore);

describe("positions — the customer's own place, from the week's own SERPs", () => {
  it("a measured place is carried with the rank the SERP recorded", () => {
    const week = weekMeasurementsFrom({ report: reportWithOwnPlace(4), week: WEEK });
    const place = week.positions.get("best user onboarding software");
    expect(place?.kind).toBe("measured");
    expect(place?.kind === "measured" && place.value).toBe(4);
  });

  it("a SERP the week read, with the customer absent, is a measured zero and never a missing measurement", () => {
    const week = weekMeasurementsFrom({ report: reportWithOwnPlace(null), week: WEEK });
    expect(week.positions.get("best user onboarding software")?.kind).toBe("zero");
  });

  it("a SERP the week could not read keeps its key, carrying an unmeasured reading", () => {
    const report = reportOf({ questions: [question()], serps: [] }, {
      serps: [unmeasured("undeterminable", AT)],
    });
    const week = weekMeasurementsFrom({ report, week: WEEK });
    // The key is there — the search is still tracked — and the value says
    // the week did not reach it. Dropping the key would say the search
    // left the tracked set, which is terminal.
    expect(week.positions.has("best user onboarding software")).toBe(true);
    expect(week.positions.get("best user onboarding software")?.kind).toBe("unmeasured");
  });

  it("the best of several own rows is the place — a page ranking twice holds the higher one", () => {
    const report = reportOf({
      questions: [question()],
      serps: [
        serp({
          organic: [
            { position: 2, domain: DOMAIN, url: `https://${DOMAIN}/b`, title: "Ours, lower" },
            { position: 7, domain: DOMAIN, url: `https://${DOMAIN}/a`, title: "Ours, deeper" },
          ],
        }),
      ],
    });
    const place = weekMeasurementsFrom({ report, week: WEEK }).positions.get(
      "best user onboarding software"
    );
    expect(place?.kind === "measured" && place.value).toBe(2);
  });
});

describe("namesCustomer — this week's AI answer, keyed by the question a named_on test records", () => {
  it("the key is the question's own wording, which is what the acceptance test recorded", () => {
    const week = weekMeasurementsFrom({ report: reportWithOwnPlace(3), week: WEEK });
    expect(week.namesCustomer.has(question().text)).toBe(true);
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
