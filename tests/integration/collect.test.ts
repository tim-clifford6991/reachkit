/**
 * Integration tests for Stage 0 collect orchestration (Task 12).
 *
 * REQUIRES NETWORK: The "App mode — Sofa" test hits live iTunes / App Store RSS.
 * LOCAL ONLY — not CI. Run with: pnpm test:int tests/integration/collect.test.ts
 */
import { expect, test, vi } from "vitest";
import { serverDb } from "@/lib/db/client";
import { ScanBudget } from "@/lib/tools/registry";
import type { ScanContext } from "@/lib/scan/pipeline";
import { runCollect } from "@/lib/scan/pipeline";

const SOFA_URL = "https://apps.apple.com/us/app/sofa/id1276554886";
const SUBJECT_URL = "https://acme.example";

// ---------------------------------------------------------------------------
// Helper: insert a fresh app + scan row and return ScanContext
// ---------------------------------------------------------------------------
async function seedAppAndScan(
  storeUrl: string,
  platform: "ios" | "android" | "web",
): Promise<ScanContext> {
  const db = serverDb();
  const { data: appRow, error: appErr } = await db
    .from("apps")
    .insert({ store_url: storeUrl, platform })
    .select("id")
    .single();
  if (appErr) throw appErr;

  const { data: scanRow, error: scanErr } = await db
    .from("scans")
    .insert({ app_id: appRow!.id })
    .select("id")
    .single();
  if (scanErr) throw scanErr;

  return {
    scanId: scanRow!.id as string,
    appId: appRow!.id as string,
    storeUrl,
    mode: platform,
    budget: new ScanBudget({ maxToolCalls: 60, budgetCents: 150 }),
  };
}

// ---------------------------------------------------------------------------
// Case 1: App mode (Sofa) — LIVE (free APIs, no keys needed)
// ---------------------------------------------------------------------------
test(
  "collect (ios/Sofa) — returns ≥1 competitor and ≥1 review, writes raw_documents and scan_events",
  async () => {
    const ctx = await seedAppAndScan(SOFA_URL, "ios");
    const db = serverDb();

    const facts = await runCollect(ctx);

    // Facts shape
    expect(facts.mode).toBe("ios");
    expect(facts.listing.name).toBeTruthy();
    expect(facts.competitors.length).toBeGreaterThanOrEqual(1);
    expect(facts.reviewVolume).toBeGreaterThanOrEqual(1);

    // raw_documents — at least one row for the subject key (the storeUrl)
    const { data: rawRows, error: rawErr } = await db
      .from("raw_documents")
      .select("id, source_type")
      .eq("subject_key", SOFA_URL);
    expect(rawErr).toBeNull();
    expect(rawRows).not.toBeNull();
    expect(rawRows!.length).toBeGreaterThanOrEqual(1);

    // scan_events — at least the 3 artifact events (listing, reviews, competitors)
    const { data: evtRows, error: evtErr } = await db
      .from("scan_events")
      .select("id, type, payload")
      .eq("scan_id", ctx.scanId);
    expect(evtErr).toBeNull();
    expect(evtRows).not.toBeNull();
    const artifactRows = (evtRows ?? []).filter((r) => r.type === "artifact");
    expect(artifactRows.length).toBeGreaterThanOrEqual(3);
    const labels = artifactRows.map((r) => String((r.payload as Record<string, unknown>).label));
    expect(labels.some((l) => /product page/i.test(l))).toBe(true);
    expect(labels.some((l) => /review/i.test(l))).toBe(true);
    expect(labels.some((l) => /competit/i.test(l))).toBe(true);

    // competitors table — rows written by persistCompetitors
    const { data: compRows, error: compErr } = await db
      .from("competitors")
      .select("name")
      .eq("app_id", ctx.appId);
    expect(compErr).toBeNull();
    expect(compRows!.length).toBeGreaterThanOrEqual(1);
  },
  60_000, // live network — give it a minute
);

// ---------------------------------------------------------------------------
// Case 2: Web mode (generic SaaS) — MOCKED vendor adapters (no API keys required)
// ---------------------------------------------------------------------------
test(
  "collect (web) — mocked adapters, returns ≥1 competitor, writes scan_events",
  async () => {
    vi.resetModules();

    // Mock all vendor adapters that require API keys
    vi.doMock("@/lib/scan/adapters/dataforseo", () => ({
      liveSerpAlternatives: async () => ({
        competitors: [
          { name: "Habitify", url: "https://habitify.me", source: "dataforseo_serp", rank: 1 },
          { name: "Streaks", url: "https://streaksapp.com", source: "dataforseo_serp", rank: 2 },
        ],
        serpResultCount: 42_000,
        raw: { mock: true },
      }),
    }));
    vi.doMock("@/lib/scan/adapters/product-hunt", () => ({
      fetchPhByName: async () => ({
        selfUpvotes: 312,
        neighbours: [
          { name: "Routinery", url: "https://routinery.app", source: "product_hunt", rank: 1 },
        ],
        raw: { mock: true },
      }),
    }));
    vi.doMock("@/lib/scan/adapters/tavily", () => ({
      tavilyAlternatives: async () => ({
        competitors: [
          { name: "Done", url: "https://apps.apple.com/us/app/done/id1084490739", source: "tavily", rank: 1 },
        ],
        raw: { mock: true },
      }),
    }));
    vi.doMock("@/lib/scan/adapters/site-fetch", () => ({
      fetchSiteListing: async () => ({
        listing: { name: "Acme", category: "Productivity", description: "An example habit-tracking app" },
        raw: "<html><title>Acme</title></html>",
      }),
    }));
    vi.doMock("@/lib/scan/adapters/domain-age", () => ({
      fetchDomainAgeYears: async () => 2,
    }));
    vi.doMock("@/lib/scan/adapters/web-reviews", () => ({
      fetchWebReviews: async () => ({ snippets: [], raw: null }),
      reviewCountFromSnippets: () => 0,
    }));

    // Dynamically import pipeline after mocking so it picks up mocked modules
    const { runCollect: runCollectMocked } = await import("@/lib/scan/pipeline");

    const ctx = await seedAppAndScan(SUBJECT_URL, "web");
    const db = serverDb();

    const facts = await runCollectMocked(ctx);

    // Facts shape
    expect(facts.mode).toBe("web");
    expect(facts.listing.name).toBe("Acme");
    expect(facts.competitors.length).toBeGreaterThanOrEqual(1);
    // web mode has no reviews — reviewVolume comes from extras.ratingCount (0 here)
    expect(facts.reviewVolume).toBeGreaterThanOrEqual(0);
    // ratingTrend is null in web mode
    expect(facts.ratingTrend).toBeNull();
    // webProxy is assembled by Task 13 from serpResultCount / phUpvotes / domainAgeYears
    expect(facts.webProxy).not.toBeNull();
    expect(facts.webProxy!.score).toBeGreaterThan(0);

    // scan_events — artifact rows written for each source
    const { data: evtRows, error: evtErr } = await db
      .from("scan_events")
      .select("id, type, payload")
      .eq("scan_id", ctx.scanId);
    expect(evtErr).toBeNull();
    expect(evtRows).not.toBeNull();
    const artifactRows = (evtRows ?? []).filter((r) => r.type === "artifact");
    expect(artifactRows.length).toBeGreaterThanOrEqual(3);
    const labels = artifactRows.map((r) => String((r.payload as Record<string, unknown>).label));
    expect(labels.some((l) => /product page/i.test(l))).toBe(true);
    expect(labels.some((l) => /review/i.test(l))).toBe(true);
    expect(labels.some((l) => /competit/i.test(l))).toBe(true);

    // competitors table persisted
    const { data: compRows, error: compErr } = await db
      .from("competitors")
      .select("name")
      .eq("app_id", ctx.appId);
    expect(compErr).toBeNull();
    expect(compRows!.length).toBeGreaterThanOrEqual(1);
  },
  30_000,
);
