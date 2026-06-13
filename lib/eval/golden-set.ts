/**
 * Golden-set eval harness (Task 14 — R1 quality gate).
 *
 * Runs the REAL deterministic pipeline stages (runCriticGate → algorithmSafety →
 * gatherScoreComponents + verifiedScore → assembleReport) over 5 reference app
 * fixtures, then scores each result against the fixture's rubric.
 *
 * Must be run with REACHKIT_USE_FIXTURES=true so:
 *   - runCriticGate skips the Sonnet/critic LLM (deterministic rules only)
 *   - algorithmSafety uses fixtureEmbed for embedding
 *
 * DB-backed: seeds a real app+scan row per fixture against local Supabase.
 */

import { serverDb } from "@/lib/db/client";
import { ScanBudget } from "@/lib/tools/registry";
import type { ScanContext } from "@/lib/scan/pipeline";
import { runCriticGate } from "@/lib/llm/critic";
import { algorithmSafety } from "@/lib/scan/algorithm-safety";
import { gatherScoreComponents, verifiedScore } from "@/lib/scan/score-full";
import { assembleReport } from "@/lib/scan/report";
import { scoreFixture } from "@/lib/eval/score";
import type { GoldenFixture, GoldenSetResult, FixtureScore } from "@/lib/eval/types";

// ---------------------------------------------------------------------------
// Import fixture JSON files
// ---------------------------------------------------------------------------

import bearableJson from "@/lib/eval/fixtures/bearable.json";
import opalJson from "@/lib/eval/fixtures/opal.json";
import cardpointersJson from "@/lib/eval/fixtures/cardpointers.json";
import sofaJson from "@/lib/eval/fixtures/sofa.json";
import nudgiJson from "@/lib/eval/fixtures/nudgi.json";

const FIXTURES: GoldenFixture[] = [
  bearableJson as unknown as GoldenFixture,
  opalJson as unknown as GoldenFixture,
  cardpointersJson as unknown as GoldenFixture,
  sofaJson as unknown as GoldenFixture,
  nudgiJson as unknown as GoldenFixture,
];

// ---------------------------------------------------------------------------
// Fixed timestamp — do NOT call new Date() at module level
// ---------------------------------------------------------------------------

const GENERATED_AT = "2026-06-13T00:00:00.000Z";

// ---------------------------------------------------------------------------
// Seed helper — inserts app + scan rows, returns ScanContext
// ---------------------------------------------------------------------------

async function seedScanContext(fixture: GoldenFixture): Promise<ScanContext> {
  const db = serverDb();

  const { data: appRow, error: appErr } = await db
    .from("apps")
    .insert({
      store_url: fixture.storeUrl,
      platform: fixture.mode,
    })
    .select("id")
    .single();

  if (appErr) {
    throw new Error(`golden-set: failed to insert app for ${fixture.id}: ${appErr.message}`);
  }
  if (!appRow) throw new Error(`golden-set: no appRow for ${fixture.id}`);

  const { data: scanRow, error: scanErr } = await db
    .from("scans")
    .insert({ app_id: appRow.id })
    .select("id")
    .single();

  if (scanErr) {
    throw new Error(`golden-set: failed to insert scan for ${fixture.id}: ${scanErr.message}`);
  }
  if (!scanRow) throw new Error(`golden-set: no scanRow for ${fixture.id}`);

  return {
    scanId: scanRow.id as string,
    appId: appRow.id as string,
    storeUrl: fixture.storeUrl,
    mode: fixture.mode,
    budget: new ScanBudget({ maxToolCalls: 60, budgetCents: 150 }),
  };
}

// ---------------------------------------------------------------------------
// Run a single fixture through the full pipeline and score it
// ---------------------------------------------------------------------------

async function runFixture(fixture: GoldenFixture): Promise<FixtureScore> {
  // 1. Seed real DB rows so critic + algorithm-safety can write pipeline_runs + embeddings
  const ctx = await seedScanContext(fixture);

  const candidateActions = fixture.candidateActions;
  const candidateCount = candidateActions.length;

  // 2. Critic gate (REACHKIT_USE_FIXTURES=true → deterministic rules only, no Sonnet)
  const { passed: criticPassed } = await runCriticGate(ctx, candidateActions);

  // 3. Algorithm safety (fixtureEmbed for embeddings, real caps/dedup)
  const safeActions = await algorithmSafety(ctx, criticPassed);

  // 4. Gather score components + compute verified score
  const scoreComponents = await gatherScoreComponents(ctx, fixture.facts);
  const score = verifiedScore(scoreComponents, fixture.mode);

  // 5. Assemble report
  const report = assembleReport({
    mode: fixture.mode,
    generatedAt: GENERATED_AT,
    positioningMirror: fixture.positioningMirror,
    findings: fixture.findings,
    icpSignals: fixture.icpSignals,
    surfaces: fixture.surfaces,
    competitorGap: fixture.competitorGap,
    actions: safeActions,
    score,
  });

  // 6. Score the assembled report against the rubric. Coverage is judged
  //    against `safeActions` (real pipeline output), NOT fixture.findings.
  return scoreFixture(report, safeActions, fixture.rubric, {
    candidateCount,
    fixtureId: fixture.id,
    appName: fixture.appName,
  });
}

// ---------------------------------------------------------------------------
// Public API — runGoldenSet
// ---------------------------------------------------------------------------

/**
 * Run all 5 reference fixtures through the full deterministic pipeline and
 * score each against its rubric.
 *
 * Must be called with REACHKIT_USE_FIXTURES=true.
 * Returns { perFixture, mean } where mean >= 0.7 is the R1 pass threshold.
 */
export async function runGoldenSet(): Promise<GoldenSetResult> {
  const perFixture: FixtureScore[] = [];

  for (const fixture of FIXTURES) {
    const result = await runFixture(fixture);
    perFixture.push(result);
  }

  const mean =
    perFixture.length === 0
      ? 0
      : perFixture.reduce((sum, f) => sum + f.score, 0) / perFixture.length;

  return { perFixture, mean };
}
