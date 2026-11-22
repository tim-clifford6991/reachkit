// The tracked prompts' rolling window, read from stored passes; it measures and buys nothing. One read for the window, never one per week.
// A week whose pass stored no prompts section is absent, not empty: an empty week would lower the rate as though every answer ignored the site.
import { ANSWER_RATE_WEEKS } from "@/lib/config/constants";
import { newestSet, type PromptSample, type PromptWeek, type PromptWindow } from "@/lib/market/prompts/rate";
import type { PromptsSection } from "../report";
import { previousWeekStart } from "./movement";
import { dbAdmin } from "@/lib/db";
import { unhealthyScans } from "../health-record";
import { readSiteZone, readWeekScans } from "./store";
import { weekStartFor } from "./week";

/** One stored section as samples: each answer beside its prompt's kind. An
 *  answer whose prompt has since left the stored set is left out. */
export function samplesOf(section: PromptsSection): PromptSample[] {
  const kinds = new Map(section.asked.map((prompt) => [prompt.id, prompt.kind]));
  const samples: PromptSample[] = [];
  for (const answer of section.answers) {
    const kind = kinds.get(answer.promptId);
    if (kind === undefined) continue;
    samples.push({
      promptId: answer.promptId,
      kind,
      named: answer.named,
      linked: answer.linked,
      ownUrls: answer.ownUrls,
      rivals: answer.rivals,
    });
  }
  return samples;
}

/** The window's Mondays ending at `weekStart`, oldest first. */
export function promptWindowWeeks(weekStart: string): string[] {
  const weeks = [weekStart];
  for (let back = 1; back < ANSWER_RATE_WEEKS; back += 1) weeks.unshift(previousWeekStart(weeks[0] as string));
  return weeks;
}

interface DeepRow {
  id?: string;
  created_at: string;
  prompts: unknown;
}

interface DeepQuery extends PromiseLike<{ data: DeepRow[] | null; error: { message: string } | null }> {
  select(columns: string): DeepQuery;
  eq(column: string, value: string): DeepQuery;
  gte(column: string, value: string): DeepQuery;
}

function isSection(value: unknown): value is PromptsSection {
  if (typeof value !== "object" || value === null) return false;
  const section = value as Record<string, unknown>;
  return Array.isArray(section.asked) && Array.isArray(section.answers);
}

/** The re-measures inside the window that asked the prompts, each under its site-local week; only the prompts member is read. Degrades to none. */
async function readRemeasures(a: {
  siteId: string;
  zone: string;
  weekStarts: readonly string[];
}): Promise<{ scanId: string | null; weekStart: string; at: number; section: PromptsSection }[]> {
  const since = new Date(Date.parse(`${a.weekStarts[0]}T00:00:00.000Z`) - 86_400_000).toISOString();
  const client = dbAdmin() as unknown as { from(table: string): DeepQuery };
  const { data, error } = await client
    .from("scans")
    .select("id, created_at, prompts:report->prompts")
    .eq("site_id", a.siteId)
    .eq("tier", "deep")
    .gte("created_at", since);
  if (error !== null || data === null) return [];
  const out: { scanId: string | null; weekStart: string; at: number; section: PromptsSection }[] = [];
  for (const row of data) {
    if (!isSection(row.prompts)) continue;
    const at = new Date(row.created_at);
    const weekStart = weekStartFor({ at, zone: a.zone });
    if (a.weekStarts.includes(weekStart)) out.push({ scanId: row.id ?? null, weekStart, at: at.getTime(), section: row.prompts });
  }
  return out;
}

/** The rolling window ending at `weekStart`. One pass a week: the newest that asked the prompts, since counting two doubles answers, not learning.
 *  One set: a week that asked the set before a rebuild is left out, so the rate never mixes two sets.
 *  Healthy passes only: a pass that failed its own health check is nobody's sample; its data stays stored and a healthy pass of that week stands in. */
export async function readPromptWindow(a: { siteId: string; weekStart: string; zone?: string }): Promise<PromptWindow> {
  const weekStarts = promptWindowWeeks(a.weekStart);
  const zone = a.zone ?? (await readSiteZone(a.siteId));
  const since = new Date(Date.parse(`${weekStarts[0]}T00:00:00.000Z`) - 86_400_000).toISOString();
  const [scans, remeasures, unhealthy] = await Promise.all([
    readWeekScans({ siteId: a.siteId, weekStarts }),
    zone === null ? [] : readRemeasures({ siteId: a.siteId, zone, weekStarts }).catch(() => []),
    unhealthyScans({ siteId: a.siteId, since }),
  ]);
  const weeksOf = (leftOut: ReadonlySet<string>): { week: PromptWeek; section: PromptsSection }[] => {
    const read: { week: PromptWeek; section: PromptsSection }[] = [];
    for (const weekStart of weekStarts) {
      const weekly = scans.get(weekStart);
      const report = weekly === undefined || leftOut.has(weekly.scanId) ? undefined : weekly.report;
      let section = report?.prompts;
      let at = section === undefined || report == null ? -1 : report.verdict.measuredAt.getTime();
      for (const remeasure of remeasures) {
        if (remeasure.weekStart !== weekStart || remeasure.at <= at) continue;
        if (remeasure.scanId !== null && leftOut.has(remeasure.scanId)) continue;
        section = remeasure.section;
        at = remeasure.at;
      }
      if (section === undefined) continue;
      read.push({ week: { weekStart, asks: section.asks, samples: samplesOf(section) }, section });
    }
    return read;
  };
  const read = weeksOf(unhealthy);
  // Where no pass in the window is healthy, the newest pass that asked the prompts is shown as a first measurement: its own week, never a rate.
  if (read.length === 0 && unhealthy.size > 0) {
    const first = weeksOf(new Set()).at(-1);
    if (first !== undefined) return { weeks: [first.week], prompts: first.section.asked, firstMeasurement: true };
  }
  return { weeks: newestSet(read, (entry) => entry.section).map((entry) => entry.week), prompts: read.at(-1)?.section.asked ?? [] };
}
