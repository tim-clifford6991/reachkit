/**
 * Search-cache cleanup (maintenance cron) — prunes stale rows from the
 * `search_cache` table so it cannot grow unboundedly in key cardinality.
 *
 * Context:
 *   - `search_cache` holds large DataForSEO/LLM jsonb responses keyed by hash.
 *     Rows are SKIPPED on read once past their 14-day TTL, but were never
 *     deleted, so every new domain/cohort/query minted a permanent row.
 *   - A `search_cache_created_at_idx` index already exists to make a cheap
 *     time-based delete possible; this cron is the missing piece.
 *
 * Shape:
 *   - Trigger: cron "0 3 * * *" → 03:00 UTC daily.
 *   - Deletes rows older than 30 days — WELL past the 14-day read TTL, so an
 *     in-flight cache entry is never pruned out from under a reader.
 *   - Best-effort: supabase-js does NOT throw, so we check the returned
 *     `{ error }` and log it; a genuine failure is logged (and left to Inngest's
 *     retry) rather than crashing the schedule.
 */

import { inngest } from "@/lib/inngest/client";
import { serverDb } from "@/lib/db/client";

// 30 days — comfortably past the 14-day read TTL so live entries are safe.
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

interface CleanupSummary {
  cutoff: string;
  deleted: number | null;
  error?: string;
}

/**
 * Delete `search_cache` rows older than the retention window. Returns a small
 * summary (deleted count when the driver reports it) and never throws — the
 * error, if any, is captured on the summary and logged for ops visibility.
 */
async function pruneSearchCache(): Promise<CleanupSummary> {
  const db = serverDb();
  const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();

  // `count: "exact"` makes supabase-js report how many rows the delete matched.
  const { count, error } = await db
    .from("search_cache")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);

  if (error) {
    console.error("[search-cache-cleanup] delete failed:", error.message);
    return { cutoff, deleted: null, error: error.message };
  }

  console.info(`[search-cache-cleanup] pruned ${count ?? 0} row(s) older than ${cutoff}`);
  return { cutoff, deleted: count ?? null };
}

export const searchCacheCleanup = inngest.createFunction(
  {
    id: "search-cache-cleanup",
    retries: 1,
    triggers: [{ cron: "0 3 * * *" }],
    onFailure: async ({ error }) => {
      // Cron has no originating event; a top-level failure is the prune itself.
      const message = error instanceof Error ? error.message : String(error);
      console.error("[search-cache-cleanup] run failed:", message);
    },
  },
  async ({ step }) => {
    return step.run("prune-search-cache", pruneSearchCache);
  },
);
