/**
 * Integration test for runFullCollect (Cycle 3 Task 4).
 *
 * Runs in FIXTURES mode — no API keys required.
 * Verifies that after runFullCollect completes, raw_documents rows exist for
 * all three source types (dataforseo_keywords, communities, youtube) keyed
 * by the scan's storeUrl (= subjectKey).
 *
 * Run with: pnpm test:int tests/integration/full-collect.test.ts
 */

import { expect, test, vi } from "vitest";
import { serverDb } from "@/lib/db/client";
import { ScanBudget } from "@/lib/tools/registry";
import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts } from "@/lib/scan/types";

// ---------------------------------------------------------------------------
// Seed helper
// ---------------------------------------------------------------------------
async function seedAppAndScan(storeUrl: string, platform: "ios" | "android" | "web"): Promise<ScanContext> {
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
// Fixture facts helper
// ---------------------------------------------------------------------------
function makeFixtureFacts(overrides?: Partial<PreliminaryFacts>): PreliminaryFacts {
  return {
    mode: "web",
    listing: {
      name: "Nudgi",
      category: "Productivity",
      description: "A gentle nudge app",
    },
    competitors: [
      { name: "Habitify", url: "https://habitify.me", source: "dataforseo_serp", rank: 1 },
      { name: "Streaks",  url: "https://streaksapp.com", source: "dataforseo_serp", rank: 2 },
    ],
    reviewVolume: 0,
    ratingTrend: null,
    webProxy: null,
    themes: [],
    sourcesUsed: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Main test — fixtures mode, no keys
// ---------------------------------------------------------------------------
test(
  "runFullCollect (fixtures mode) writes dataforseo_keywords + communities + youtube raw_documents",
  async () => {
    vi.resetModules();

    // Enable fixtures via env stub — must be done before module import
    vi.stubEnv("REACHKIT_USE_FIXTURES", "true");

    // Dynamic import so the env stub is picked up by fixturesEnabled()
    const { runFullCollect } = await import("@/lib/scan/full-collect");

    const storeUrl = `https://nudgi-fc-${Date.now()}.test`;
    const ctx = await seedAppAndScan(storeUrl, "web");
    const facts = makeFixtureFacts({ mode: "web" });

    // runFullCollect must never throw
    await expect(runFullCollect(ctx, facts)).resolves.toBeUndefined();

    // Query raw_documents for this storeUrl (= subjectKey)
    const db = serverDb();
    const { data: rows, error } = await db
      .from("raw_documents")
      .select("id, source_type, subject_key")
      .eq("subject_key", storeUrl);

    expect(error).toBeNull();
    expect(rows).not.toBeNull();

    const sourceTypes = (rows ?? []).map((r) => r.source_type);

    expect(sourceTypes).toContain("dataforseo_keywords");
    expect(sourceTypes).toContain("communities");
    expect(sourceTypes).toContain("youtube");
  },
  30_000,
);

// ---------------------------------------------------------------------------
// Resilience test — even when a tool throws, runFullCollect still resolves
// ---------------------------------------------------------------------------
test(
  "runFullCollect never throws even when all tools fail",
  async () => {
    vi.resetModules();

    // Mock tools to all throw — runFullCollect should still resolve
    vi.doMock("@/lib/scan/tools/index", () => ({
      searchKeywords:   { run: async () => { throw new Error("keywords down"); } },
      findCommunities:  { run: async () => { throw new Error("communities down"); } },
      findCreators:     { run: async () => { throw new Error("creators down"); } },
    }));

    const { runFullCollect } = await import("@/lib/scan/full-collect");

    const storeUrl = `https://nudgi-fc-fail-${Date.now()}.test`;
    // No DB seed needed — tools are mocked so nothing is persisted
    const ctx: ScanContext = {
      scanId: "test-scan-id",
      appId: "test-app-id",
      storeUrl,
      mode: "web",
      budget: new ScanBudget({ maxToolCalls: 60, budgetCents: 150 }),
    };
    const facts = makeFixtureFacts();

    await expect(runFullCollect(ctx, facts)).resolves.toBeUndefined();
  },
);

// ---------------------------------------------------------------------------
// productName / seeds derivation — listing.name takes precedence
// ---------------------------------------------------------------------------
test(
  "runFullCollect seeds derivation uses listing.name when present",
  async () => {
    vi.resetModules();

    vi.stubEnv("REACHKIT_USE_FIXTURES", "true");

    const capturedArgs: Array<{ seeds?: string[]; topic?: string; competitors?: string[] }> = [];

    vi.doMock("@/lib/scan/tools/index", () => ({
      searchKeywords: {
        run: async (args: { seeds: string[] }) => {
          capturedArgs.push({ seeds: args.seeds });
          return { keywords: [] };
        },
      },
      findCommunities: {
        run: async (args: { topic: string }) => {
          capturedArgs.push({ topic: args.topic });
          return { communities: [] };
        },
      },
      findCreators: {
        run: async (args: { competitors: string[] }) => {
          capturedArgs.push({ competitors: args.competitors });
          return { creators: [] };
        },
      },
    }));

    const { runFullCollect } = await import("@/lib/scan/full-collect");

    const ctx: ScanContext = {
      scanId: "s-derive",
      appId:  "a-derive",
      storeUrl: "https://nudgi.app",
      mode: "web",
      budget: new ScanBudget({ maxToolCalls: 60, budgetCents: 150 }),
    };

    const facts = makeFixtureFacts({
      listing: { name: "Nudgi", category: "Productivity", description: null },
      competitors: [
        { name: "Habitify", url: "https://habitify.me", source: "dataforseo_serp", rank: 1 },
      ],
    });

    await runFullCollect(ctx, facts);

    // seeds should start with the listing name
    const kwArgs = capturedArgs.find((a) => a.seeds !== undefined);
    expect(kwArgs?.seeds?.[0]).toBe("Nudgi");
    expect(kwArgs?.seeds).toContain("Habitify");

    // topic should be the category
    const commArgs = capturedArgs.find((a) => a.topic !== undefined);
    expect(commArgs?.topic).toBe("Productivity");

    // competitors sliced to those with names
    const crArgs = capturedArgs.find((a) => a.competitors !== undefined);
    expect(crArgs?.competitors).toContain("Habitify");
  },
);
