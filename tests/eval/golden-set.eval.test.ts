/**
 * Golden-set eval gate (Task 14 — R1 quality gate).
 *
 * Runs all 5 reference fixtures through the full deterministic pipeline and
 * asserts that the mean score ≥ 0.7 (R1 pass threshold).
 *
 * Run with: pnpm eval
 *
 * Requirements:
 *   - REACHKIT_USE_FIXTURES=true (set via vi.stubEnv below)
 *   - Local Supabase running (same as other integration tests)
 */

import { expect, test, vi } from "vitest";
import type { GoldenSetResult } from "@/lib/eval/types";

// ---------------------------------------------------------------------------
// Force fixture mode so critic/embed gates run deterministically (no API keys)
// ---------------------------------------------------------------------------

vi.stubEnv("REACHKIT_USE_FIXTURES", "true");

test(
  "golden-set: mean ≥ 0.7, 5 fixtures, each fixture ≥ minActions safe actions",
  async () => {
    // Dynamic import so the env stub is picked up before module-level reads
    const { runGoldenSet } = await import("@/lib/eval/golden-set");

    const result: GoldenSetResult = await runGoldenSet();

    // ---------------------------------------------------------------------------
    // Print a per-fixture table for observability
    // ---------------------------------------------------------------------------
    console.log("\n=== Golden-Set Eval Results ===");
    console.log(
      [
        "Fixture".padEnd(16),
        "FindCov".padEnd(9),
        "Actions".padEnd(9),
        "Evidence".padEnd(10),
        "ScorePlau".padEnd(11),
        "Score".padEnd(7),
        "Cand→Safe",
      ].join(" | "),
    );
    console.log("-".repeat(80));

    for (const f of result.perFixture) {
      console.log(
        [
          f.fixtureId.padEnd(16),
          f.findingsCoverage.toFixed(2).padEnd(9),
          f.actionScore.toFixed(2).padEnd(9),
          f.evidenceScore.toFixed(2).padEnd(10),
          f.scorePlausible.toFixed(2).padEnd(11),
          f.score.toFixed(2).padEnd(7),
          `${f.candidateCount}→${f.safeCount}`,
        ].join(" | "),
      );
      if (f.notes.length > 0) {
        for (const note of f.notes) {
          console.log(`  NOTE: ${note}`);
        }
      }
    }

    console.log("-".repeat(80));
    console.log(`Mean score: ${result.mean.toFixed(3)}`);
    console.log("");

    // ---------------------------------------------------------------------------
    // Assertions
    // ---------------------------------------------------------------------------

    // Exactly 5 fixtures
    expect(result.perFixture.length).toBe(5);

    // Each fixture must have ≥ minActions safe actions
    // We load the fixture rubrics to get minActions per fixture
    const { default: bearableJson } = await import("@/lib/eval/fixtures/bearable.json", { with: { type: "json" } });
    const { default: opalJson } = await import("@/lib/eval/fixtures/opal.json", { with: { type: "json" } });
    const { default: cardpointersJson } = await import("@/lib/eval/fixtures/cardpointers.json", { with: { type: "json" } });
    const { default: sofaJson } = await import("@/lib/eval/fixtures/sofa.json", { with: { type: "json" } });
    const { default: nudgiJson } = await import("@/lib/eval/fixtures/nudgi.json", { with: { type: "json" } });

    const fixtureRubrics: Record<string, number> = {
      bearable: (bearableJson as { rubric: { minActions: number } }).rubric.minActions,
      opal: (opalJson as { rubric: { minActions: number } }).rubric.minActions,
      cardpointers: (cardpointersJson as { rubric: { minActions: number } }).rubric.minActions,
      sofa: (sofaJson as { rubric: { minActions: number } }).rubric.minActions,
      nudgi: (nudgiJson as { rubric: { minActions: number } }).rubric.minActions,
    };

    for (const f of result.perFixture) {
      const minActions = fixtureRubrics[f.fixtureId] ?? 3;
      expect(
        f.safeCount,
        `${f.fixtureId}: expected ≥${minActions} safe actions, got ${f.safeCount}`,
      ).toBeGreaterThanOrEqual(minActions);
    }

    // Mean ≥ 0.7 (R1 pass threshold)
    expect(
      result.mean,
      `Mean score ${result.mean.toFixed(3)} is below the R1 threshold of 0.7`,
    ).toBeGreaterThanOrEqual(0.7);
  },
  60_000,
);
