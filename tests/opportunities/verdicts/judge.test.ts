// judgeWeek — one site's week, judged once, from that week's measurement.
//
// Two fixtures here carry ADR-085's whole cost, and they differ only in
// what the one check at 24 hours recorded: `could_not_confirm` gives an
// ordinary verdict with a note beside it, identical in every other respect
// to a page whose check passed, and `page_not_found` gives `not_judgeable`
// with that cause and no note at all. Routing the first to the second
// completes the union the obvious way, passes every other test here, and
// retires a live page forever on the strength of ReachKit's own 502.
// The bindings `env.ts` parses at module load, before anything that
// reaches `@/lib/db` is evaluated.
import "../env";
import { afterEach, describe, expect, it } from "vitest";
import { judgeWeek } from "../../../src/lib/opportunities/verdicts/judge";
import { earlierAddresses } from "../../../src/lib/opportunities/verdicts/store";
import {
  PAGE_URL,
  PREVIOUS_WEEK,
  WEEK,
  fakeStore,
  pageOf,
  readingAt,
  record,
  releaseStore,
  reportWithOwnPlace,
  verification,
} from "./harness";
import { measured, unmeasured } from "../../../src/lib/measure/measured";
import { AT, DOMAIN, SITE_ID, question, reportOf, serp } from "../fixtures";
import { assembleReading, readingOf, type PageReading } from "../../../src/lib/measure/page-reading";
import { readStoredReport, type StoredReport } from "../../../src/lib/scan/report";
import { LOCAL, SAAS, stored, weekWith } from "../../measure/reading-fixture";

afterEach(releaseStore);

describe("REQ-063 c1 — every publicly served published page is judged against its recorded test", () => {
  it("a page whose search it holds a place on reads working", async () => {
    fakeStore({ report: reportWithOwnPlace(3) });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings).toHaveLength(1);
    expect(standings[0]?.standing).toMatchObject({ kind: "verdict", verdict: "working" });
  });

  it("a page absent from a SERP the week did read is judged, not withheld", async () => {
    fakeStore({ pages: [pageOf({ reading: readingAt(50, { weeksAgo: 8 }) })], report: reportWithOwnPlace(null) });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing).toMatchObject({ kind: "verdict", verdict: "not_working" });
  });

  it("a WordPress page is judged exactly as a hosted one is — the module holds no destination-kind test at all", async () => {
    // The population is read off `live_url` (ADR-084 made `servesPublicly`
    // true at both destinations), so there is nothing here to tell the two
    // apart, and this fixture is the hosted one with a different address.
    const store = fakeStore({
      pages: [
        pageOf({ publicationId: "hosted", liveUrl: "https://content.example.com/a" }),
        pageOf({ publicationId: "wordpress", liveUrl: "https://blog.customer.com/a" }),
      ],
      report: reportWithOwnPlace(3),
    });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings.map((s) => s.standing)).toEqual([
      standings[0]?.standing,
      standings[0]?.standing,
    ]);
    expect(store.rows).toHaveLength(2);
  });

  it("a page with no publication row gets no standing — by the absence of the row, not by a rule", async () => {
    fakeStore({ pages: [], report: reportWithOwnPlace(3) });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings).toEqual([]);
  });
});

describe("REQ-063 c1 — the two outcomes of the one check at 24 hours go opposite ways", () => {
  it("a stored could_not_confirm gives an ordinary verdict with a verifyNote beside it", async () => {
    fakeStore({
      pages: [pageOf({ verification: verification("could_not_confirm") })],
      report: reportWithOwnPlace(3),
    });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing).toMatchObject({
      kind: "verdict",
      verdict: "working",
      verifyNote: { note: "could_not_confirm", checkedAt: AT },
    });
  });

  it("…identical in every other respect to a page whose check passed", async () => {
    fakeStore({
      pages: [
        pageOf({ publicationId: "confirmed", verification: verification("found") }),
        pageOf({ publicationId: "unconfirmed", verification: verification("could_not_confirm") }),
      ],
      report: reportWithOwnPlace(3),
    });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    const [passed, unconfirmed] = standings;
    expect(passed?.standing.kind).toBe("verdict");
    expect(unconfirmed?.standing.kind).toBe("verdict");
    expect({ ...passed?.standing, verifyNote: null }).toEqual({ ...unconfirmed?.standing, verifyNote: null });
  });

  it("a stored page_not_found gives not_judgeable with that cause and no verifyNote at all", async () => {
    fakeStore({
      pages: [pageOf({ verification: verification("page_not_found") })],
      report: reportWithOwnPlace(3),
    });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing).toEqual({
      kind: "not_judgeable",
      cause: "page_not_found",
      lastJudgedWeek: null,
    });
    expect(standings[0]?.standing).not.toHaveProperty("verifyNote");
  });

  it("a failed check is stated beside the verdict and never in place of one", async () => {
    fakeStore({
      pages: [pageOf({ verification: verification("found", ["indexable", "sitemap"]) })],
      report: reportWithOwnPlace(3),
    });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing).toMatchObject({
      kind: "verdict",
      verdict: "working",
      verifyNote: { note: "checks_failed", failed: ["indexable", "sitemap"] },
    });
  });
});

describe("REQ-063 c5 — an unmeasured week and a partly measured one", () => {
  it("an unmeasured week writes zero rows and every page reads no_week", async () => {
    const store = fakeStore({
      pages: [pageOf({ publicationId: "a" }), pageOf({ publicationId: "b" })],
      report: null,
    });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings.map((s) => s.standing)).toEqual([{ kind: "no_week" }, { kind: "no_week" }]);
    expect(store.inserted).toEqual([]);
  });

  it("a partial week judges the decidable pages and leaves the rest not_measured with no row", async () => {
    const store = fakeStore({
      pages: [
        pageOf({ publicationId: "decidable" }),
        pageOf({ publicationId: "gated", acceptance: { form: "gate_cleared", gate: "js_only" } }),
      ],
      report: reportWithOwnPlace(3),
    });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing.kind).toBe("verdict");
    expect(standings[1]?.standing).toEqual({ kind: "not_measured" });
    expect(store.rows.map((row) => row.publicationId)).toEqual(["decidable"]);
  });
});

describe("REQ-063 c6 — the three causes this node supplies, from stored state", () => {
  it("a page the customer unpublished is not_judgeable with that cause", async () => {
    fakeStore({
      pages: [pageOf({ unpublishedAt: new Date("2026-08-20T00:00:00.000Z") })],
      report: reportWithOwnPlace(3),
    });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing).toMatchObject({ kind: "not_judgeable", cause: "unpublished" });
  });

  it("a page published under a domain the site is no longer measured under is not_judgeable with domain_changed", async () => {
    fakeStore({ pages: [pageOf({ domain: "old-domain.com" })], report: reportWithOwnPlace(3) });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing).toMatchObject({ kind: "not_judgeable", cause: "domain_changed" });
  });

  it("each cause is written with its own cause value, and none stands in for another", async () => {
    fakeStore({
      pages: [
        pageOf({ publicationId: "unpublished", unpublishedAt: AT }),
        pageOf({ publicationId: "missing", verification: verification("page_not_found") }),
        pageOf({ publicationId: "moved", domain: "elsewhere.com" }),
        pageOf({ publicationId: "unread", reading: null }),
      ],
      report: reportWithOwnPlace(3),
    });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(
      standings.map((s) => (s.standing.kind === "not_judgeable" ? s.standing.cause : s.standing.kind))
    ).toEqual(["unpublished", "page_not_found", "domain_changed", "not_measured"]);
  });

  it("lastJudgedWeek is the last verdict's week, and null where the page never received one", async () => {
    fakeStore({
      pages: [pageOf({ publicationId: "judged", unpublishedAt: AT }), pageOf({ publicationId: "never", unpublishedAt: AT })],
      report: reportWithOwnPlace(3),
      history: [record({ publicationId: "judged", week: PREVIOUS_WEEK })],
    });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing).toMatchObject({ lastJudgedWeek: PREVIOUS_WEEK });
    expect(standings[1]?.standing).toMatchObject({ lastJudgedWeek: null });
  });
});

describe("#795 — a page's search is read every week, in the twelve or not", () => {
  const OUTSIDE = { form: "top20", query: "onboarding checklist template" } as const;
  const CHECKLIST = "https://example.com/checklist";
  const row = (keyword: string, position: number) => ({
    keyword,
    position,
    searchVolume: 20,
    url: CHECKLIST,
  });

  it("a search that left the twelve is read from the site's own ranked rows", async () => {
    const store = fakeStore({
      pages: [pageOf({ publicationId: "outside", acceptance: OUTSIDE, liveUrl: CHECKLIST })],
      report: reportWithOwnPlace(3, {
        ownRanked: measured(2, AT),
        ownRankedRows: [row("Onboarding  Checklist Template", 7), row("something else", 4)],
      }),
    });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing).toMatchObject({ kind: "verdict", verdict: "working" });
    expect(store.inserted[0]).toMatchObject({ verdict: "working", cause: null, measured: { kind: "measured", value: 7 } });
  });

  it("a site that ranks for it outside the top twenty, or not at all, is judged — never untracked", async () => {
    const store = fakeStore({
      pages: [
        pageOf({ publicationId: "deep", acceptance: OUTSIDE, liveUrl: CHECKLIST, reading: readingAt(35, { weeksAgo: 8 }) }),
        pageOf({ publicationId: "absent", acceptance: { form: "top20", query: "a search the site holds no place on" }, volume: 90, reading: readingAt(null) }),
      ],
      report: reportWithOwnPlace(3, {
        ownRanked: measured(1, AT),
        ownRankedRows: [row("onboarding checklist template", 35)],
      }),
    });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings.map((s) => s.standing)).toMatchObject([
      { kind: "verdict", verdict: "not_working" },
      { kind: "verdict", verdict: "too_early" },
    ]);
    expect(store.inserted.map((row) => row.measured?.kind)).toEqual(["measured", "zero"]);
  });

  it("rows that were not read, or that are fewer than the site ranks for, record no place: the label is the reading's", async () => {
    for (const over of [
      { ownRanked: unmeasured<number>("not_attempted", AT), ownRankedRows: [] },
      { ownRanked: measured(500, AT), ownRankedRows: [row("something else", 4)] },
    ]) {
      const store = fakeStore({
        pages: [pageOf({ publicationId: "outside", acceptance: OUTSIDE, liveUrl: CHECKLIST })],
        report: reportWithOwnPlace(3, over),
      });
      const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
      expect(standings[0]?.standing).toMatchObject({ kind: "verdict", verdict: "working" });
      expect(store.inserted[0]?.measured?.kind).toBe("unmeasured");
      releaseStore();
    }
  });
});

describe("REQ-063 c3/c4 — what moved, and over what interval", () => {
  it("a worse place than the previous recorded measurement is carried as a decline", async () => {
    fakeStore({
      report: reportWithOwnPlace(9),
      reports: { [PREVIOUS_WEEK]: reportWithOwnPlace(3) },
      history: [record({ week: PREVIOUS_WEEK, measured: measured(3, AT) })],
    });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing).toMatchObject({
      kind: "verdict",
      movement: { previousWeek: PREVIOUS_WEEK, spansWeeks: 1, declined: true },
    });
  });

  it("a gap in the series spans more than one week", async () => {
    fakeStore({
      report: reportWithOwnPlace(3),
      history: [record({ week: "2026-08-17", measured: measured(3, AT) })],
    });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing).toMatchObject({ movement: { spansWeeks: 2 } });
  });
});

describe("idempotency is the unique key, not a guard", () => {
  it("a re-run of the same week inserts nothing further and mints no second verdict", async () => {
    const store = fakeStore({ report: reportWithOwnPlace(3) });
    await judgeWeek({ siteId: SITE_ID, week: WEEK });
    await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(store.inserted).toHaveLength(2);
    expect(store.rows).toHaveLength(1);
  });

  it("two sites in different time zones are judged under the week each is in, a day apart", async () => {
    const store = fakeStore({ report: reportWithOwnPlace(3) });
    await judgeWeek({ siteId: SITE_ID, week: "2026-08-31" });
    await judgeWeek({ siteId: SITE_ID, week: "2026-09-01" });
    expect(store.rows.map((row) => row.week)).toEqual(["2026-08-31", "2026-09-01"]);
  });
});

describe("issue 1518 — a page's Google verdict is about that page's own address", () => {
  const SEARCH = "best user onboarding software";
  const HOME = { position: 3, domain: DOMAIN, url: `https://${DOMAIN}/`, title: "Home" };
  const ranked = (position: number) => ({ keyword: SEARCH, position, searchVolume: 90, url: PAGE_URL });
  const weekOf = (organic: readonly (typeof HOME)[], over: Parameters<typeof reportOf>[1] = {}) =>
    reportOf({ questions: [question()], serps: [serp({ organic: [...organic] })] }, over);

  it("the home page at #3 with the article never held is too early, and records no place", async () => {
    const store = fakeStore({ pages: [pageOf({ reading: readingAt(null) })], report: weekOf([HOME]) });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing).toMatchObject({ kind: "verdict", verdict: "too_early" });
    expect(store.inserted[0]?.measured).toMatchObject({ kind: "zero" });
  });

  it("an article at 14 in the ranked rows only, on one of the twelve, is working at place 14", async () => {
    const store = fakeStore({
      report: weekOf([HOME], { ownRanked: measured(2, AT), ownRankedRows: [ranked(14)] }),
    });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing).toMatchObject({ kind: "verdict", verdict: "working" });
    expect(store.inserted[0]?.measured).toMatchObject({ kind: "measured", value: 14 });
  });

  it("issue 1537 — on a site whose ranked rows were capped, an article in neither the SERP nor the rows records no place", async () => {
    const elsewhere = Array.from({ length: 300 }, (_, i) => ({ keyword: `other search ${i}`, position: 1 + (i % 50), searchVolume: 90, url: `https://${DOMAIN}/p${i}` }));
    const store = fakeStore({ report: weekOf([HOME], { ownRanked: measured(1200, AT), ownRankedRows: elsewhere }) });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing).toMatchObject({ kind: "verdict" });
    expect(store.rows[0]?.measured?.kind).toBe("unmeasured");
  });

  it("the movement compares the page's own places, read again from the previous week's stored report", async () => {
    const store = fakeStore({
      report: weekOf([HOME], { ownRanked: measured(1, AT), ownRankedRows: [ranked(12)] }),
      // The row the previous week wrote holds the domain's best place, 3.
      history: [record({ week: PREVIOUS_WEEK, measured: measured(3, AT) })],
      reports: { [PREVIOUS_WEEK]: weekOf([HOME, { position: 8, domain: DOMAIN, url: PAGE_URL, title: "Ours" }]) },
    });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing).toMatchObject({
      kind: "verdict",
      verdict: "working",
      movement: { from: { kind: "measured", value: 8 }, to: { kind: "measured", value: 12 }, declined: true },
    });
    expect(store.inserted[0]?.movement).toMatchObject({ declined: true });
  });

  it("a row at an address the page answered at before is the page's, on whatever host that was", async () => {
    // The host the page was published on before its site's host moved
    // (issue 896): not the site's domain, and still this page.
    const OLD = "https://pages.earlier-host.example/old-slug";
    fakeStore({
      pages: [pageOf({ earlierUrls: [OLD] })],
      report: weekOf([{ ...HOME, position: 5, domain: "pages.earlier-host.example" as typeof DOMAIN, url: OLD, title: "Old" }]),
    });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing).toMatchObject({ kind: "verdict", verdict: "working" });
  });
});

describe("issue 1518 — the addresses a page answered at before", () => {
  const row = (id: string, liveUrl: string, from: string | null) => ({
    id,
    live_url: liveUrl,
    drafts: {
      meta: null,
      opportunities: { acceptance: null, target_query: null, volume: null, family: from === null ? "write" : "improve", target_ref: from },
    },
  });

  it("follows each retarget back through the addresses it moved from, and the host the row recorded", () => {
    const first = row("p1", "https://content.example.com/first", null);
    const second = row("p2", "https://content.example.com/second", "https://content.example.com/first/");
    const third = row("p3", "https://old.example.com/third", "https://content.example.com/second");
    expect(earlierAddresses(third, [first, second, third], "https://content.example.com/third")).toEqual([
      "https://old.example.com/third",
      "https://content.example.com/second",
      "https://content.example.com/first/",
    ]);
  });

  it("a Write row names no earlier address, and an update in place names none", () => {
    const write = row("w", "https://content.example.com/a", null);
    const refresh = row("r", "https://content.example.com/a", "https://content.example.com/a");
    expect(earlierAddresses(write, [write], "https://content.example.com/a")).toEqual([]);
    expect(earlierAddresses(refresh, [refresh, write], "https://content.example.com/a")).toEqual([]);
  });
});

describe("ADR-071 point 2 — a week whose place was not read is never stored as not moving", () => {
  const WEEK_MS = 7 * 86_400_000;

  it("15 for 9 weeks, then a week whose ranked rows were capped, writes no not_working row (SaaS and local)", async () => {
    for (const panel of [SAAS, LOCAL]) {
      const weekAt = (place: number | null): StoredReport =>
        weekWith({ domain: panel.domain, asked: [{ publicationId: "pub-1", liveUrl: panel.page, search: panel.search, place }] });
      // The capped week: the site ranks for more searches than the rows kept.
      const capped: StoredReport = { ...weekAt(null), ownRanked: measured(1200, AT) };
      const weeks = [...Array<StoredReport>(9).fill(weekAt(15)), capped];
      const page = { id: "pub-1", liveUrl: panel.page, search: panel.search, crawled: false, aiReads: 0, aiVisits: 0, google: null, bing: null };
      let reading: PageReading | null = null;
      weeks.forEach((report, n) => {
        const now = new Date(AT.getTime() - (weeks.length - 1 - n) * WEEK_MS);
        reading = readingOf(stored(assembleReading({ before: reading, report: readStoredReport(stored(report)), page, now }) as never));
      });
      const store = fakeStore({
        pages: [pageOf({ domain: panel.domain, liveUrl: panel.page, acceptance: { form: "top20", query: panel.search }, reading })],
        report: capped,
      });
      const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
      expect(standings[0]?.standing).toEqual({ kind: "not_measured" });
      expect(store.rows).toHaveLength(0);
      releaseStore();
    }
  });
});
