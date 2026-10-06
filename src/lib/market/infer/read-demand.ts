// src/lib/market/infer/read-demand.ts — brand search volume, bought (SPEC
// §6, owner D50 of 2026-10-05, issue 1271): the keyword-overview call D49
// added, asked for the business's brand and each rival candidate's. What is
// done with the volumes is `demand.ts`.
import type { CostContext } from "@/lib/costs";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import { keywordsOwed, mergeDemand, ownKeywords } from "./demand";
import type { BrandDemand, RivalConclusion } from "./types";

/**
 * The market's brand demand with `rivals` read. Buys only the names the
 * stored read does not hold, so a pass that concludes the candidates it
 * concluded last week buys nothing. Unmeasured where the vendor did not
 * answer: the caller then keeps the order and the volumes it had.
 */
export async function readBrandDemand(
  c: CostContext,
  a: {
    demand: BrandDemand | undefined;
    rivals: readonly Pick<RivalConclusion, "name" | "searchNames" | "domain">[];
    domain: string;
    siteName: string | null;
    at: Date;
  }
): Promise<Measured<BrandDemand>> {
  const own = ownKeywords(a);
  const owed = keywordsOwed({ demand: a.demand, rivals: a.rivals, own, at: a.at });
  if (owed.length === 0 && a.demand !== undefined) return measured(a.demand, a.at);
  if (owed.length === 0) return unmeasured("not_attempted", a.at);
  const { keywordOverview } = await import("@/lib/vendors/dataforseo");
  const volumes = await keywordOverview(c, { keywords: owed });
  if (volumes.kind === "unmeasured") return unmeasured(volumes.reason, volumes.at, volumes.because);
  return measured(mergeDemand({ demand: a.demand, bought: owed, volumes: volumes.value, own, at: a.at }), a.at);
}
