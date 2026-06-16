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
  opts: { topN?: number; queryCap?: number; scanId?: string | null } = {},
): Promise<MarketAnalysis> {
  const cohort = await profileCohort(domain, { topN: opts.topN ?? 5 });

  // Demand brief from what the crawl told us the product does.
  const demand = await discoverDemand(
    {
      brand: cohort.product.name,
      problem: cohort.product.description ?? cohort.product.name,
      audience: "",
      valueProp: cohort.product.description ?? "",
    },
    { queryCap: opts.queryCap ?? 8, scanId: opts.scanId },
  );

  const gap = analyzeGap(cohort.self, cohort.competitors, demand.pockets);
  const plan = buildPlan(gap);

  return { cohort, demand, gap, plan };
}
