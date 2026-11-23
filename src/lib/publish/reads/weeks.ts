// SPEC §7 *Hosted reads are counts* — each hosted page's closed UTC weeks, folded from the daily rows kept, held 13 months.
// A week is written once all seven of its days are past and still kept, and an existing week is never rewritten, so a
// step retry or a catch-up writes what the first pass wrote. A week no pass saw has no row: a gap, never a 0.
import { BLOG_WEEKS_KEPT_W } from "@/lib/config/constants";
import { googleRead, type PageReading } from "@/lib/measure/page-reading";
import { publishDb } from "../db";
import { READS_KEPT_D } from "./model";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/** The week's own Google reading, compact; only the pass in the week after it takes one. */
export interface WeekReading {
  indexed: boolean | null;
  impressions: number | null;
  clicks: number | null;
  place: { value: number; source: string } | null;
  linkedBy: string[] | null;
}

/** `publication_weeks`: `counts` is the week's daily cells summed, keyed `kind:engine`. */
export interface WeekRow {
  publication_id: string;
  site_id: string;
  week_start: string;
  counts: Record<string, number>;
  reading: WeekReading | null;
}

const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const midnightOf = (at: Date): number => Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
const mondayOf = (at: Date): number => midnightOf(at) - ((at.getUTCDay() + 6) % 7) * DAY_MS;

/** The closed weeks whose seven days are all still kept, newest first: four on a Monday, three on any other day. */
export function closedWeeks(now: Date): string[] {
  const weeks: string[] = [];
  for (let start = mondayOf(now) - WEEK_MS; start >= midnightOf(now) - READS_KEPT_D * DAY_MS; start -= WEEK_MS) weeks.push(dayOf(start));
  return weeks;
}

/** The oldest week kept; a row starting before it is trimmed. */
export const weeksKeptFrom = (now: Date): string => dayOf(mondayOf(now) - BLOG_WEEKS_KEPT_W * WEEK_MS);

/** One live hosted page's closed weeks since it went live; the newest carries this pass's reading. */
export function pageWeeks(a: {
  siteId: string;
  page: { id: string; published_at: string | null };
  reads: readonly { publication_id: string; day: string; engine: string; kind: string; hits: number }[];
  reading: PageReading;
  now: Date;
}): WeekRow[] {
  const google = googleRead(a.reading.google);
  const reading: WeekReading = {
    indexed: a.reading.google?.indexed ?? null,
    impressions: google?.impressions ?? null,
    clicks: google?.clicks ?? null,
    place: a.reading.place === null ? null : { value: a.reading.place.value, source: a.reading.place.source },
    linkedBy: a.reading.linkedBy,
  };
  const live = Date.parse(a.page.published_at ?? "");
  const weeks = closedWeeks(a.now);
  return weeks
    .filter((start) => Date.parse(start) + WEEK_MS > live)
    .map((start) => {
      const counts: Record<string, number> = {};
      for (const row of a.reads) {
        if (row.publication_id !== a.page.id || row.day < start || row.day >= dayOf(Date.parse(start) + WEEK_MS)) continue;
        counts[`${row.kind}:${row.engine}`] = (counts[`${row.kind}:${row.engine}`] ?? 0) + row.hits;
      }
      return { publication_id: a.page.id, site_id: a.siteId, week_start: start, counts, reading: start === weeks[0] ? reading : null };
    });
}

/** Writes the weeks not yet on file, then trims the site's weeks past 57; never on a request. `again` writes the newest week over what is
 *  on file too, since only it carries this pass's reading: an older week's reading cannot be measured again. `superseded` names an older
 *  version live at a newer one's address with the newer one's `published_at`: its weeks from then on are the newer one's. */
export async function keepWeeks(a: { siteId: string; rows: readonly WeekRow[]; now: Date; again?: boolean; superseded?: readonly { id: string; until: string }[] }): Promise<void> {
  const db = publishDb(), upsert = (rows: WeekRow[], over: boolean) => db.from("publication_weeks").upsert(rows, { onConflict: "publication_id,week_start", ignoreDuplicates: !over });
  const newest = a.rows.filter((row) => a.again === true && row.reading !== null), rest = a.rows.filter((row) => !newest.includes(row));
  const kept = newest.length > 0 ? await upsert(newest, true) : { error: null };
  const added = rest.length > 0 ? await upsert(rest, false) : { error: null };
  const trimmed = await db.from("publication_weeks").delete().eq("site_id", a.siteId).lt("week_start", weeksKeptFrom(a.now));
  const dropped = await Promise.all((a.superseded ?? []).map((page) => db.from("publication_weeks").delete().eq("publication_id", page.id).gte("week_start", dayOf(Date.parse(page.until) - WEEK_MS + DAY_MS))));
  for (const { error } of [kept, added, trimmed, ...dropped]) if (error !== null) console.log(JSON.stringify({ event: "publication_weeks_unwritten", siteId: a.siteId, message: error.message }));
}
