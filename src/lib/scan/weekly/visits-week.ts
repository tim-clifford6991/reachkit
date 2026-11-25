// SPEC §6 *The Monday owner digest*: each paying hosted site's visits for the week before, by source, and the Search Console
// clicks on its live pages. Stored rows only, 0¢; counts only, never a visitor or a referrer.
import { AI_BLOG_ENGINES, WEEK_PLAN } from "@/lib/config/constants";
import type { MarketWeek } from "@/lib/mail/templates/ops/incident";
import { googleRead, readingOf } from "@/lib/measure/page-reading";
import { publishDb } from "@/lib/publish/db";

export type VisitsWeek = NonNullable<MarketWeek["visits"]>;

/** A robot reading the page, never a visit; every other kind found is listed, so a new one needs no change here. */
const FETCHES: ReadonlySet<string> = new Set(["answer_fetch", "own_fetch", "index_fetch", "crawl"]);
const AI: ReadonlySet<string> = new Set(AI_BLOG_ENGINES);

/** The source a stored row counts under: Google search, AI apps, or the engine or kind the row names. */
function sourceOf(engine: string, kind: string): string {
  if (kind !== "referral") return `${kind}/${engine}`;
  return engine === "google" ? "google" : AI.has(engine) ? "ai" : engine;
}

/** One site's line from its week of counts and its live hosted pages. */
export function visitsSite(a: { domain: string; reads: readonly { engine: string; kind: string; hits: number }[]; pages: readonly { search_reading: unknown }[] }): VisitsWeek["sites"][number] {
  const counted = new Map<string, number>([["google", 0], ["ai", 0]]);
  for (const row of a.reads) {
    if (FETCHES.has(row.kind)) continue;
    const source = sourceOf(row.engine, row.kind);
    counted.set(source, (counted.get(source) ?? 0) + row.hits);
  }
  const google = a.pages.flatMap((row) => googleRead(readingOf(row.search_reading)?.google) ?? []);
  return {
    domain: a.domain,
    visits: a.pages.length === 0 ? null : [...counted].map(([source, visits]) => ({ source, visits })),
    clicks: google.length === 0 ? null : google.reduce((sum, reading) => sum + reading.clicks, 0),
  };
}

function rowsOf<T>(result: { data: T[] | null; error: { message: string } | null }, what: string): T[] {
  if (result.error !== null) throw new Error(`readVisitsWeek: could not read ${what}: ${result.error.message}`);
  return result.data ?? [];
}

/** The paying hosted sites' lines over the seven dates from `from`; `null` where none is hosted. A site with no live page
 *  is not measured, and a page with no Google figures adds no clicks. Throws where a store could not be read. */
export async function readVisitsWeek(from: string): Promise<VisitsWeek | null> {
  const { sitesForDailyTick } = await import("@/lib/publish/daily/sites");
  const paying = (await sitesForDailyTick()).sites.map((site) => site.siteId);
  if (paying.length === 0) return null;
  const db = publishDb();
  const hosted = rowsOf(await db.from<{ site_id: string }>("destinations").select("site_id").eq("kind", "hosted").is("deleted_at", null).in("site_id", paying), "the hosted sites");
  const ids = [...new Set(hosted.map((row) => row.site_id))];
  if (ids.length === 0) return null;
  const to = new Date(Date.parse(`${from}T00:00:00Z`) + (WEEK_PLAN.days - 1) * 86_400_000).toISOString().slice(0, 10);
  const [sites, reads, pages] = await Promise.all([
    db.from<{ id: string; domain: string }>("sites").select("id, domain").in("id", ids),
    db.from<{ site_id: string; engine: string; kind: string; hits: number }>("publication_reads").select("site_id, engine, kind, hits").in("site_id", ids).gte("day", from).lte("day", to),
    db.from<{ site_id: string; search_reading: unknown }>("publications").select("site_id, search_reading").eq("destination", "hosted").in("site_id", ids).not("published_at", "is", null).is("unpublished_at", null),
  ]);
  const [readRows, pageRows] = [rowsOf(reads, "the week's visits"), rowsOf(pages, "the live pages")];
  const lines = rowsOf(sites, "the sites").map((site) =>
    visitsSite({ domain: site.domain, reads: readRows.filter((row) => row.site_id === site.id), pages: pageRows.filter((row) => row.site_id === site.id) })
  );
  return { weekStart: from, sites: lines.sort((x, y) => x.domain.localeCompare(y.domain)) };
}
