import type { ToolDefinition } from "@/lib/tools/registry";
import type { ListingFacts } from "@/lib/scan/types";
import type { FactsExtras } from "./types";
import { appIdFromUrl, fetchItunesListing } from "@/lib/scan/adapters/itunes";
import { fetchSiteListing } from "@/lib/scan/adapters/site-fetch";
import { fetchDomainAgeYears } from "@/lib/scan/adapters/domain-age";
import { tavilyExtract } from "@/lib/scan/adapters/tavily";
import { isGarbageFetch, visibleTextFromHtml, bareHostOf } from "@/lib/scan/fetch-quality";
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

/** Review fix (IMPORTANT B) — a marker row for the "escalation was attempted
 *  and STILL failed" case. Carries no real content (there is none to carry —
 *  don't-cache-empties), but its mere presence tells the extract layer
 *  (`lib/llm/extract.ts`'s `effectiveListingRows`) that the raw `site_fetch`
 *  garbage HTML for this subject must NOT feed the positioning/identity
 *  extract either — without this marker, a garbage fetch whose escalation
 *  also failed would still leak its near-empty/shell HTML into the prompt
 *  and the non-LLM floor, exactly the dilution the escalated-replace rule
 *  exists to prevent for the SUCCESS case. */
export const SITE_FETCH_DEGRADED = "site_fetch_degraded";

/**
 * Review fix (CRITICAL A) — derive a page name/title from a successful
 * escalation's rendered content, so `listing.name` (and therefore
 * `facts.listing.name` → `brandNames`) can recover even when the raw fetch's
 * `<title>` was garbage. Verified against `parseTavilyExtract`
 * (adapters/tavily.ts): Tavily's /extract endpoint returns only
 * `{url, raw_content}` — NO title/metadata field — so the name must come from
 * the content itself: the first markdown H1 (`# ...`) if the rendered page
 * has one, else the first non-empty line IF it's short enough to plausibly be
 * a title (≤120 chars — a longer first line is prose/a sentence, not a
 * title, and is skipped rather than truncated into something misleading).
 * Pure; returns null when nothing title-shaped is derivable.
 */
export function deriveEscalatedName(content: string): string | null {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const h1 = lines.find((l) => /^#\s+\S/.test(l));
  if (h1) {
    const name = h1.replace(/^#\s+/, "").trim();
    if (name.length > 0) return name;
  }
  const first = lines[0];
  if (first && !first.startsWith("#") && first.length <= 120) return first;
  return null;
}

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
 * this entirely, budget/cost untouched). On success, `escalatedName` carries
 * a derived name ONLY when it is non-trivial (non-empty and not merely the
 * bare host) — the caller REPLACES `listing.name` with it, never any other
 * listing field (CRITICAL A: don't fabricate what wasn't derived).
 */
async function escalateIfGarbage(args: {
  storeUrl: string;
  subjectKey: string;
  rawHtml: string;
  listingName: string;
  host: string;
  mode: "web";
  budget: { charge: (use: { toolCalls: number; cents: number }) => void };
}): Promise<{ fetchDegraded: boolean; escalatedName?: string }> {
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
    // never persisted as if it were good content. IMPORTANT B: persist the
    // degrade MARKER instead, so the extract layer can exclude the raw
    // site_fetch garbage row too (it would otherwise still leak in).
    await upsertRawDocument({
      subjectType: "web",
      subjectKey: args.subjectKey,
      sourceType: SITE_FETCH_DEGRADED,
      body: { fetchDegraded: true },
      mode: args.mode,
    });
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

  const derivedName = deriveEscalatedName(content);
  const bareHost = bareHostOf(args.host);
  const nameIsTrivial =
    !derivedName || derivedName.length === 0 || derivedName.toLowerCase() === bareHost;

  return { fetchDegraded: false, escalatedName: nameIsTrivial ? undefined : derivedName! };
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

      let listing: ListingFacts =
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
        // CRITICAL A — the escalated page's derived name REPLACES listing.name
        // (only name; no other listing field is fabricated) so downstream
        // brand detection (facts.listing.name → brandNames) can recover.
        if (result.escalatedName) {
          listing = { ...listing, name: result.escalatedName };
        }
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
