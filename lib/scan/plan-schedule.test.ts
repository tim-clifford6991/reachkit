/**
 * plan-schedule.test.ts — the singular plan timeline (PURE).
 *
 * Coverage: merge dedupe (tracked + already-shipped titles), tracked-first
 * ordering, the §11-as-scheduler pacing rules (content 1/week, venue-host
 * spacing, weekly budget/count caps), oversized entries still placing, and
 * nothing ever being dropped.
 */
import { describe, expect, test } from "vitest";
import {
  mergePlanEntries,
  schedulePlan,
  scheduleToDays,
  byScheduleOrder,
  buildDailyPostAngles,
  addDailyPosts,
  CONTENT_EFFORT_MIN,
  DAILY_POST_HORIZON_DAYS,
  type PlanEntry,
} from "./plan-schedule";
import type { BoardAction } from "./action-board";

function boardAction(overrides: Partial<BoardAction> & { id: string; title: string }): BoardAction {
  return {
    category: "outreach",
    why: null,
    predictedDelta: null,
    actualDelta: null,
    createdAt: "2026-07-01T00:00:00Z",
    verifiedAt: null,
    draft: null,
    verifyUrl: null,
    effortMin: null,
    ...overrides,
  };
}

function entry(overrides: Partial<PlanEntry> & { key: string; title: string }): PlanEntry {
  return {
    actionId: null,
    kind: "distribution",
    why: null,
    channel: "community",
    target: null,
    targetUrl: null,
    effortMin: 60,
    priority: "medium",
    predictedDelta: null,
    draft: null,
    tracked: false,
    evidence: null,
    ...overrides,
  };
}

describe("mergePlanEntries", () => {
  test("tracked actions come through with their execution payload", () => {
    const merged = mergePlanEntries({
      openActions: [boardAction({ id: "a1", title: "Submit to AlternativeTo", draft: "listing copy", verifyUrl: "https://alternativeto.net", effortMin: 15 })],
      allActionTitles: new Set(["Submit to AlternativeTo"]),
      content: [],
      distribution: [],
    });
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ actionId: "a1", tracked: true, draft: "listing copy", targetUrl: "https://alternativeto.net", effortMin: 15 });
  });

  test("suggestions matching ANY existing action title are dropped (open or shipped)", () => {
    const merged = mergePlanEntries({
      openActions: [],
      allActionTitles: new Set(["Already shipped topic", "Open action"]),
      content: [{ topic: "Already shipped topic", priority: "high" }, { topic: "Fresh topic", priority: "high" }],
      distribution: [{ action: "Open action", channel: "community", target: "r/SaaS", effort: "low", priority: "high" }],
    });
    expect(merged.map((e) => e.title)).toEqual(["Fresh topic"]);
    expect(merged[0]).toMatchObject({ tracked: false, kind: "content", effortMin: CONTENT_EFFORT_MIN });
  });

  test("distribution suggestions map effort and carry the venue", () => {
    const merged = mergePlanEntries({
      openActions: [],
      allActionTitles: new Set(),
      content: [],
      distribution: [{ action: "Post in r/SaaS", channel: "community", target: "r/SaaS", targetUrl: "https://reddit.com/r/SaaS", effort: "low", priority: "high" }],
    });
    expect(merged[0]).toMatchObject({ kind: "distribution", effortMin: 15, targetUrl: "https://reddit.com/r/SaaS", channel: "community" });
  });
});

describe("byScheduleOrder", () => {
  test("tracked beats untracked; then priority; then quick wins", () => {
    const tracked = entry({ key: "t", title: "t", tracked: true, priority: "low" });
    const highSuggest = entry({ key: "h", title: "h", priority: "high" });
    const quickMedium = entry({ key: "q", title: "q", priority: "medium", effortMin: 15 });
    const slowMedium = entry({ key: "s", title: "s", priority: "medium", effortMin: 180 });
    const sorted = [slowMedium, quickMedium, highSuggest, tracked].sort(byScheduleOrder);
    expect(sorted.map((e) => e.key)).toEqual(["t", "h", "q", "s"]);
  });
});

describe("schedulePlan — §11 pacing as the calendar", () => {
  test("only one content piece per week", () => {
    const weeks = schedulePlan([
      entry({ key: "c1", title: "Post A", kind: "content", effortMin: 150, priority: "high" }),
      entry({ key: "c2", title: "Post B", kind: "content", effortMin: 150, priority: "high" }),
    ]);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]!.entries.map((e) => e.key)).toEqual(["c1"]);
    expect(weeks[1]!.entries.map((e) => e.key)).toEqual(["c2"]);
  });

  test("two actions on the same venue host land in different weeks", () => {
    const weeks = schedulePlan([
      entry({ key: "d1", title: "Comment in r/SaaS", targetUrl: "https://reddit.com/r/SaaS", effortMin: 15, priority: "high" }),
      entry({ key: "d2", title: "Post in r/startups", targetUrl: "https://reddit.com/r/startups", effortMin: 15, priority: "high" }),
    ]);
    // Same host (reddit.com) → spaced across weeks even though budget allows both.
    expect(weeks).toHaveLength(2);
    expect(weeks[0]!.entries).toHaveLength(1);
    expect(weeks[1]!.entries).toHaveLength(1);
  });

  test("weekly budget and count caps push overflow to later weeks — nothing dropped", () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      entry({ key: `d${i}`, title: `Action ${i}`, effortMin: 60, priority: "medium", targetUrl: `https://venue${i}.com` }),
    );
    const weeks = schedulePlan(many, { weeklyBudgetMin: 120, maxPerWeek: 4, maxDistributionPerWeek: 3 });
    const placed = weeks.flatMap((w) => w.entries.map((e) => e.key));
    expect(placed).toHaveLength(9);
    // 120min budget / 60min each → 2 per week.
    expect(weeks[0]!.entries).toHaveLength(2);
  });

  test("an entry longer than the whole weekly budget still lands (alone)", () => {
    const weeks = schedulePlan([
      entry({ key: "big", title: "Long play", effortMin: 999, priority: "high" }),
      entry({ key: "small", title: "Quick", effortMin: 15, priority: "high", targetUrl: "https://venue.com" }),
    ]);
    const all = weeks.flatMap((w) => w.entries.map((e) => e.key));
    expect(all).toContain("big");
    expect(all).toContain("small");
  });

  test("deterministic: same input, same schedule", () => {
    const input = [
      entry({ key: "a", title: "A", priority: "high", effortMin: 30 }),
      entry({ key: "b", title: "B", priority: "high", effortMin: 30 }),
    ];
    expect(schedulePlan(input)).toEqual(schedulePlan([...input].reverse()));
  });
});

describe("scheduleToDays — the calendar layer", () => {
  // Wednesday 2026-07-08 (local): week 0 has Wed..Sun left.
  const wednesday = new Date(2026, 6, 8);

  test("week 0 starts TODAY, one entry per day, never in the past", () => {
    const weeks = [{
      index: 0,
      entries: [
        entry({ key: "a", title: "A" }),
        entry({ key: "b", title: "B" }),
        entry({ key: "c", title: "C" }),
      ],
    }];
    const days = scheduleToDays(weeks, wednesday);
    expect(days.map((d) => d.date)).toEqual(["2026-07-08", "2026-07-09", "2026-07-10"]);
    expect(days.every((d) => d.entries.length === 1)).toBe(true);
  });

  test("later weeks start on their Monday", () => {
    const weeks = [{ index: 1, entries: [entry({ key: "a", title: "A" })] }];
    const days = scheduleToDays(weeks, wednesday);
    expect(days.map((d) => d.date)).toEqual(["2026-07-13"]);
  });

  test("more entries than remaining days wraps round-robin (nothing dropped)", () => {
    const sunday = new Date(2026, 6, 12); // week 0 has only Sunday left
    const weeks = [{
      index: 0,
      entries: [entry({ key: "a", title: "A" }), entry({ key: "b", title: "B" })],
    }];
    const days = scheduleToDays(weeks, sunday);
    expect(days).toHaveLength(1);
    expect(days[0]!.date).toBe("2026-07-12");
    expect(days[0]!.entries.map((e) => e.key)).toEqual(["a", "b"]);
  });

  test("deterministic for a fixed today", () => {
    const weeks = schedulePlan([
      entry({ key: "a", title: "A", priority: "high" }),
      entry({ key: "b", title: "B", priority: "medium" }),
    ]);
    expect(scheduleToDays(weeks, wednesday)).toEqual(scheduleToDays(weeks, new Date(2026, 6, 8)));
  });
});

describe("daily posts — content as a habit", () => {
  const wednesday = new Date(2026, 6, 8);
  const synthesisLike = {
    category: "AI meeting notes",
    contentPlan: [
      { topic: "Best AI meeting note tools", buyerAngle: "teams drowning in calls", priority: "high" },
    ],
    distribution: [
      { action: "Post in r/SaaS", channel: "community", target: "r/SaaS", why: "Buyers describe this pain weekly.", effort: "low", priority: "high" },
    ],
  };

  test("angle pool is grounded in the plan + evergreen beats, deterministic", () => {
    const angles = buildDailyPostAngles(synthesisLike);
    // 2 per content item (topic tip + pain point) + 1 per distribution why + 3 evergreen.
    expect(angles).toHaveLength(6);
    expect(angles.map((a) => a.title).join(" ")).toContain("Best AI meeting note tools");
    expect(buildDailyPostAngles(synthesisLike)).toEqual(angles);
  });

  test("every day through the horizon gets a post, posts lead the day", () => {
    const scheduled = scheduleToDays(
      schedulePlan([entry({ key: "d1", title: "Submit somewhere", priority: "high" })]),
      wednesday,
    );
    const days = addDailyPosts(scheduled, buildDailyPostAngles(synthesisLike), wednesday);
    expect(days).toHaveLength(DAILY_POST_HORIZON_DAYS);
    expect(days[0]!.date).toBe("2026-07-08");
    // 30-day rolling horizon: Jul 8 + 29 = Aug 6.
    expect(days[days.length - 1]!.date).toBe("2026-08-06");
    // Every day has a post; the day that also has the distribution action puts the post FIRST.
    expect(days.every((d) => d.entries.some((e) => e.kind === "post"))).toBe(true);
    const busy = days.find((d) => d.entries.length > 1)!;
    expect(busy.entries[0]!.kind).toBe("post");
  });

  test("days already posted (dated tracked title) stay clear", () => {
    const days = addDailyPosts([], buildDailyPostAngles(synthesisLike), wednesday, {
      horizonDays: 3,
      postedDates: new Set(["2026-07-09"]),
    });
    expect(days.map((d) => d.date)).toEqual(["2026-07-08", "2026-07-10"]);
  });

  test("mergePlanEntries never misfiles tracked daily posts as articles", () => {
    const merged = mergePlanEntries({
      openActions: [boardAction({ id: "p1", title: "X post (2026-07-08): Tip: something", category: "content" })],
      allActionTitles: new Set(["X post (2026-07-08): Tip: something"]),
      content: [],
      distribution: [],
    });
    expect(merged).toHaveLength(0);
  });
});
