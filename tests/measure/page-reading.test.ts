// The page reading, assembled from a stored weekly scan: every field, what
// is carried forward from the week before, and where the place is read from.
import { describe, expect, it } from "vitest";
import { assembleReading, readingOf, type PageFacts, type PageReading } from "../../src/lib/measure/page-reading";
import { ladderOf } from "../../src/lib/measure/ladder";
import { readStoredReport } from "../../src/lib/scan/report";
import { LOCAL, SAAS, stored, weekWith } from "./reading-fixture";

const WEEK_1 = new Date(Date.UTC(2026, 9, 12, 6, 0, 0));
const WEEK_2 = new Date(Date.UTC(2026, 9, 19, 6, 0, 0));
const WEEK_3 = new Date(Date.UTC(2026, 9, 26, 6, 0, 0));

function facts(over: Partial<PageFacts> = {}): PageFacts {
  return {
    id: "pub-saas",
    liveUrl: SAAS.page,
    search: SAAS.search,
    crawled: false,
    aiReads: 0,
    aiVisits: 0,
    google: null,
    bing: null,
    ...over,
  };
}

const ranked = (keyword: string, url: string, position: number) => ({ keyword, position, searchVolume: 90, url });

/** The SaaS page's first week: #7 on its own result, linked by the AI
 *  Overview, and in the keyword database for two other searches. */
const saasWeek1 = () =>
  readStoredReport(
    stored(
      weekWith({
        domain: SAAS.domain,
        asked: [{ publicationId: "pub-saas", liveUrl: SAAS.page, search: SAAS.search, place: 7, linked: true }],
        ranked: [
          ranked("onboarding checklist template", SAAS.page, 15),
          ranked("saas onboarding steps", SAAS.page, 31),
          ranked("user onboarding checklist", "https://content.example.com/", 3),
        ],
      })
    )
  );

describe("one stored week assembles every field of the reading", () => {
  it("place, first, best, prev, linkedBy, aiReads, variants and the date each step was reached", () => {
    const reading = assembleReading({ before: null, report: saasWeek1(), page: facts({ crawled: true, aiReads: 3, aiVisits: 1 }), now: WEEK_1 });
    const at = WEEK_1.toISOString();

    expect(reading).toEqual({
      at,
      crawled: true,
      // The home page at #3 is not this page: the place is the page's own.
      place: { value: 7, source: "serp", query: SAAS.search },
      first: { at, place: 7 },
      best: { place: 7, at },
      prev: null,
      linkedBy: ["ai_overview"],
      aiReads: 3,
      variants: [
        { query: "onboarding checklist template", place: 15 },
        { query: "saas onboarding steps", place: 31 },
      ],
      reached: { found: at, showing: at, firstPage: at, readByAi: at, linkedByAi: at, aiVisit: at },
      google: null,
      bing: null,
    });
    expect(reading).not.toHaveProperty("seen");
    // What is stored reads back as itself.
    expect(readingOf(stored(reading as never))).toEqual(reading);
  });

  it("carries first, best and every reached date forward; prev is the week before's place", () => {
    const week1 = assembleReading({ before: null, report: saasWeek1(), page: facts({ crawled: true, aiReads: 3 }), now: WEEK_1 });
    const slipped = readStoredReport(
      stored(weekWith({ domain: SAAS.domain, asked: [{ publicationId: "pub-saas", liveUrl: SAAS.page, search: SAAS.search, place: 12 }] }))
    );
    // A week later: down to 12, no longer linked, and the reads aged out.
    const week2 = assembleReading({ before: readingOf(stored(week1 as never)), report: slipped, page: facts({ aiReads: 0 }), now: WEEK_2 });

    expect(week2.place).toEqual({ value: 12, source: "serp", query: SAAS.search });
    expect(week2.prev).toBe(7);
    expect(week2.first).toEqual(week1.first);
    expect(week2.best).toEqual(week1.best);
    expect(week2.crawled).toBe(true);
    expect(week2.linkedBy).toEqual([]);
    expect(week2.reached).toEqual(week1.reached);

    // A second read in the same week keeps the week before as prev.
    expect(assembleReading({ before: week2, report: slipped, page: facts(), now: new Date(WEEK_2.getTime() + 3_600_000) }).prev).toBe(7);

    // Up to 5 the week after: a new best, and the first place stays.
    const climbed = readStoredReport(
      stored(weekWith({ domain: SAAS.domain, asked: [{ publicationId: "pub-saas", liveUrl: SAAS.page, search: SAAS.search, place: 5 }] }))
    );
    const week3 = assembleReading({ before: week2, report: climbed, page: facts(), now: WEEK_3 });
    expect(week3).toMatchObject({ prev: 12, first: { at: WEEK_1.toISOString(), place: 7 }, best: { place: 5, at: WEEK_3.toISOString() } });
  });

  it("what nothing measured is null, never 0: a page off ReachKit's host, and a question not asked", () => {
    const unasked = readStoredReport(stored(weekWith({ domain: LOCAL.domain, asked: [] })));
    const reading = assembleReading({
      before: null,
      report: unasked,
      page: facts({ id: "pub-wp", liveUrl: LOCAL.page, search: LOCAL.search, aiReads: null, aiVisits: null }),
      now: WEEK_1,
    });
    expect(reading).toMatchObject({ place: null, first: null, best: null, linkedBy: null, aiReads: null, variants: [], reached: {} });
    expect(ladderOf(reading, null)).toMatchObject({ bestPlace: null, showing: null, cited: null });
  });

  it("an older stored reading reads defensively, and junk reads as never read", () => {
    const old = { at: WEEK_1.toISOString(), crawled: true, seen: true, cited: false, google: null, bing: null };
    expect(readingOf(old)).toMatchObject({ crawled: true, place: null, first: null, linkedBy: null, reached: {}, variants: [] });
    expect(readingOf(old)).not.toHaveProperty("seen");
    expect(readingOf({ crawled: true })).toBeNull();
    expect(readingOf("nope")).toBeNull();
  });

  it("keeps at most three variants, best first", () => {
    const many = readStoredReport(
      stored(
        weekWith({
          domain: SAAS.domain,
          asked: [{ publicationId: "pub-saas", liveUrl: SAAS.page, search: SAAS.search, place: null }],
          ranked: [40, 22, 61, 18, 90].map((place, i) => ranked(`variant ${i}`, SAAS.page, place)),
        })
      )
    );
    expect(assembleReading({ before: null, report: many, page: facts(), now: WEEK_1 }).variants.map((v) => v.place)).toEqual([18, 22, 40]);
  });
});

describe("Showing reads the page's own result first, then the keyword database, labelled (D8)", () => {
  const localWeek = (place: number | null, labs: number | null) =>
    readStoredReport(
      stored(
        weekWith({
          domain: LOCAL.domain,
          asked: [{ publicationId: "pub-local", liveUrl: LOCAL.page, search: LOCAL.search, place }],
          ranked: labs === null ? [] : [ranked(LOCAL.search, LOCAL.page, labs)],
        })
      )
    );
  const local = facts({ id: "pub-local", liveUrl: LOCAL.page, search: LOCAL.search });

  it("own result: the page's own SERP read wins over the keyword database", () => {
    const reading = assembleReading({ before: null, report: localWeek(4, 9), page: local, now: WEEK_1 });
    expect(reading.place).toEqual({ value: 4, source: "serp", query: LOCAL.search });
    expect(ladderOf(reading, 0)).toMatchObject({ showing: true, bestPlace: 4, placeSource: "serp" });
  });

  it("absent from its own result and in the keyword database: Showing uses it, and says so", () => {
    const reading = assembleReading({ before: null, report: localWeek(null, 14), page: local, now: WEEK_1 });
    expect(reading.place).toEqual({ value: 14, source: "labs", query: LOCAL.search });
    expect(reading.reached.showing).toBe(WEEK_1.toISOString());
    expect(ladderOf(reading, 0)).toMatchObject({ showing: true, bestPlace: 14, placeSource: "labs" });
  });

  it("in neither, Search Console's place is the last read", () => {
    const google = { indexed: true, lastCrawl: null, impressions: 12, clicks: 0, bestPlace: 22.4, bestQuery: "water heater repair" };
    const reading = assembleReading({ before: null, report: localWeek(null, null), page: { ...local, google }, now: WEEK_1 });
    expect(reading.place).toEqual({ value: 22, source: "gsc", query: "water heater repair" });
  });

  it("without Search Console, a page in no row is not shown", () => {
    const reading = assembleReading({ before: null, report: localWeek(null, null), page: local, now: WEEK_1 });
    expect(reading.place).toBeNull();
    expect((reading as PageReading).reached.showing).toBeUndefined();
  });
});
