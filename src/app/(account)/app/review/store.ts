// What `/app/review` reads: each site with active access, its stored week
// and its live pages. Reads only.
import { hasActiveAccess } from "@/lib/account/billing";
import { readingOf } from "@/lib/measure/page-reading";
import { pageLabel, reviewWeek, storedChoice, type ReviewWeek } from "@/lib/opportunities/review/week";
import { COLUMNS, untyped, type OpportunityRow } from "@/lib/opportunities/store";
import type { Label } from "@/lib/opportunities/verdicts/types";

export interface LivePage {
  id: string;
  url: string;
  /** `null` where the page has no stored reading. */
  label: Label | null;
}

export interface ReviewSite {
  id: string;
  domain: string;
  week: ReviewWeek;
  pages: LivePage[];
}

function rowsOrThrow<T>(what: string, result: { data: T[] | null; error: { message: string } | null }): T[] {
  if (result.error) throw new Error(`review.${what}: ${result.error.message}`);
  return result.data ?? [];
}

async function readSite(site: { id: string; domain: string }, now: Date): Promise<ReviewSite> {
  const [planned, held, live] = await Promise.all([
    untyped().from<OpportunityRow>("opportunities").select(COLUMNS).eq("site_id", site.id).not("plan_place", "is", null),
    untyped()
      .from<OpportunityRow>("opportunities")
      .select(COLUMNS)
      .eq("site_id", site.id)
      .eq("status", "open")
      .eq("ready", false)
      .is("plan_place", null)
      .order("created_at", { ascending: true }),
    untyped()
      .from<{ id: string; live_url: string; search_reading: unknown }>("publications")
      .select("id, live_url, search_reading")
      .eq("site_id", site.id)
      .not("published_at", "is", null)
      .not("live_url", "is", null)
      .is("unpublished_at", null)
      .order("published_at", { ascending: false }),
  ]);
  const rows = [...rowsOrThrow("planned", planned), ...rowsOrThrow("held", held)];
  return {
    ...site,
    week: reviewWeek(rows, storedChoice(rows)),
    pages: rowsOrThrow("pages", live).map((page) => ({ id: page.id, url: page.live_url, label: pageLabel(readingOf(page.search_reading), now) })),
  };
}

export async function readReview(now: Date): Promise<ReviewSite[]> {
  const sites = rowsOrThrow(
    "sites",
    await untyped().from<{ id: string; domain: string }>("sites").select("id, domain").order("domain", { ascending: true })
  );
  const paying = (await Promise.all(sites.map(async (site) => ((await hasActiveAccess(site.id)) ? site : null)))).filter(
    (site): site is { id: string; domain: string } => site !== null
  );
  return Promise.all(paying.map((site) => readSite(site, now)));
}
