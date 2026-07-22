import { serverDb } from "@/lib/db/client";
import type { Json } from "@/lib/db/types";
import { GROUNDING_POLICY_VERSION } from "@/lib/scan/adapters/web-reviews";
import type { FactSheetKind } from "@/lib/scan/fact-sheet-kind";
import { RELEVANCE_JUDGE_VERSION } from "@/lib/scan/fact-sheet-kind";

export type { FactSheetKind };

// Task 2b (the cache-poisoning class fix): a sheet kind whose CACHE VALIDITY is
// gated by a policy version carries that version as a suffix on `model_version`,
// so a bump treats every pre-bump row as a MISS on read-back even inside its TTL
// (the rules that decided what the row means changed underneath it). Only kinds
// DERIVED from a versioned policy appear here:
//   - `review_themes`     — built from Tavily web-review snippets filtered by
//                           web-reviews.ts's subject/domain-conflict rule
//                           (`GROUNDING_POLICY_VERSION`).
//   - `relevance_verdicts` — the LLM relevance judge's category/niche/irrelevant
//                           calls (`RELEVANCE_JUDGE_VERSION`, Phase B): a prompt
//                           or verdict-semantics change must invalidate old
//                           verdicts, not re-serve them.
// `positioning`/`competitor_gap`/`keyword_data` aren't built from a versioned
// policy, so they're intentionally absent — add a kind here only when its
// meaning is gated by a version constant.
const POLICY_SUFFIX_BY_KIND: Partial<Record<FactSheetKind, string>> = {
  review_themes: `+g${GROUNDING_POLICY_VERSION}`,
  relevance_verdicts: `+rjv${RELEVANCE_JUDGE_VERSION}`,
};

/** Appends the current policy-version suffix for kinds that need it; a no-op
 *  (unchanged behavior) for every other kind. */
function stampModelVersion(kind: FactSheetKind, modelVersion: string): string {
  const suffix = POLICY_SUFFIX_BY_KIND[kind];
  return suffix ? `${modelVersion}${suffix}` : modelVersion;
}

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
        model_version: stampModelVersion(input.kind, input.modelVersion),
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
    .select("body, expires_at, model_version")
    .eq("subject_type", subjectType)
    .eq("subject_key", subjectKey)
    .eq("kind", kind)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null; // expired → treat as absent
  // The cache-poisoning class fix (Task 2b): a sheet cached under an older
  // policy version is stale evidence even inside its TTL window — the rules
  // that decided what the row means changed underneath it. Treat a
  // missing/mismatched policy suffix as a miss so it re-derives instead of
  // re-serving pre-fix poison (the reachkit.app/reachkit.ai review-theme leak,
  // 2026-07-19: a sheet cached 2026-07-16, pre-WS-A, was read back post-fix).
  const suffix = POLICY_SUFFIX_BY_KIND[kind];
  if (suffix && !(data.model_version ?? "").endsWith(suffix)) {
    return null;
  }
  return { body: data.body };
}
