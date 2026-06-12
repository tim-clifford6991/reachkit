import { createHash } from "node:crypto";
import { serverDb } from "./client";
import type { Json } from "./types";

// Recursively sort object keys so equal content hashes equally regardless of key order at any depth.
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") {
    return Object.keys(v as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((o, k) => {
        o[k] = canonical((v as Record<string, unknown>)[k]);
        return o;
      }, {});
  }
  return v;
}

export function contentHash(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(body))).digest("hex");
}

export type RawDocInput = {
  subjectType: string;
  subjectKey: string;
  sourceType: string;
  url?: string;
  body: unknown;
  mode: "ios" | "android" | "web";
};

// Insert if new; on (subject_type, subject_key, content_hash) conflict, return the existing id (append-only — never mutate).
export async function upsertRawDocument(
  input: RawDocInput,
): Promise<{ id: number; deduped: boolean }> {
  const hash = contentHash(input.body);
  const db = serverDb();
  const inserted = await db
    .from("raw_documents")
    .insert({
      subject_type: input.subjectType,
      subject_key: input.subjectKey,
      source_type: input.sourceType,
      url: input.url,
      content_hash: hash,
      body: input.body as Json,
      mode: input.mode,
    })
    .select("id")
    .maybeSingle();

  if (!inserted.error && inserted.data) return { id: inserted.data.id, deduped: false };

  if (inserted.error && inserted.error.code === "23505") {
    // unique violation → already have it
    const existing = await db
      .from("raw_documents")
      .select("id")
      .eq("subject_type", input.subjectType)
      .eq("subject_key", input.subjectKey)
      .eq("content_hash", hash)
      .single();
    if (existing.error) throw existing.error;
    return { id: existing.data.id, deduped: true };
  }

  throw inserted.error ?? new Error("raw_documents insert returned no row");
}
