/**
 * Monitor seeding (Cycle 4 Task 7) — the prerequisite for the weekly delta
 * refresh. After a full scan persists its report, we seed one monitor row per
 * kind so the weekly cron has a watermark baseline to advance from.
 *
 * Four monitors, all `cadence: "weekly"` with `last_run_at: null` (never run):
 *   - reviews     → { lastReviewId: null }     baseline; the first refresh sets
 *                                              the marker without emitting deltas
 *   - rank        → { topRanks: {} }
 *   - threads     → { lastThreadAt: null }
 *   - competitors → { knownCompetitors: [...] } seeded from the scan's competitors
 *
 * Idempotent: upserts on the monitors_app_kind_uniq index (app_id, kind), so a
 * re-run of the scan never duplicates monitors. Best-effort, like the notify
 * step — wraps the body in try/catch and NEVER throws, so it can't break the
 * scan it's wired into.
 */

import { serverDb } from "@/lib/db/client";
import type { ScanContext } from "@/lib/scan/pipeline";
import type { MonitorKind, PreliminaryFacts, WatermarkBody } from "@/lib/scan/types";
import type { Json } from "@/lib/db/types";

type MonitorRow = {
  app_id: string;
  kind: MonitorKind;
  query: null;
  cadence: "weekly";
  last_run_at: null;
  watermark: Json;
};

function buildRows(ctx: ScanContext, facts: PreliminaryFacts): MonitorRow[] {
  const knownCompetitors = facts.competitors
    .map((c) => c.name)
    .filter((n) => n.length > 0);

  const watermarks: Record<MonitorKind, WatermarkBody> = {
    reviews: { lastReviewId: null },
    rank: { topRanks: {} },
    threads: { lastThreadAt: null },
    competitors: { knownCompetitors },
  };

  const kinds: MonitorKind[] = ["reviews", "rank", "threads", "competitors"];
  return kinds.map((kind) => ({
    app_id: ctx.appId,
    kind,
    query: null,
    cadence: "weekly",
    last_run_at: null,
    watermark: watermarks[kind] as unknown as Json,
  }));
}

/**
 * Seed the four weekly monitors for the scanned app. Idempotent (upsert on
 * app_id,kind) and best-effort: never throws, logs on failure, returns void.
 */
export async function seedMonitors(ctx: ScanContext, facts: PreliminaryFacts): Promise<void> {
  try {
    const rows = buildRows(ctx, facts);
    const { error } = await serverDb()
      .from("monitors")
      .upsert(rows, { onConflict: "app_id,kind" });
    if (error) throw error;
  } catch (err) {
    console.error("[seedMonitors] failed to seed monitors (best-effort):", err);
  }
}
