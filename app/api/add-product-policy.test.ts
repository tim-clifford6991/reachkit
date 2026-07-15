/**
 * ONE product-resolution policy (spec 2026-07-15). `/api/scan` and the in-app add
 * MUST both ask `resolveProductScan`. They disagreed before — /api/scan
 * find-or-created while addFirstTrackedProduct always inserted — and that
 * disagreement produced nudgi.ai's incoherent state (paid dashboard over an
 * anonymous free scan). Source tripwire, same idiom as costed-routes.test.ts.
 *
 * Both assertions below go through `expectCallsSymbol` (lib/testing/tripwire.ts)
 * rather than a hand-rolled whole-file `toMatch`. A whole-file substring check
 * is vacuous by construction here: `lib/app/add-product.ts` is where
 * `resolveProductScan` is DEFINED (`export async function resolveProductScan(...)`),
 * so /resolveProductScan/ matches that file no matter what `addTrackedProduct`
 * actually does — mutation-proved (Finding 4, code review 2026-07-15): removing
 * the real `resolveProductScan(...)` CALL from route.ts's POST handler and
 * leaving only the import still passed the old whole-file check 3/3.
 * `expectCallsSymbol` closes this structurally: it refuses to assert against a
 * file that defines the symbol unless scoped with `within`, and `within` isolates
 * just that one function's own brace-matched body (comments/strings blanked), so
 * neither the definition line nor a stray import/comment elsewhere in the file
 * can satisfy it.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expectCallsSymbol } from "@/lib/testing/tripwire";

const ROUTE_FILE = "app/api/scan/route.ts";
const ADD_PRODUCT_FILE = "lib/app/add-product.ts";

describe("single product-resolution policy (ratchet)", () => {
  it(`${ROUTE_FILE}: POST's body calls resolveProductScan(...)`, () => {
    expect(() => expectCallsSymbol(ROUTE_FILE, "resolveProductScan", { within: "POST" })).not.toThrow();
  });

  it(`${ADD_PRODUCT_FILE}: addTrackedProduct's body calls resolveProductScan(...)`, () => {
    expect(() => expectCallsSymbol(ADD_PRODUCT_FILE, "resolveProductScan", { within: "addTrackedProduct" })).not.toThrow();
  });

  it("addFirstTrackedProduct is gone (its always-insert contradicted the policy)", () => {
    expect(() => readFileSync(resolve(process.cwd(), "lib/app/add-first-product.ts"), "utf8")).toThrow();
  });
});
