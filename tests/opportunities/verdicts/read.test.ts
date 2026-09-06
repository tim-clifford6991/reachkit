// readWeek and weeklyDigest — what a surface and the Monday mail read.
//
// The case that discriminates is the fallback: falling back to the most
// recent verdict when the requested week has no row is the change that
// shows a customer last week's verdict as this week's, and it reads in
// review as a helpful default. REQ-063 c5 forbids it in terms.
import "../env";
import { afterEach, describe, expect, it } from "vitest";
import { judgeWeek } from "../../../src/lib/opportunities/verdicts/judge";
import { readWeek, weeklyDigest } from "../../../src/lib/opportunities/verdicts/read";
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

describe("a read is scoped to the week it was asked about", () => {
  it("a week with no rows never returns a neighbouring week's verdict", async () => {
    fakeStore({
      report: reportWithOwnPlace(3),
      thisWeek: [record({ week: PREVIOUS_WEEK })],
    });
    const standings = await readWeek({ siteId: SITE_ID, week: WEEK });
    // The measurement exists, so the page reads `not_measured` — not last
    // week's `working`.
    expect(standings[0]?.standing).toEqual({ kind: "not_measured" });
  });

  it("a week that was not measured at all reads no_week, not not_measured", async () => {
    fakeStore({ report: null });
    const standings = await readWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing).toEqual({ kind: "no_week" });
  });

  it("a judged week reads back the verdict, the movement and the date exactly as they were written — and a page can be working and still have declined", async () => {
    fakeStore({
      report: reportWithOwnPlace(9),
      history: [record({ week: PREVIOUS_WEEK, measured: measured(3, AT) })],
    });
    await judgeWeek({ siteId: SITE_ID, week: WEEK });
    const standings = await readWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing).toMatchObject({
      kind: "verdict",
      // Position 9 is still a place inside the top twenty, so the page
      // passes its recorded test — and it slipped six places getting
      // there, which is shown beside the verdict rather than smoothed
      // away by it (REQ-063 c3).
      verdict: "working",
      movement: { from: measured(3, AT), to: measured(9, AT), declined: true },
    });
  });

  it("a page that received a verdict in one week and became unjudgeable later reads lastJudgedWeek as the earlier one", async () => {
    fakeStore({
      pages: [pageOf({ unpublishedAt: AT })],
      report: reportWithOwnPlace(3),
      history: [record({ week: PREVIOUS_WEEK })],
    });
    await judgeWeek({ siteId: SITE_ID, week: WEEK });
    const standings = await readWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing).toEqual({
      kind: "not_judgeable",
      cause: "unpublished",
      lastJudgedWeek: PREVIOUS_WEEK,
    });
  });

  it("a page that never received one reads null", async () => {
    fakeStore({ pages: [pageOf({ unpublishedAt: AT })], report: reportWithOwnPlace(3) });
    await judgeWeek({ siteId: SITE_ID, week: WEEK });
    const standings = await readWeek({ siteId: SITE_ID, week: WEEK });
    expect(standings[0]?.standing).toMatchObject({ lastJudgedWeek: null });
  });

  it("neither read writes anything", async () => {
    const store = fakeStore({ report: reportWithOwnPlace(3), thisWeek: [record({ week: WEEK })] });
    await readWeek({ siteId: SITE_ID, week: WEEK });
    await weeklyDigest({ siteId: SITE_ID, week: WEEK });
    expect(store.inserted).toEqual([]);
  });
});

describe("the digest — REQ-063 c4's four things", () => {
  it("carries each page's standing, the address it is served at, and the week's measurement date", async () => {
    const report = reportWithOwnPlace(3);
    fakeStore({ report });
    await judgeWeek({ siteId: SITE_ID, week: WEEK });
    const digest = await weeklyDigest({ siteId: SITE_ID, week: WEEK });
    expect(digest.weekMeasuredAt).toEqual(report.verdict.measuredAt);
    expect(digest.standings[0]?.liveUrl).toBe(pageOf().liveUrl);
    expect(digest.standings[0]?.standing.kind).toBe("verdict");
  });

  it("carries the verifyNote where there is one, beside the verdict and never in place of it", async () => {
    fakeStore({
      pages: [pageOf({ verification: verification("could_not_confirm") })],
      report: reportWithOwnPlace(3),
    });
    await judgeWeek({ siteId: SITE_ID, week: WEEK });
    const digest = await weeklyDigest({ siteId: SITE_ID, week: WEEK });
    expect(digest.standings[0]?.standing).toMatchObject({
      kind: "verdict",
      verdict: "working",
      verifyNote: { note: "could_not_confirm" },
    });
  });

  it("a week that was not measured carries no measurement date and no verdict", async () => {
    fakeStore({ report: null });
    const digest = await weeklyDigest({ siteId: SITE_ID, week: WEEK });
    expect(digest.weekMeasuredAt).toBeNull();
    expect(digest.standings[0]?.standing).toEqual({ kind: "no_week" });
  });

  it("a site whose access has ended is judged for no new week, while every verdict already recorded stays readable with the date it was taken", async () => {
    // Access is the weekly measurement's gate (REQ-065 c5): a week nobody
    // measured has no scan, so nothing new is judged — and the rows
    // already written are read back unchanged.
    const store = fakeStore({ report: null, thisWeek: [record({ week: PREVIOUS_WEEK })] });
    await judgeWeek({ siteId: SITE_ID, week: WEEK });
    expect(store.inserted).toEqual([]);
    const earlier = await readWeek({ siteId: SITE_ID, week: PREVIOUS_WEEK });
    expect(earlier[0]?.standing).toMatchObject({ kind: "verdict", verdict: "working", measuredAt: AT });
  });
});
