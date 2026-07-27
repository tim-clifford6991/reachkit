/**
 * Competitor discovery — the ONE implementation (capability ledger, R-11.7).
 *
 * Runs `findCompetitors` (SERP/Tavily URL parse) and, in web mode, refines the
 * set with `extractCompetitorNames` over the SERP/Tavily *content* — anchored to
 * the subject's category so a same-named different product can't contaminate the
 * set (brand-ambiguity hard rule). Extracted verbatim from `collect.ts` (Phase S,
 * 2026-07-21) so the paid initial collect AND the deepen-time re-collect share
 * one code path instead of forking. Competitor discovery is a PAID capability:
 * the free scan skips it entirely (off the R-1.5 contract), and a scan deepened
 * from a stored free scan re-runs it here (runFullCollect) rather than shipping
 * an empty competitor set into the paid surfaces that need it.
 */
import type { ScanContext } from "@/lib/scan/scan-context";
import type { Competitor, ListingFacts } from "@/lib/scan/types";
import type { FactsExtras } from "@/lib/scan/tools/types";
import { findCompetitors } from "@/lib/scan/tools/index";
import { rankCompetitors, SCAN_COMPETITOR_POOL } from "@/lib/scan/competitors";
import { hostname } from "@/lib/scan/url";
import { serverDb } from "@/lib/db/client";
import { extractCompetitorNames } from "@/lib/llm/competitor-names";
import { parseSerpContent } from "@/lib/scan/adapters/dataforseo";
import { parseTavilyContent } from "@/lib/scan/adapters/tavily";

export interface DiscoverCompetitorsResult {
  competitors: Competitor[];
  extras: FactsExtras;
}

/**
 * Discover the subject's competitor set. `productName` is the derived product
 * name (collect's `deriveProductName`); `listing` supplies the category anchor
 * for the web-mode content refine.
 */
export async function discoverScanCompetitors(
  ctx: ScanContext,
  args: { productName: string; listing: ListingFacts },
): Promise<DiscoverCompetitorsResult> {
  const { scanId, storeUrl, mode, budget } = ctx;
  const subjectKey = storeUrl;
  const toolCtx = { scanId, mode, budget };

  const base = await findCompetitors
    .run({ productName: args.productName, storeUrl, subjectKey }, toolCtx)
    .catch((): DiscoverCompetitorsResult => ({ competitors: [], extras: {} }));

  let competitors = base.competitors;

  // Web mode: the URL-based competitor parse often yields only listicle /
  // aggregator pages that get filtered out (→ empty set). Recover the REAL
  // competitor names from the SERP/Tavily *content* — category-anchored to the
  // subject so a same-named different product can't contaminate the set
  // (brand-ambiguity hard rule) — and merge them before facts are computed.
  if (mode === "web") {
    const selfHost = hostname(storeUrl);
    const { data: rawDocs } = await serverDb()
      .from("raw_documents")
      .select("source_type, body")
      .eq("subject_key", subjectKey)
      .in("source_type", ["dataforseo_serp", "tavily"]);
    const content = (rawDocs ?? [])
      .map((d) => (d.source_type === "tavily" ? parseTavilyContent(d.body) : parseSerpContent(d.body)))
      .join("\n")
      .trim();
    const named = await extractCompetitorNames(ctx, {
      subjectName: args.listing.name,
      subjectHost: selfHost,
      category: args.listing.category ?? args.listing.description ?? "",
      content,
    });
    if (named.length > 0) {
      competitors = rankCompetitors([...competitors, ...named], {
        selfHost,
        subjectName: args.listing.name,
        cap: SCAN_COMPETITOR_POOL,
      });
    }
  }

  return { competitors, extras: base.extras };
}
