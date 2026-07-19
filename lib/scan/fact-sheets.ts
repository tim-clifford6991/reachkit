import { serverDb } from "@/lib/db/client";
import type { Json } from "@/lib/db/types";
import { GROUNDING_POLICY_VERSION } from "@/lib/scan/adapters/web-reviews";
import type { FactSheetKind } from "@/lib/scan/fact-sheet-kind";

export type { FactSheetKind };

// Task 2b (the cache-poisoning class fix): only sheet kinds actually DERIVED from
// grounding-filtered inputs need the policy check on read-back. Today that's just
// `review_themes` (built from Tavily web-review snippets, filtered by
// web-reviews.ts's subject/domain-conflict rule). `positioning`/`competitor_gap`/
// `keyword_data` aren't built from that filtered input, so they're intentionally
// excluded — revisit this set if a future extract kind starts consuming
// grounding-filtered evidence.
const GROUNDING_POLICY_KINDS: ReadonlySet<FactSheetKind> = new Set(["review_themes"]);

const POLICY_SUFFIX = `+g${GROUNDING_POLICY_VERSION}`;

/** Appends the current grounding-policy suffix for kinds that need it; a no-op
 *  (unchanged behavior) for every other kind. */
function stampModelVersion(kind: FactSheetKind, modelVersion: string): string {
  return GROUNDING_POLICY_KINDS.has(kind) ? `${modelVersion}${POLICY_SUFFIX}` : modelVersion;
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
  // grounding policy is stale evidence even inside its TTL window — the rules
  // that decided what counts as grounded evidence changed underneath it. Treat
  // a missing/mismatched policy suffix as a miss so it re-extracts instead of
  // re-serving pre-fix poison (the reachkit.app/reachkit.ai review-theme leak,
  // 2026-07-19: a sheet cached 2026-07-16, pre-WS-A, was read back post-fix).
  if (GROUNDING_POLICY_KINDS.has(kind) && !(data.model_version ?? "").endsWith(POLICY_SUFFIX)) {
    return null;
  }
  return { body: data.body };
}
