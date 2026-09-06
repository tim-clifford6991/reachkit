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
import {
  PREVIOUS_WEEK,
  WEEK,
  fakeStore,
  pageOf,
  record,
  releaseStore,
  reportWithOwnPlace,
  verification,
} from "./harness";
import { measured } from "../../../src/lib/measure/measured";
import { AT, SITE_ID } from "../fixtures";

afterEach(releaseStore);

describe("REQ-063 c1 — every publicly served published page is judged against its recorded test", () => {
  it("a page whose search it holds a place on reads working", async () => {
    fakeStore({ report: reportWithOwnPlace(3) });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings).toHaveLength(1);
    expect(standings[0]?.standing).toMatchObject({ kind: "verdict", verdict: "working" });
  });

  it("a page absent from a SERP the week did read is judged, not withheld", async () => {
    fakeStore({ report: reportWithOwnPlace(null) });
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

  it("each of the five causes is written with its own cause value, and none stands in for another", async () => {
    fakeStore({
      pages: [
        pageOf({ publicationId: "unpublished", unpublishedAt: AT }),
        pageOf({ publicationId: "missing", verification: verification("page_not_found") }),
        pageOf({ publicationId: "moved", domain: "elsewhere.com" }),
        pageOf({ publicationId: "untracked", acceptance: { form: "top20", query: "a search nobody measures" } }),
        pageOf({ publicationId: "left", acceptance: { form: "named_on", question: "a question nobody asks" } }),
      ],
      report: reportWithOwnPlace(3),
    });
    const { standings } = await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(
      standings.map((s) => (s.standing.kind === "not_judgeable" ? s.standing.cause : s.standing.kind))
    ).toEqual([
      "unpublished",
      "page_not_found",
      "domain_changed",
      "search_untracked",
      "question_left_set",
    ]);
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

describe("REQ-063 c3/c4 — what moved, and over what interval", () => {
  it("a worse place than the previous recorded measurement is carried as a decline", async () => {
    fakeStore({
      report: reportWithOwnPlace(9),
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
