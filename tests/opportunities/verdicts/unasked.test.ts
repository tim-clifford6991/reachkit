// A page judged on its question is never retired because the capped page-question
// slots did not reach it, and a place in the top twenty of its target passes it.
import "../env";
import { afterEach, describe, expect, it } from "vitest";
import { judgeWeek } from "../../../src/lib/opportunities/verdicts/judge";
import { pageQuestionsSectionOf } from "../../../src/lib/scan/sections";
import { measured } from "../../../src/lib/measure/measured";
import { question, reportOf, search, serp } from "../fixtures";
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
  it("13 pages and 12 slots: twelve are judged, the thirteenth is not_measured, and no row retires a page", async () => {
    const { pages, report } = thirteenPagesTwelveAsked();
    const store = fakeStore({ pages, report });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });

    expect(standings.map((s) => s.standing.kind)).toEqual([...Array<string>(SLOTS).fill("verdict"), "not_measured"]);
    expect(store.inserted.filter((row) => row.verdict === "not_judgeable")).toEqual([]);
    expect(store.inserted.map((row) => row.publicationId)).not.toContain(`pub-${SLOTS + 1}`);
  });
});

describe("condition 2 — a named_on page also passes on the top twenty of its target", () => {
  const TARGET = "water heater repair austin";
  const PAGE = "https://content.example.com/water-heater-repair-austin";
  /** A local plumber's week: its target among the twelve, the page at 14, its question not asked. */
  const plumberWeek = () =>
    reportOf({
      questions: [question({ text: "Who repairs water heaters in Austin?", search: search({ keyword: TARGET }) })],
      serps: [
        serp({
          organic: [
            { position: 1, domain: "rotorooter.com", url: "https://rotorooter.com/austin", title: "Roto-Rooter" },
            { position: 14, domain: "content.example.com", url: PAGE, title: "Ours" },
          ],
        }),
      ],
    });

  it("a page at 14 on its target reads working although its question was not asked", async () => {
    const store = fakeStore({
      pages: [
        pageOf({
          liveUrl: PAGE,
          acceptance: { form: "named_on", question: "How much does water heater repair cost in Austin?" },
          targetQuery: TARGET,
        }),
      ],
      report: plumberWeek(),
    });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing).toMatchObject({ kind: "verdict", verdict: "working" });
    expect(store.inserted.map((row) => [row.verdict, row.cause])).toEqual([["working", null]]);
  });

  it("the same page with no target recorded stays not_measured", async () => {
    const store = fakeStore({
      pages: [
        pageOf({ liveUrl: PAGE, acceptance: { form: "named_on", question: "How much does water heater repair cost in Austin?" } }),
      ],
      report: plumberWeek(),
    });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing).toEqual({ kind: "not_measured" });
    expect(store.inserted).toEqual([]);
  });
});
