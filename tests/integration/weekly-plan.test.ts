/**
 * Integration test for the weekly plan assembler (Cycle 4 Task 11, §10.3),
 * against real Supabase. Seeds an app + actions with varied effort created this
 * week, one OPEN action created last week, and one `done` action, plus two
 * score_snapshots — then asserts the assembled plan's bucketing, carryover,
 * score delta, and §7.2 rule 5 honesty note.
 *
 * Run with: pnpm test:int tests/integration/weekly-plan.test.ts
 */

import { expect, test } from "vitest";
import { serverDb } from "@/lib/db/client";
import { assembleWeeklyPlan, isoWeekStartDate } from "@/lib/scan/weekly-plan";
import type { Json } from "@/lib/db/types";

const db = serverDb();

/** ISO timestamp `days` days before `weekOf`'s Monday 00:00 UTC. */
function daysBeforeWeek(weekOf: string, days: number): string {
  return new Date(Date.parse(`${weekOf}T00:00:00.000Z`) - days * 86_400_000).toISOString();
}

async function seedApp(storeUrl: string): Promise<string> {
  const { data, error } = await db
    .from("apps")
    .insert({ store_url: storeUrl, platform: "ios" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

interface SeedAction {
  effortMin: number | null;
  status?: string;
  createdAt?: string;
}

async function seedAction(appId: string, a: SeedAction): Promise<string> {
  const { data, error } = await db
    .from("actions")
    .insert({
      app_id: appId,
      category: "content",
      title: `wp-${appId}-${a.effortMin}-${a.status ?? "open"}-${Math.random()}`,
      why: "because reasons",
      effort_min: a.effortMin,
      score_component: "seo",
      status: a.status ?? "open",
      ...(a.createdAt ? { created_at: a.createdAt } : {}),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
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
  "assembleWeeklyPlan: buckets this-week opens by effort, carries earlier opens, excludes done, computes score delta + honesty note",
  async () => {
    const stamp = Date.now();
    const appId = await seedApp(`https://apps.apple.com/us/app/wp/id${stamp}`);

    // weekOf = current ISO-week Monday (what the function defaults to).
    const weekOf = isoWeekStartDate(new Date());
    const thisWeek = new Date(Date.parse(`${weekOf}T12:00:00.000Z`)).toISOString();
    const lastWeek = daysBeforeWeek(weekOf, 3); // 3 days before this Monday → prior week

    // This-week OPEN actions across all three effort buckets (10/45/130) + null.
    const quickId = await seedAction(appId, { effortMin: 10, createdAt: thisWeek });
    const medId = await seedAction(appId, { effortMin: 45, createdAt: thisWeek });
    const longId = await seedAction(appId, { effortMin: 130, createdAt: thisWeek });
    const nullId = await seedAction(appId, { effortMin: null, createdAt: thisWeek });

    // One OPEN action from LAST week → carryover (not this week's queue).
    const carryId = await seedAction(appId, { effortMin: 20, createdAt: lastWeek });

    // One DONE action this week → excluded from both queue and carryover.
    const doneId = await seedAction(appId, {
      effortMin: 15,
      status: "done",
      createdAt: thisWeek,
    });

    // Two snapshots: prior total 60, latest 64 → delta 4. Installs flat (100→100)
    // while the score rose → §7.2 rule 5 honesty note should fire.
    await seedSnapshot(appId, 60, 100, daysBeforeWeek(weekOf, 7));
    await seedSnapshot(appId, 64, 100, thisWeek);

    const plan = await assembleWeeklyPlan(appId);

    expect(plan.appId).toBe(appId);
    expect(plan.weekOf).toBe(weekOf);

    // Bucketing: 10 → quickWins, 45 + null(→30) → medium, 130 → longPlay.
    expect(plan.queue.quickWins.map((x) => x.id)).toEqual([quickId]);
    expect(plan.queue.medium.map((x) => x.id).sort()).toEqual([medId, nullId].sort());
    expect(plan.queue.longPlay.map((x) => x.id)).toEqual([longId]);

    // The carryover action is in carryover and NOT in any queue bucket.
    expect(plan.carryover).toContain(carryId);
    const allQueued = [
      ...plan.queue.quickWins,
      ...plan.queue.medium,
      ...plan.queue.longPlay,
    ].map((x) => x.id);
    expect(allQueued).not.toContain(carryId);

    // The done action appears nowhere.
    expect(allQueued).not.toContain(doneId);
    expect(plan.carryover).not.toContain(doneId);

    // Projection shape sanity on one card.
    const quick = plan.queue.quickWins[0];
    if (!quick) throw new Error("expected a quick win");
    expect(quick).toMatchObject({
      id: quickId,
      category: "content",
      why: "because reasons",
      effortMin: 10,
      status: "open",
      scoreComponent: "seo",
    });

    // Score delta = 64 − 60 = 4.
    expect(plan.scoreDeltaLastWeek).toBe(4);

    // Honesty note fired (score up, installs flat).
    expect(plan.honestyNote).not.toBeNull();
    expect(plan.honestyNote).toContain("installs");
  },
  60_000,
);

test(
  "assembleWeeklyPlan: score rose with installs up → no honesty note; explicit weekOf honored",
  async () => {
    const stamp = Date.now();
    const appId = await seedApp(`https://apps.apple.com/us/app/wp2/id${stamp}`);

    const weekOf = isoWeekStartDate(new Date());

    // Score rose 60→64 AND installs rose 100→150 → honesty note must be null.
    await seedSnapshot(appId, 60, 100, daysBeforeWeek(weekOf, 7));
    await seedSnapshot(appId, 64, 150, new Date().toISOString());

    const plan = await assembleWeeklyPlan(appId, weekOf);

    expect(plan.weekOf).toBe(weekOf);
    expect(plan.scoreDeltaLastWeek).toBe(4);
    expect(plan.honestyNote).toBeNull();
  },
  60_000,
);

test(
  "assembleWeeklyPlan: fewer than 2 snapshots → delta 0 and honesty note null",
  async () => {
    const stamp = Date.now();
    const appId = await seedApp(`https://apps.apple.com/us/app/wp3/id${stamp}`);

    // A single snapshot only.
    await seedSnapshot(appId, 42, 100, new Date().toISOString());

    const plan = await assembleWeeklyPlan(appId);

    expect(plan.scoreDeltaLastWeek).toBe(0);
    expect(plan.honestyNote).toBeNull();
    expect(plan.queue.quickWins).toEqual([]);
    expect(plan.queue.medium).toEqual([]);
    expect(plan.queue.longPlay).toEqual([]);
    expect(plan.carryover).toEqual([]);
  },
  60_000,
);
