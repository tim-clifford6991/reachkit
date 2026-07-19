import type { ToolDefinition } from "@/lib/tools/registry";
import type { ListingFacts } from "@/lib/scan/types";
import type { FactsExtras } from "./types";
import { appIdFromUrl, fetchItunesListing } from "@/lib/scan/adapters/itunes";
import { fetchSiteListing } from "@/lib/scan/adapters/site-fetch";
import { fetchDomainAgeYears } from "@/lib/scan/adapters/domain-age";
import { tavilyExtract } from "@/lib/scan/adapters/tavily";
import { isGarbageFetch, visibleTextFromHtml } from "@/lib/scan/fetch-quality";
import { upsertRawDocument } from "@/lib/db/raw-documents";
import { recordPipelineRun } from "@/lib/telemetry/pipeline-runs";
import { hostname } from "@/lib/scan/url";

/** The raw_documents source_type for a successful escalation's rendered text
 *  (Part C). A SEPARATE row from "site_fetch" — never overwrites it — so the 8
 *  on-page HTML signals (persist-signals.ts) keep reading the REAL fetched
 *  HTML always (a JS-shell page genuinely lacks server-rendered signals; that
 *  is honest measurement, not a bug this feature papers over). Only the
 *  identity/extract/synth path (lib/llm/extract.ts) prefers this row when
 *  present — see its `LISTING_SOURCES` replace-semantics. */
export const SITE_FETCH_ESCALATED = "site_fetch_escalated";

/**
 * Part C — when the site fetch returned a GARBAGE capture (a JS-shell/SPA
 * bootstrap page — `isGarbageFetch`), make ONE Tavily Extract call for the
 * rendered content and persist it as a separate raw_documents row IF it is
 * itself non-garbage. Cost-attributed via `tavilyExtract`'s own
 * `recordTavilyCost` call (the ambient cost context — invariant #2); fixture-
 * gated the same way (returns `[]` under `fixtures()`, so this is a no-op
 * escalation in tests unless the caller mocks the adapter directly).
 *
 * Returns `fetchDegraded: true` only when escalation was attempted AND still
 * produced nothing usable — never for a healthy fetch (garbage=false skips
 * this entirely, budget/cost untouched).
 */
async function escalateIfGarbage(args: {
  storeUrl: string;
  subjectKey: string;
  rawHtml: string;
  listingName: string;
  host: string;
  mode: "web";
  budget: { charge: (use: { toolCalls: number; cents: number }) => void };
}): Promise<{ fetchDegraded: boolean }> {
  const text = visibleTextFromHtml(args.rawHtml);
  const garbage = isGarbageFetch({ html: args.rawHtml, text, title: args.listingName, host: args.host });
  if (!garbage) return { fetchDegraded: false };

  args.budget.charge({ toolCalls: 1, cents: 0 });
  const escalated = await tavilyExtract([args.storeUrl]);
  const content = (escalated[0]?.content ?? "").trim();
  // Re-run the SAME detector on the escalated content. No `title` — Tavily
  // Extract returns rendered text/markdown, not an HTML <title>, so the
  // title==host/empty check doesn't apply here (see isGarbageFetch's docs).
  const stillGarbage = content.length === 0 || isGarbageFetch({ html: content, text: content, host: args.host });

  if (stillGarbage) {
    // Don't-cache-empties (invariant #3): a garbage escalation result is
    // never persisted as if it were good content.
    return { fetchDegraded: true };
  }

  await upsertRawDocument({
    subjectType: "web",
    subjectKey: args.subjectKey,
    sourceType: SITE_FETCH_ESCALATED,
    url: args.storeUrl,
    body: content,
    mode: args.mode,
  });
  return { fetchDegraded: false };
}

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

      // Part C — one bounded escalation attempt when the fetch was garbage. A
      // failed fetch (siteSettled rejected) already degrades via the existing
      // hostname-only listing fallback above; this only fires on a fetch that
      // SUCCEEDED but returned unusable (JS-shell) content.
      let fetchDegraded = false;
      if (siteSettled.status === "fulfilled") {
        const result = await escalateIfGarbage({
          storeUrl: args.storeUrl,
          subjectKey: args.subjectKey,
          rawHtml: siteSettled.value.raw,
          listingName: listing.name,
          host,
          mode: ctx.mode,
          budget: ctx.budget,
        });
        fetchDegraded = result.fetchDegraded;
      }

      await recordPipelineRun({
        scanId: ctx.scanId,
        stage: "tool",
        costCents: 0,
        durationMs: Date.now() - t0,
      });

      return { listing, extras: { domainAgeYears, fetchDegraded } };
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
