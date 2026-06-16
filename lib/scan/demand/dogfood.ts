/**
 * Demand discovery (M3) — ReachKit's own dogfooding brief + lead radar.
 *
 * ReachKit's value prop is "help founders get discovered", so we run the demand
 * engine on ourselves: find founders posting about distribution struggles → our
 * own leads. This both proves the engine works and powers our growth.
 *
 * Run live (real ANTHROPIC + DATAFORSEO keys, fixtures off):
 *   REACHKIT_USE_FIXTURES=false npx tsx lib/scan/demand/dogfood.ts
 * or call `runDemandDogfood()` from a script/route.
 */

import { discoverDemand } from "./index";
import type { ProductBrief, DemandResult } from "./types";

export const REACHKIT_BRIEF: ProductBrief = {
  brand: "ReachKit",
  problem:
    "an indie founder has built a product but no one is finding it — they don't know which channels to post in or how to distribute it",
  audience: "early-stage / indie founders and solo makers who just launched",
  valueProp:
    "finds where your buyers and competitors already are, and hands you the exact posts to make so distribution stops being a guessing game",
};

/** Run the dogfood demand sweep on ReachKit itself. */
export async function runDemandDogfood(
  opts: { queryCap?: number } = {},
): Promise<DemandResult> {
  return discoverDemand(REACHKIT_BRIEF, { queryCap: opts.queryCap ?? 10 });
}
