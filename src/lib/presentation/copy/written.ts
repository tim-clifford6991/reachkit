// src/lib/presentation/copy/written.ts — BP-020 (issue #19)
//
// One predicate: has the owner written this sentence yet?
//
// `copy()` throws on an owner-owed key, by design (BP-020 step 6a) — a blank
// sentence must never reach a screen. A surface that carries a line the
// owner has not written yet therefore needs to ask before it speaks, or it
// cannot render at all. That question is asked here, once, rather than by
// each surface reaching past the barrel into `registry.ts` for `OWNER_OWED`.
//
// It is answered from `COPY` alone, which is the same fact `OWNER_OWED` is
// derived from ("a key is owner-owed exactly when its value is the empty
// string", `registry.ts`), so the two cannot drift apart.
//
// This is not a fallback and mints no string: a key this returns `false` for
// is a line the surface leaves unsaid — and says so in its pull request —
// until the owner writes it, at which point the surface speaks it with no
// code change.
import { COPY, type CopyKey } from "./registry.ts";

export function isWritten(key: CopyKey): boolean {
  return COPY[key] !== "";
}
