import { serverDb } from "@/lib/db/client";
import type { Json } from "@/lib/db/types";

export type FactSheetKind = "review_themes" | "positioning" | "competitor_gap" | "keyword_data";

/** Returns the subject_type string used in fact_sheets for a given scan mode.
 *  Web-mode scans write/read "web"; all app modes use "app".
 *  This ensures extract WRITE and synth/findings READ are always consistent.
 */
export function factSheetSubjectType(mode: "ios" | "android" | "web"): string {
  return mode === "web" ? "web" : "app";
}

const DAY = 24 * 3600 * 1000;

// §5.7 TTLs: keyword data 30d; competitor/positioning/review sheets 14d.
export function factSheetTtlMs(kind: FactSheetKind): number {
  return kind === "keyword_data" ? 30 * DAY : 14 * DAY;
}

export async function upsertFactSheet(input: {
  subjectType: string;
  subjectKey: string;
  kind: FactSheetKind;
  body: unknown;
  evidenceIds?: number[];
  modelVersion: string;
}): Promise<{ id: number }> {
  const db = serverDb();
  const expiresAt = new Date(Date.now() + factSheetTtlMs(input.kind)).toISOString();
  const { data, error } = await db
    .from("fact_sheets")
    .upsert(
      {
        subject_type: input.subjectType,
        subject_key: input.subjectKey,
        kind: input.kind,
        body: input.body as Json,
        evidence_ids: input.evidenceIds ?? [],
        model_version: input.modelVersion,
        expires_at: expiresAt,
        shared: true,
      },
      { onConflict: "subject_type,subject_key,kind" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

export async function getFreshFactSheet(
  subjectType: string,
  subjectKey: string,
  kind: FactSheetKind,
): Promise<{ body: unknown } | null> {
  const db = serverDb();
  const { data, error } = await db
    .from("fact_sheets")
    .select("body, expires_at")
    .eq("subject_type", subjectType)
    .eq("subject_key", subjectKey)
    .eq("kind", kind)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null; // expired → treat as absent
  return { body: data.body };
}
