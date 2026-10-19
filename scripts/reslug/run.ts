// scripts/reslug/run.ts — `npm run reslug` (SPEC §6, 2026-10-18; issue 1545):
// the open and queued Write and Earn topics of a site in another language
// than English, given a slug before that language's letters were known
// (issue 1514), get the slug a new topic gets today. 0¢: no vendor, no model.
//
// This box's database key is a placeholder, so the script reads and writes
// nothing itself. With no rows it prints the statement that selects them;
// run that through the Supabase connector, save the answer as JSON, and
// hand it back with `--rows`. It then prints the dry report and the
// statements that apply it.
//
// **No live address ever changes.** A topic with a page published from it is
// never selected, and each update says the row's whole state again, so a row
// that was published, moved on or re-slugged since the read is left alone.
// A topic whose new slug an open sibling already holds is left alone too:
// the partial unique index (`derive/persist.ts`) would refuse it, and the
// sibling is the same page.
import { reslugged } from "@/lib/opportunities/derive/candidate";
import { isLanguage } from "@/lib/locale/locales";

/** One row as the select returns it. */
export interface StoredTopic {
  id: string;
  site_id: string;
  domain: string;
  language: string;
  type: string;
  target_query: string;
  target_ref: string;
  proposed_slug: string | null;
}

export interface Reslug {
  id: string;
  domain: string;
  targetQuery: string;
  from: string;
  to: string;
}

/** The topics the retrofit reads: open or queued, Write or Earn, on a site
 *  not in English, with no page published from them. */
export const SELECT_SQL = [
  "select o.id, o.site_id, s.domain, s.language, o.type, o.target_query, o.target_ref, o.proposed_slug",
  "from opportunities o",
  "join sites s on s.id = o.site_id",
  "where o.family in ('write', 'earn')",
  "  and o.status in ('open', 'queued')",
  "  and s.language is not null and s.language <> 'en'",
  "  and not exists (",
  "    select 1 from drafts d join publications p on p.draft_id = d.id",
  "    where d.opportunity_id = o.id and p.published_at is not null",
  "  )",
  "order by s.domain, o.target_query;",
].join("\n");

/** Each topic whose slug changes, and to what. */
export function reslugs(rows: readonly StoredTopic[]): Reslug[] {
  return rows.flatMap((row) => {
    if (!isLanguage(row.language) || row.proposed_slug !== row.target_ref) return [];
    const to = reslugged({ targetQuery: row.target_query, slug: row.target_ref, language: row.language });
    return to === row.target_ref ? [] : [{ id: row.id, domain: row.domain, targetQuery: row.target_query, from: row.target_ref, to }];
  });
}

function text(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** One guarded update: it changes the row only while it is still the row
 *  the report read, unpublished, and its new slug is free. */
export function updateSql(change: Reslug): string {
  return [
    `update opportunities o set target_ref = ${text(change.to)}, proposed_slug = ${text(change.to)}`,
    `where o.id = ${text(change.id)}`,
    `  and o.target_ref = ${text(change.from)} and o.proposed_slug = ${text(change.from)}`,
    "  and o.family in ('write', 'earn') and o.status in ('open', 'queued')",
    "  and not exists (select 1 from drafts d join publications p on p.draft_id = d.id",
    "    where d.opportunity_id = o.id and p.published_at is not null)",
    "  and not exists (select 1 from opportunities x where x.site_id = o.site_id and x.type = o.type",
    `    and x.target_query = o.target_query and x.target_ref = ${text(change.to)} and x.status in ('open', 'queued'))`,
    "returning id, target_ref;",
  ].join("\n");
}

export function main(a: { rows: readonly StoredTopic[] | null }): number {
  if (a.rows === null) {
    console.log(SELECT_SQL);
    console.error("\n-- Run it through the Supabase connector, save the rows as JSON, then: npm run reslug -- --rows <file>");
    return 0;
  }
  const changes = reslugs(a.rows);
  console.error(`-- Dry report: ${a.rows.length} unpublished topic(s) read, ${changes.length} re-slugged.`);
  for (const change of changes) console.error(`--   ${change.domain}  "${change.targetQuery}"  ${change.from} -> ${change.to}`);
  for (const change of changes) console.log(updateSql(change));
  return 0;
}
