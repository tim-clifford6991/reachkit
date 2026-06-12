/**
 * Findings pipeline orchestration (Cycle 2 Task 6).
 *
 * Orchestrates: extract → synth → score → persist → emit findings event.
 *
 * On any error after the pipeline begins, emits an "error" scan_event and
 * rethrows so the caller's onFailure handler can also act.
 */

import { serverDb } from "@/lib/db/client";
import { runExtract } from "@/lib/llm/extract";
import { runSynth } from "@/lib/llm/synth";
import { discoverabilityScore } from "@/lib/scan/score";
import { getFreshFactSheet } from "@/lib/scan/fact-sheets";
import { emitScanEvent } from "@/lib/scan/progress";
import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts } from "@/lib/scan/types";
import type { KeywordSheet } from "@/lib/llm/types";
import type { Json } from "@/lib/db/types";

export async function runFindings(
  ctx: ScanContext,
  facts: PreliminaryFacts,
): Promise<void> {
  try {
    // 1. Extract — runs LLM on raw_documents and writes fact_sheets
    await runExtract(ctx);

    // 2. Synth — reads fact_sheets and produces SynthResult
    const synth = await runSynth(ctx);

    // 3. Score — uses preliminary facts + keyword fact sheet
    const keywordRow = await getFreshFactSheet("app", ctx.storeUrl, "keyword_data");
    const keywordSheet = (keywordRow?.body ?? null) as KeywordSheet | null;
    const score = discoverabilityScore(facts, keywordSheet);

    // 4. Persist
    const db = serverDb();

    // 4a. Insert one findings row per finding
    const findingsInsert = synth.findings.map((f) => ({
      scan_id: ctx.scanId,
      category: f.category,
      basis: f.basis,
      confidence: f.confidence,
      body: { claim: f.claim, evidence: f.evidence } as unknown as Json,
      evidence_ids: [] as number[],
    }));

    const { error: findingsErr } = await db.from("findings").insert(findingsInsert);
    if (findingsErr) throw findingsErr;

    // 4b. Update scans with score + findings_payload
    const findingsPayload: Json = {
      positioningMirror: synth.positioningMirror as unknown as Json,
      sampleAction: synth.sampleAction as unknown as Json,
      findings: synth.findings as unknown as Json,
      score: score as unknown as Json,
    };

    const { error: scansErr } = await db
      .from("scans")
      .update({
        score_total: score.total,
        score_breakdown: score.breakdown as Json,
        findings_payload: findingsPayload,
      })
      .eq("id", ctx.scanId);
    if (scansErr) throw scansErr;

    // 5. Emit findings event
    await emitScanEvent(ctx.scanId, "findings", {
      score,
      positioningMirror: synth.positioningMirror,
      findings: synth.findings,
      sampleAction: synth.sampleAction,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Best-effort error event — do not swallow the original error
    await emitScanEvent(ctx.scanId, "error", { message }).catch(() => {
      // If even the error event fails, still rethrow the original
    });
    throw err;
  }
}
