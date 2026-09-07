// BUILD §4.6, REQ-071 c11 — the held day's two slots, filled from the
// engine and from the registry.
//
// **`{change}` is never the engine's own handle.** `generationHold()`
// answers `because: 'domain' | 'category'` — internal names, and REQ-071's
// line reads that value out to a customer. So each kind has a registry key
// of its own and the slot carries the owner's word for it, not ours. A
// screen that interpolated `because` would be inventing copy out of a
// discriminant, which is the copy law's own case.
//
// **`{date}` is `resumesOn`, formatted and not computed.** The date pages
// resume is the pass that adopts the change, and `effectiveOn()` derived it
// in the customer's own zone before it ever reached this module.
import type { CopyKey } from "@/lib/presentation/copy";

/** One key per held answer. A third change kind is a compile error here
 *  rather than a slot filled with a raw handle. */
export const CHANGE_COPY_KEY: Readonly<Record<"domain" | "category", CopyKey>> = Object.freeze({
  domain: "settings.market.change.domain",
  category: "settings.market.change.category",
});
