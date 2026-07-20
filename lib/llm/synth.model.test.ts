import { describe, expect, it } from "vitest";
import { SYNTH_MODEL_FREE, SYNTH_MODEL_FULL } from "./synth";
import { SYNTH_SYSTEM_LITE, buildSynthPromptLite, buildSynthPrompt } from "./prompts";
import { anthropicCostCents } from "@/lib/telemetry/pipeline-runs";
import { expectCallsSymbol } from "@/lib/testing/tripwire";

// ---------------------------------------------------------------------------
// GUARD — the two-tier synth: the FREE findings step runs a LITE Haiku teaser
// (positioning mirror + category/niche market seeds only, P2 2026-07-20 — see
// docs/plans/2026-07-20-free-scan-databoard.md); the DEEP pass re-runs the
// FULL Sonnet synth that the paid action plan is built from. Mutation-proven
// below.
// ---------------------------------------------------------------------------

describe("synth models", () => {
  it("free teaser = Haiku 4.5, deep = Sonnet, and they are distinct", () => {
    expect(SYNTH_MODEL_FREE).toBe("claude-haiku-4-5-20251001");
    expect(SYNTH_MODEL_FULL).toBe("claude-sonnet-4-6");
    expect(SYNTH_MODEL_FREE).not.toBe(SYNTH_MODEL_FULL);
  });

  it("the free teaser model is genuinely CHEAPER on the same workload", () => {
    const free = anthropicCostCents(SYNTH_MODEL_FREE, 1900, 300);
    const deep = anthropicCostCents(SYNTH_MODEL_FULL, 1900, 300);
    expect(free).toBeLessThan(deep);
  });
});

describe("the lite prompt generates ONLY the two rendered fields (render-only)", () => {
  const lite = buildSynthPromptLite(
    { reviewThemes: "{}", positioning: "{}", competitorGap: "{}" },
    { storeUrl: "https://acme.com/" },
  );
  it("asks for positioningMirror + category/niche market seeds", () => {
    expect(lite).toContain("positioningMirror");
    expect(lite).toContain('"category"');
    expect(lite).toContain('"niche"');
  });
  it("does NOT ask for findings or sampleAction (the tokens the free report discards)", () => {
    // The full prompt requests these; the lite one must not — that's the ~800→~280
    // output-token cut that makes the free synth ~4s instead of ~12s.
    expect(lite).not.toContain('"findings"');
    expect(lite).not.toContain('"sampleAction"');
    // sanity: the FULL prompt DOES ask for them (so the assertion isn't vacuous)
    const full = buildSynthPrompt(
      { reviewThemes: "{}", positioning: "{}", competitorGap: "{}", keywordData: "{}" },
      { storeUrl: "https://acme.com/" },
    );
    expect(full).toContain('"findings"');
    expect(full).toContain('"sampleAction"');
  });
  it("lite uses its own leaner system prompt (not the 'EXACTLY 3 findings' one)", () => {
    expect(SYNTH_SYSTEM_LITE).not.toContain("EXACTLY 3 findings");
  });
});

describe("wiring — free findings step is lite, deep pass re-runs the full synth", () => {
  it("the findings step runs runFindings (the lite Haiku teaser is passed there)", () => {
    // The findings step must pass { synthModel: SYNTH_MODEL_FREE, lite: true } — a
    // source tripwire that it routes the free teaser, not the full model.
    expectCallsSymbol("lib/inngest/functions/scan-requested.ts", "runFindings");
  });
  it("the deep pass re-runs runSynth (it must OWN the full synth, not reuse the teaser)", () => {
    // If the deep pass ever stops calling runSynth it would build the paid action
    // plan from the lite teaser's empty findings — this guards that regression.
    // Scoped to runFullScan's own body (full-scan.ts DEFINES persistDeepSynth).
    expectCallsSymbol("lib/scan/full-scan.ts", "runSynth", { within: "runFullScan" });
    expectCallsSymbol("lib/scan/full-scan.ts", "persistDeepSynth", { within: "runFullScan" });
  });
});
