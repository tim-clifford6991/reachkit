// SPEC §4 (D22) · §6 (D19, #1162) — the tracked prompts' rolling window,
// read from stored weekly passes. It measures nothing and buys nothing.
//
// One read for the window, never one per week. A week whose pass stored no
// prompts section is absent, not empty: an empty week would lower the rate
// as though its prompts had been asked and every answer ignored the site.
import { ANSWER_RATE_WEEKS } from "@/lib/config/constants";
import type { PromptSample, PromptWeek, PromptWindow } from "@/lib/market/prompts/rate";
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

/**
 * The re-measures inside the window that asked the prompts (owner,
 * 2026-10-03, #1162), each under the site-local week it ran in. Only the
 * prompts member is read, never the whole report. Degrades to none: the
 * weekly passes are still the window.
 */
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

/**
 * The rolling window ending at `weekStart`. **One pass a week**: where a
 * week holds a weekly pass and a re-measure, or two re-measures, the newest
 * that asked the prompts is that week's sample. Counting both would double
 * the answers read without doubling what was learned. **One set**: a week
 * that asked the set as it was before a rebuild (D54) is left out, so the
 * rate starts again with the rebuilt set and never mixes the two.
 * **Healthy passes only** (D58, issue 1287): a pass one of its own health
 * checks failed on is nobody's sample, so the headline numbers stay on the
 * last healthy pass. Its data stays stored, and a healthy pass of the same
 * week stands in for it.
 */
export async function readPromptWindow(a: { siteId: string; weekStart: string; zone?: string }): Promise<PromptWindow> {
  const weekStarts = promptWindowWeeks(a.weekStart);
  const zone = a.zone ?? (await readSiteZone(a.siteId));
  const since = new Date(Date.parse(`${weekStarts[0]}T00:00:00.000Z`) - 86_400_000).toISOString();
  const [scans, remeasures, unhealthy] = await Promise.all([
    readWeekScans({ siteId: a.siteId, weekStarts }),
    zone === null ? [] : readRemeasures({ siteId: a.siteId, zone, weekStarts }).catch(() => []),
    unhealthyScans({ siteId: a.siteId, since }),
  ]);
  const read: { week: PromptWeek; section: PromptsSection }[] = [];
  for (const weekStart of weekStarts) {
    const weekly = scans.get(weekStart);
    const report = weekly === undefined || unhealthy.has(weekly.scanId) ? undefined : weekly.report;
    let section = report?.prompts;
    let at = section === undefined || report == null ? -1 : report.verdict.measuredAt.getTime();
    for (const remeasure of remeasures) {
      if (remeasure.weekStart !== weekStart || remeasure.at <= at) continue;
      if (remeasure.scanId !== null && unhealthy.has(remeasure.scanId)) continue;
      section = remeasure.section;
      at = remeasure.at;
    }
    if (section === undefined) continue;
    read.push({ week: { weekStart, asks: section.asks, samples: samplesOf(section) }, section });
  }
  const newest = read.at(-1)?.section;
  return {
    weeks: read.filter((entry) => entry.section.restartedAt === newest?.restartedAt).map((entry) => entry.week),
    prompts: newest?.asked ?? [],
  };
}
