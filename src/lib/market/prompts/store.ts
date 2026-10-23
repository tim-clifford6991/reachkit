// src/lib/market/prompts/store.ts — `sites.tracked_prompts`, read and
// written (#1162). The weekly pass is the one writer.
import { dbAdmin } from "@/lib/db";
import { parsePromptSet, type PromptSet } from "./set";

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQuery<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQuery<T>;
  update(values: Record<string, unknown>): MinimalQuery<T>;
  eq(column: string, value: string): MinimalQuery<T>;
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
