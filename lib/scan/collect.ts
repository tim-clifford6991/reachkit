import type { ScanContext } from "@/lib/scan/scan-context";
import type { PreliminaryFacts, ListingFacts, Competitor, ReviewItem } from "@/lib/scan/types";
import type { FactsExtras } from "@/lib/scan/tools/types";
import { getListing } from "@/lib/scan/tools/index";
import { persistCompetitors } from "@/lib/scan/competitors";
import { discoverScanCompetitors } from "@/lib/scan/scan-competitors";
import { emitScanEvent } from "@/lib/scan/progress";
import { hostname } from "@/lib/scan/url";
import { appIdFromUrl } from "@/lib/scan/adapters/itunes";
import { assembleFacts } from "@/lib/scan/facts";

// ---------------------------------------------------------------------------
// productName derivation
// Web  → first label of hostname (e.g. "nudgi.app" → "nudgi")
// App  → slug from "…/app/<slug>/id…" with hyphens replaced by spaces;
//         fallback to appIdFromUrl if the slug pattern doesn't match.
// ---------------------------------------------------------------------------
function deriveProductName(storeUrl: string, mode: "ios" | "android" | "web"): string {
  if (mode === "web") {
    // "nudgi.app" → "nudgi";  "www.mysite.com" → "mysite"
    return hostname(storeUrl).split(".")[0] ?? hostname(storeUrl);
  }
  // app mode: extract slug from ".../app/<slug>/id<digits>..."
  const slugMatch = storeUrl.match(/\/app\/([^/]+)\/id\d+/);
  if (slugMatch?.[1]) {
    return slugMatch[1].replace(/-/g, " ");
  }
  // fallback: use the numeric app id
  try {
    return appIdFromUrl(storeUrl);
  } catch {
    return hostname(storeUrl);
  }
}

// ---------------------------------------------------------------------------
// Collect orchestration — runs the three D-tools in parallel with per-source
// isolation (.catch backstops so a single failure degrades only that source).
// ---------------------------------------------------------------------------
export async function collect(ctx: ScanContext): Promise<PreliminaryFacts> {
  const { scanId, appId, storeUrl, mode, budget } = ctx;
  const subjectKey = storeUrl;
  const productName = deriveProductName(storeUrl, mode);
  const toolCtx = { scanId, mode, budget };

  // Phase S (R-1.5): the FREE scan gathers only what the free contract renders —
  // its own page (identity/category/signals). Reviews and competitor discovery
  // are off the free contract, so a free scan skips BOTH fetches (cheaper +
  // faster + no dead sections). Competitors are re-collected at deepen time
  // (runFullCollect) for a scan that upgrades. Default "full" keeps every other
  // caller's behaviour unchanged.
  const gatherOffContract = (ctx.tier ?? "full") !== "free";

  // --- Listing (always) ---
  const listingPromise = getListing
    .run({ storeUrl, subjectKey }, toolCtx)
    .catch(
      (): { listing: ListingFacts; extras: FactsExtras } => ({
        listing: { name: hostname(storeUrl), category: null, description: null },
        extras: {},
      }),
    )
    .then(async (result) => {
      await emitScanEvent(scanId, "artifact", { label: "Read your product page" });
      return result;
    });

  // --- Reviews (O-7, 2026-07-23): the review_themes producer is retired for
  // BOTH tiers — no consumer reads app_store_rss/web_reviews raw docs anymore
  // (extract's review_themes job, synth's review section, and the strengths/
  // weaknesses report section are all cut in the same change). Reviews are no
  // longer gathered at collect time. The weekly "reviews" MONITOR (a separate
  // producer — app-store review DELTAS via app-store-rss.ts's fetchAppReviews)
  // is untouched; it reads live via delta-collect.ts, not these raw_documents.
  const reviewsPromise: Promise<{ reviews: ReviewItem[] }> = Promise.resolve({ reviews: [] });

  // --- Competitors (paid only; off the free contract — re-collected at deepen) ---
  const competitorsPromise: Promise<{ competitors: Competitor[]; extras: FactsExtras }> = !gatherOffContract
    ? Promise.resolve({ competitors: [], extras: {} })
    : listingPromise.then((listingResult) =>
        discoverScanCompetitors(ctx, { productName, listing: listingResult.listing }),
      );

  const [listingResult, reviewsResult, competitorsResult] = await Promise.all([
    listingPromise,
    reviewsPromise,
    competitorsPromise,
  ]);

  const competitors = competitorsResult.competitors;

  // Single competitor artifact event with the final count.
  await emitScanEvent(scanId, "artifact", {
    label: competitors.length > 0 ? `Found ${competitors.length} competitors` : "Mapping your competitive landscape",
    count: competitors.length,
  });

  await persistCompetitors(appId, competitors);

  const mergedExtras: FactsExtras = {
    ...listingResult.extras,
    ...competitorsResult.extras,
  };

  return assembleFacts(ctx, {
    listing: listingResult.listing,
    reviews: reviewsResult.reviews,
    competitors,
    extras: mergedExtras,
  });
}

/**
 * The collect pipeline step. Lives here (not in pipeline.ts) so pipeline.ts
 * stays a type-only re-export shim and never imports collect at runtime — that
 * import was the `pipeline → collect` edge that turned every tool taking a
 * ScanContext into a dependency cycle. Phase S, 2026-07-21.
 */
export async function runCollect(ctx: ScanContext): Promise<PreliminaryFacts> {
  return collect(ctx);
}
