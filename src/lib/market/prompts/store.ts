// src/lib/market/prompts/store.ts — `sites.tracked_prompts`, read and
// written (#1162). The weekly pass is the one writer.
//
// Issue 1539: and what the newest pass's answers misstated of the business,
// read for Overview from the stored report and the knowledge base.
import { dbAdmin } from "@/lib/db";
import { misstatedFacts, siteFactsOf, type MisstatedFact } from "./misstated";
import { parsePromptSet, type PromptSet } from "./set";

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQuery<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQuery<T>;
  update(values: Record<string, unknown>): MinimalQuery<T>;
  eq(column: string, value: string): MinimalQuery<T>;
  not(column: string, operator: string, value: null): MinimalQuery<T>;
  order(column: string, options: { ascending: boolean }): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

interface Row {
  tracked_prompts: unknown;
}

export async function readPromptSet(siteId: string): Promise<PromptSet> {
  const { data, error } = await untyped().from<Row>("sites").select("tracked_prompts").eq("id", siteId).limit(1);
  if (error !== null) throw new Error(`readPromptSet: ${error.message}`);
  return parsePromptSet(data?.[0]?.tracked_prompts ?? null);
}

export async function writePromptSet(siteId: string, set: PromptSet): Promise<void> {
  const { error } = await untyped().from<Row>("sites").update({ tracked_prompts: set }).eq("id", siteId);
  if (error !== null) throw new Error(`writePromptSet: ${error.message}`);
}

/**
 * What the newest pass's tracked-prompt answers state of the business that
 * its own site contradicts (issue 1539), against the knowledge base as it
 * stands. Empty where no pass asked the prompts or nothing is misstated.
 */
export async function readMisstatedFacts(a: { siteId: string; domain: string }): Promise<MisstatedFact[]> {
  const { data, error } = await untyped()
    .from<{ report: unknown }>("scans")
    .select("report")
    .eq("site_id", a.siteId)
    .not("report->prompts", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error !== null) throw new Error(`readMisstatedFacts: ${error.message}`);
  if (data === null || data[0] === undefined) return [];
  const [{ readStoredReport, localeOfReport }, { readKnowledgeBase }] = await Promise.all([
    import("@/lib/scan/report"),
    import("@/lib/site-profile/knowledge/read"),
  ]);
  const report = readStoredReport(data[0].report);
  const knowledge = await readKnowledgeBase(a);
  if (report.prompts === undefined || knowledge === null) return [];
  return misstatedFacts({ answers: report.prompts.answers, facts: siteFactsOf(knowledge), language: localeOfReport(report).language });
}
