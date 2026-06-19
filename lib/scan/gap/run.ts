/**
 * Market analysis (M4) — the full orchestrator.
 *
 * domain → cohort (you + prominent rivals, profiled) + demand sweep → gap
 * analysis → distribution plan. This is the complete data behind the paid
 * report; the report renderer + the execution layer (M5) consume it.
 */

import { profileCohort, type Cohort } from "@/lib/scan/profile";
import { discoverDemand, type DemandResult } from "@/lib/scan/demand";
import { analyzeGap } from "./analyze";
import { buildPlan, type DistributionPlan } from "./plan";
import type { GapAnalysis } from "./types";

export interface MarketAnalysis {
  cohort: Cohort;
  demand: DemandResult;
  gap: GapAnalysis;
  plan: DistributionPlan;
}

export async function runMarketAnalysis(
  domain: string,
  opts: { topN?: number; queryCap?: number; scanId?: string | null; light?: boolean } = {},
): Promise<MarketAnalysis> {
  // Light (free-tier) pass: top-3 cohort, ETV-only profiles (no Backlinks), and a
  // 2-query demand sweep — keeps the free scan inside its ≤20¢ ceiling.
  const light = opts.light ?? false;
  const cohort = await profileCohort(domain, {
    topN: opts.topN ?? (light ? 3 : 5),
    light,
  });

  // Demand brief from what the crawl told us the product does.
  const demand = await discoverDemand(
    {
      brand: cohort.product.name,
      problem: cohort.product.description ?? cohort.product.name,
      audience: "",
      valueProp: cohort.product.description ?? "",
    },
    { queryCap: opts.queryCap ?? (light ? 2 : 8), scanId: opts.scanId },
  );

  const gap = analyzeGap(cohort.self, cohort.competitors, demand.pockets);
  const plan = buildPlan(gap);

  return { cohort, demand, gap, plan };
}
