// scripts/backfill-page-reading/run.ts — fills each live page's
// `publications.search_reading` from the scans already stored, so the tile,
// the ladder and the verdict read one place from the first deploy. 0¢: it
// reads exported rows and prints updates; it holds no database key and
// imports no vendor client.
//
// With no rows it prints the two selects to run through the Supabase
// connector. Saved as JSON and handed back with `--pages` and `--scans`, it
// folds each page's site's weeks oldest first and prints one guarded update
// per page. A page the weekly pass has already read in the new shape is
// left alone.
import { assembleReading, pageSearchOf, readingOf, type PageReading, type PlaceReport } from "@/lib/measure/page-reading";

export interface PageRow {
  id: string;
  site_id: string;
  live_url: string;
  destination: string | null;
  search_reading: unknown;
  acceptance: unknown;
  target_query: string | null;
  crawled: boolean;
  ai_reads: number;
  ai_visits: number;
}

export interface ScanRow {
  site_id: string;
  created_at: string;
  measured_at: string | null;
  /** The twelve's searches in order; `null` where the week measured none. */
  keywords: string[] | null;
  serps: unknown[] | null;
  own_ranked: unknown;
  own_ranked_rows: unknown[] | null;
  page_questions: unknown[] | null;
}

export const PAGES_SQL = [
  "select p.id, p.site_id, p.live_url, p.destination, p.search_reading,",
  "  coalesce(p.acceptance, o.acceptance) as acceptance, o.target_query,",
  "  exists (select 1 from publication_reads r where r.publication_id = p.id and r.kind = 'crawl') as crawled,",
  "  (select coalesce(sum(r.hits), 0) from publication_reads r where r.publication_id = p.id and r.kind in ('answer_fetch', 'index_fetch')) as ai_reads,",
  "  (select coalesce(sum(r.hits), 0) from publication_reads r where r.publication_id = p.id and r.kind = 'referral') as ai_visits",
  "from publications p",
  "left join drafts d on d.id = p.draft_id",
  "left join opportunities o on o.id = d.opportunity_id",
  "where p.published_at is not null and p.unpublished_at is null and p.live_url is not null",
  "  and not coalesce(p.search_reading ? 'reached', false)",
  "order by p.site_id, p.id;",
].join("\n");

/** Only the parts of each report a place is read from, so the export stays small. */
export const SCANS_SQL = [
  "select s.site_id, s.created_at, s.report->'verdict'->>'measuredAt' as measured_at,",
  "  case when s.report->'questions'->>'kind' = 'unmeasured' then null else",
  "    (select jsonb_agg(q->'search'->'keyword' order by i) from jsonb_array_elements(s.report->'questions'->'value') with ordinality x(q, i)) end as keywords,",
  "  (select jsonb_agg(case when e->>'kind' = 'unmeasured' then jsonb_build_object('kind', 'unmeasured', 'reason', e->'reason')",
  "     else jsonb_build_object('kind', e->'kind', 'value', jsonb_build_object('organic',",
  "       (select coalesce(jsonb_agg(jsonb_build_object('url', o->'url', 'position', o->'position')), '[]'::jsonb)",
  "        from jsonb_array_elements(e->'value'->'organic') o))) end order by i)",
  "   from jsonb_array_elements(s.report->'serps') with ordinality y(e, i)) as serps,",
  "  s.report->'ownRanked' as own_ranked,",
  "  (select jsonb_agg(jsonb_build_object('keyword', r->'keyword', 'position', r->'position', 'url', r->'url'))",
  "   from jsonb_array_elements(s.report->'ownRankedRows') r) as own_ranked_rows,",
  "  (select jsonb_agg(jsonb_build_object('publicationId', q->'publicationId', 'liveUrl', q->'liveUrl',",
  "     'question', jsonb_build_object('search', q->'question'->'search'), 'cell', q->'cell', 'engines', q->'engines', 'organic', q->'organic'))",
  "   from jsonb_array_elements(s.report->'pageQuestions'->'rows') q) as page_questions",
  "from scans s",
  "where s.report is not null",
  "  and s.site_id in (select site_id from publications where published_at is not null and unpublished_at is null)",
  "order by s.site_id, s.created_at;",
].join("\n");

/** One exported scan as the parts of a stored report the place reads. */
export function placeReportOf(row: ScanRow): PlaceReport {
  const at = new Date(row.measured_at ?? row.created_at);
  const ownRanked = row.own_ranked as { kind?: unknown } | null;
  return {
    questions:
      row.keywords === null
        ? { kind: "unmeasured", reason: "not_attempted", at }
        : { kind: "measured", value: row.keywords.map((keyword) => ({ search: { keyword } })), at },
    serps: row.serps ?? [],
    ownRanked: ownRanked?.kind === "measured" || ownRanked?.kind === "zero" ? ownRanked : { kind: "unmeasured", reason: "not_attempted", at },
    ownRankedRows: row.own_ranked_rows ?? [],
    pageQuestions: {
      rows: (row.page_questions ?? []).map((q) => {
        const stored = q as Record<string, unknown>;
        return { ...stored, engines: Array.isArray(stored.engines) ? stored.engines : [] };
      }),
    },
    verdict: { measuredAt: at },
  } as unknown as PlaceReport;
}

/** Each page's reading, folded over its site's stored weeks oldest first,
 *  then read once more as of `now` with what is counted on it today. */
export function backfill(a: { pages: readonly PageRow[]; scans: readonly ScanRow[]; now: Date }): { id: string; before: string | null; reading: PageReading }[] {
  const bySite = new Map<string, ScanRow[]>();
  for (const scan of a.scans) bySite.set(scan.site_id, [...(bySite.get(scan.site_id) ?? []), scan]);
  return a.pages.map((page) => {
    const existing = readingOf(page.search_reading);
    const weeks = [...(bySite.get(page.site_id) ?? [])].sort((x, y) => Date.parse(x.created_at) - Date.parse(y.created_at));
    const search = pageSearchOf(page.acceptance, page.target_query);
    const quiet = { id: page.id, liveUrl: page.live_url, search, crawled: false, aiReads: null, aiVisits: null, google: null, bing: null };
    let reading: PageReading | null = null;
    for (const week of weeks) {
      const report = placeReportOf(week);
      reading = assembleReading({ before: reading, report, page: quiet, now: report.verdict.measuredAt });
    }
    const hosted = page.destination === "hosted";
    const newest = weeks.at(-1);
    reading = assembleReading({
      before: reading,
      report: newest === undefined ? null : placeReportOf(newest),
      page: {
        ...quiet,
        crawled: page.crawled || existing?.crawled === true,
        aiReads: hosted ? Number(page.ai_reads) : null,
        aiVisits: hosted ? Number(page.ai_visits) : null,
        google: existing?.google ?? null,
        bing: existing?.bing ?? null,
      },
      now: a.now,
    });
    return { id: page.id, before: existing?.at ?? null, reading };
  });
}

function text(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** One guarded update: only a live page whose reading is still the one read. */
export function updateSql(change: { id: string; before: string | null; reading: PageReading }): string {
  return [
    `update publications set search_reading = ${text(JSON.stringify(change.reading))}::jsonb`,
    `where id = ${text(change.id)} and published_at is not null and unpublished_at is null`,
    `  and coalesce(search_reading->>'at', '') = ${text(change.before ?? "")} and not coalesce(search_reading ? 'reached', false)`,
    "returning id;",
  ].join("\n");
}

export function main(a: { pages: readonly PageRow[] | null; scans: readonly ScanRow[] | null; now?: Date }): number {
  if (a.pages === null || a.scans === null) {
    console.log(PAGES_SQL);
    console.log("");
    console.log(SCANS_SQL);
    console.error("\n-- Run both through the Supabase connector, save each as JSON, then:");
    console.error("-- node scripts/backfill-page-reading.mjs --pages <pages.json> --scans <scans.json>");
    return 0;
  }
  const changes = backfill({ pages: a.pages, scans: a.scans, now: a.now ?? new Date() });
  const placed = changes.filter((change) => change.reading.place !== null).length;
  console.error(`-- Dry report: ${changes.length} live page(s), ${a.scans.length} stored scan(s) read, ${placed} with a place.`);
  for (const change of changes) console.log(updateSql(change));
  return 0;
}
