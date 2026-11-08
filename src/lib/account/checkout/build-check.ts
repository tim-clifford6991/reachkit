// src/lib/account/checkout/build-check.ts — BUILD §13
//
// ADR-052's third point, run by the production build (`scripts/check-price.mjs`, npm's `prebuild`) rather than at every
// boot: a crossed price fails the build, so it never reaches READY and the last good deployment keeps serving.

/** What the build is told. Every field is a name from a closed set or a mismatch message, never a binding's value. */
export type PriceCheck =
  | { readonly outcome: "checked" }
  | { readonly outcome: "unchecked"; readonly reason: string }
  | { readonly outcome: "refused"; readonly reason: string; readonly message: string };

/** Refused on a price the spec does not describe or the vendor says does not exist; a vendor that could not be read,
 *  or bindings that do not parse, establish nothing and are `unchecked`. */
export async function checkPriceForBuild(): Promise<PriceCheck> {
  let spec: typeof import("./price-object") | undefined;
  try {
    spec = await import("./price-object");
    await spec.assertLivePriceMatchesSpec();
  } catch (error) {
    if (spec !== undefined && (error instanceof spec.PriceObjectMismatch || error instanceof spec.PriceObjectUnknown)) {
      return { outcome: "refused", reason: error.name, message: error.message };
    }
    return { outcome: "unchecked", reason: error instanceof Error ? error.name : "unknown" };
  }
  return { outcome: "checked" };
}
