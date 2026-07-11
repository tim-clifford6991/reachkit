/**
 * pulse.test.ts — the free iterative-tracking pulse.
 *
 * Coverage:
 *   - coerceFacts degrades safely and honors the persisted blob
 *   - refreshSiteCrawl persists a fresh site_fetch doc; never throws
 *   - runScorePulse: fresh crawl for web, market stays null (no DataForSEO),
 *     snapshot written with source "pulse"; skips apps with no scan
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

const fetchSiteListing = vi.fn();
const upsertRawDocument = vi.fn();
const gatherScoreComponents = vi.fn();
const verifiedScore = vi.fn();
const persistScanSignals = vi.fn();
const headlineFromRows = vi.fn();
const inserted: unknown[] = [];

function mockDb(opts: { app?: unknown; scan?: unknown; signals?: unknown[] }) {
  const table = (name: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    Object.assign(chain, {
      select: self, eq: self, order: self, limit: self, gte: self,
      maybeSingle: async () =>
        name === "apps" ? { data: opts.app ?? null } : { data: opts.scan ?? null },
      insert: (row: unknown) => {
        inserted.push({ table: name, row });
        return { select: self, single: async () => ({ data: { id: "x" } }), error: null, then: undefined };
      },
    });
    // signals read resolves via then-able select chain末 — emulate final await
    (chain as { then?: unknown }).then = undefined;
    return chain;
  };
  return { from: (name: string) => table(name) };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  inserted.length = 0;
  vi.doMock("@/lib/scan/adapters/site-fetch", () => ({ fetchSiteListing }));
  vi.doMock("@/lib/db/raw-documents", () => ({ upsertRawDocument }));
  vi.doMock("@/lib/scan/score-full", () => ({ gatherScoreComponents, verifiedScore }));
  vi.doMock("@/lib/scan/persist-signals", () => ({ persistScanSignals }));
  // unifiedHeadline is a passthrough here: the mock scan has no report_payload, so
  // search presence is null → the pulse leaves the on-page headline unchanged.
  vi.doMock("@/lib/scan/registry-score", () => ({
    headlineFromRows,
    unifiedHeadline: (h: unknown) => h,
  }));
  vi.doMock("@/lib/config/env", () => ({ env: { scanBudgetCents: 150 } }));
  vi.doMock("@/lib/tools/registry", () => ({ ScanBudget: class { constructor(_: unknown) {} } }));
});

describe("coerceFacts", () => {
  test("degrades to a safe empty shape and honors the blob", async () => {
    vi.doMock("@/lib/db/client", () => ({ serverDb: () => mockDb({}) }));
    const { coerceFacts } = await import("./pulse");
    expect(coerceFacts(null, "web").mode).toBe("web");
    expect(coerceFacts(null, "web").coldStart).toBe(true);
    const facts = coerceFacts({ reviewVolume: 42 } as never, "ios");
    expect(facts.reviewVolume).toBe(42);
    expect(facts.mode).toBe("ios");
  });
});

describe("refreshSiteCrawl", () => {
  test("persists the fresh crawl under the storeUrl subject key", async () => {
    vi.doMock("@/lib/db/client", () => ({ serverDb: () => mockDb({}) }));
    fetchSiteListing.mockResolvedValue({ listing: {}, raw: "<html>fresh</html>" });
    upsertRawDocument.mockResolvedValue({ id: 1, deduped: false });
    const { refreshSiteCrawl } = await import("./pulse");
    expect(await refreshSiteCrawl("https://resend.com/")).toBe(true);
    expect(upsertRawDocument).toHaveBeenCalledWith(
      expect.objectContaining({ subjectKey: "https://resend.com/", sourceType: "site_fetch", mode: "web" }),
    );
  });

  test("never throws — a dead site just returns false", async () => {
    vi.doMock("@/lib/db/client", () => ({ serverDb: () => mockDb({}) }));
    fetchSiteListing.mockRejectedValue(new Error("ECONNREFUSED"));
    const { refreshSiteCrawl } = await import("./pulse");
    expect(await refreshSiteCrawl("https://dead.example")).toBe(false);
  });
});

describe("runScorePulse", () => {
  test("web app: fresh crawl → market:null recompute → 'pulse' snapshot, zero paid calls", async () => {
    vi.doMock("@/lib/db/client", () => ({
      serverDb: () => mockDb({
        app: { store_url: "https://resend.com/", platform: "web" },
        scan: { id: "scan-1", preliminary_facts: null },
      }),
    }));
    fetchSiteListing.mockResolvedValue({ listing: {}, raw: "<html>fresh</html>" });
    upsertRawDocument.mockResolvedValue({ id: 1, deduped: false });
    gatherScoreComponents.mockResolvedValue({ some: "components" });
    verifiedScore.mockReturnValue({ total: 61 });
    persistScanSignals.mockResolvedValue(undefined);
    headlineFromRows.mockReturnValue({ total: 63, breakdown: {}, version: 2 });

    const { runScorePulse } = await import("./pulse");
    const result = await runScorePulse("app-1");

    expect(result).toEqual({ skipped: false, total: 63 });
    expect(fetchSiteListing).toHaveBeenCalledTimes(1);
    // The whole point: DataForSEO stays untouched — market is null.
    expect(persistScanSignals).toHaveBeenCalledWith(expect.objectContaining({ market: null }));
    const snap = inserted.find((i) => (i as { table: string }).table === "score_snapshots") as { row: Record<string, unknown> };
    expect(snap.row).toMatchObject({ app_id: "app-1", total: 63, source: "pulse", scan_id: "scan-1" });
  });

  test("app with no scan yet is skipped (nothing to score)", async () => {
    vi.doMock("@/lib/db/client", () => ({
      serverDb: () => mockDb({ app: { store_url: "https://x.dev", platform: "web" }, scan: null }),
    }));
    const { runScorePulse } = await import("./pulse");
    expect(await runScorePulse("app-2")).toEqual({ skipped: true });
    expect(fetchSiteListing).not.toHaveBeenCalled();
  });
});
