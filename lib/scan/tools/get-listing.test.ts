/**
 * get_listing tool tests — Part C fetch escalation.
 *
 * Covers: the escalation is called EXACTLY ONCE when the site fetch is
 * garbage, and NEVER when it's healthy (spy, call-count-proven); the
 * non-garbage-replacement rule (a good escalation replaces/adds the
 * site_fetch_escalated row + clears the degrade flag, a still-garbage
 * escalation does neither and sets the degrade flag); and that the
 * escalation's Tavily cost is recorded under the ambient cost context
 * (invariant #2), never for a healthy fetch that never escalates.
 *
 * Review fixes:
 *  CRITICAL A — a good escalation's derived name REPLACES `listing.name`
 *  (so `facts.listing.name` → brandNames can recover), unless the derived
 *  name is trivial (empty or the bare host).
 *  IMPORTANT B — a still-garbage escalation persists a `site_fetch_degraded`
 *  marker row (consumed by lib/llm/extract.ts's effectiveListingRows to
 *  exclude the raw garbage HTML from the positioning/identity extract too).
 */
import { afterEach, describe, expect, test, vi } from "vitest";

const STORE_URL = "https://x.com/";
const HOST = "x.com";

// A realistic CSR bootstrap shell — near-empty visible text, an empty #root
// mount node, and the universal noscript fallback (same shape as
// fetch-quality.test.ts's SPA_SHELL_HTML — the class this feature targets).
const GARBAGE_HTML = `<!doctype html>
<html>
<head><title>${HOST}</title></head>
<body>
  <noscript>You need to enable JavaScript to run this app.</noscript>
  <div id="root"></div>
</body>
</html>`;

const HEALTHY_HTML = `<!doctype html>
<html>
<head><title>Acme — Project tracking for small teams</title>
<meta name="description" content="Acme helps small teams plan sprints and ship on time."></head>
<body>
  <h1>Project tracking that keeps small teams shipping</h1>
  <p>Acme is a lightweight project tracker built for small teams who are tired of
  heavyweight tools. Plan your sprint in minutes, track issues without the
  ceremony, and see exactly what's blocking your release. Thousands of teams
  use Acme every day to ship faster, with less overhead than the big
  enterprise suites. Try it free for 14 days, no credit card required.</p>
</body>
</html>`;

const GOOD_ESCALATED_TEXT = "Real rendered page content. ".repeat(30); // > 400 chars, no shell markers
const STILL_GARBAGE_TEXT = "short";

// CRITICAL A fixtures — a realistic Tavily Extract markdown body carrying a
// derivable H1 title, and one whose only derivable "title" is the bare host
// (must NOT override listing.name — a trivial derived name is no better than
// what's already there).
const GOOD_ESCALATED_WITH_TITLE = `# Acme — Project Tracking for Small Teams

Acme is a lightweight project tracker built for small teams who are tired of
heavyweight tools. Plan your sprint in minutes, track issues without the
ceremony, and see exactly what's blocking your release. Thousands of teams
use Acme every day to ship faster, with less overhead than the big
enterprise suites. Try it free for 14 days, no credit card required — set up
takes under five minutes and your whole team can be planning sprints by the
end of the afternoon.`;

const GOOD_ESCALATED_TRIVIAL_TITLE = `# x.com

Real rendered page content that is long enough to clear the garbage-fetch
length floor but whose only derivable title-shaped line is literally the
bare host itself, which must not be treated as a real recovered brand name.
Padding this out further so the visible text comfortably clears 400 chars
for the re-check the escalation performs on its own content, since the
detector re-runs on exactly this rendered text with no separate title field
to fall back on.`;

function budgetOf() {
  return import("@/lib/tools/registry").then(
    ({ ScanBudget }) => new ScanBudget({ maxToolCalls: 60, budgetCents: 500 }),
  );
}

function mockCommon(opts: { siteHtml: string; siteName: string; tavilyExtract?: ReturnType<typeof vi.fn> }) {
  vi.doMock("@/lib/scan/adapters/site-fetch", () => ({
    fetchSiteListing: async () => ({
      listing: { name: opts.siteName, category: null, description: null },
      raw: opts.siteHtml,
    }),
  }));
  vi.doMock("@/lib/scan/adapters/domain-age", () => ({
    fetchDomainAgeYears: async () => 5,
  }));
  vi.doMock("@/lib/db/raw-documents", () => ({
    upsertRawDocument: vi.fn(async () => ({ id: 1, deduped: false })),
  }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
    recordPipelineRun: async () => {},
  }));
  if (opts.tavilyExtract) {
    vi.doMock("@/lib/scan/adapters/tavily", () => ({ tavilyExtract: opts.tavilyExtract }));
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("get_listing — escalation call-count (spy)", () => {
  test("healthy fetch: tavilyExtract is NEVER called", async () => {
    vi.resetModules();
    const tavilyExtract = vi.fn(async () => {
      throw new Error("tavilyExtract should not be called for a healthy fetch");
    });
    mockCommon({ siteHtml: HEALTHY_HTML, siteName: "Acme — Project tracking for small teams", tavilyExtract });

    const { getListing } = await import("./get-listing");
    const budget = await budgetOf();
    const out = await getListing.run(
      { storeUrl: STORE_URL, subjectKey: STORE_URL },
      { scanId: "s1", mode: "web", budget },
    );

    expect(tavilyExtract).not.toHaveBeenCalled();
    expect(out.extras.fetchDegraded).toBe(false);
  });

  test("garbage fetch: tavilyExtract is called EXACTLY ONCE", async () => {
    vi.resetModules();
    const tavilyExtract = vi.fn(async (urls: string[]) => [{ url: urls[0]!, content: GOOD_ESCALATED_TEXT }]);
    mockCommon({ siteHtml: GARBAGE_HTML, siteName: HOST, tavilyExtract });

    const { getListing } = await import("./get-listing");
    const budget = await budgetOf();
    await getListing.run({ storeUrl: STORE_URL, subjectKey: STORE_URL }, { scanId: "s2", mode: "web", budget });

    expect(tavilyExtract).toHaveBeenCalledTimes(1);
    expect(tavilyExtract).toHaveBeenCalledWith([STORE_URL]);
  });
});

describe("get_listing — non-garbage-replacement rule", () => {
  test("a GOOD escalation is persisted as site_fetch_escalated and clears the degrade flag", async () => {
    vi.resetModules();
    const tavilyExtract = vi.fn(async (urls: string[]) => [{ url: urls[0]!, content: GOOD_ESCALATED_TEXT }]);
    mockCommon({ siteHtml: GARBAGE_HTML, siteName: HOST, tavilyExtract });

    const { getListing } = await import("./get-listing");
    const { upsertRawDocument } = await import("@/lib/db/raw-documents");
    const budget = await budgetOf();
    const out = await getListing.run(
      { storeUrl: STORE_URL, subjectKey: STORE_URL },
      { scanId: "s3", mode: "web", budget },
    );

    expect(out.extras.fetchDegraded).toBe(false);
    const calls = (upsertRawDocument as ReturnType<typeof vi.fn>).mock.calls as Array<[Record<string, unknown>]>;
    const escalatedCall = calls.find((c) => c[0].sourceType === "site_fetch_escalated");
    expect(escalatedCall).toBeDefined();
    // Implementation trims the escalated content before persisting.
    expect(escalatedCall?.[0].body).toBe(GOOD_ESCALATED_TEXT.trim());
    expect(escalatedCall?.[0].subjectType).toBe("web");
  });

  test("a STILL-GARBAGE escalation is NOT persisted and sets the degrade flag (don't-cache-empties)", async () => {
    vi.resetModules();
    const tavilyExtract = vi.fn(async (urls: string[]) => [{ url: urls[0]!, content: STILL_GARBAGE_TEXT }]);
    mockCommon({ siteHtml: GARBAGE_HTML, siteName: HOST, tavilyExtract });

    const { getListing } = await import("./get-listing");
    const { upsertRawDocument } = await import("@/lib/db/raw-documents");
    const budget = await budgetOf();
    const out = await getListing.run(
      { storeUrl: STORE_URL, subjectKey: STORE_URL },
      { scanId: "s4", mode: "web", budget },
    );

    expect(out.extras.fetchDegraded).toBe(true);
    const calls = (upsertRawDocument as ReturnType<typeof vi.fn>).mock.calls as Array<[Record<string, unknown>]>;
    expect(calls.some((c) => c[0].sourceType === "site_fetch_escalated")).toBe(false);
  });

  test("escalation returning NO result at all (empty array) also degrades honestly", async () => {
    vi.resetModules();
    const tavilyExtract = vi.fn(async () => []);
    mockCommon({ siteHtml: GARBAGE_HTML, siteName: HOST, tavilyExtract });

    const { getListing } = await import("./get-listing");
    const budget = await budgetOf();
    const out = await getListing.run(
      { storeUrl: STORE_URL, subjectKey: STORE_URL },
      { scanId: "s5", mode: "web", budget },
    );

    expect(out.extras.fetchDegraded).toBe(true);
  });
});

describe("get_listing — CRITICAL A: escalated title REPLACES listing.name", () => {
  test("a GOOD escalation with a derivable H1 REPLACES listing.name", async () => {
    vi.resetModules();
    const tavilyExtract = vi.fn(async (urls: string[]) => [{ url: urls[0]!, content: GOOD_ESCALATED_WITH_TITLE }]);
    mockCommon({ siteHtml: GARBAGE_HTML, siteName: HOST, tavilyExtract });

    const { getListing } = await import("./get-listing");
    const budget = await budgetOf();
    const out = await getListing.run(
      { storeUrl: STORE_URL, subjectKey: STORE_URL },
      { scanId: "s6", mode: "web", budget },
    );

    expect(out.listing.name).toBe("Acme — Project Tracking for Small Teams");
    // Only the name is replaced — no other listing field is fabricated.
    expect(out.listing.category).toBeNull();
    expect(out.listing.description).toBeNull();
  });

  test("a derived name that is TRIVIAL (equals the bare host) does NOT override listing.name", async () => {
    vi.resetModules();
    const tavilyExtract = vi.fn(async (urls: string[]) => [{ url: urls[0]!, content: GOOD_ESCALATED_TRIVIAL_TITLE }]);
    mockCommon({ siteHtml: GARBAGE_HTML, siteName: HOST, tavilyExtract });

    const { getListing } = await import("./get-listing");
    const budget = await budgetOf();
    const out = await getListing.run(
      { storeUrl: STORE_URL, subjectKey: STORE_URL },
      { scanId: "s7", mode: "web", budget },
    );

    // The escalated H1 is "x.com" — the bare host — so listing.name stays
    // whatever the (fixture-supplied) original name was, unmodified.
    expect(out.listing.name).toBe(HOST);
  });

  test("a GOOD escalation with no derivable title (no H1, first line too long) leaves listing.name unchanged", async () => {
    vi.resetModules();
    // GOOD_ESCALATED_TEXT is one long repeated line with no H1 and no
    // newlines — deriveEscalatedName must return null, not a mangled guess.
    const tavilyExtract = vi.fn(async (urls: string[]) => [{ url: urls[0]!, content: GOOD_ESCALATED_TEXT }]);
    mockCommon({ siteHtml: GARBAGE_HTML, siteName: HOST, tavilyExtract });

    const { getListing } = await import("./get-listing");
    const budget = await budgetOf();
    const out = await getListing.run(
      { storeUrl: STORE_URL, subjectKey: STORE_URL },
      { scanId: "s8", mode: "web", budget },
    );

    expect(out.listing.name).toBe(HOST);
  });
});

describe("get_listing — IMPORTANT B: still-garbage escalation persists an exclusionary marker", () => {
  test("a STILL-GARBAGE escalation persists a site_fetch_degraded marker row", async () => {
    vi.resetModules();
    const tavilyExtract = vi.fn(async (urls: string[]) => [{ url: urls[0]!, content: STILL_GARBAGE_TEXT }]);
    mockCommon({ siteHtml: GARBAGE_HTML, siteName: HOST, tavilyExtract });

    const { getListing } = await import("./get-listing");
    const { upsertRawDocument } = await import("@/lib/db/raw-documents");
    const budget = await budgetOf();
    await getListing.run({ storeUrl: STORE_URL, subjectKey: STORE_URL }, { scanId: "s9", mode: "web", budget });

    const calls = (upsertRawDocument as ReturnType<typeof vi.fn>).mock.calls as Array<[Record<string, unknown>]>;
    const markerCall = calls.find((c) => c[0].sourceType === "site_fetch_degraded");
    expect(markerCall).toBeDefined();
    expect(markerCall?.[0].subjectType).toBe("web");
  });

  test("a HEALTHY fetch persists NO degraded marker", async () => {
    vi.resetModules();
    const tavilyExtract = vi.fn(async () => {
      throw new Error("should not be called");
    });
    mockCommon({ siteHtml: HEALTHY_HTML, siteName: "Acme — Project tracking for small teams", tavilyExtract });

    const { getListing } = await import("./get-listing");
    const { upsertRawDocument } = await import("@/lib/db/raw-documents");
    const budget = await budgetOf();
    await getListing.run({ storeUrl: STORE_URL, subjectKey: STORE_URL }, { scanId: "s10", mode: "web", budget });

    const calls = (upsertRawDocument as ReturnType<typeof vi.fn>).mock.calls as Array<[Record<string, unknown>]>;
    expect(calls.some((c) => c[0].sourceType === "site_fetch_degraded")).toBe(false);
  });
});

describe("get_listing — Tavily extract cost is recorded under the ambient cost step", () => {
  test("garbage fetch → escalation cost lands in the active cost sink", async () => {
    vi.resetModules();
    // Earlier tests in this file `vi.doMock`'d "@/lib/scan/adapters/tavily"
    // directly (a registration, not just a module-cache entry — it survives
    // `vi.resetModules()`). Unmock it here so THIS test's dynamic import
    // resolves the REAL module and exercises the real recordTavilyCost path.
    vi.doUnmock("@/lib/scan/adapters/tavily");
    // Mock the transport boundary (not the tavily adapter itself), so the
    // REAL tavilyExtract → recordTavilyCost path runs, same idiom as
    // lib/scan/profile/crawl.test.ts. `@/lib/config/env` is also stubbed —
    // its real module does a strict zod parse of the FULL process.env
    // (Supabase URL/keys etc.), which isn't set in this unit-test harness;
    // every other adapter test that reaches this real path either mocks the
    // adapter directly or never touches `env`, so this stub is the seam.
    vi.doMock("@/lib/config/env", () => ({ env: { tavilyApiKey: "test-key", tavilyUsdPerCredit: 0.008 } }));
    vi.doMock("@/lib/scan/adapters/fetch-timeout", () => ({
      fetchWithTimeout: vi.fn(async () => ({
        ok: true,
        json: async () => ({ results: [{ url: STORE_URL, raw_content: GOOD_ESCALATED_TEXT }] }),
      })),
    }));
    mockCommon({ siteHtml: GARBAGE_HTML, siteName: HOST });

    const { getListing } = await import("./get-listing");
    const { runInCostContext, newCostSink } = await import("@/lib/scan/cost-context");
    const budget = await budgetOf();
    const sink = newCostSink(undefined, "scan-cost-1");

    await runInCostContext(sink, () =>
      getListing.run({ storeUrl: STORE_URL, subjectKey: STORE_URL }, { scanId: "scan-cost-1", mode: "web", budget }),
    );

    expect(sink.tavily).toBeGreaterThan(0);
  });

  test("healthy fetch → no escalation call → no Tavily cost recorded", async () => {
    vi.resetModules();
    const fetchWithTimeout = vi.fn(async () => ({ ok: true, json: async () => ({ results: [] }) }));
    vi.doMock("@/lib/scan/adapters/fetch-timeout", () => ({ fetchWithTimeout }));
    mockCommon({ siteHtml: HEALTHY_HTML, siteName: "Acme — Project tracking for small teams" });

    const { getListing } = await import("./get-listing");
    const { runInCostContext, newCostSink } = await import("@/lib/scan/cost-context");
    const budget = await budgetOf();
    const sink = newCostSink(undefined, "scan-cost-2");

    await runInCostContext(sink, () =>
      getListing.run({ storeUrl: STORE_URL, subjectKey: STORE_URL }, { scanId: "scan-cost-2", mode: "web", budget }),
    );

    expect(sink.tavily).toBe(0);
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });
});
