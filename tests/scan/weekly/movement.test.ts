// tests/scan/weekly/movement.test.ts — §12's two opening figures are
// **deltas**, and a delta is a statement about a pair of weeks (#181).
//
// The row that matters is the first digest a site ever gets: with no
// previous week there is no movement to state, and the honest answer is
// `unmeasured` — which the mail's omission rule drops. A zero would tell a
// customer nothing changed in the week when there was nothing yet to
// change from, and it would print, because a measured zero is a result.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../../publish/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { previousWeekStart, weekMovement } = await import("@/lib/scan/weekly");

const AT = new Date(Date.UTC(2026, 8, 7, 6, 0, 0));
const WEEK = "2026-09-07";
const BEFORE = "2026-08-31";

/** A stored report, as far as the two figures are concerned. */
function report(a: { score: number | null; citations: number | null }): Record<string, unknown> {
  return {
    version: 4,
    verdict: {
      scoreAndBand:
        a.score === null
          ? { kind: "unmeasured", reason: "not_attempted", at: AT.toISOString() }
          : { kind: "measured", value: { score: a.score, band: "findable" }, at: AT.toISOString() },
    },
    aiAnswers:
      a.citations === null
        ? null
        : {
            measuredSearches: 12,
            answeredSearches: 9,
            customerCitations: a.citations,
            measuredAt: AT.toISOString(),
            ownDomain: "example.com",
            rivals: [],
          },
  };
}

function seedWeek(weekStart: string, r: Record<string, unknown> | null): void {
  db.seed("scans", [
    ...db.rows("scans"),
    {
      id: `scan-${weekStart}`,
      site_id: "site-1",
      tier: "weekly",
      week_start: weekStart,
      status: "done",
      report: r,
    } as Row,
  ]);
}

beforeEach(() => {
  db.reset();
  db.seed("scans", []);
});

describe("the previous week is the calendar week before, as a date", () => {
  it.each([
    ["2026-09-07", "2026-08-31"],
    ["2026-01-04", "2025-12-28"],
    ["2026-03-30", "2026-03-23"], // across a spring-forward weekend
  ])("%s → %s", (week, before) => {
    expect(previousWeekStart(week)).toBe(before);
  });
});

describe("a delta needs two measurements", () => {
  it("two measured weeks give the difference, and it carries the week's own date", async () => {
    seedWeek(BEFORE, report({ score: 41, citations: 2 }));
    seedWeek(WEEK, report({ score: 45, citations: 5 }));

    const movement = await weekMovement({ siteId: "site-1", weekStart: WEEK, at: AT });
    expect(movement.scoreDelta).toEqual({ kind: "measured", value: 4, at: AT });
    expect(movement.aiAnswersDelta).toEqual({ kind: "measured", value: 3, at: AT });
  });

  it("**no previous week is unmeasured, never zero** — the first digest states no movement", async () => {
    seedWeek(WEEK, report({ score: 45, citations: 5 }));

    const movement = await weekMovement({ siteId: "site-1", weekStart: WEEK, at: AT });
    expect(movement.scoreDelta.kind).toBe("unmeasured");
    expect(movement.aiAnswersDelta.kind).toBe("unmeasured");
  });

  it("no movement between two measured weeks is a measured zero, which prints", async () => {
    seedWeek(BEFORE, report({ score: 45, citations: 5 }));
    seedWeek(WEEK, report({ score: 45, citations: 5 }));

    const movement = await weekMovement({ siteId: "site-1", weekStart: WEEK, at: AT });
    expect(movement.scoreDelta).toEqual({ kind: "measured", value: 0, at: AT });
    expect(movement.aiAnswersDelta).toEqual({ kind: "measured", value: 0, at: AT });
  });

  it("a movement downward is stated as one — the regression is shown, never hidden", async () => {
    seedWeek(BEFORE, report({ score: 52, citations: 6 }));
    seedWeek(WEEK, report({ score: 45, citations: 2 }));

    const movement = await weekMovement({ siteId: "site-1", weekStart: WEEK, at: AT });
    expect(movement.scoreDelta).toMatchObject({ kind: "measured", value: -7 });
    expect(movement.aiAnswersDelta).toMatchObject({ kind: "measured", value: -4 });
  });

  it("the two figures are independent: one week can reach a score and not the AI answers", async () => {
    seedWeek(BEFORE, report({ score: 41, citations: 2 }));
    seedWeek(WEEK, report({ score: 45, citations: null }));

    const movement = await weekMovement({ siteId: "site-1", weekStart: WEEK, at: AT });
    expect(movement.scoreDelta).toMatchObject({ kind: "measured", value: 4 });
    expect(movement.aiAnswersDelta.kind).toBe("unmeasured");
  });

  it("an unmeasured score on either side is not a zero on either figure", async () => {
    seedWeek(BEFORE, report({ score: null, citations: 2 }));
    seedWeek(WEEK, report({ score: 45, citations: 5 }));

    const movement = await weekMovement({ siteId: "site-1", weekStart: WEEK, at: AT });
    expect(movement.scoreDelta.kind).toBe("unmeasured");
    expect(movement.aiAnswersDelta).toMatchObject({ kind: "measured", value: 3 });
  });

  it("a week whose AI answers could not be read is unmeasured, never a delta (issue 869)", async () => {
    // The AI Mode engine answered 1 call in 14 on production. A section
    // that read no answer at all counts `0` citations over `0` measured
    // searches, and the mail would have printed that as "AI answers −2".
    const blank = report({ score: 45, citations: 0 });
    blank.aiAnswers = {
      measuredSearches: 0,
      answeredSearches: 0,
      customerCitations: 0,
      measuredAt: AT.toISOString(),
      ownDomain: "example.com",
      rivals: [],
    };
    seedWeek(BEFORE, report({ score: 41, citations: 2 }));
    seedWeek(WEEK, blank);

    const movement = await weekMovement({ siteId: "site-1", weekStart: WEEK, at: AT });
    expect(movement.scoreDelta).toMatchObject({ kind: "measured", value: 4 });
    expect(movement.aiAnswersDelta.kind).toBe("unmeasured");
  });

  it("a week that read its answers and was named by none still moves", async () => {
    seedWeek(BEFORE, report({ score: 41, citations: 2 }));
    seedWeek(WEEK, report({ score: 45, citations: 0 }));

    const movement = await weekMovement({ siteId: "site-1", weekStart: WEEK, at: AT });
    expect(movement.aiAnswersDelta).toMatchObject({ kind: "measured", value: -2 });
  });

  it("a week with a row and no report at all yields neither figure", async () => {
    seedWeek(BEFORE, report({ score: 41, citations: 2 }));
    seedWeek(WEEK, null);

    const movement = await weekMovement({ siteId: "site-1", weekStart: WEEK, at: AT });
    expect(movement.scoreDelta.kind).toBe("unmeasured");
    expect(movement.aiAnswersDelta.kind).toBe("unmeasured");
  });

  it("it reads and writes nothing — the weeks are left exactly as they were", async () => {
    seedWeek(BEFORE, report({ score: 41, citations: 2 }));
    seedWeek(WEEK, report({ score: 45, citations: 5 }));
    const before = JSON.stringify(db.rows("scans"));

    await weekMovement({ siteId: "site-1", weekStart: WEEK, at: AT });
    expect(JSON.stringify(db.rows("scans"))).toBe(before);
  });
});

describe("SPEC §9 on Monday: the technical checks that moved (#573)", () => {
  const issues = (brokenLinks: number) => ({
    pagesChecked: 40,
    stoppedBy: "complete",
    issues: [
      { check: "broken_links", ran: true, count: brokenLinks, over: 120, unit: "links", severity: brokenLinks === 0 ? "nothing_to_fix" : "worth_fixing", doer: "free_fix" },
    ],
  });

  it("reads both stored weeks' checks: a fixed issue is last week's count and this week's zero", async () => {
    seedWeek(BEFORE, { ...report({ score: 45, citations: 5 }), version: 7, siteIssues: issues(2) });
    seedWeek(WEEK, { ...report({ score: 45, citations: 5 }), version: 7, siteIssues: issues(0) });

    const movement = await weekMovement({ siteId: "site-1", weekStart: WEEK, at: AT });
    expect(movement.issueChanges).toEqual({
      kind: "measured",
      value: [{ check: "broken_links", from: 2, to: 0, over: 120, unit: "links", severity: "nothing_to_fix" }],
      at: AT,
    });
  });

  it("a week before the checks existed is unmeasured, never 'nothing moved'", async () => {
    seedWeek(BEFORE, report({ score: 45, citations: 5 }));
    seedWeek(WEEK, { ...report({ score: 45, citations: 5 }), version: 7, siteIssues: issues(0) });

    const movement = await weekMovement({ siteId: "site-1", weekStart: WEEK, at: AT });
    expect(movement.issueChanges.kind).toBe("unmeasured");
  });
});
