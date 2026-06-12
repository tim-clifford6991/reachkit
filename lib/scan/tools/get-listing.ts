import type { ToolDefinition } from "@/lib/tools/registry";
import type { ListingFacts } from "@/lib/scan/types";
import type { FactsExtras } from "./types";
import { appIdFromUrl, fetchItunesListing } from "@/lib/scan/adapters/itunes";
import { fetchSiteListing } from "@/lib/scan/adapters/site-fetch";
import { fetchDomainAgeYears } from "@/lib/scan/adapters/domain-age";
import { upsertRawDocument } from "@/lib/db/raw-documents";
import { recordPipelineRun } from "@/lib/telemetry/pipeline-runs";

export interface GetListingArgs {
  storeUrl: string;
  subjectKey: string;
}

export interface GetListingResult {
  listing: ListingFacts;
  extras: FactsExtras;
}

function hostname(url: string): string {
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export const getListing: ToolDefinition<GetListingArgs, GetListingResult> = {
  name: "get_listing",
  klass: "D",
  async run(args, ctx) {
    const t0 = Date.now();

    if (ctx.mode === "web") {
      ctx.budget.charge({ toolCalls: 2, cents: 0 });

      const [siteResult, domainAgeYears] = await Promise.all([
        fetchSiteListing(args.storeUrl),
        fetchDomainAgeYears(hostname(args.storeUrl)),
      ]);

      await Promise.all([
        upsertRawDocument({
          subjectType: "web",
          subjectKey: args.subjectKey,
          sourceType: "site_fetch",
          url: args.storeUrl,
          body: siteResult.raw,
          mode: ctx.mode,
        }),
        upsertRawDocument({
          subjectType: "web",
          subjectKey: args.subjectKey,
          sourceType: "domain_age",
          body: { domainAgeYears },
          mode: ctx.mode,
        }),
      ]);

      await recordPipelineRun({
        scanId: ctx.scanId,
        stage: "tool",
        costCents: 0,
        durationMs: Date.now() - t0,
      });

      return {
        listing: siteResult.listing,
        extras: { domainAgeYears },
      };
    }

    // app mode (ios / android)
    ctx.budget.charge({ toolCalls: 1, cents: 0 });

    const appId = appIdFromUrl(args.storeUrl);
    const result = await fetchItunesListing(appId);

    await upsertRawDocument({
      subjectType: "app",
      subjectKey: args.subjectKey,
      sourceType: "itunes",
      url: args.storeUrl,
      body: result.raw,
      mode: ctx.mode,
    });

    await recordPipelineRun({
      scanId: ctx.scanId,
      stage: "tool",
      costCents: 0,
      durationMs: Date.now() - t0,
    });

    return {
      listing: result.listing,
      extras: { rating: result.rating, ratingCount: result.ratingCount },
    };
  },
};
