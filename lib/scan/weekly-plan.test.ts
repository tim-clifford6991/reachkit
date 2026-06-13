/**
 * Pure-helper unit tests for the weekly plan assembler (§10.3). These exercise
 * the effort bucketing, the this-week / carryover split, the score delta, and the
 * §7.2 rule 5 honesty note WITHOUT a DB — the DB wiring is covered by the
 * integration test (tests/integration/weekly-plan.test.ts).
 */

import { describe, expect, test } from "vitest";
import {
  effortBucket,
  honestyNote,
  isInWeek,
  isoWeekStartDate,
  scoreDelta,
  splitQueueAndCarryover,
  type WeeklyPlanAction,
} from "./weekly-plan";

// ---------------------------------------------------------------------------
// isoWeekStartDate — mirrors the cron's isoWeekStart (date-only)
// ---------------------------------------------------------------------------

describe("isoWeekStartDate", () => {
  test("returns the same UTC Monday for every day of that ISO week", () => {
    // Mon 2026-06-08 .. Sun 2026-06-14 → all collapse to 2026-06-08.
    expect(isoWeekStartDate(new Date("2026-06-08T00:00:00Z"))).toBe("2026-06-08");
    expect(isoWeekStartDate(new Date("2026-06-11T13:40:00Z"))).toBe("2026-06-08");
    expect(isoWeekStartDate(new Date("2026-06-14T23:59:59Z"))).toBe("2026-06-08");
  });

  test("a Sunday belongs to the week that started the previous Monday", () => {
    // Sun 2026-06-07 → previous Monday 2026-06-01.
    expect(isoWeekStartDate(new Date("2026-06-07T12:00:00Z"))).toBe("2026-06-01");
  });

  test("uses UTC, not local time", () => {
    // Just after midnight UTC Monday is still that Monday regardless of TZ.
    expect(isoWeekStartDate(new Date("2026-06-08T00:00:01Z"))).toBe("2026-06-08");
  });
});

// ---------------------------------------------------------------------------
// effortBucket — §10.3 horizon mix thresholds
// ---------------------------------------------------------------------------

describe("effortBucket", () => {
  test("< 30 → quickWins", () => {
    expect(effortBucket(0)).toBe("quickWins");
    expect(effortBucket(10)).toBe("quickWins");
    expect(effortBucket(29)).toBe("quickWins");
  });

  test("30..120 inclusive → medium", () => {
    expect(effortBucket(30)).toBe("medium");
    expect(effortBucket(45)).toBe("medium");
    expect(effortBucket(120)).toBe("medium");
  });

  test("> 120 → longPlay", () => {
    expect(effortBucket(121)).toBe("longPlay");
    expect(effortBucket(130)).toBe("longPlay");
  });

  test("null effort is treated as 30 → medium", () => {
    expect(effortBucket(null)).toBe("medium");
  });
});

// ---------------------------------------------------------------------------
// isInWeek — half-open [Mon 00:00 UTC, next Mon 00:00 UTC)
// ---------------------------------------------------------------------------

describe("isInWeek", () => {
  const weekOf = "2026-06-08";

  test("the Monday boundary itself is in the week (inclusive start)", () => {
    expect(isInWeek("2026-06-08T00:00:00.000Z", weekOf)).toBe(true);
  });

  test("a mid-week timestamp is in the week", () => {
    expect(isInWeek("2026-06-11T13:40:00.000Z", weekOf)).toBe(true);
  });

  test("the last instant before next Monday is in the week", () => {
    expect(isInWeek("2026-06-14T23:59:59.999Z", weekOf)).toBe(true);
  });

  test("next Monday 00:00 is NOT in the week (exclusive end)", () => {
    expect(isInWeek("2026-06-15T00:00:00.000Z", weekOf)).toBe(false);
  });

  test("the previous week is NOT in the week", () => {
    expect(isInWeek("2026-06-07T23:59:59.999Z", weekOf)).toBe(false);
    expect(isInWeek("2026-06-01T00:00:00.000Z", weekOf)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// splitQueueAndCarryover — bucket this-week opens, carry earlier opens, drop done
// ---------------------------------------------------------------------------

interface Row {
  id: string;
  status: string;
  created_at: string;
  effort_min: number | null;
  category: string;
  title: string;
  why: string | null;
  deadline: string | null;
  draft: string | null;
  score_component: string | null;
}

function row(over: Partial<Row> & Pick<Row, "id">): Row {
  return {
    status: "open",
    created_at: "2026-06-11T10:00:00.000Z", // this week (weekOf 2026-06-08)
    effort_min: 45,
    category: "content",
    title: `title-${over.id}`,
    why: null,
    deadline: null,
    draft: null,
    score_component: null,
    ...over,
  };
}

const project = (r: Row): WeeklyPlanAction => ({
  id: r.id,
  category: r.category,
  title: r.title,
  why: r.why,
  effortMin: r.effort_min,
  deadline: r.deadline,
  draft: r.draft,
  status: r.status,
  scoreComponent: r.score_component,
});

describe("splitQueueAndCarryover", () => {
  const weekOf = "2026-06-08";

  test("buckets open this-week actions by effort", () => {
    const { queue, carryover } = splitQueueAndCarryover(
      [
        row({ id: "q", effort_min: 10 }),
        row({ id: "m", effort_min: 45 }),
        row({ id: "l", effort_min: 130 }),
      ],
      weekOf,
      project,
    );
    expect(queue.quickWins.map((a) => a.id)).toEqual(["q"]);
    expect(queue.medium.map((a) => a.id)).toEqual(["m"]);
    expect(queue.longPlay.map((a) => a.id)).toEqual(["l"]);
    expect(carryover).toEqual([]);
  });

  test("open action created BEFORE the week is carryover, not queued", () => {
    const { queue, carryover } = splitQueueAndCarryover(
      [row({ id: "old", created_at: "2026-06-01T10:00:00.000Z", effort_min: 10 })],
      weekOf,
      project,
    );
    expect(carryover).toEqual(["old"]);
    expect(queue.quickWins).toEqual([]);
    expect(queue.medium).toEqual([]);
    expect(queue.longPlay).toEqual([]);
  });

  test("done actions are excluded from both queue and carryover", () => {
    const { queue, carryover } = splitQueueAndCarryover(
      [
        row({ id: "done-this-week", status: "done", effort_min: 10 }),
        row({
          id: "done-old",
          status: "done",
          created_at: "2026-06-01T10:00:00.000Z",
        }),
      ],
      weekOf,
      project,
    );
    expect(queue.quickWins).toEqual([]);
    expect(queue.medium).toEqual([]);
    expect(queue.longPlay).toEqual([]);
    expect(carryover).toEqual([]);
  });

  test("projects rows to WeeklyPlanAction shape", () => {
    const { queue } = splitQueueAndCarryover(
      [row({ id: "x", effort_min: 45, why: "because", score_component: "seo" })],
      weekOf,
      project,
    );
    expect(queue.medium[0]).toEqual({
      id: "x",
      category: "content",
      title: "title-x",
      why: "because",
      effortMin: 45,
      deadline: null,
      draft: null,
      status: "open",
      scoreComponent: "seo",
    });
  });

  test("any non-'done' status counts as open", () => {
    const { queue, carryover } = splitQueueAndCarryover(
      [
        row({ id: "todo", status: "todo", effort_min: 10 }),
        row({ id: "in_progress", status: "in_progress", effort_min: 45 }),
      ],
      weekOf,
      project,
    );
    expect(queue.quickWins.map((a) => a.id)).toEqual(["todo"]);
    expect(queue.medium.map((a) => a.id)).toEqual(["in_progress"]);
    expect(carryover).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// scoreDelta — newest minus prior, 0 if <2
// ---------------------------------------------------------------------------

describe("scoreDelta", () => {
  test("latest minus prior (snapshots newest-first)", () => {
    expect(scoreDelta([{ total: 64 }, { total: 60 }])).toBe(4);
  });

  test("can be negative", () => {
    expect(scoreDelta([{ total: 55 }, { total: 60 }])).toBe(-5);
  });

  test("0 when fewer than 2 snapshots", () => {
    expect(scoreDelta([])).toBe(0);
    expect(scoreDelta([{ total: 42 }])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// honestyNote — §7.2 rule 5
// ---------------------------------------------------------------------------

describe("honestyNote", () => {
  test("score rose + installs flat → caution", () => {
    const note = honestyNote([
      { total: 64, installs_reported: 100 },
      { total: 60, installs_reported: 100 },
    ]);
    expect(note).not.toBeNull();
    expect(note).toContain("installs");
  });

  test("score rose + installs down → caution", () => {
    expect(
      honestyNote([
        { total: 64, installs_reported: 80 },
        { total: 60, installs_reported: 100 },
      ]),
    ).not.toBeNull();
  });

  test("score rose + installs up → null", () => {
    expect(
      honestyNote([
        { total: 64, installs_reported: 150 },
        { total: 60, installs_reported: 100 },
      ]),
    ).toBeNull();
  });

  test("score did not rise → null even if installs flat", () => {
    expect(
      honestyNote([
        { total: 60, installs_reported: 100 },
        { total: 60, installs_reported: 100 },
      ]),
    ).toBeNull();
  });

  test("missing installs on either snapshot → null", () => {
    expect(
      honestyNote([
        { total: 64, installs_reported: null },
        { total: 60, installs_reported: 100 },
      ]),
    ).toBeNull();
    expect(
      honestyNote([
        { total: 64, installs_reported: 100 },
        { total: 60, installs_reported: null },
      ]),
    ).toBeNull();
  });

  test("fewer than 2 snapshots → null", () => {
    expect(honestyNote([])).toBeNull();
    expect(honestyNote([{ total: 64, installs_reported: 100 }])).toBeNull();
  });
});
