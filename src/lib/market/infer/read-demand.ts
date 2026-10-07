// src/lib/market/infer/read-demand.ts — brand search volume, bought (SPEC
// §6, owner D50 of 2026-10-05, issue 1271): the keyword-overview call D49
// added, asked for the business's brand and each rival candidate's. What is
// done with the volumes is `demand.ts`.
import type { Locale } from "@/lib/locale/locales";
import type { CostContext } from "@/lib/costs";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import { byDemand, comparisonsOf, keywordsOwed, mergeDemand, ownKeywords, searched, searchesOwed } from "./demand";
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
    rivals: readonly RivalConclusion[];
    domain: string;
    siteName: string | null;
    at: Date;
    /** The site's country and language (D66): where the volumes are read. */
    locale: Locale;
  }
): Promise<Measured<BrandDemand>> {
  const own = ownKeywords(a);
  const owed = keywordsOwed({ demand: a.demand, rivals: a.rivals, own, at: a.at });
  // SPEC §6 (owner D64, issue 1301): the comparison searches these rivals
  // yield are read in this same call, so a comparison topic carries a
  // volume. They are derived from the volumes already held — a brand read
  // for the first time here joins a pair on the next read.
  const held = a.demand ?? { at: a.at.toISOString(), own: 0, brands: {} };
  const wanted = comparisonsOf({
    rivals: byDemand(a.rivals, held),
    product: own[0] ?? null,
    ownSearched: searched(held.own),
    searchedOnly: false,
    language: a.locale.language,
  }).map((comparison) => comparison.query);
  const owedSearches = searchesOwed({ demand: a.demand, wanted, at: a.at });
  if (owed.length === 0 && owedSearches.length === 0 && a.demand !== undefined) return measured(a.demand, a.at);
  if (owed.length === 0 && a.demand === undefined) return unmeasured("not_attempted", a.at);
  const { keywordOverview } = await import("@/lib/vendors/dataforseo");
  const volumes = await keywordOverview(c, { keywords: [...owed, ...owedSearches], locale: a.locale });
  if (volumes.kind === "unmeasured") {
    // The brands are held and only the comparisons were asked: what is held stands.
    if (owed.length === 0 && a.demand !== undefined) return measured(a.demand, a.at);
    return unmeasured(volumes.reason, volumes.at, volumes.because);
  }
  return measured(mergeDemand({ demand: a.demand, bought: owed, searched: owedSearches, volumes: volumes.value, own, at: a.at }), a.at);
}
