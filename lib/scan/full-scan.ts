/**
 * Full-scan orchestration (Cycle 3 Task 13) — the heavy second pass that turns
 * preliminary facts into a persisted four-question report (§5.6) + action plan.
 *
 * Stage order:
 *   1. runFullCollect   — keyword / community / creator raw_documents
 *   2. runExtract       — re-extract so the keyword_data sheet (and the others)
 *                         reflect the freshly-collected docs (idempotent upsert)
 *   3. read findings    — from scans.findings_payload (written by the Cycle 2
 *                         findings pipeline); degrade to empty if absent
 *   4. generateActions  — over-generate §10.2 ActionCards from the fact sheets
 *   5. runCriticGate    — Critic Gate v2 (drop/downgrade); then algorithmSafety (§11)
 *   6. verifiedScore    — §7 anti-vanity verified Discoverability Score + radar
 *   7. gather + assemble — icpSignals / surfaces / competitorGap → assembleReport
 *   8. persistReport    — scans.report_payload
 *   9. persist actions  — idempotent (delete by scan_id, then insert the safe set)
 *  10. update score     — scans.score_total / score_breakdown
 *  11. seedMonitors     — seed the 4 weekly monitors (best-effort, idempotent)
 *  12. emit "report"     — scan_event with the score + action count
 *
 * On any failure: emit an "error" scan_event and rethrow (so Inngest retries /
 * marks the run failed via onFailure).
 *
 * Fixture-aware throughout: every paid call (collect tools, extract, action-gen,
 * Critic LLM, embeddings) short-circuits to fixtures when REACHKIT_USE_FIXTURES=true,
 * so the whole pass runs keyless in dev/test.
 */

import { serverDb } from "@/lib/db/client";
import { runFullCollect } from "@/lib/scan/full-collect";
import { runExtract } from "@/lib/llm/extract";
import { generateActions } from "@/lib/llm/actions";
import { runCriticGate } from "@/lib/llm/critic";
import { algorithmSafety } from "@/lib/scan/algorithm-safety";
import { gatherScoreComponents, verifiedScore } from "@/lib/scan/score-full";
import { assembleReport, persistReport } from "@/lib/scan/report";
import { seedMonitors } from "@/lib/scan/monitors";
import { getFreshFactSheet, factSheetSubjectType } from "@/lib/scan/fact-sheets";
import { emitScanEvent } from "@/lib/scan/progress";
import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts } from "@/lib/scan/types";
import type { Finding, PositioningMirror, ActionCard } from "@/lib/llm/types";
import type { Json } from "@/lib/db/types";

// ---------------------------------------------------------------------------
// Report-input shapes (subset of assembleReport's input)
// ---------------------------------------------------------------------------
type Surface = { source: string; title: string; url: string };
type GapRow = { competitor: string; dimension: string; them: number; you: number };

const EMPTY_MIRROR: PositioningMirror = { listingSays: "", reviewsValue: "", gap: "" };

// ---------------------------------------------------------------------------
// findings_payload reader — degrade gracefully if absent / malformed
// ---------------------------------------------------------------------------
async function readFindingsPayload(
  scanId: string,
): Promise<{ findings: Finding[]; positioningMirror: PositioningMirror }> {
  const db = serverDb();
  const { data, error } = await db
    .from("scans")
    .select("findings_payload")
    .eq("id", scanId)
    .single();
  if (error) throw error;

  const payload = (data?.findings_payload ?? null) as {
    findings?: unknown;
    positioningMirror?: unknown;
  } | null;

  const findings = Array.isArray(payload?.findings) ? (payload.findings as Finding[]) : [];
  const mirror =
    payload?.positioningMirror !== undefined && payload.positioningMirror !== null
      ? (payload.positioningMirror as PositioningMirror)
      : EMPTY_MIRROR;

  return { findings, positioningMirror: mirror };
}

// ---------------------------------------------------------------------------
// icpSignals — theme strings from the review_themes fact sheet (degrade to [])
// ---------------------------------------------------------------------------
async function readIcpSignals(subjectType: string, subjectKey: string): Promise<string[]> {
  try {
    const sheet = await getFreshFactSheet(subjectType, subjectKey, "review_themes");
    if (sheet === null) return [];
    const body = sheet.body as { themes?: unknown };
    const themes = Array.isArray(body.themes) ? body.themes : [];
    const signals: string[] = [];
    for (const t of themes) {
      const theme = (t as Record<string, unknown>)["theme"];
      if (typeof theme === "string" && theme.length > 0) signals.push(theme);
    }
    return signals;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// surfaces — where the audience is: communities + creators raw_documents
// (subject_key = storeUrl; communities body = Community[], youtube body = Creator[])
// ---------------------------------------------------------------------------
async function readSurfaces(subjectKey: string): Promise<Surface[]> {
  try {
    const db = serverDb();
    const { data, error } = await db
      .from("raw_documents")
      .select("source_type, body")
      .eq("subject_key", subjectKey)
      .in("source_type", ["communities", "youtube"]);
    if (error || data === null) return [];

    const surfaces: Surface[] = [];
    for (const row of data) {
      const items = Array.isArray(row.body) ? (row.body as unknown[]) : [];
      for (const item of items) {
        if (typeof item !== "object" || item === null) continue;
        const obj = item as Record<string, unknown>;
        const url = obj["url"];
        if (typeof url !== "string" || url.length === 0) continue;

        if (row.source_type === "communities") {
          const source = typeof obj["source"] === "string" ? obj["source"] : "community";
          const title = typeof obj["title"] === "string" ? obj["title"] : url;
          surfaces.push({ source, title, url });
        } else {
          // youtube creators — Creator.name is the channel/video title
          const title = typeof obj["name"] === "string" ? obj["name"] : url;
          surfaces.push({ source: "youtube", title, url });
        }
      }
    }
    return surfaces;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// competitorGap — from the competitor_gap fact sheet, else derived from facts
// ---------------------------------------------------------------------------
async function readCompetitorGap(
  subjectType: string,
  subjectKey: string,
  facts: PreliminaryFacts,
): Promise<GapRow[]> {
  const fromFacts = (): GapRow[] =>
    facts.competitors
      .filter((c) => typeof c.name === "string" && c.name.length > 0)
      .map((c) => ({ competitor: c.name, dimension: "presence", them: 1, you: 0 }));

  try {
    const sheet = await getFreshFactSheet(subjectType, subjectKey, "competitor_gap");
    if (sheet === null) return fromFacts();
    const body = sheet.body as { competitors?: unknown };
    const comps = Array.isArray(body.competitors) ? body.competitors : [];
    const gap: GapRow[] = [];
    for (const c of comps) {
      const name = (c as Record<string, unknown>)["name"];
      if (typeof name === "string" && name.length > 0) {
        gap.push({ competitor: name, dimension: "presence", them: 1, you: 0 });
      }
    }
    return gap.length > 0 ? gap : fromFacts();
  } catch {
    return fromFacts();
  }
}

// ---------------------------------------------------------------------------
// Persist the Critic-passed, algorithm-safe actions to the actions table.
// Idempotent: delete existing rows for this scan first, then insert.
// ---------------------------------------------------------------------------
async function persistActions(ctx: ScanContext, actions: ActionCard[]): Promise<void> {
  const db = serverDb();

  const { error: delErr } = await db.from("actions").delete().eq("scan_id", ctx.scanId);
  if (delErr) throw delErr;

  if (actions.length === 0) return;

  const rows = actions.map((a) => ({
    app_id: ctx.appId,
    scan_id: ctx.scanId,
    category: a.category,
    title: a.title,
    why: a.why,
    basis: a.basis,
    confidence: a.confidence,
    deadline: a.suggestedDeadline,
    draft: a.draft,
    draft_requires_edit: a.draftRequiresEdit,
    effort_min: a.effortMin,
    evidence_ids: a.evidenceIds,
    expected_outcome: a.expectedOutcome as unknown as Json,
    score_component: a.expectedOutcome.scoreComponent,
    verification: a.verification as unknown as Json,
  }));

  const { error: insErr } = await db.from("actions").insert(rows);
  if (insErr) throw insErr;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function runFullScan(ctx: ScanContext, facts: PreliminaryFacts): Promise<void> {
  try {
    // 1. Heavy collect (keywords / communities / creators)
    await runFullCollect(ctx, facts);

    // 2. Re-extract so the keyword_data sheet reflects the freshly-collected docs
    await runExtract(ctx);

    // 3. Findings + positioning mirror from the Cycle 2 findings pipeline
    const { findings, positioningMirror } = await readFindingsPayload(ctx.scanId);

    // 4. Over-generate action cards from the fact sheets + findings
    const actions = await generateActions(ctx, findings);

    // 5. Critic Gate v2 → §11 algorithm safety
    const { passed } = await runCriticGate(ctx, actions);
    const safe = await algorithmSafety(ctx, passed);

    // 6. Verified Discoverability Score + radar (§7)
    const components = await gatherScoreComponents(ctx, facts);
    const score = verifiedScore(components, ctx.mode);

    // 7. Gather the remaining report inputs + assemble the four-question report
    const subjectType = factSheetSubjectType(ctx.mode);
    const [icpSignals, surfaces, competitorGap] = await Promise.all([
      readIcpSignals(subjectType, ctx.storeUrl),
      readSurfaces(ctx.storeUrl),
      readCompetitorGap(subjectType, ctx.storeUrl, facts),
    ]);

    const payload = assembleReport({
      mode: ctx.mode,
      generatedAt: new Date().toISOString(),
      positioningMirror,
      findings,
      icpSignals,
      surfaces,
      competitorGap,
      actions: safe,
      score,
    });

    // 8. Persist the report payload
    await persistReport(ctx.scanId, payload);

    // 9. Persist the safe actions (idempotent)
    await persistActions(ctx, safe);

    // 10. Update the verified score on the scan row
    const db = serverDb();
    const { error: scoreErr } = await db
      .from("scans")
      .update({
        score_total: score.total,
        score_breakdown: score.breakdown as unknown as Json,
      })
      .eq("id", ctx.scanId);
    if (scoreErr) throw scoreErr;

    // 11. Seed the weekly monitors (Cycle 4 Task 7) — best-effort & idempotent
    //     (upsert on app_id,kind), so it can't break the scan or duplicate rows.
    await seedMonitors(ctx, facts);

    // 12. Emit the report event
    await emitScanEvent(ctx.scanId, "report", {
      score: score as unknown as Json,
      actionCount: safe.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await emitScanEvent(ctx.scanId, "error", { message });
    throw err;
  }
}
