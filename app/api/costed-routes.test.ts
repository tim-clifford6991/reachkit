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
