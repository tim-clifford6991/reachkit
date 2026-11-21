// SPEC §4 *Overview's four tiles* — the two reads the tiles count over: the
// weekly passes of the last nine weeks and every page ever published.
import { dbAdmin } from "@/lib/db";
import { failingChecks, parseHealth } from "@/lib/scan/health";
import { resolvedRows } from "@/lib/market/rivals/domains";
import { pageSearchOf, readingOf, type PlaceReport } from "@/lib/measure/page-reading";
import type { SerpResult } from "@/lib/vendors/dataforseo/types";
import { onFirstPage } from "./rivals-store";
import { AI_WINDOW_WEEKS, TILE_WEEKS, type TilePage, type TilePass } from "./tiles";

interface Query<T> extends PromiseLike<{ data: T[] | null; error: { message: string } | null }> {
  select(columns: string): Query<T>;
  eq(column: string, value: string): Query<T>;
  neq(column: string, value: string): Query<T>;
  gte(column: string, value: string): Query<T>;
  not(column: string, operator: string, value: null): Query<T>;
}

function from<T>(table: string): Query<T> {
  return (dbAdmin() as unknown as { from(table: string): Query<T> }).from(table);
}

interface PassRow {
  week_start: string;
  created_at: string;
  health: unknown;
  questions: PlaceReport["questions"] | null;
  serps: { kind: string; value?: SerpResult }[] | null;
  pageQuestions: PlaceReport["pageQuestions"];
  ownRankedRows: PlaceReport["ownRankedRows"] | null;
  ownRanked: PlaceReport["ownRanked"] | null;
}

interface PageRow {
  id: string;
  live_url: string | null;
  published_at: string;
  unpublished_at: string | null;
  acceptance: unknown;
  search_reading: unknown;
  drafts: { opportunities: { acceptance: unknown; target_query: string | null } | null } | null;
}

const NOT_READ = { kind: "unmeasured", reason: "not_attempted" } as const;

/** The main searches a pass put `domain` on the first page for; `null` where it read none. */
function firstPageOf(serps: PassRow["serps"], domain: string): number | null {
  const read = (serps ?? []).flatMap((serp) => (serp.kind !== "unmeasured" && serp.value !== undefined && resolvedRows(serp.value.organic) !== null ? [serp.value] : []));
  return read.length === 0 ? null : read.filter((serp) => onFirstPage(serp, domain)).length;
}

export async function readTileRows(a: { siteId: string; domain: string; week: string }): Promise<{ passes: TilePass[]; pages: TilePage[] }> {
  const since = new Date(Date.parse(`${a.week}T12:00:00Z`) - (TILE_WEEKS + AI_WINDOW_WEEKS) * 7 * 86_400_000).toISOString().slice(0, 10);
  const [passes, pages] = await Promise.all([
    from<PassRow>("scans")
      .select("week_start, created_at, health, questions:report->questions, serps:report->serps, pageQuestions:report->pageQuestions, ownRankedRows:report->ownRankedRows, ownRanked:report->ownRanked")
      .eq("site_id", a.siteId)
      .eq("tier", "weekly")
      .neq("status", "failed")
      .gte("week_start", since)
      .not("report", "is", null),
    from<PageRow>("publications")
      .select("id, live_url, published_at, unpublished_at, acceptance, search_reading, drafts(opportunities(acceptance, target_query))")
      .eq("site_id", a.siteId)
      .not("published_at", "is", null),
  ]);
  if (passes.error !== null || passes.data === null) throw new Error(`tiles: could not read the passes: ${passes.error?.message}`);
  if (pages.error !== null || pages.data === null) throw new Error(`tiles: could not read the pages: ${pages.error?.message}`);
  return {
    passes: passes.data.map((row) => ({
      weekStart: row.week_start,
      at: row.created_at,
      healthy: failingChecks(parseHealth(row.health)).length === 0,
      firstPage: firstPageOf(row.serps, a.domain),
      report: {
        questions: row.questions ?? NOT_READ,
        serps: (row.serps ?? []) as PlaceReport["serps"],
        ownRanked: row.ownRanked ?? NOT_READ,
        ownRankedRows: row.ownRankedRows ?? [],
        pageQuestions: row.pageQuestions ?? null,
        verdict: { measuredAt: new Date(row.created_at) },
      } as PlaceReport,
    })),
    pages: pages.data.map((row) => ({
      id: row.id,
      liveUrl: row.live_url,
      publishedAt: row.published_at,
      unpublishedAt: row.unpublished_at,
      search: pageSearchOf(row.acceptance ?? row.drafts?.opportunities?.acceptance, row.drafts?.opportunities?.target_query),
      placed: readingOf(row.search_reading)?.place != null,
    })),
  };
}
