/**
 * Integration test for the engagement data layer (Cycle 4 Task 15, §7.3) against
 * real Supabase. Seeds an app with `outcomes` (verified actions) across three
 * consecutive ISO weeks (>= 3 each) and a run of `score_snapshots`, then asserts:
 *   - weeklyStreak === 3 (three consecutive >= 3 weeks ending at the current week);
 *   - scoreHistory is ordered oldest-first and projected to { takenAt, total };
 *   - engagementSummary returns all three fields, with the §7.2 rule 5 honesty
 *     note firing/null per the seeded installs.
 *
 * Run with: pnpm test:int tests/integration/engagement.test.ts
 */

import { afterEach, expect, test } from "vitest";
import { serverDb } from "@/lib/db/client";
import {
  engagementSummary,
  scoreHistory,
  weeklyStreak,
} from "@/lib/scan/engagement";
import { isoWeekStartDate } from "@/lib/scan/weekly-plan";
import type { Json } from "@/lib/db/types";

const db = serverDb();
const createdAppIds: string[] = [];

afterEach(async () => {
  for (const appId of createdAppIds.splice(0)) {
    await db.from("outcomes").delete().eq("app_id", appId);
    await db.from("score_snapshots").delete().eq("app_id", appId);
    await db.from("apps").delete().eq("id", appId);
  }
});

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** A timestamp inside the ISO week that is `n` weeks before the current one. */
function inWeeksAgo(n: number): string {
  const currentWeek = isoWeekStartDate(new Date());
  const weekMonday = isoWeekStartDate(
    new Date(Date.parse(`${currentWeek}T00:00:00.000Z`) - n * WEEK_MS),
  );
  // Noon Wednesday of that week — safely inside [Mon 00:00, next Mon 00:00).
  return new Date(Date.parse(`${weekMonday}T00:00:00.000Z`) + 2 * 86_400_000 + 12 * 3_600_000).toISOString();
}

async function seedApp(storeUrl: string): Promise<string> {
  const { data, error } = await db
    .from("apps")
    .insert({ store_url: storeUrl, platform: "ios" })
    .select("id")
    .single();
  if (error) throw error;
  createdAppIds.push(data.id);
  return data.id;
}

async function seedOutcome(appId: string, observedAt: string): Promise<void> {
  const { error } = await db.from("outcomes").insert({
    app_id: appId,
    verified_signal: "url_live",
    observed_at: observedAt,
  });
  if (error) throw error;
}

async function seedSnapshot(
  appId: string,
  total: number,
  installsReported: number | null,
  takenAt: string,
): Promise<void> {
  const { error } = await db.from("score_snapshots").insert({
    app_id: appId,
    total,
    installs_reported: installsReported,
    taken_at: takenAt,
    breakdown: {} as unknown as Json,
  });
  if (error) throw error;
}

test(
  "weeklyStreak: 3 consecutive ISO weeks with >= 3 verified actions each → streak 3",
  async () => {
    const appId = await seedApp(`https://apps.apple.com/us/app/eng/id${Date.now()}`);

    // 3 outcomes in each of the current week and the two prior weeks.
    for (const n of [0, 1, 2]) {
      await seedOutcome(appId, inWeeksAgo(n));
      await seedOutcome(appId, inWeeksAgo(n));
      await seedOutcome(appId, inWeeksAgo(n));
    }

    expect(await weeklyStreak(appId)).toBe(3);
  },
  60_000,
);

test(
  "weeklyStreak: a short current week → streak 0 (even with strong prior weeks)",
  async () => {
    const appId = await seedApp(`https://apps.apple.com/us/app/eng2/id${Date.now()}`);

    // Only 2 this week (short), 3 last week.
    await seedOutcome(appId, inWeeksAgo(0));
    await seedOutcome(appId, inWeeksAgo(0));
    await seedOutcome(appId, inWeeksAgo(1));
    await seedOutcome(appId, inWeeksAgo(1));
    await seedOutcome(appId, inWeeksAgo(1));

    expect(await weeklyStreak(appId)).toBe(0);
  },
  60_000,
);

test(
  "scoreHistory: snapshots projected to { takenAt, total } ordered oldest-first",
  async () => {
    const appId = await seedApp(`https://apps.apple.com/us/app/eng3/id${Date.now()}`);

    const t0 = inWeeksAgo(2);
    const t1 = inWeeksAgo(1);
    const t2 = inWeeksAgo(0);
    // Insert out of order to prove the query orders, not insertion.
    await seedSnapshot(appId, 64, 120, t2);
    await seedSnapshot(appId, 55, 100, t0);
    await seedSnapshot(appId, 60, 110, t1);

    const history = await scoreHistory(appId);
    expect(history.map((p) => p.total)).toEqual([55, 60, 64]);
    // Compare instants, not string form — Postgres timestamptz round-trips as
    // `+00:00` rather than the `.000Z` we constructed, but the instant is equal.
    expect(history.map((p) => Date.parse(p.takenAt))).toEqual(
      [t0, t1, t2].map((t) => Date.parse(t)),
    );
  },
  60_000,
);

test(
  "engagementSummary: returns streak + history + honesty note (note fires on flat installs)",
  async () => {
    const appId = await seedApp(`https://apps.apple.com/us/app/eng4/id${Date.now()}`);

    // 3 consecutive >= 3 weeks → streak 3.
    for (const n of [0, 1, 2]) {
      await seedOutcome(appId, inWeeksAgo(n));
      await seedOutcome(appId, inWeeksAgo(n));
      await seedOutcome(appId, inWeeksAgo(n));
    }

    // Score rose 60→64 while installs stayed flat (100→100) → honesty note fires.
    await seedSnapshot(appId, 60, 100, inWeeksAgo(1));
    await seedSnapshot(appId, 64, 100, inWeeksAgo(0));

    const summary = await engagementSummary(appId);

    expect(summary.streak).toBe(3);
    expect(summary.history.map((p) => p.total)).toEqual([60, 64]);
    expect(summary.honestyNote).not.toBeNull();
    expect(summary.honestyNote).toContain("installs");
  },
  60_000,
);

test(
  "engagementSummary: honesty note is null when installs rose with the score",
  async () => {
    const appId = await seedApp(`https://apps.apple.com/us/app/eng5/id${Date.now()}`);

    // Score rose 60→64 AND installs rose 100→150 → no honesty note.
    await seedSnapshot(appId, 60, 100, inWeeksAgo(1));
    await seedSnapshot(appId, 64, 150, inWeeksAgo(0));

    const summary = await engagementSummary(appId);

    expect(summary.streak).toBe(0); // no outcomes seeded
    expect(summary.history.map((p) => p.total)).toEqual([60, 64]);
    expect(summary.honestyNote).toBeNull();
  },
  60_000,
);
