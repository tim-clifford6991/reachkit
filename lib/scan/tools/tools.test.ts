import { expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// getReviews
// ---------------------------------------------------------------------------

test("getReviews charges the budget once and returns reviews", async () => {
  vi.resetModules();
  vi.doMock("@/lib/scan/adapters/app-store-rss", () => ({
    fetchAppReviews: async () => [{ rating: 5, title: "", body: "great" }],
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));
  const { getReviews } = await import("./get-reviews");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });
  const out = await getReviews.run(
    { appId: "1", subjectKey: "sofa" },
    { scanId: "s1", mode: "ios", budget },
  );
  expect(out.reviews).toHaveLength(1);
  expect(budget.callsMade).toBe(1);
});

test("getReviews persists raw payload to raw_documents", async () => {
  vi.resetModules();
  const upsertRawDocument = vi.fn(async () => ({ id: 42, deduped: false }));
  vi.doMock("@/lib/scan/adapters/app-store-rss", () => ({
    fetchAppReviews: async () => [{ rating: 4, title: "ok", body: "decent" }],
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({ upsertRawDocument }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));
  const { getReviews } = await import("./get-reviews");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });
  await getReviews.run(
    { appId: "999", subjectKey: "myapp" },
    { scanId: "s2", mode: "ios", budget },
  );
  expect(upsertRawDocument).toHaveBeenCalledOnce();
  const firstCall = upsertRawDocument.mock.calls[0];
  expect(firstCall).toBeDefined();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((firstCall as any)[0].subjectKey).toBe("myapp");
});

// ---------------------------------------------------------------------------
// findCompetitors — web mode (Promise.allSettled isolation)
// ---------------------------------------------------------------------------

test("findCompetitors (web) isolates a failed source via allSettled", async () => {
  vi.resetModules();
  vi.doMock("@/lib/scan/adapters/dataforseo", () => ({
    liveSerpAlternatives: async () => ({
      competitors: [
        {
          name: "Habitify",
          url: "https://habitify.me",
          source: "dataforseo_serp",
          rank: 1,
        },
      ],
      serpResultCount: 1000,
      raw: {},
    }),
  }));
  vi.doMock("@/lib/scan/adapters/product-hunt", () => ({
    fetchPhByName: async () => {
      throw new Error("PH 503");
    }, // failed source
  }));
  vi.doMock("@/lib/scan/adapters/tavily", () => ({
    tavilyAlternatives: async () => ({ competitors: [], raw: {} }),
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));
  const { findCompetitors } = await import("./find-competitors");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });
  const out = await findCompetitors.run(
    {
      productName: "nudgi",
      storeUrl: "https://nudgi.app",
      subjectKey: "nudgi",
    },
    { scanId: "s1", mode: "web", budget },
  );
  expect(out.competitors.map((c) => c.name)).toContain("Habitify"); // survives the PH failure
  expect(out.extras.serpResultCount).toBe(1000);
});

test("findCompetitors (web) charges 3 tool calls and 1 cent", async () => {
  vi.resetModules();
  vi.doMock("@/lib/scan/adapters/dataforseo", () => ({
    liveSerpAlternatives: async () => ({
      competitors: [],
      serpResultCount: 0,
      raw: {},
    }),
  }));
  vi.doMock("@/lib/scan/adapters/product-hunt", () => ({
    fetchPhByName: async () => ({ selfUpvotes: 200, neighbours: [], raw: {} }),
  }));
  vi.doMock("@/lib/scan/adapters/tavily", () => ({
    tavilyAlternatives: async () => ({ competitors: [], raw: {} }),
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));
  const { findCompetitors } = await import("./find-competitors");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });
  await findCompetitors.run(
    { productName: "nudgi", storeUrl: "https://nudgi.app", subjectKey: "nudgi" },
    { scanId: "s1", mode: "web", budget },
  );
  expect(budget.callsMade).toBe(3);
  expect(budget.spentCents).toBe(1);
});

test("findCompetitors (web) captures phUpvotes from PH when it succeeds", async () => {
  vi.resetModules();
  vi.doMock("@/lib/scan/adapters/dataforseo", () => ({
    liveSerpAlternatives: async () => ({
      competitors: [],
      serpResultCount: 0,
      raw: {},
    }),
  }));
  vi.doMock("@/lib/scan/adapters/product-hunt", () => ({
    fetchPhByName: async () => ({
      selfUpvotes: 500,
      neighbours: [],
      raw: {},
    }),
  }));
  vi.doMock("@/lib/scan/adapters/tavily", () => ({
    tavilyAlternatives: async () => ({ competitors: [], raw: {} }),
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));
  const { findCompetitors } = await import("./find-competitors");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });
  const out = await findCompetitors.run(
    { productName: "nudgi", storeUrl: "https://nudgi.app", subjectKey: "nudgi" },
    { scanId: "s1", mode: "web", budget },
  );
  expect(out.extras.phUpvotes).toBe(500);
});

// ---------------------------------------------------------------------------
// findCompetitors — app mode
// ---------------------------------------------------------------------------

test("findCompetitors (app) uses iTunes search and charges 1 call", async () => {
  vi.resetModules();
  vi.doMock("@/lib/scan/adapters/itunes", () => ({
    appIdFromUrl: () => "123456",
    fetchItunesCompetitors: async () => [
      { name: "CompApp", url: "https://apps.apple.com/us/app/compapp/id999", source: "itunes_search", rank: 1 },
    ],
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));
  const { findCompetitors } = await import("./find-competitors");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });
  const out = await findCompetitors.run(
    {
      productName: "myapp",
      storeUrl: "https://apps.apple.com/us/app/myapp/id123456",
      subjectKey: "myapp",
    },
    { scanId: "s3", mode: "ios", budget },
  );
  expect(out.competitors[0]?.name).toBe("CompApp");
  expect(budget.callsMade).toBe(1);
  expect(budget.spentCents).toBe(0);
});

// ---------------------------------------------------------------------------
// getListing — app mode
// ---------------------------------------------------------------------------

test("getListing (app) charges 1 call and returns listing + rating extras", async () => {
  vi.resetModules();
  vi.doMock("@/lib/scan/adapters/itunes", () => ({
    appIdFromUrl: () => "12345",
    fetchItunesListing: async () => ({
      listing: { name: "MyApp", category: "Productivity", description: "Does things" },
      rating: 4.8,
      ratingCount: 1200,
      raw: {},
    }),
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));
  const { getListing } = await import("./get-listing");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });
  const out = await getListing.run(
    {
      storeUrl: "https://apps.apple.com/us/app/myapp/id12345",
      subjectKey: "myapp",
    },
    { scanId: "s4", mode: "ios", budget },
  );
  expect(out.listing.name).toBe("MyApp");
  expect(out.extras.rating).toBe(4.8);
  expect(out.extras.ratingCount).toBe(1200);
  expect(budget.callsMade).toBe(1);
  expect(budget.spentCents).toBe(0);
});

// ---------------------------------------------------------------------------
// android — C1 audit finding: there is no Google Play Store adapter. Every
// "app mode" tool is written as "app mode (ios / android)" with no platform
// branch and always calls the Apple-only itunes adapter (appIdFromUrl's
// `/\/id(\d+)/` pattern never matches a real play.google.com URL — see
// lib/scan/adapters/itunes.test.ts). These tests use the REAL itunes adapter
// (not mocked) to pin exactly what a live android scan currently does: it
// does not crash the scan, but it does NOT get real data either.
// ---------------------------------------------------------------------------

const REAL_PLAY_URL = "https://play.google.com/store/apps/details?id=com.example.app";

test("getListing (android) degrades to a hostname-only listing — no Play Store adapter exists", async () => {
  vi.resetModules();
  // Earlier tests in this file `vi.doMock` the itunes adapter; that registration
  // outlives `vi.resetModules()`, so it must be explicitly undone to exercise
  // the REAL adapter (and its Apple-only appId regex) here.
  vi.doUnmock("@/lib/scan/adapters/itunes");
  vi.doMock("@/lib/db/raw-documents", () => ({ upsertRawDocument: async () => ({ id: 1, deduped: false }) }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({ recordPipelineRun: async () => {} }));
  const { getListing } = await import("./get-listing");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });
  const out = await getListing.run(
    { storeUrl: REAL_PLAY_URL, subjectKey: REAL_PLAY_URL },
    { scanId: "s-android", mode: "android", budget },
  );
  // getListing's app-mode branch DOES try/catch appIdFromUrl+fetchItunesListing,
  // so this resolves rather than throwing — but with a useless hostname stand-in,
  // not the app's real name/category/description.
  expect(out.listing).toEqual({ name: "play.google.com", category: null, description: null });
  expect(out.extras).toEqual({});
});

test("findCompetitors (android) REJECTS — appIdFromUrl throws unguarded in the app-mode branch (no internal try/catch)", async () => {
  vi.resetModules();
  vi.doUnmock("@/lib/scan/adapters/itunes");
  vi.doMock("@/lib/db/raw-documents", () => ({ upsertRawDocument: async () => ({ id: 1, deduped: false }) }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({ recordPipelineRun: async () => {} }));
  const { findCompetitors } = await import("./find-competitors");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });
  // Unlike getListing, find-competitors.ts's app-mode branch has no internal
  // try/catch around appIdFromUrl — it only survives in production because
  // collect.ts wraps the whole `findCompetitors.run(...)` call in `.catch()`.
  // Called directly (as this test does), it rejects.
  await expect(
    findCompetitors.run(
      { productName: "example app", storeUrl: REAL_PLAY_URL, subjectKey: REAL_PLAY_URL },
      { scanId: "s-android", mode: "android", budget },
    ),
  ).rejects.toThrow(/no app id in url/);
});

// ---------------------------------------------------------------------------
// getListing — web mode
// ---------------------------------------------------------------------------

test("getListing (web) charges 2 calls and returns domainAgeYears in extras", async () => {
  vi.resetModules();
  // Healthy, content-rich HTML (Part C: `<html></html>` alone is a GARBAGE
  // capture — near-zero visible text — and would trigger the fetch-escalation
  // path this test isn't about; that path is covered in get-listing.test.ts).
  vi.doMock("@/lib/scan/adapters/site-fetch", () => ({
    fetchSiteListing: async () => ({
      listing: { name: "Nudgi", category: null, description: "A nudge app" },
      raw: `<html><head><title>Nudgi — habit nudges</title></head><body><p>${"Gentle reminders that build habits, one nudge at a time. ".repeat(10)}</p></body></html>`,
    }),
  }));
  vi.doMock("@/lib/scan/adapters/domain-age", () => ({
    fetchDomainAgeYears: async () => 3,
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));
  // An earlier test in this file `vi.doMock`'d this path without exporting
  // `tavilyExtract` — that registration survives `vi.resetModules()`. Not
  // reached by a healthy fetch (no escalation), but unmock explicitly so this
  // test can't silently start depending on load order.
  vi.doUnmock("@/lib/scan/adapters/tavily");
  const { getListing } = await import("./get-listing");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });
  const out = await getListing.run(
    { storeUrl: "https://nudgi.app", subjectKey: "nudgi" },
    { scanId: "s5", mode: "web", budget },
  );
  expect(out.listing.name).toBe("Nudgi");
  expect(out.extras.domainAgeYears).toBe(3);
  expect(out.extras.fetchDegraded).toBe(false);
  expect(budget.callsMade).toBe(2);
  expect(budget.spentCents).toBe(0);
});

test("getListing (web) does NOT throw when site-fetch rejects; degrades gracefully", async () => {
  vi.resetModules();
  const recordPipelineRun = vi.fn(async () => {});
  vi.doMock("@/lib/scan/adapters/site-fetch", () => ({
    fetchSiteListing: async () => {
      throw new Error("fetch failed");
    },
  }));
  vi.doMock("@/lib/scan/adapters/domain-age", () => ({
    fetchDomainAgeYears: async () => 5,
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({ recordPipelineRun }));
  const { getListing } = await import("./get-listing");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });
  const out = await getListing.run(
    { storeUrl: "https://nudgi.app", subjectKey: "nudgi" },
    { scanId: "s7", mode: "web", budget },
  );
  expect(out.listing.name).toBe("nudgi.app");
  expect(out.extras.domainAgeYears).toBe(5);
  expect(recordPipelineRun).toHaveBeenCalledOnce();
});

// ---------------------------------------------------------------------------
// searchWeb
// ---------------------------------------------------------------------------

test("searchWeb charges 1 call + 1 cent and returns competitors", async () => {
  vi.resetModules();
  vi.doMock("@/lib/scan/adapters/tavily", () => ({
    tavilyAlternatives: async () => ({
      competitors: [
        { name: "AltApp", url: "https://altapp.com", source: "tavily", rank: 1 },
      ],
      raw: {},
    }),
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: async () => ({ id: 1, deduped: false }),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));
  const { searchWeb } = await import("./search-web");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });
  const out = await searchWeb.run(
    { productName: "nudgi" },
    { scanId: "s6", mode: "web", budget },
  );
  expect(out.competitors[0]?.name).toBe("AltApp");
  expect(budget.callsMade).toBe(1);
  expect(budget.spentCents).toBe(1);
});

// ---------------------------------------------------------------------------
// index — registry wiring
// ---------------------------------------------------------------------------

test("index registers all 4 tools in the registry", async () => {
  vi.resetModules();
  // Stub all adapters so the import doesn't error
  vi.doMock("@/lib/scan/adapters/app-store-rss", () => ({ fetchAppReviews: async () => [] }));
  vi.doMock("@/lib/scan/adapters/itunes", () => ({ appIdFromUrl: () => "", fetchItunesListing: async () => ({ listing: { name: "", category: null, description: null }, rating: null, ratingCount: 0, raw: {} }), fetchItunesCompetitors: async () => [] }));
  vi.doMock("@/lib/scan/adapters/site-fetch", () => ({ fetchSiteListing: async () => ({ listing: { name: "", category: null, description: null }, raw: "" }) }));
  vi.doMock("@/lib/scan/adapters/domain-age", () => ({ fetchDomainAgeYears: async () => null }));
  vi.doMock("@/lib/scan/adapters/dataforseo", () => ({ liveSerpAlternatives: async () => ({ competitors: [], serpResultCount: 0, raw: {} }) }));
  vi.doMock("@/lib/scan/adapters/product-hunt", () => ({ fetchPhByName: async () => ({ selfUpvotes: 0, neighbours: [], raw: {} }) }));
  vi.doMock("@/lib/scan/adapters/tavily", () => ({ tavilyAlternatives: async () => ({ competitors: [], raw: {} }) }));
  vi.doMock("@/lib/db/raw-documents", () => ({ upsertRawDocument: async () => ({ id: 1, deduped: false }) }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({ recordPipelineRun: async () => {} }));

  const indexMod = await import("./index");
  const { registry } = await import("@/lib/tools/registry");
  expect(registry.has("get_listing")).toBe(true);
  expect(registry.has("get_reviews")).toBe(true);
  expect(registry.has("find_competitors")).toBe(true);
  expect(registry.has("search_web")).toBe(true);
  // Re-export check
  expect(typeof indexMod.getListing.run).toBe("function");
  expect(typeof indexMod.getReviews.run).toBe("function");
  expect(typeof indexMod.findCompetitors.run).toBe("function");
  expect(typeof indexMod.searchWeb.run).toBe("function");
});
