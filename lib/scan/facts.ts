import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts, Competitor, ReviewItem, ListingFacts } from "@/lib/scan/types";
import type { FactsExtras } from "@/lib/scan/tools/types";
import { extractThemes } from "@/lib/scan/themes";
import { webProxyScore } from "@/lib/scan/web-proxy";

export function assembleFacts(
  ctx: ScanContext,
  data: { listing: ListingFacts; reviews: ReviewItem[]; competitors: Competitor[]; extras: FactsExtras },
): PreliminaryFacts {
  const isWeb = ctx.mode === "web";
  return {
    mode: ctx.mode,
    listing: data.listing,
    competitors: data.competitors,
    reviewVolume: isWeb ? data.reviews.length : (data.extras.ratingCount ?? data.reviews.length),
    ratingTrend: isWeb ? null : (data.extras.rating ?? null),
    webProxy: isWeb
      ? webProxyScore({ serpResultCount: data.extras.serpResultCount ?? 0, phUpvotes: data.extras.phUpvotes ?? 0, domainAgeYears: data.extras.domainAgeYears ?? null })
      : null,
    themes: extractThemes(data.reviews),
    // Cycle 1 lists the sources QUERIED; §6's measured-density drop is Cycle 3.
    sourcesUsed: isWeb ? ["site_fetch", "dataforseo_serp", "product_hunt", "domain_age"] : ["itunes", "app_store_rss"],
  };
}
