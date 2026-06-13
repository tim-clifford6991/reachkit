/**
 * track_rank — D-tool (§9.4): keyword → SERP position lookup for a single target.
 *
 * Thin wrapper over rankLookup (Cycle 4 Task 8), which is already fixture-aware and
 * NEVER throws — any failure (missing keys, HTTP error, a keyword the target doesn't
 * rank for) degrades to that keyword being absent from the map, with total failure
 * returning {}. In fixtures mode rankLookup returns a DETERMINISTIC canned map so the
 * weekly refresh / verification flow runs keyless.
 */

import type { ToolDefinition } from "@/lib/tools/registry";
import { rankLookup } from "@/lib/scan/adapters/dataforseo-rank";

export interface TrackRankArgs {
  keywords: string[];
  target: string;
}

export interface TrackRankResult {
  ranks: Record<string, number>;
}

export const trackRank: ToolDefinition<TrackRankArgs, TrackRankResult> = {
  name: "track_rank",
  klass: "D",
  async run(args, ctx) {
    // rankLookup itself routes to fixtures when enabled; charge the budget either way
    // so a fixtures run still records the tool call.
    ctx.budget.charge({ toolCalls: 1, cents: 0 });
    const ranks = await rankLookup(args.keywords, args.target);
    return { ranks };
  },
};
