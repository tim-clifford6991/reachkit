// scripts/retarget/run.ts — `npm run retarget` (SPEC §7, D53, issue 1268):
// turn one of ReachKit's own live pages into an update topic with a new
// target.
//
// The row is the product's own (`retargetCandidate`), column for column
// what `insertFor` writes — `tests/opportunities/retarget.test.ts` holds the
// two together. This box's database key is a placeholder, so the script
// writes nothing: it prints one statement to run through the Supabase
// connector. The site, the scan and the band are the page's own row's, read
// in the statement, so the operator names only the address and the search.
//
// The statement adds one open `refresh_page` at the page's address. The
// evening's generation records its readiness and ranks it with the site's
// other topics; the page it writes is the new search's own type, published
// as a new version at the same address.
import { contentTypeOf } from "@/lib/opportunities/content-type";
import { pageTypeOf } from "@/lib/opportunities/page-type";
import { retargetCandidate } from "@/lib/opportunities/retarget";

export interface Options {
  /** The page's live address, as `publications.live_url` stores it. */
  url: string;
  /** The search the page is rewritten for. */
  target: string;
  /** Its monthly searches, where they were measured. */
  volume: number | null;
  at: Date;
}

/** The columns the statement reads off the page's own row. */
const FROM_ROW = { siteId: "o.site_id", scanId: "o.scan_id", fitBand: "o.fit_band" } as const;

function text(value: string | null): string {
  return value === null ? "null" : `'${value.replace(/'/g, "''")}'`;
}

function json(value: unknown): string {
  return `${text(JSON.stringify(value))}::jsonb`;
}

export function retargetSql(a: Options): string {
  const row = retargetCandidate({ url: a.url, row: { siteId: "", scanId: "", fitBand: "winnable" } }, a);
  const volume = row.volume === null || row.volume.kind === "unmeasured" ? "null" : String(row.volume.value);
  return [
    "insert into opportunities",
    "  (site_id, scan_id, type, family, target_query, target_ref, proposed_slug, title, volume,",
    "   evidence, acceptance, fit_band, business_fit, source, page_type, effort)",
    "select",
    `  ${FROM_ROW.siteId}, ${FROM_ROW.scanId}, ${text(row.type)}, ${text(row.family)}, ${text(row.targetQuery)}, p.live_url, null, null, ${volume},`,
    `  ${json(row.evidence)},`,
    `  ${json(row.acceptance)},`,
    `  ${FROM_ROW.fitBand}, null, null, ${text(pageTypeOf(row))}, ${row.effort}`,
    "from publications p",
    "join drafts d on d.id = p.draft_id",
    "join opportunities o on o.id = d.opportunity_id",
    `where p.live_url = ${text(a.url)}`,
    "  and p.published_at is not null",
    "  and p.unpublished_at is null",
    "  and o.family <> 'fix'",
    "order by p.published_at desc",
    "limit 1",
    "returning id, site_id, target_query, target_ref, page_type;",
  ].join("\n");
}

export function main(a: Options): number {
  const type = contentTypeOf(retargetCandidate({ url: a.url, row: { siteId: "", scanId: "", fitBand: "winnable" } }, a));
  console.log(retargetSql(a));
  console.error(
    [
      "",
      `-- The page at ${a.url} becomes an update topic for "${a.target.trim()}", written as: ${type}.`,
      "-- Run the statement above through the Supabase connector. It returns one row.",
      "-- No row: the address is not a live page ReachKit published (check publications.live_url).",
      "-- A unique violation: that page already has this update open or queued.",
    ].join("\n")
  );
  return 0;
}
