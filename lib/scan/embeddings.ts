import { serverDb } from "@/lib/db/client";

export interface EmbeddingRow {
  subjectType: string;
  subjectKey: string;
  appId?: string | null;
  content: string;
  embedding: number[];
  model: string;
  modelVersion: string;
}

/**
 * Insert a batch of embedding rows into the `embeddings` table.
 * The pgvector literal format `[a,b,c,...]` is used for the embedding column.
 * Throws on Supabase error.
 *
 * Note: uses `.insert()` — not an upsert. For idempotent population, call
 * `deleteEmbeddingsForApp` first.
 */
export async function insertEmbeddings(rows: EmbeddingRow[]): Promise<void> {
  if (rows.length === 0) return;

  const db = serverDb();
  const inserts = rows.map((r) => ({
    subject_type: r.subjectType,
    subject_key: r.subjectKey,
    app_id: r.appId ?? null,
    content: r.content,
    embedding: `[${r.embedding.join(",")}]`,
    model: r.model,
    model_version: r.modelVersion,
  }));

  const { error } = await db.from("embeddings").insert(inserts);
  if (error) throw new Error(`insertEmbeddings failed: ${error.message}`);
}

/**
 * Delete all embedding rows for a given app + subjectType.
 * Use before `insertEmbeddings` to make population idempotent (safe to retry).
 */
export async function deleteEmbeddingsForApp(
  appId: string,
  subjectType: string,
): Promise<void> {
  const db = serverDb();
  const { error } = await db
    .from("embeddings")
    .delete()
    .eq("app_id", appId)
    .eq("subject_type", subjectType);
  if (error) throw new Error(`deleteEmbeddingsForApp failed: ${error.message}`);
}

/**
 * Search for semantically similar content via the `match_embeddings` RPC.
 * Returns up to `k` (default 5) results ordered by cosine similarity descending.
 */
export async function searchSimilar(
  queryVec: number[],
  opts: { subjectType?: string; appId?: string; k?: number } = {},
): Promise<Array<{ content: string; similarity: number }>> {
  const db = serverDb();
  const matchCount = opts.k ?? 5;

  const { data, error } = await db.rpc("match_embeddings", {
    query: `[${queryVec.join(",")}]`,
    match_count: matchCount,
    p_subject_type: opts.subjectType,
    p_app_id: opts.appId,
  });

  if (error) throw new Error(`searchSimilar failed: ${error.message}`);

  return (data ?? []) as Array<{ content: string; similarity: number }>;
}
