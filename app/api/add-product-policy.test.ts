/**
 * ONE product-resolution policy (spec 2026-07-15). `/api/scan` and the in-app add
 * MUST both ask `resolveProductScan`. They disagreed before — /api/scan
 * find-or-created while addFirstTrackedProduct always inserted — and that
 * disagreement produced nudgi.ai's incoherent state (paid dashboard over an
 * anonymous free scan). Source tripwire, same idiom as costed-routes.test.ts.
 *
 * NOTE on scope: the plan (docs/superpowers/plans/2026-07-15-add-product-onboarding.md)
 * also pins "addFirstTrackedProduct is gone" here, but that retirement is Task 6's
 * job (it deletes lib/app/add-first-product.ts and rewires
 * app/(app)/app/settings/actions.ts onto addTrackedProduct — neither is in this
 * task's file list). Asserting that now would fail for a reason outside this
 * task's scope, not because the shared-policy convergence regressed. Once Task 6
 * lands, add:
 *   it("addFirstTrackedProduct is gone (its always-insert contradicted the policy)", () => {
 *     expect(() => readFileSync(resolve(process.cwd(), "lib/app/add-first-product.ts"), "utf8")).toThrow();
 *   });
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CALLERS = ["app/api/scan/route.ts", "lib/app/add-product.ts"];

describe("single product-resolution policy (ratchet)", () => {
  for (const rel of CALLERS) {
    it(`${rel} resolves products through resolveProductScan`, () => {
      const src = readFileSync(resolve(process.cwd(), rel), "utf8");
      expect(src, `${rel} must use resolveProductScan — never its own dedupe/staleness logic`).toMatch(/resolveProductScan/);
    });
  }
});
