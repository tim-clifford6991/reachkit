/**
 * Action verification → outcomes moat + score movement (Cycle 4 Task 14, §10.4).
 *
 * runActionVerification closes the paid loop: a founder marks an action complete,
 * we VERIFY it actually shipped, and on success we (a) mark the action done,
 * (b) write an idempotent `outcomes` row (the compounding moat: "founder did X →
 * surface Y went live"), and (c) recompute the verified Discoverability Score and
 * snapshot it — so the score visibly TRACKS the founder's progress.
 *
 * Dispatch by verification.method (§10.2 action-card field):
 *   - "url"         → verify_action: the action's verify_url must be live (and, if
 *                     we have a sensible needle, contain the action title).
 *   - "rank_check"  → track_rank: the target store host must now RANK for the
 *                     action's keyword(s) (a position is present).
 *   - "self_report" → the founder attests; verified = true.
 *
 * Contract: NEVER throws out. Every failure is wrapped + logged; an unverifiable
 * action sets verify_state="failed" (status untouched) and writes NO outcome.
 *
 * Fixture-aware end-to-end: verify_action / track_rank short-circuit to fixtures
 * when REACHKIT_USE_FIXTURES=true, so this whole flow runs keyless in dev/test.
 */

import { serverDb } from "@/lib/db/client";
import { env } from "@/lib/config/env";
import { ScanBudget } from "@/lib/tools/registry";
import { verifyAction } from "@/lib/scan/tools/verify-action";
import { trackRank } from "@/lib/scan/tools/track-rank";
import { gatherScoreComponents, verifiedScore, CURRENT_SCORE_VERSION } from "@/lib/scan/score-full";
import { persistScanSignals } from "@/lib/scan/persist-signals";
import { hostname } from "@/lib/scan/url";
import type { ScanContext } from "@/lib/scan/pipeline";
import type { ToolContext } from "@/lib/tools/registry";
import type { PreliminaryFacts } from "@/lib/scan/types";
import type { Json } from "@/lib/db/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Platform = ScanContext["mode"];
function isPlatform(p: string): p is Platform {
  return p === "ios" || p === "android" || p === "web";
}

type VerificationMethod = "url" | "self_report" | "rank_check";
function isMethod(m: unknown): m is VerificationMethod {
  return m === "url" || m === "self_report" || m === "rank_check";
}

/** The action row + its app, as loaded for verification. */
interface LoadedAction {
  id: string;
  appId: string;
  category: string;
  title: string;
  method: VerificationMethod;
  verifyUrl: string | null;
  expectedOutcome: Json | null;
  storeUrl: string;
  platform: Platform;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract candidate ranking keywords for a rank_check action. Prefers an
 * explicit `keywords` array on expected_outcome; otherwise falls back to the
 * action title (a coarse single-keyword probe). Always returns ≥0 trimmed,
 * non-empty strings.
 */
function rankKeywords(expectedOutcome: Json | null, title: string): string[] {
  if (expectedOutcome !== null && typeof expectedOutcome === "object" && !Array.isArray(expectedOutcome)) {
    const kw = (expectedOutcome as Record<string, unknown>)["keywords"];
    if (Array.isArray(kw)) {
      const out = kw.filter((k): k is string => typeof k === "string" && k.trim().length > 0);
      if (out.length > 0) return out;
    }
  }
  const t = title.trim();
  return t.length > 0 ? [t] : [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface VerificationResult {
  verified: boolean;
}

/**
 * Verify a single action, then persist the outcome + score movement on success.
 * See module docstring for the full contract. Returns { verified } either way;
 * never throws.
 */
export async function runActionVerification(actionId: string): Promise<VerificationResult> {
  try {
    const db = serverDb();

    // Load the action joined to its app (store_url + platform).
    const { data: row, error: loadErr } = await db
      .from("actions")
      .select("id, app_id, category, title, verify_url, verification, expected_outcome, apps(store_url, platform)")
      .eq("id", actionId)
      .maybeSingle();
    if (loadErr) throw loadErr;
    if (!row) {
      console.error(`[verify] action ${actionId} not found`);
      return { verified: false };
    }

    const appRaw = row.apps as unknown as { store_url: string; platform: string } | null;
    if (!appRaw || !isPlatform(appRaw.platform)) {
      console.error(`[verify] action ${actionId} has no usable app`);
      return { verified: false };
    }

    // Resolve the verification method (default "url" — the §10.2 fallback).
    const verification = row.verification as { method?: unknown } | null;
    const rawMethod = verification?.method;
    const method: VerificationMethod = isMethod(rawMethod) ? rawMethod : "url";

    const action: LoadedAction = {
      id: row.id,
      appId: row.app_id,
      category: row.category,
      title: row.title,
      method,
      verifyUrl: row.verify_url,
      expectedOutcome: row.expected_outcome,
      storeUrl: appRaw.store_url,
      platform: appRaw.platform,
    };

    // Tool context for the D-tools (scanId not needed — these tools don't persist).
    const toolCtx: ToolContext = {
      scanId: null,
      mode: action.platform,
      budget: new ScanBudget({ maxToolCalls: 10, budgetCents: env.scanBudgetCents }),
    };

    // Dispatch by method → { verified, signal }.
    const { verified, signal } = await dispatchVerify(action, toolCtx);

    if (!verified) {
      // Not verified: mark failed, leave status as-is, write NO outcome.
      const { error: failErr } = await db
        .from("actions")
        .update({ verify_state: "failed" })
        .eq("id", action.id);
      if (failErr) throw failErr;
      return { verified: false };
    }

    // Verified: mark done + verified, upsert the outcome, then move the score.
    await markVerifiedAndRecordOutcome(action, signal);
    await snapshotScore(action);

    return { verified: true };
  } catch (err) {
    // Never throw out — wrap + log (mirrors the fail-closed tool contract).
    const message =
      err instanceof Error ? err.message : typeof err === "object" ? JSON.stringify(err) : String(err);
    console.error(`[verify] action ${actionId} verification errored: ${message}`);
    return { verified: false };
  }
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

async function dispatchVerify(
  action: LoadedAction,
  toolCtx: ToolContext,
): Promise<{ verified: boolean; signal: string }> {
  switch (action.method) {
    case "self_report":
      // The founder attests — trust it (it's gated to the owner upstream).
      return { verified: true, signal: "self_reported" };

    case "rank_check": {
      const keywords = rankKeywords(action.expectedOutcome, action.title);
      if (keywords.length === 0) return { verified: false, signal: "rank_present" };
      const target = hostname(action.storeUrl);
      const { ranks } = await trackRank.run({ keywords, target }, toolCtx);
      // Verified iff the target now ranks (a position is present) for any keyword.
      const present = Object.values(ranks).some((pos) => typeof pos === "number" && pos > 0);
      return { verified: present, signal: "rank_present" };
    }

    case "url":
    default: {
      const url = action.verifyUrl;
      if (url === null || url.trim() === "") return { verified: false, signal: "url_live" };
      // Needle: the action title (verify_action lowercases + substring-matches).
      const expect = action.title.trim().length > 0 ? action.title : undefined;
      const { verified } = await verifyAction.run({ url, expect }, toolCtx);
      return { verified, signal: "url_live" };
    }
  }
}

// ---------------------------------------------------------------------------
// Persist: action done + idempotent outcome
// ---------------------------------------------------------------------------

async function markVerifiedAndRecordOutcome(action: LoadedAction, signal: string): Promise<void> {
  const db = serverDb();

  // Mark the action verified + done.
  const { error: updErr } = await db
    .from("actions")
    .update({ verify_state: "verified", status: "done" })
    .eq("id", action.id);
  if (updErr) throw updErr;

  // Idempotent outcome (unique index on outcomes(action_id) → re-run = no dup).
  // observed_delta carries the action's expected_outcome (the "what we expected
  // to move" record the moat is built from).
  const { error: outErr } = await db
    .from("outcomes")
    .upsert(
      {
        action_id: action.id,
        app_id: action.appId,
        verified_signal: signal,
        observed_delta: action.expectedOutcome,
      },
      { onConflict: "action_id" },
    );
  if (outErr) throw outErr;
}

// ---------------------------------------------------------------------------
// Score movement: recompute verified score + write a snapshot
// ---------------------------------------------------------------------------

async function snapshotScore(action: LoadedAction): Promise<void> {
  const db = serverDb();

  // Reconstruct a ScanContext for the score recompute. The verified score is
  // app-scoped; the latest scan id (if any) is a convenient anchor but the score
  // itself is gathered from the app's verified outcomes + its preliminary facts.
  const { data: scanRow } = await db
    .from("scans")
    .select("id, preliminary_facts")
    .eq("app_id", action.appId)
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const facts: PreliminaryFacts = coerceFacts(scanRow?.preliminary_facts ?? null, action.platform);

  const ctx: ScanContext = {
    scanId: scanRow?.id ?? action.id,
    appId: action.appId,
    storeUrl: action.storeUrl,
    mode: action.platform,
    budget: new ScanBudget({ maxToolCalls: 10, budgetCents: env.scanBudgetCents }),
  };

  const components = await gatherScoreComponents(ctx, facts);
  const score = verifiedScore(components, action.platform);

  // History row so the score timeline shows the bump. action_id marks it as an
  // action-completion marker on the score-history chart.
  const { error: snapErr } = await db.from("score_snapshots").insert({
    app_id: action.appId,
    total: score.total,
    breakdown: score.breakdown as unknown as Json,
    score_version: CURRENT_SCORE_VERSION,
    source: "action_verify",
    scan_id: scanRow?.id ?? null,
    action_id: action.id,
  });
  if (snapErr) throw snapErr;

  // Refresh the per-signal rows for the anchor scan (best-effort).
  if (scanRow?.id) {
    try {
      await persistScanSignals({ scanId: scanRow.id, mode: ctx.mode, storeUrl: ctx.storeUrl, components, market: null });
    } catch (e) {
      console.error("[verify] persistScanSignals failed (best-effort)", e);
    }
  }
}

/**
 * Coerce a persisted preliminary_facts blob into the minimal PreliminaryFacts the
 * score gatherer reads (mode, themes, ratingTrend). Degrades to a safe empty-shape
 * for the platform when the blob is missing/malformed — the verified-outcome bumps
 * (the point of this flow) are independent of these proxy fields.
 */
function coerceFacts(raw: Json | null, platform: Platform): PreliminaryFacts {
  const empty: PreliminaryFacts = {
    mode: platform,
    listing: { name: "", category: null, description: null },
    competitors: [],
    reviewVolume: 0,
    ratingTrend: null,
    webProxy: null,
    themes: [],
    sourcesUsed: [],
    coldStart: true, // no footprint in this degraded placeholder; overridden by the persisted blob below
  };
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return empty;
  return { ...empty, ...(raw as Partial<PreliminaryFacts>), mode: platform };
}
