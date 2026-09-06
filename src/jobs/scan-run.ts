// src/jobs/scan-run.ts — BUILD §11
//
// "`scan/run` · on demand · The one pipeline; tier is a parameter. Free
// ≈60s live; deep live; weekly standard." A trigger, one call into the
// engine, and the outcome — no admission rule, no stage list, no cost
// arithmetic: all of those are the pipeline's own and none is repeated
// here. In the kill switch's scope.
import { runScan, type ScanTier } from "@/jobs/engine";
import { oneOf, optionalString, requiredString } from "./payload";
import type { JobDefinition, Outcome } from "./types";

const TIERS = Object.freeze(["free", "deep", "weekly"] as const) satisfies readonly ScanTier[];

export const scanRun: JobDefinition = {
  id: "scan/run",
  trigger: { kind: "event", event: "scan/run" },
  idempotencyKey: ["scanId"],
  async run(input): Promise<Outcome> {
    const scanId = requiredString(input, "scanId");
    const result = await runScan({
      scanId,
      domain: requiredString(input, "domain"),
      tier: oneOf(input, "tier", TIERS),
      // The onboarding pass belongs to a site, and the deep tier is the
      // only one that needs to know which: the founder's stage and their
      // release latch are both rows on it. Absent on a free scan, which
      // has no site yet.
      siteId: optionalString(input, "siteId"),
    });
    return "degraded" in result
      ? { outcome: "degraded", subjectId: scanId, step: result.degraded }
      : { outcome: "ran", subjectId: scanId };
  },
};
