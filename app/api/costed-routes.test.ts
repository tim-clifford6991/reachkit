/**
 * Cost-attribution tripwire (invariant #2 — a ratchet guard, not a behavioural test).
 *
 * External DataForSEO/Tavily spend is recorded at the ADAPTER layer, but only
 * lands on a scan row when the CALLER establishes a cost context (`costedStep` /
 * `costedIntelStep`). These are every cost-bearing caller outside the scan
 * pipeline itself; dropping the wrapper silently un-tracks real recurring spend
 * (the weekly refresh ran untracked for a month before this guard existed).
 *
 * Same pattern as entitlement-gates.test.ts: read the source, fail if the
 * wrapper is ever removed.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const COSTED_CALLERS: Array<{ rel: string; wrapper: RegExp }> = [
  { rel: "lib/inngest/functions/weekly-refresh.ts", wrapper: /costedStep\s*\(/ },
  { rel: "app/api/app/[id]/refresh/route.ts", wrapper: /costedStep\s*\(/ },
  { rel: "app/api/app/intel/route.ts", wrapper: /costedIntelStep\s*\(/ },
  { rel: "app/api/app/intel/stream/route.ts", wrapper: /costedIntelStep\s*\(/ },
  { rel: "app/api/competitors/select/route.ts", wrapper: /costedIntelStep\s*\(/ },
  { rel: "app/api/competitors/candidates/route.ts", wrapper: /costedIntelStep\s*\(/ },
  { rel: "app/api/app/plan/generate/route.ts", wrapper: /costedIntelStep\s*\(/ },
  // Paid LLM drafts. Before 2026-07-15 these ran OUTSIDE any cost context and
  // their generators call `callModel({ scanId: null })` — so every draft spent
  // real Anthropic money that landed in `pipeline_runs` with `scan_id = NULL`:
  // attributable to no scan, and therefore to no user.
  { rel: "app/api/content-draft/route.ts", wrapper: /costedIntelStep\s*\(/ },
  { rel: "app/api/distribute/draft/route.ts", wrapper: /costedIntelStep\s*\(/ },
];

describe("cost attribution (invariant #2 — ratchet)", () => {
  for (const { rel, wrapper } of COSTED_CALLERS) {
    it(`${rel} runs its gather under a cost context`, () => {
      const src = readFileSync(resolve(process.cwd(), rel), "utf8");
      expect(
        src,
        `${rel} must wrap its cost-bearing work in ${wrapper.source.replace("\\s*\\(", "")} so external spend attributes to a scan row`,
      ).toMatch(wrapper);
    });
  }
});

describe("cost phase tagging (C-COST / R2 — per-run vs post-scan split)", () => {
  // `costedStep` defaults phase:"run" (its 5 scan-pipeline sites are the majority).
  // The 2 refresh sites are POST-scan recurring spend on the app's latest scan row —
  // they MUST tag phase:"post-scan" so that spend lands in the lifetime accumulator
  // only, never in that scan's per-run cost. Drop the tag → the C-COST misread
  // returns (refresh spend re-counted as this scan's run cost). Source tripwire.
  const POST_SCAN_COSTED_STEP = [
    "lib/inngest/functions/weekly-refresh.ts",
    "app/api/app/[id]/refresh/route.ts",
  ];
  for (const rel of POST_SCAN_COSTED_STEP) {
    it(`${rel} tags its costedStep phase:"post-scan"`, () => {
      const src = readFileSync(resolve(process.cwd(), rel), "utf8");
      expect(src, `${rel} costedStep must pass phase:"post-scan" so recurring spend isn't counted as this scan's run cost`)
        .toMatch(/phase:\s*["']post-scan["']/);
    });
  }

  it('costedIntelStep flushes external cost as "post-scan"', () => {
    // The 7 interactive intel routes all funnel through costedIntelStep; its single
    // flush must be post-scan so paid-intel spend never inflates the anchor scan's run cost.
    const src = readFileSync(resolve(process.cwd(), "lib/app/latest-scan.ts"), "utf8");
    expect(src, 'costedIntelStep must flushExternalCost(..., "post-scan") so interactive intel spend is not per-run cost')
      .toMatch(/flushExternalCost\([^)]*["']post-scan["']\)/);
  });
});
