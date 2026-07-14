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
  topThreeByHorizon,
  buildThreadReplyEntries,
  addThreadReplies,
  buildPlanDays,
  buildPlanDaysWithReplies,
  placePinnedEntries,
  CONTENT_EFFORT_MIN,
  DAILY_POST_HORIZON_DAYS,
  THREAD_REPLY_EFFORT_MIN,
  type PlanEntry,
  type ScheduledDay,
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
    target: null,
    scheduledFor: null,
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
    expect(merged[0]).toMatchObject({ kind: "distribution", effortMin: 8, targetUrl: "https://reddit.com/r/SaaS", channel: "community" });
  });

  test("a tracked action's ActionTarget populates the plan entry's channel/target/targetUrl", () => {
    const entries = mergePlanEntries({
      openActions: [{
        id: "a1", title: "Post in r/productivity", category: "outreach", why: null,
        predictedDelta: 3, actualDelta: null, createdAt: "2026-07-01", verifiedAt: null,
        draft: null, verifyUrl: null, effortMin: 30, scheduledFor: null,
        target: { channel: "community", label: "r/productivity", url: "https://reddit.com/r/productivity" },
      }],
      allActionTitles: new Set(["Post in r/productivity"]),
      content: [], distribution: [],
    });
    const e = entries[0]!;
    expect(e.channel).toBe("community");
    expect(e.target).toBe("r/productivity");
    expect(e.targetUrl).toBe("https://reddit.com/r/productivity");
  });

  test("a tracked action without a target keeps today's behavior", () => {
    const entries = mergePlanEntries({
      openActions: [{
        id: "a2", title: "Fix title tag", category: "seo", why: null,
        predictedDelta: null, actualDelta: null, createdAt: "2026-07-01", verifiedAt: null,
        draft: null, verifyUrl: "https://example.com", effortMin: 20, target: null, scheduledFor: null,
      }],
      allActionTitles: new Set(["Fix title tag"]),
      content: [], distribution: [],
    });
    const e = entries[0]!;
    expect(e.channel).toBeNull();
    expect(e.target).toBeNull();
    expect(e.targetUrl).toBe("https://example.com");
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

describe("topThreeByHorizon", () => {
  // horizon reminders: kind "post" → short; kind "content" → medium;
  // kind "distribution" + channel "community" (or effortMin<=6) → short;
  // kind "distribution" otherwise → long.
  const post = entry({ key: "post", title: "Post", kind: "post", priority: "high" });
  const content = entry({ key: "content", title: "Content", kind: "content", priority: "medium" });
  const longPlay = entry({ key: "long", title: "Long", kind: "distribution", channel: "directory", effortMin: 60, priority: "medium" });
  const quickReply = entry({ key: "reply", title: "Reply", kind: "distribution", channel: "community", effortMin: 4, priority: "high" });

  test("one entry per horizon, returned in short/medium/long order", () => {
    const picked = topThreeByHorizon([longPlay, content, quickReply]);
    expect(picked.map((e) => e.key)).toEqual(["reply", "content", "long"]);
  });

  test("within a horizon, the highest-priority entry wins (byScheduleOrder)", () => {
    const lowReply = entry({ key: "low-reply", title: "Low reply", kind: "distribution", channel: "community", priority: "low" });
    const picked = topThreeByHorizon([lowReply, quickReply, content, longPlay]);
    // quickReply (high) beats lowReply (low) for the short slot.
    expect(picked.map((e) => e.key)).toEqual(["reply", "content", "long"]);
  });

  test("an empty horizon backfills from the remaining highest-priority entries", () => {
    // Two "short" candidates, no medium/long entries at all.
    const secondShort = entry({ key: "short2", title: "Short2", kind: "post", priority: "high" });
    const picked = topThreeByHorizon([post, secondShort]);
    expect(picked.map((e) => e.key).sort()).toEqual(["post", "short2"]);
    expect(picked).toHaveLength(2);
  });

  test("fewer than 3 entries total returns all of them", () => {
    expect(topThreeByHorizon([post])).toHaveLength(1);
    expect(topThreeByHorizon([])).toHaveLength(0);
  });

  test("never returns more than 3 even with many candidates", () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      entry({ key: `d${i}`, title: `D${i}`, kind: "distribution", channel: "directory", effortMin: 60, priority: "medium" }),
    );
    expect(topThreeByHorizon(many)).toHaveLength(3);
  });

  test("deterministic regardless of input order", () => {
    const a = topThreeByHorizon([longPlay, content, quickReply, post]);
    const b = topThreeByHorizon([post, quickReply, content, longPlay]);
    expect(a.map((e) => e.key)).toEqual(b.map((e) => e.key));
  });
});

describe("buildThreadReplyEntries — quick-win replies from REAL demand threads", () => {
  test("ranks by intent (desc) and shapes the PlanEntry per spec", () => {
    const entries = buildThreadReplyEntries([
      { title: "How do I get my SaaS discovered on Google?", url: "https://reddit.com/r/SaaS/1", intent: 0.4 },
      { title: "Anyone struggling with search visibility for their product", url: "https://reddit.com/r/startups/2", intent: 0.9 },
    ]);
    expect(entries.map((e) => e.targetUrl)).toEqual(["https://reddit.com/r/startups/2", "https://reddit.com/r/SaaS/1"]);
    const top = entries[0]!;
    expect(top).toMatchObject({
      kind: "distribution",
      channel: "community",
      effortMin: THREAD_REPLY_EFFORT_MIN,
      priority: "high",
      draft: null,
      tracked: false,
      evidence: "https://reddit.com/r/startups/2",
      why: "A buyer is describing your problem unprompted — a genuine, helpful reply puts you in front of them.",
    });
    expect(top.title).toBe("Reply to: Anyone struggling with search visibility for their product");
  });

  test("truncates a long thread title to 60 chars in the entry title", () => {
    const longTitle = "A".repeat(80);
    const [entryOut] = buildThreadReplyEntries([{ title: longTitle, url: "https://reddit.com/r/x/1" }]);
    expect(entryOut!.title.length).toBeLessThanOrEqual("Reply to: ".length + 60);
  });

  test("dedupes by url and caps at the limit", () => {
    const threads = Array.from({ length: 8 }, (_, i) => ({ title: `Thread ${i}`, url: `https://reddit.com/${i}`, intent: i }));
    const entries = buildThreadReplyEntries([...threads, threads[0]!], { limit: 3 });
    expect(entries).toHaveLength(3);
    expect(new Set(entries.map((e) => e.targetUrl)).size).toBe(3);
  });

  test("skips threads whose derived title is already an existing action (no duplicate work)", () => {
    const thread = { title: "Already actioned thread", url: "https://reddit.com/r/x/1" };
    const entries = buildThreadReplyEntries([thread], { excludeTitles: new Set(["Reply to: Already actioned thread"]) });
    expect(entries).toHaveLength(0);
  });

  test("HONESTY: no threads in → no entries out, nothing invented", () => {
    expect(buildThreadReplyEntries([])).toEqual([]);
  });

  test("drops threads missing a title or url — nothing to reply to", () => {
    const entries = buildThreadReplyEntries([
      { title: "", url: "https://reddit.com/r/x/1" },
      { title: "No url", url: "" },
    ] as { title: string; url: string }[]);
    expect(entries).toHaveLength(0);
  });
});

describe("addThreadReplies — at most 1 reply/day, right after the daily post", () => {
  const reply = (key: string): PlanEntry => entry({ key, title: key, kind: "distribution", channel: "community", effortMin: 4, priority: "high" });
  const dayWithPost = (date: string): ScheduledDay => ({
    date,
    entries: [entry({ key: `post:${date}`, title: "Daily post", kind: "post" })],
  });

  test("injects one reply per day, right after the post, consuming the queue in order", () => {
    const days = [dayWithPost("2026-07-08"), dayWithPost("2026-07-09")];
    const out = addThreadReplies(days, [reply("r1"), reply("r2"), reply("r3")]);
    expect(out[0]!.entries.map((e) => e.key)).toEqual([`post:2026-07-08`, "r1"]);
    expect(out[1]!.entries.map((e) => e.key)).toEqual([`post:2026-07-09`, "r2"]);
  });

  test("once the reply queue is exhausted, later days pass through untouched", () => {
    const days = [dayWithPost("2026-07-08"), dayWithPost("2026-07-09")];
    const out = addThreadReplies(days, [reply("r1")]);
    expect(out[0]!.entries.map((e) => e.key)).toEqual([`post:2026-07-08`, "r1"]);
    expect(out[1]!.entries.map((e) => e.key)).toEqual([`post:2026-07-09`]);
  });

  test("no replies → days pass through unchanged (no fabrication)", () => {
    const days = [dayWithPost("2026-07-08")];
    expect(addThreadReplies(days, [])).toEqual(days);
  });

  test("a day with no post gets the reply at the front", () => {
    const days = [{ date: "2026-07-08", entries: [entry({ key: "d1", title: "Distro" })] }];
    const out = addThreadReplies(days, [reply("r1")]);
    expect(out[0]!.entries.map((e) => e.key)).toEqual(["r1", "d1"]);
  });
});

describe("placePinnedEntries — scheduledFor pins to a day, bypassing the pacer", () => {
  const wednesday = new Date(2026, 6, 8); // 2026-07-08
  const pinnedEntry = (over: Partial<PlanEntry> & { key: string; scheduledFor: string }): PlanEntry => ({
    actionId: "a", kind: "distribution", title: "t", why: null, channel: null, target: null,
    targetUrl: null, effortMin: 10, priority: "high", predictedDelta: null, draft: null,
    tracked: true, evidence: null, ...over,
  });

  test("lands on its exact day, creating the day if absent", () => {
    const days = placePinnedEntries([], [pinnedEntry({ key: "k1", scheduledFor: "2026-07-08" })], wednesday);
    expect(days).toHaveLength(1);
    expect(days[0]!.date).toBe("2026-07-08");
    expect(days[0]!.entries.map((e) => e.key)).toEqual(["k1"]);
  });

  test("a past pin is clamped to today (never schedules into the past)", () => {
    const days = placePinnedEntries([], [pinnedEntry({ key: "k1", scheduledFor: "2026-07-01" })], wednesday);
    expect(days[0]!.date).toBe("2026-07-08");
  });

  test("appends to an existing day and stays date-sorted; empty pins is a no-op", () => {
    expect(placePinnedEntries([{ date: "2026-07-08", entries: [] }], [], wednesday)).toEqual([{ date: "2026-07-08", entries: [] }]);
    const existing: ScheduledDay[] = [{ date: "2026-07-10", entries: [] }, { date: "2026-07-08", entries: [{ key: "x" } as PlanEntry] }];
    const days = placePinnedEntries(existing, [pinnedEntry({ key: "k1", scheduledFor: "2026-07-08" })], wednesday);
    expect(days.map((d) => d.date)).toEqual(["2026-07-08", "2026-07-10"]);
    expect(days[0]!.entries.map((e) => e.key)).toEqual(["x", "k1"]);
  });
});

describe("buildPlanDays — a pinned tracked action lands on today, not paced", () => {
  const wednesday = new Date(2026, 6, 8);
  const todayKey = "2026-07-08";

  test("scheduledFor=today puts the action on today's entries", () => {
    const board = {
      open: [boardAction({ id: "gen1", title: "Launch on X", category: "outreach", scheduledFor: todayKey, effortMin: 10 })],
      retry: [], verifying: [], done: [],
    };
    const days = buildPlanDays({ board, category: "SaaS", content: [], distribution: [], today: wednesday });
    const today = days.find((d) => d.date === todayKey);
    expect(today?.entries.some((e) => e.actionId === "gen1")).toBe(true);
  });
});

describe("buildPlanDaysWithReplies — threadReplies wiring (progressive enhancement)", () => {
  const wednesday = new Date(2026, 6, 8);
  const emptyBoard = { open: [], retry: [], verifying: [], done: [] };

  test("omitting threadReplies equals the base buildPlanDays (additive/optional)", () => {
    const base = buildPlanDays({ board: emptyBoard, category: "SaaS", content: [], distribution: [], today: wednesday });
    const withOmitted = buildPlanDaysWithReplies({ board: emptyBoard, category: "SaaS", content: [], distribution: [], today: wednesday });
    const withEmpty = buildPlanDaysWithReplies({ board: emptyBoard, category: "SaaS", content: [], distribution: [], today: wednesday, threadReplies: [] });
    expect(withOmitted).toEqual(withEmpty);
    expect(withOmitted).toEqual(base);
  });

  test("real threads surface as a reply entry on the plan", () => {
    const days = buildPlanDaysWithReplies({
      board: emptyBoard,
      category: "SaaS",
      content: [],
      distribution: [],
      today: wednesday,
      threadReplies: [{ title: "Buyers asking for exactly this", url: "https://reddit.com/r/SaaS/9", intent: 0.8 }],
    });
    const allEntries = days.flatMap((d) => d.entries);
    const replyEntry = allEntries.find((e) => e.targetUrl === "https://reddit.com/r/SaaS/9");
    expect(replyEntry).toBeDefined();
    expect(replyEntry!.title).toBe("Reply to: Buyers asking for exactly this");
    expect(replyEntry!.draft).toBeNull();
  });
});
