import { describe, expect, it } from "vitest";
import { synthModelForTier, SYNTH_MODEL_FREE, SYNTH_MODEL_FULL } from "./synth";
import { anthropicCostCents } from "@/lib/telemetry/pipeline-runs";
import { expectCallsSymbol } from "@/lib/testing/tripwire";

// ---------------------------------------------------------------------------
// GUARD — the synth model is tier-aware: free runs Haiku 4.5 (fast/cheap teaser,
// the free report renders only the mirror + seeds); paid runs Sonnet (the deep
// report's action plan is built FROM these findings). Mutation-proven: flip the
// free branch to Sonnet and the "free → Haiku" + "free is cheaper" tests fail.
// ---------------------------------------------------------------------------

describe("synthModelForTier — free runs Haiku, paid runs Sonnet", () => {
  it("free → Haiku 4.5", () => {
    expect(synthModelForTier("free")).toBe(SYNTH_MODEL_FREE);
    expect(SYNTH_MODEL_FREE).toBe("claude-haiku-4-5-20251001");
  });

  it("full → Sonnet", () => {
    expect(synthModelForTier("full")).toBe(SYNTH_MODEL_FULL);
    expect(SYNTH_MODEL_FULL).toBe("claude-sonnet-4-6");
  });

  it("the free and paid synth models are distinct", () => {
    expect(SYNTH_MODEL_FREE).not.toBe(SYNTH_MODEL_FULL);
  });

  it("the free synth model is genuinely CHEAPER on the same workload (not just different)", () => {
    // A representative synth call: ~1,900 input fact-sheet tokens, ~800 output.
    const free = anthropicCostCents(synthModelForTier("free"), 1900, 800);
    const paid = anthropicCostCents(synthModelForTier("full"), 1900, 800);
    expect(free).toBeLessThan(paid);
  });
});

describe("the free scan actually routes synth through the tier selector", () => {
  it("the scan-requested findings step calls synthModelForTier", () => {
    // Effect-checking source tripwire: the findings step must derive its synth
    // model from the tier (not hard-code one), or a free scan silently runs the
    // expensive model. `expectCallsSymbol` requires a real call, not an import.
    expectCallsSymbol("lib/inngest/functions/scan-requested.ts", "synthModelForTier");
  });
});
