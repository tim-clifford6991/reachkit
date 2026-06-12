import type { ToolDefinition } from "@/lib/tools/registry";
import type { ListingFacts } from "@/lib/scan/types";
import type { FactsExtras } from "./types";
import { appIdFromUrl, fetchItunesListing } from "@/lib/scan/adapters/itunes";
import { fetchSiteListing } from "@/lib/scan/adapters/site-fetch";
import { fetchDomainAgeYears } from "@/lib/scan/adapters/domain-age";
import { upsertRawDocument } from "@/lib/db/raw-documents";
import { recordPipelineRun } from "@/lib/telemetry/pipeline-runs";
import { hostname } from "@/lib/scan/url";

export interface GetListingArgs {
  storeUrl: string;
  subjectKey: string;
}

export interface GetListingResult {
  listing: ListingFacts;
  extras: FactsExtras;
}

export const getListing: ToolDefinition<GetListingArgs, GetListingResult> = {
  name: "get_listing",
  klass: "D",
  async run(args, ctx) {
    const t0 = Date.now();

    if (ctx.mode === "web") {
      ctx.budget.charge({ toolCalls: 2, cents: 0 });

      const host = hostname(args.storeUrl);
      const [siteSettled, ageSettled] = await Promise.allSettled([
        fetchSiteListing(args.storeUrl),
        fetchDomainAgeYears(host),
      ]);

      const listing: ListingFacts =
        siteSettled.status === "fulfilled"
          ? siteSettled.value.listing
          : { name: host, category: null, description: null };
      const domainAgeYears: number | null =
        ageSettled.status === "fulfilled" ? ageSettled.value : null;

      const persistPromises: Promise<unknown>[] = [
        upsertRawDocument({
          subjectType: "web",
          subjectKey: args.subjectKey,
          sourceType: "domain_age",
          body: { domainAgeYears },
          mode: ctx.mode,
        }),
      ];
      if (siteSettled.status === "fulfilled") {
        persistPromises.push(
          upsertRawDocument({
            subjectType: "web",
            subjectKey: args.subjectKey,
            sourceType: "site_fetch",
            url: args.storeUrl,
            body: siteSettled.value.raw,
            mode: ctx.mode,
          }),
        );
      }
      await Promise.all(persistPromises);

      await recordPipelineRun({
        scanId: ctx.scanId,
        stage: "tool",
        costCents: 0,
        durationMs: Date.now() - t0,
      });

      return { listing, extras: { domainAgeYears } };
    }

    // app mode (ios / android)
    ctx.budget.charge({ toolCalls: 1, cents: 0 });

    let listing: ListingFacts;
    let extras: FactsExtras;

    try {
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

      listing = result.listing;
      extras = { rating: result.rating, ratingCount: result.ratingCount };
    } catch {
      listing = { name: hostname(args.storeUrl), category: null, description: null };
      extras = {};
    }

    await recordPipelineRun({
      scanId: ctx.scanId,
      stage: "tool",
      costCents: 0,
      durationMs: Date.now() - t0,
    });

    return { listing, extras };
  },
};
