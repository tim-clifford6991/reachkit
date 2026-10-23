// SPEC §4 (2026-10-10, issue 1395) — the rows behind the process under
// Settings › Market.
//
// The other half of `done-provider.ts`: `DoneFacts` for a real signed-in
// account. It measures nothing, buys nothing and writes nothing; every
// field is a projection of rows another block already wrote.
//
//   lastMeasured              `scans.report` — the newest pass of any tier
//   rivals                    `sites.competitors` — `trackedRivals`
//   ready                     `supplyDepth`
//   pagesRead                 `site_profiles.knowledge`
//   publishTime               `sites.publish_time`
//   remeasureOn               `nextDueOn`
//
// **Each read stands alone.** One that fails leaves its field `undefined`
// and its figure is not drawn; the rest of the screen stands.
import { now as clock } from "@/lib/config/now";
import { dbAdmin } from "@/lib/db";
import { HARD_RULES } from "@/lib/generate/rules/types";
import { trackedRivals } from "@/lib/market/rivals/tracked";
import type { AnswerEngine } from "@/lib/opportunities/types";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";
import { nextDueOn } from "@/lib/scan/weekly";
import type { DoneFacts, MeasuredFacts } from "./done";

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
function measuredOf(report: StoredReport): MeasuredFacts {
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

export async function readDoneFacts(site: { siteId: string; domain: string; timeZone: string }): Promise<DoneFacts> {
  const now = clock();
  const { supplyDepth } = await import("@/lib/opportunities");

  const [lastMeasured, rivals, depth, pagesRead, publishTime, remeasureOn] = await Promise.all([
    attempt(() => newestPass(site.siteId)),
    attempt(async () => (await trackedRivals(site.siteId))?.length ?? null),
    attempt(() => supplyDepth(site.siteId)),
    attempt(() => pagesReadOf(site.domain)),
    attempt(() => publishTimeOf(site.siteId)),
    attempt(() => nextDueOn({ siteId: site.siteId, now })),
  ]);

  return {
    checks: HARD_RULES.length,
    ...(lastMeasured === undefined ? {} : { lastMeasured }),
    ...(rivals === undefined ? {} : { rivals }),
    ...(depth === undefined ? {} : { ready: depth.unused }),
    ...(pagesRead === undefined ? {} : { pagesRead }),
    ...(publishTime === undefined ? {} : { publishTime }),
    ...(remeasureOn === undefined ? {} : { remeasureOn }),
  };
}
