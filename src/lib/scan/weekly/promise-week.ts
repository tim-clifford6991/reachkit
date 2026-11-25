// SPEC §6 *The Monday owner digest*: each paying site's line on the daily promise. The week before is read from its
// pages and `draft_days`, the coming week's supply from the Monday commit's `week_research` row. Stored rows only, 0¢.
import { WEEK_PLAN } from "@/lib/config/constants";
import type { MarketWeek } from "@/lib/mail/templates/ops/incident";
import { publishDb } from "@/lib/publish/db";
import { becameUpdate } from "@/lib/publish/record/needs-you";

export type PromiseWeek = NonNullable<MarketWeek["promise"]>;
type PromiseSite = PromiseWeek["sites"][number];

/** A page of the week, with only the `meta` paths the line reads. */
export interface PromiseDraft {
  site_id: string;
  scheduled_for: string;
  state: string;
  transitions: unknown;
  mendOf: unknown;
  fallbackFor: unknown;
  research: unknown;
  met: unknown;
  cause: unknown;
}
const DRAFT_COLUMNS = "site_id, scheduled_for, state, transitions, mendOf:meta->mendOf, fallbackFor:meta->fallbackFor, research:meta->research, met:meta->standard->met, cause:meta->pack->live->cause";

export interface PromiseDay {
  site_id: string;
  publish_date: string;
  outcome: string;
  reason: string | null;
}

/** Live, in review, or delivered and since taken down: the page was out or going out on its date. */
const KEEPING: ReadonlySet<string> = new Set(["in_review", "approved", "publishing", "published", "unpublished"]);
/** Refreshes that change no substance; they may publish but never keep a day. */
const COSMETIC: ReadonlySet<unknown> = new Set(["link", "unseen", "structure"]);

const cosmetic = (page: PromiseDraft) => typeof page.mendOf === "string" || (typeof page.fallbackFor !== "string" && COSMETIC.has(page.cause));
/** The day's last step wrote it anyway: it keeps the day and never meets the standard. */
const anyway = (page: PromiseDraft) => typeof page.fallbackFor === "string" && !becameUpdate(page);

function stoppedByCustomer(draft: PromiseDraft): boolean {
  const last = Array.isArray(draft.transitions) ? (draft.transitions.at(-1) as { actor?: { kind?: unknown } } | undefined) : undefined;
  return draft.state === "skipped" && last?.actor?.kind === "customer";
}

function supplyOf(read: string | undefined): PromiseSite["supply"] {
  if (read === undefined) return null;
  try {
    const r = JSON.parse(read) as { met?: number; at_margin?: number; queued?: number; short?: { rows?: number }; rested?: unknown[]; spares_met?: number; uncovered?: number };
    const n = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0);
    return { researched: n(r.met) + n(r.at_margin), spares: n(r.spares_met), uncovered: n(r.uncovered), queued: n(r.queued), short: Math.max(0, n(r.short?.rows) - (r.rested?.length ?? 0)) };
  } catch {
    return null;
  }
}

/** One site's line over `dates`. A date with no keeping page, no stop and no record is not recorded, never a miss. */
export function promiseSite(a: { domain: string; dates: readonly string[]; drafts: readonly PromiseDraft[]; days: readonly PromiseDay[]; research?: string }): PromiseSite {
  let kept = 0;
  let stopped = 0;
  let unrecorded = 0;
  const missed: { date: string; reason: string }[] = [];
  for (const date of a.dates) {
    const pages = a.drafts.filter((draft) => draft.scheduled_for === date);
    const day = a.days.find((row) => row.publish_date === date);
    if (pages.some(stoppedByCustomer)) stopped++;
    else if (pages.some((page) => KEEPING.has(page.state) && !cosmetic(page))) kept++;
    else if (day !== undefined) missed.push({ date, reason: day.reason === null ? day.outcome : `${day.outcome}:${day.reason}` });
    else unrecorded++;
  }
  let met = 0;
  let measured = 0;
  for (const page of a.drafts.filter((draft) => !cosmetic(draft))) {
    if (anyway(page) || typeof page.met === "boolean") measured++;
    if (!anyway(page) && page.met === true) met++;
  }
  const supply = supplyOf(a.research);
  // A site short of researched spares or with a day uncovered: its buffer is below the margin.
  const low = supply !== null && (supply.spares < WEEK_PLAN.spares || supply.uncovered > 0);
  return { domain: a.domain, kept, days: a.dates.length, stopped, unrecorded, missed, standard: measured === 0 ? null : { met, of: measured }, supply, low };
}

function rowsOf<T>(result: { data: T[] | null; error: { message: string } | null }, what: string): T[] {
  if (result.error !== null) throw new Error(`readPromiseWeek: could not read ${what}: ${result.error.message}`);
  return result.data ?? [];
}

/** The paying sites' lines: the seven dates from `from`, and the supply committed on `weekStart`. `null` where no site
 *  pays or who pays could not be read. Throws where a store could not be read. */
export async function readPromiseWeek(from: string, weekStart: string): Promise<PromiseWeek | null> {
  const { sitesForDailyTick } = await import("@/lib/publish/daily/sites");
  const selection = await sitesForDailyTick();
  const ids = selection.sites.map((site) => site.siteId);
  if (ids.length === 0) return null;
  const dates = Array.from({ length: WEEK_PLAN.days }, (_, i) => new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));
  const db = publishDb();
  const [sites, drafts, days, research] = await Promise.all([
    db.from<{ id: string; domain: string }>("sites").select("id, domain").in("id", ids),
    db.from<PromiseDraft>("drafts").select(DRAFT_COLUMNS).in("site_id", ids).gte("scheduled_for", dates[0]!).lte("scheduled_for", dates.at(-1)!),
    db.from<PromiseDay>("draft_days").select("site_id, publish_date, outcome, reason").in("site_id", ids).gte("publish_date", dates[0]!).lte("publish_date", dates.at(-1)!).not("outcome", "is", null),
    db.from<{ site_id: string; read: string }>("ops_events").select("site_id, read").eq("kind", "week_research").eq("code", weekStart).in("site_id", ids),
  ]);
  const [draftRows, dayRows, researchRows] = [rowsOf(drafts, "the week's pages"), rowsOf(days, "the week's days"), rowsOf(research, "the week's research")];
  const lines = rowsOf(sites, "the sites").map((site) =>
    promiseSite({
      domain: site.domain,
      dates,
      drafts: draftRows.filter((row) => row.site_id === site.id),
      days: dayRows.filter((row) => row.site_id === site.id),
      research: researchRows.find((row) => row.site_id === site.id)?.read,
    })
  );
  return { weekStart: from, sites: lines.sort((x, y) => Number(y.low) - Number(x.low) || x.domain.localeCompare(y.domain)) };
}
