/**
 * upsertDraftAction — the ONE path that turns a generated draft into a persisted,
 * reusable `actions` row (R-11.7, capability "draft-action-persist").
 *
 * WHY this exists: a generated draft must ALWAYS be retained so the founder can
 * come back to it — a refresh, a closed tab, or a dropped mobile connection
 * mid-generation must never lose the work (owner, 2026-07-27). Content drafts
 * already persisted server-side; distribution drafts did not (they lived in React
 * state until the user opened a composer), so a refresh dropped them. Rather than
 * fork the persist logic a third time (it already lived in /api/content-draft AND
 * /api/action), both draft routes now share THIS helper.
 *
 * Shape mirrors /api/content-draft's original inline logic exactly:
 *   - Reuse an OPEN (status !== "done") action with the same (app_id, title):
 *     return its stored draft for free unless `regenerate` is set (repeat clicks
 *     don't re-spend the LLM budget).
 *   - Otherwise run `generate()` (the caller's costed LLM call) and store the
 *     result: UPDATE the open action if one exists (regenerate overwrites — a
 *     redraft must persist), else INSERT a new `pending` row.
 *   - Everything stored is review-required (§11 No-auto → draft_requires_edit).
 *
 * The LLM call is the caller's `generate` thunk so cost attribution stays at the
 * call site (costedIntelStep); this helper only reads/writes the action row.
 */

import type { Json } from "@/lib/db/types";
import type { ServerDb } from "@/lib/db/client";
import type { ActionTarget } from "@/lib/llm/types";

export interface DraftActionInput {
  /** The action title — the dedupe key against existing open actions. */
  title: string;
  category: "content" | "outreach";
  why?: string | null;
  /** Outreach routing (channel/venue), carried so the rehydrated plan entry
   *  still routes to the right composer after a refresh. */
  target?: ActionTarget | null;
  /** Verification/venue URL for the action row. Must be a valid URL or omitted. */
  verifyUrl?: string | null;
  effortMin?: number | null;
  /** Force a fresh generation even if a stored draft exists (overwrites it). */
  regenerate?: boolean;
}

export interface UpsertedDraft {
  actionId: string;
  /** The persisted draft text (the reused one, or the freshly generated one). */
  draft: string;
  /** true when an existing stored draft was returned without calling generate(). */
  reused: boolean;
}

/**
 * Find-or-create the draft action for (appId, title) and return its persisted
 * draft. Runs `generate()` only when there's no reusable stored draft (or
 * `regenerate` is set). Throws on a DB error so the caller returns 500.
 */
export async function upsertDraftAction(
  db: ServerDb,
  appId: string,
  input: DraftActionInput,
  generate: () => Promise<string>,
): Promise<UpsertedDraft> {
  const { data: existingRows, error: findErr } = await db
    .from("actions")
    .select("id, status, draft")
    .eq("app_id", appId)
    .eq("title", input.title);
  if (findErr) throw new Error(`draft-action lookup failed: ${findErr.message}`);

  const openMatch = (existingRows ?? []).find((a) => a.status !== "done");

  // Reuse a stored draft for free — repeat "Generate draft" clicks shouldn't
  // re-spend the LLM budget (parity with the original /api/content-draft path).
  if (
    openMatch &&
    typeof openMatch.draft === "string" &&
    openMatch.draft.length > 0 &&
    !input.regenerate
  ) {
    return { actionId: openMatch.id as string, draft: openMatch.draft, reused: true };
  }

  const draft = await generate();

  if (openMatch) {
    // A redraft OVERWRITES the stored draft (the founder asked for a new one) —
    // this is the deliberate difference from /api/action's fill-only enrich,
    // which protects a hand-edited draft from a stray "add to plan".
    const patch: { draft: string; draft_requires_edit: boolean; verify_url?: string; effort_min?: number; target?: Json } = {
      draft,
      draft_requires_edit: true,
    };
    if (input.verifyUrl) patch.verify_url = input.verifyUrl;
    if (input.effortMin != null) patch.effort_min = input.effortMin;
    if (input.target) patch.target = input.target as unknown as Json;
    const { error: updErr } = await db.from("actions").update(patch).eq("id", openMatch.id);
    if (updErr) throw new Error(`draft-action update failed: ${updErr.message}`);
    return { actionId: openMatch.id as string, draft, reused: false };
  }

  const { data: inserted, error: insErr } = await db
    .from("actions")
    .insert({
      app_id: appId,
      category: input.category,
      title: input.title,
      why: input.why ?? null,
      status: "pending",
      draft,
      draft_requires_edit: true,
      verify_url: input.verifyUrl ?? null,
      effort_min: input.effortMin ?? null,
      target: (input.target ?? null) as Json | null,
      expected_outcome: null,
    })
    .select("id")
    .single();
  if (insErr || !inserted) throw new Error(`draft-action insert failed: ${insErr?.message ?? "no row"}`);
  return { actionId: inserted.id as string, draft, reused: false };
}
