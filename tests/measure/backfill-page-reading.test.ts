// The 0¢ backfill: each live page's reading is folded from its site's stored
// scans, as exported by the script's own select, and written by one guarded
// update. It reaches no vendor and no database (`reading-graph.test.ts`).
import { describe, expect, it } from "vitest";
import { backfill, updateSql, type PageRow, type ScanRow } from "../../scripts/backfill-page-reading/run";
import type { StoredReport } from "../../src/lib/scan/report";
import { SAAS, stored, weekWith } from "./reading-fixture";

const NOW = new Date(Date.UTC(2026, 9, 21, 9, 0, 0));

/** A stored report as the scans select returns it: only the parts a place reads. */
function exported(report: StoredReport, createdAt: string): ScanRow {
  const blob = stored(report) as {
    questions: { kind: string; value?: { search: { keyword: string } }[] };
    serps: { kind: string; reason?: string; value?: { organic: { url: string; position: number }[] } }[];
    ownRanked: unknown;
    ownRankedRows: { keyword: string; position: number; url: string }[];
    pageQuestions: { rows: Record<string, unknown>[] } | null;
  };
  return {
    site_id: "s1",
    created_at: createdAt,
    measured_at: createdAt,
    keywords: blob.questions.kind === "unmeasured" ? null : (blob.questions.value ?? []).map((q) => q.search.keyword),
    serps: blob.serps.map((s) =>
      s.kind === "unmeasured" ? { kind: "unmeasured", reason: s.reason } : { kind: s.kind, value: { organic: (s.value?.organic ?? []).map(({ url, position }) => ({ url, position })) } }
    ),
    own_ranked: blob.ownRanked,
    own_ranked_rows: blob.ownRankedRows.map(({ keyword, position, url }) => ({ keyword, position, url })),
    page_questions: (blob.pageQuestions?.rows ?? []).map((q) => ({
      publicationId: q.publicationId,
      liveUrl: q.liveUrl,
      question: { search: (q.question as { search: string }).search },
      cell: q.cell,
      engines: q.engines,
      organic: q.organic,
    })),
  };
}

const week = (place: number, createdAt: string) =>
  exported(weekWith({ domain: SAAS.domain, asked: [{ publicationId: "pub-1", liveUrl: SAAS.page, search: SAAS.search, place }] }), createdAt);

const page: PageRow = {
  id: "pub-1",
  site_id: "s1",
  live_url: SAAS.page,
  destination: "hosted",
  // The reading the weekly pass wrote before this shape: kept engines and crawl.
  search_reading: { at: "2026-10-19T06:00:00.000Z", crawled: true, seen: true, cited: null, google: null, bing: null },
  acceptance: { form: "top20", query: SAAS.search },
  target_query: SAAS.search,
  crawled: false,
  ai_reads: 4,
  ai_visits: 0,
};

describe("the backfill folds a page's stored weeks into its reading", () => {
  it("first, best, prev and the place come from the stored weeks, as of the run", () => {
    const [change] = backfill({ pages: [page], scans: [week(9, "2026-10-12T06:00:00.000Z"), week(7, "2026-10-19T06:00:00.000Z")], now: NOW });

    expect(change?.reading).toMatchObject({
      at: NOW.toISOString(),
      crawled: true,
      place: { value: 7, source: "serp", query: SAAS.search },
      first: { at: "2026-10-12T06:00:00.000Z", place: 9 },
      best: { place: 7, at: "2026-10-19T06:00:00.000Z" },
      prev: 9,
      aiReads: 4,
      reached: { showing: "2026-10-12T06:00:00.000Z", firstPage: "2026-10-12T06:00:00.000Z", found: NOW.toISOString(), readByAi: NOW.toISOString() },
    });
  });

  it("a page off ReachKit's host reads no AI reads, never 0; a site with no scan reads no place", () => {
    const [change] = backfill({ pages: [{ ...page, destination: "wordpress", site_id: "s2" }], scans: [week(7, "2026-10-19T06:00:00.000Z")], now: NOW });
    expect(change?.reading).toMatchObject({ place: null, first: null, aiReads: null, linkedBy: null });
  });

  it("each update is guarded: a live page, still holding the reading that was read", () => {
    const [change] = backfill({ pages: [page], scans: [week(7, "2026-10-19T06:00:00.000Z")], now: NOW });
    const sql = updateSql(change!);
    expect(sql).toContain("where id = 'pub-1' and published_at is not null and unpublished_at is null");
    expect(sql).toContain("coalesce(search_reading->>'at', '') = '2026-10-19T06:00:00.000Z'");
    expect(sql.startsWith("update publications set search_reading = ")).toBe(true);
    expect(sql).not.toMatch(/delete/i);
  });
});
