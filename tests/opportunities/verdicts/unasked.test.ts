// A page judged on its question is never retired because the capped
// page-question slots did not reach it: it is labelled from its reading.
import "../env";
import { afterEach, describe, expect, it } from "vitest";
import { judgeWeek } from "../../../src/lib/opportunities/verdicts/judge";
import { pageQuestionsSectionOf } from "../../../src/lib/scan/sections";
import { measured } from "../../../src/lib/measure/measured";
import { serp } from "../fixtures";
import { AT, DOMAIN, SITE_ID, WEEK, fakeStore, pageOf, releaseStore, reportWithOwnPlace } from "./harness";

afterEach(releaseStore);

const SLOTS = 12;

/** Thirteen answer pages of a SaaS site, of which the week asked twelve. */
function thirteenPagesTwelveAsked() {
  const pages = Array.from({ length: SLOTS + 1 }, (_, i) =>
    pageOf({
      publicationId: `pub-${i + 1}`,
      liveUrl: `https://content.example.com/onboarding-question-${i + 1}`,
      acceptance: { form: "named_on", question: `How do I run onboarding step ${i + 1}?` },
    })
  );
  const asked = pages.slice(0, SLOTS);
  const pageQuestions = pageQuestionsSectionOf({
    asked: asked.map((page, i) => ({
      publicationId: page.publicationId,
      liveUrl: page.liveUrl,
      question: `How do I run onboarding step ${i + 1}?`,
      search: `onboarding step ${i + 1}`,
      position: null,
    })),
    // Each answer read its sources, and cited a rival.
    serps: asked.map(() =>
      measured(
        serp({
          aiOverview: { present: true, asynchronousAiOverview: true, referenceDomains: ["appcues.com"], referenceUrls: ["https://appcues.com/a"] },
        }),
        AT
      )
    ),
    battery: [],
    retired: [],
    selected: 1,
    ownDomain: DOMAIN,
    measuredAt: AT,
  });
  return { pages, report: { ...reportWithOwnPlace(null), pageQuestions } };
}

describe("condition 1 — a question not asked this week is not measured, never a terminal row", () => {
  it("13 pages and 12 slots: all thirteen are labelled from their readings, and no row retires a page", async () => {
    const { pages, report } = thirteenPagesTwelveAsked();
    const store = fakeStore({ pages, report });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });

    expect(standings.map((s) => s.standing.kind)).toEqual(Array<string>(SLOTS + 1).fill("verdict"));
    expect(store.inserted.filter((row) => row.verdict === "not_judgeable")).toEqual([]);
  });
});
