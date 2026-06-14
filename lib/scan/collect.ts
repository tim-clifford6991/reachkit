import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts, ListingFacts, Competitor, ReviewItem } from "@/lib/scan/types";
import type { FactsExtras } from "@/lib/scan/tools/types";
import { getListing, getReviews, findCompetitors } from "@/lib/scan/tools/index";
import { persistCompetitors } from "@/lib/scan/competitors";
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

  // --- Listing ---
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

  // --- Reviews (skip in web mode) ---
  // appIdFromUrl is called INSIDE the promise chain so a malformed URL throws
  // within the protected chain and the .catch backstop degrades gracefully.
  const reviewsPromise = (
    mode === "web"
      ? Promise.resolve({ reviews: [] as ReviewItem[] })
      : Promise.resolve().then(() =>
          getReviews.run({ appId: appIdFromUrl(storeUrl), subjectKey }, toolCtx),
        )
  )
    .catch((): { reviews: ReviewItem[] } => ({ reviews: [] }))
    .then(async (result) => {
      await emitScanEvent(scanId, "artifact", {
        label:
          result.reviews.length > 0
            ? `Analysed ${result.reviews.length} reviews`
            : "Checked for public reviews",
        count: result.reviews.length,
      });
      return result;
    });

  // --- Competitors ---
  const competitorsPromise = findCompetitors
    .run({ productName, storeUrl, subjectKey }, toolCtx)
    .catch(
      (): { competitors: Competitor[]; extras: FactsExtras } => ({
        competitors: [],
        extras: {},
      }),
    )
    .then(async (result) => {
      await emitScanEvent(scanId, "artifact", {
        label:
          result.competitors.length > 0
            ? `Found ${result.competitors.length} competitors`
            : "Mapping your competitive landscape",
        count: result.competitors.length,
      });
      return result;
    });

  const [listingResult, reviewsResult, competitorsResult] = await Promise.all([
    listingPromise,
    reviewsPromise,
    competitorsPromise,
  ]);

  await persistCompetitors(appId, competitorsResult.competitors);

  const mergedExtras: FactsExtras = {
    ...listingResult.extras,
    ...competitorsResult.extras,
  };

  return assembleFacts(ctx, {
    listing: listingResult.listing,
    reviews: reviewsResult.reviews,
    competitors: competitorsResult.competitors,
    extras: mergedExtras,
  });
}
