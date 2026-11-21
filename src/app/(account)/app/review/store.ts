// What `/app/review` reads: each site with active access, its stored week, its live pages and how they link, and the
// week's figures and marks. Reads only.
import { hasActiveAccess } from "@/lib/account/billing";
import { siteLinkMap, type LinkMap } from "@/lib/known-content/link-map";
import { readingOf } from "@/lib/measure/page-reading";
import { pageLabel, reviewWeek, storedChoice, type ReviewWeek } from "@/lib/opportunities/review/week";
import { COLUMNS, readOpportunity, untyped, type OpportunityRow } from "@/lib/opportunities/store";
import type { TargetFacts } from "@/lib/opportunities/types";
import type { Label } from "@/lib/opportunities/verdicts/types";
import { readMarks, reviewWeekOf, type Marks } from "./marks";

const DAY_MS = 86_400_000;

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
  links: LinkMap;
  /** Each row's keyword difficulty, 0–100, by opportunity id; `null` where it was never measured. */
  difficulty: ReadonlyMap<string, number | null>;
  /** Drafts this week the hard rules stopped while they were written. */
  stopped: number;
  /** Live pages whose verdict this week differs from the week before. */
  flips: number;
}

export interface Review {
  /** `YYYY-MM-DD`, the Monday the review's week starts. */
  week: string;
  sites: ReviewSite[];
  marks: Marks;
}

function rowsOrThrow<T>(what: string, result: { data: T[] | null; error: { message: string } | null }): T[] {
  if (result.error) throw new Error(`review.${what}: ${result.error.message}`);
  return result.data ?? [];
}

function difficultyOf(row: OpportunityRow): number | null {
  const read = (readOpportunity(row).evidence as { target?: TargetFacts } | null)?.target?.difficulty;
  return read === undefined || read.kind === "unmeasured" ? null : read.value;
}

/** Whether a draft's moves hold one the hard rules made while it was written, on or after `from`. */
function stoppedByRules(transitions: unknown, from: string): boolean {
  const moves = Array.isArray(transitions) ? (transitions as { from?: string; to?: string; reason?: string; at?: string }[]) : [];
  return moves.some((m) => m?.from === "generating" && m.to === "needs_attention" && (m.reason ?? "").startsWith("rules:") && (m.at ?? "") >= from);
}

/** Pages whose verdict in the site's newest week differs from their verdict the week before it. */
function flipsOf(rows: readonly { publication_id: string; week_start: string; verdict: string }[]): number {
  const newest = rows.reduce((top, row) => (row.week_start > top ? row.week_start : top), "");
  const byPage = new Map<string, { now?: string; before?: { week: string; verdict: string } }>();
  for (const row of rows) {
    const page = byPage.get(row.publication_id) ?? {};
    if (row.week_start === newest) page.now = row.verdict;
    else if (page.before === undefined || row.week_start > page.before.week) page.before = { week: row.week_start, verdict: row.verdict };
    byPage.set(row.publication_id, page);
  }
  return [...byPage.values()].filter((page) => page.now !== undefined && page.before !== undefined && page.now !== page.before.verdict).length;
}

async function readSite(site: { id: string; domain: string }, now: Date, week: string): Promise<ReviewSite> {
  // A site's own Monday can fall a day either side of the UTC one.
  const from = new Date(Date.parse(`${week}T00:00:00.000Z`) - DAY_MS).toISOString();
  const lastWeek = new Date(Date.parse(from) - 7 * DAY_MS).toISOString().slice(0, 10);
  const [planned, held, live, drafts, verdicts, links] = await Promise.all([
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
    untyped().from<{ transitions: unknown }>("drafts").select("transitions").eq("site_id", site.id).gte("created_at", from),
    untyped()
      .from<{ publication_id: string; week_start: string; verdict: string }>("page_verdicts")
      .select("publication_id, week_start, verdict")
      .eq("site_id", site.id)
      .gte("week_start", lastWeek),
    siteLinkMap(site.id),
  ]);
  const rows = [...rowsOrThrow("planned", planned), ...rowsOrThrow("held", held)];
  return {
    ...site,
    week: reviewWeek(rows, storedChoice(rows)),
    pages: rowsOrThrow("pages", live).map((page) => ({ id: page.id, url: page.live_url, label: pageLabel(readingOf(page.search_reading), now) })),
    links,
    difficulty: new Map(rows.map((row) => [row.id, difficultyOf(row)])),
    stopped: rowsOrThrow("drafts", drafts).filter((draft) => stoppedByRules(draft.transitions, from)).length,
    flips: flipsOf(rowsOrThrow("verdicts", verdicts)),
  };
}

export async function readReview(now: Date): Promise<Review> {
  const sites = rowsOrThrow(
    "sites",
    await untyped().from<{ id: string; domain: string }>("sites").select("id, domain").order("domain", { ascending: true })
  );
  const paying = (await Promise.all(sites.map(async (site) => ((await hasActiveAccess(site.id)) ? site : null)))).filter(
    (site): site is { id: string; domain: string } => site !== null
  );
  const week = reviewWeekOf(now);
  const [read, marks] = await Promise.all([Promise.all(paying.map((site) => readSite(site, now, week))), readMarks(paying.map((site) => site.id), week)]);
  return { week, sites: read, marks };
}
