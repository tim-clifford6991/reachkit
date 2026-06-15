import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts, ListingFacts, Competitor, ReviewItem } from "@/lib/scan/types";
import type { FactsExtras } from "@/lib/scan/tools/types";
import { getListing, getReviews, findCompetitors } from "@/lib/scan/tools/index";
import { persistCompetitors, rankCompetitors } from "@/lib/scan/competitors";
import { emitScanEvent } from "@/lib/scan/progress";
import { hostname } from "@/lib/scan/url";
import { appIdFromUrl } from "@/lib/scan/adapters/itunes";
import { assembleFacts } from "@/lib/scan/facts";
import { serverDb } from "@/lib/db/client";
import { upsertRawDocument } from "@/lib/db/raw-documents";
import { extractCompetitorNames } from "@/lib/llm/competitor-names";
import { parseSerpContent } from "@/lib/scan/adapters/dataforseo";
import { parseTavilyContent } from "@/lib/scan/adapters/tavily";
import { fetchWebReviews, reviewCountFromSnippets } from "@/lib/scan/adapters/web-reviews";

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
      ? // Web mode has no first-party reviews — mine review-bearing snippets from a
        // domain-anchored "{host} reviews" search so review_themes has signal.
        fetchWebReviews(hostname(storeUrl)).then(async (r) => {
          if (r.snippets.length > 0) {
            await upsertRawDocument({ subjectType: "web", subjectKey, sourceType: "web_reviews", body: r.raw, mode });
          }
          return {
            reviews: r.snippets.map((s, i) => ({ id: `web-${i}`, rating: null, title: "Web review", body: s })) as ReviewItem[],
          };
        })
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
  // The competitor artifact event is emitted ONCE after the (web-mode) content
  // refine below, so the feed shows the FINAL count rather than the pre-refine one.
  const competitorsPromise = findCompetitors
    .run({ productName, storeUrl, subjectKey }, toolCtx)
    .catch(
      (): { competitors: Competitor[]; extras: FactsExtras } => ({
        competitors: [],
        extras: {},
      }),
    );

  const [listingResult, reviewsResult, competitorsResult] = await Promise.all([
    listingPromise,
    reviewsPromise,
    competitorsPromise,
  ]);

  // Web mode: the URL-based competitor parse often yields only listicle / aggregator
  // pages that get filtered out (→ empty set). Recover the REAL competitor names from
  // the SERP/Tavily *content* — category-anchored to the subject so a same-named
  // different product can't contaminate the set (brand-ambiguity hard rule) — and
  // merge them in before facts + cold-start are computed.
  let competitors = competitorsResult.competitors;
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
      subjectName: listingResult.listing.name,
      subjectHost: selfHost,
      category: listingResult.listing.category ?? listingResult.listing.description ?? "",
      content,
    });
    if (named.length > 0) {
      competitors = rankCompetitors([...competitors, ...named], {
        selfHost,
        subjectName: listingResult.listing.name,
      });
    }
  }

  // Single competitor artifact event with the final count (post content-refine).
  await emitScanEvent(scanId, "artifact", {
    label: competitors.length > 0 ? `Found ${competitors.length} competitors` : "Mapping your competitive landscape",
    count: competitors.length,
  });

  await persistCompetitors(appId, competitors);

  const mergedExtras: FactsExtras = {
    ...listingResult.extras,
    ...competitorsResult.extras,
  };
  // Web mode: surface a REAL review count parsed from the review snippets
  // ("from 380 reviews") rather than the misleading snippet count. Falls back to
  // the snippet count (in facts.ts) when no figure is parseable.
  if (mode === "web") {
    const webReviewCount = reviewCountFromSnippets(reviewsResult.reviews.map((r) => r.body));
    if (webReviewCount > 0) mergedExtras.ratingCount = webReviewCount;
  }

  return assembleFacts(ctx, {
    listing: listingResult.listing,
    reviews: reviewsResult.reviews,
    competitors,
    extras: mergedExtras,
  });
}
