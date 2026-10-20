// SPEC §4 (2026-10-10, issue 1395) — the rows behind "what ReachKit did".
//
// The other half of `done-provider.ts`: `DoneFacts` for a real signed-in
// account. It measures nothing, buys nothing and writes nothing; every
// field is a projection of rows another block already wrote.
//
//   measured / lastMeasured   `scans.report` — this week's weekly pass, and
//                             the newest pass of any tier
//   rivals                    `sites.competitors` — `trackedRivals`
//   wrote                     `drafts`, by the moment generation handed the
//                             page on (`transitions`), with `rule_failures`
//   published                 `publications.published_at`
//   setAside                  `opportunities.unready_reason`
//   ready                     `supplyDepth`
//   pagesRead                 `site_profiles.knowledge`
//   publishTime               `sites.publish_time`
//   remeasureOn               `nextDueOn`
//
// **Each read stands alone.** One that fails leaves its field `undefined`
// and `done.ts` then draws no line for it; the rest of the screen stands.
import { now as clock } from "@/lib/config/now";
import { dbAdmin } from "@/lib/db";
import { HARD_RULES } from "@/lib/generate/rules/types";
import { readRecordedRules } from "@/lib/generate/record";
import { trackedRivals } from "@/lib/market/rivals/tracked";
import { FAMILY_OF, type AnswerEngine, type OpportunityType } from "@/lib/opportunities/types";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";
import { nextDueOn, readWeekScan, weekStartFor } from "@/lib/scan/weekly";
import { addDays, dayKeyOf } from "../calendar/dates";
import type { DoneFacts, MeasuredFacts, SetAside } from "./done";

interface Result<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface Query<T> extends PromiseLike<Result<T>> {
  select(columns: string): Query<T>;
  eq(column: string, value: unknown): Query<T>;
  in(column: string, values: readonly unknown[]): Query<T>;
  not(column: string, operator: string, value: unknown): Query<T>;
  order(column: string, opts: { ascending: boolean }): Query<T>;
  limit(count: number): Query<T>;
}

function from<T>(table: string): Query<T> {
  return (dbAdmin() as unknown as { from<R>(table: string): Query<R> }).from<T>(table);
}

/** A read that could not answer is no answer: `undefined`, never a zero. */
async function attempt<T>(read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read();
  } catch {
    return undefined;
  }
}

function rowsOf<T>(result: Result<T>): T[] {
  if (result.error !== null || result.data === null) throw new Error(result.error?.message ?? "no rows");
  return result.data;
}

/** One pass as its stored report counts it: the searches it read a result
 *  page for, the prompts it asked, and the engines whose answers it kept. */
export function measuredOf(report: StoredReport): MeasuredFacts {
  const engines: AnswerEngine[] = [];
  for (const answer of report.prompts?.answers ?? []) {
    if (!engines.includes(answer.engine)) engines.push(answer.engine);
  }
  return {
    searches: report.serps.filter((serp) => serp.kind !== "unmeasured").length,
    questions: report.prompts?.asked.length ?? 0,
    engines,
    at: report.verdict.measuredAt,
  };
}

async function newestPass(siteId: string): Promise<MeasuredFacts | null> {
  const rows = rowsOf(
    await from<{ report: unknown }>("scans")
      .select("report")
      .eq("site_id", siteId)
      .in("tier", ["weekly", "deep"])
      .not("report", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
  );
  const report = rows[0]?.report;
  return report == null ? null : measuredOf(readStoredReport(report));
}

interface DraftRow {
  id: string;
  state: string;
  created_at: string;
  opportunity_id: string | null;
  transitions: unknown;
  rule_failures: unknown;
}

/** When generation handed the page on: its first move out of `generating`.
 *  A row with no such move that is past writing was written when it was
 *  created; one still planned or being written has not been. */
function writtenAt(row: DraftRow): Date | null {
  const moves = Array.isArray(row.transitions) ? (row.transitions as { from?: unknown; at?: unknown }[]) : [];
  const first = moves.find((move) => move?.from === "generating" && typeof move.at === "string");
  const at = first === undefined ? (row.state === "planned" || row.state === "generating" ? null : row.created_at) : String(first.at);
  if (at === null) return null;
  const when = new Date(at);
  return Number.isNaN(when.getTime()) ? null : when;
}

async function draftsOf(
  siteId: string,
  inWeek: (at: Date) => boolean
): Promise<Pick<DoneFacts, "wrote">> {
  const rows = rowsOf(
    await from<DraftRow>("drafts")
      .select("id, state, created_at, opportunity_id, transitions, rule_failures")
      .eq("site_id", siteId)
  );
  const written = rows.filter((row) => {
    const at = writtenAt(row);
    return at !== null && inWeek(at);
  });
  const ids = written.map((row) => row.opportunity_id).filter((id): id is string => id !== null);
  const types =
    ids.length === 0
      ? []
      : rowsOf(await from<{ id: string; type: string }>("opportunities").select("id, type").in("id", ids));
  const familyOf = new Map(types.map((row) => [row.id, FAMILY_OF[row.type as OpportunityType]]));
  // An Improve row rewrites a page the site already has; every other page
  // is a new one.
  const updated = written.filter((row) => row.opportunity_id !== null && familyOf.get(row.opportunity_id) === "improve").length;
  const records = written.map((row) => readRecordedRules(row.rule_failures));
  const held = records.some((record) => record === null) ? null : records.filter((record) => (record ?? []).length > 0).length;

  return { wrote: { pages: written.length, fresh: written.length - updated, updated, held } };
}

async function publishedIn(siteId: string, inWeek: (at: Date) => boolean): Promise<number> {
  const rows = rowsOf(
    await from<{ published_at: string | null }>("publications")
      .select("published_at")
      .eq("site_id", siteId)
      .not("published_at", "is", null)
  );
  return rows.filter((row) => row.published_at !== null && inWeek(new Date(row.published_at))).length;
}

async function setAsideOf(siteId: string, now: Date): Promise<SetAside> {
  const rows = rowsOf(
    await from<{ unready_reason: string | null; rest_until: string | null }>("opportunities")
      .select("unready_reason, rest_until")
      .eq("site_id", siteId)
      .eq("status", "open")
      .eq("ready", false)
  );
  const count = (reason: string): number => rows.filter((row) => row.unready_reason === reason).length;
  return {
    covered: count("already_covered"),
    tooHard: count("outsized"),
    lowFit: count("low_fit"),
    // A rest that has run out is no rest (`opportunities.rest_until`).
    resting: rows.filter(
      (row) => row.unready_reason === "resting" && row.rest_until !== null && new Date(row.rest_until) > now
    ).length,
  };
}

async function pagesReadOf(domain: string): Promise<number> {
  const rows = rowsOf(
    await from<{ knowledge: { pages?: unknown } | null }>("site_profiles").select("knowledge").eq("domain", domain).limit(1)
  );
  const pages = rows[0]?.knowledge?.pages;
  return Array.isArray(pages) ? pages.length : 0;
}

async function publishTimeOf(siteId: string): Promise<string | null> {
  const rows = rowsOf(await from<{ publish_time: string | null }>("sites").select("publish_time").eq("id", siteId).limit(1));
  const time = rows[0]?.publish_time;
  return typeof time === "string" && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : null;
}

/** The topics set aside, alone — what the draft screen reads. */
export async function readSetAside(siteId: string): Promise<SetAside | undefined> {
  return attempt(() => setAsideOf(siteId, clock()));
}

export async function readDoneFacts(site: { siteId: string; domain: string; timeZone: string }): Promise<DoneFacts> {
  const now = clock();
  const weekStart = weekStartFor({ at: now, zone: site.timeZone });
  const weekEnd = addDays(weekStart, 6);
  // A site-local day, compared as `drafts.scheduled_for` spells one.
  const inWeek = (at: Date): boolean => {
    const day = dayKeyOf(at, site.timeZone);
    return day >= weekStart && day <= weekEnd;
  };
  const { supplyDepth } = await import("@/lib/opportunities");

  const [measured, lastMeasured, rivals, drafts, published, setAside, depth, pagesRead, publishTime, remeasureOn] =
    await Promise.all([
      attempt(async () => {
        const week = await readWeekScan({ siteId: site.siteId, weekStart });
        return week?.report == null ? null : measuredOf(week.report);
      }),
      attempt(() => newestPass(site.siteId)),
      attempt(async () => (await trackedRivals(site.siteId))?.length ?? null),
      attempt(() => draftsOf(site.siteId, inWeek)),
      attempt(() => publishedIn(site.siteId, inWeek)),
      attempt(() => setAsideOf(site.siteId, now)),
      attempt(() => supplyDepth(site.siteId)),
      attempt(() => pagesReadOf(site.domain)),
      attempt(() => publishTimeOf(site.siteId)),
      attempt(() => nextDueOn({ siteId: site.siteId, now })),
    ]);

  return {
    checks: HARD_RULES.length,
    ...(measured === undefined ? {} : { measured }),
    ...(lastMeasured === undefined ? {} : { lastMeasured }),
    ...(rivals === undefined ? {} : { rivals }),
    ...(drafts ?? {}),
    ...(published === undefined ? {} : { published }),
    ...(setAside === undefined ? {} : { setAside }),
    ...(depth === undefined ? {} : { ready: depth.unused }),
    ...(pagesRead === undefined ? {} : { pagesRead }),
    ...(publishTime === undefined ? {} : { publishTime }),
    ...(remeasureOn === undefined ? {} : { remeasureOn }),
  };
}
