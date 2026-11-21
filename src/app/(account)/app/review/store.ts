// What `/app/review` reads: each site with active access, its stored week, its live pages and how they link, the facts
// the week's figures are counted from, and the marks. Reads only; `reviewModel` counts.
import { hasActiveAccess } from "@/lib/account/billing";
import { siteLinkMap } from "@/lib/known-content/link-map";
import { readingOf } from "@/lib/measure/page-reading";
import { pageLabel, reviewWeek, storedChoice } from "@/lib/opportunities/review/week";
import { COLUMNS, opportunityStore, readOpportunity, untyped, type OpportunityRow } from "@/lib/opportunities/store";
import { weekStartFor } from "@/lib/scan/weekly/week";
import type { TargetFacts } from "@/lib/opportunities/types";
import { readMarks, reviewWeekOf } from "./marks";
import { reviewModel, type Review, type SiteRead } from "./model";

const DAY_MS = 86_400_000;
// A page's verdict before this week may be a few weeks old; a draft stopped this week may have been started last week.
const LOOK_BACK_DAYS = 28;

function rowsOrThrow<T>(what: string, result: { data: T[] | null; error: { message: string } | null }): T[] {
  if (result.error) throw new Error(`review.${what}: ${result.error.message}`);
  return result.data ?? [];
}

function difficultyOf(row: OpportunityRow): number | null {
  const read = (readOpportunity(row).evidence as { target?: TargetFacts } | null)?.target?.difficulty;
  return read === undefined || read.kind === "unmeasured" ? null : read.value;
}

/** When each move the hard rules made while the draft was written happened. */
function rulesStops(transitions: unknown): string[] {
  const moves = Array.isArray(transitions) ? (transitions as { from?: string; to?: string; reason?: string; at?: string }[]) : [];
  return moves.flatMap((m) => (m?.from === "generating" && m.to === "needs_attention" && (m.reason ?? "").startsWith("rules:") && typeof m.at === "string" ? [m.at] : []));
}

type Site = { id: string; domain: string; timezone: string | null };

async function readSite({ timezone, ...site }: Site, now: Date, week: string): Promise<SiteRead> {
  const back = new Date(Date.parse(`${week}T00:00:00.000Z`) - LOOK_BACK_DAYS * DAY_MS).toISOString();
  const [planned, held, live, drafts, verdicts, links, weeklyCommit] = await Promise.all([
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
    untyped().from<{ transitions: unknown }>("drafts").select("transitions").eq("site_id", site.id).gte("created_at", back),
    untyped()
      .from<{ publication_id: string; week_start: string; verdict: string }>("page_verdicts")
      .select("publication_id, week_start, verdict")
      .eq("site_id", site.id)
      .gte("week_start", back.slice(0, 10)),
    siteLinkMap(site.id),
    opportunityStore().weeklyCommit(site.id),
  ]);
  const rows = [...rowsOrThrow("planned", planned), ...rowsOrThrow("held", held)];
  return {
    ...site,
    week: reviewWeek(rows, storedChoice(rows)),
    pages: rowsOrThrow("pages", live).map((page) => ({ id: page.id, url: page.live_url, label: pageLabel(readingOf(page.search_reading), now) })),
    links,
    difficulty: new Map(rows.map((row) => [row.id, difficultyOf(row)])),
    stops: rowsOrThrow("drafts", drafts).flatMap((draft) => rulesStops(draft.transitions)),
    verdicts: rowsOrThrow("verdicts", verdicts),
    // A site with no zone has no Monday yet, as the weekly pass reads it.
    siteWeek: timezone === null ? null : weekStartFor({ at: now, zone: timezone }),
    weeklyCommit,
  };
}

export async function readReview(now: Date): Promise<Review> {
  const sites = rowsOrThrow(
    "sites",
    await untyped().from<Site>("sites").select("id, domain, timezone").order("domain", { ascending: true })
  );
  const paying = (await Promise.all(sites.map(async (site) => ((await hasActiveAccess(site.id)) ? site : null)))).filter(
    (site): site is Site => site !== null
  );
  const week = reviewWeekOf(now);
  const [read, marks] = await Promise.all([Promise.all(paying.map((site) => readSite(site, now, week))), readMarks(paying.map((site) => site.id), week)]);
  return reviewModel(week, read, marks);
}
