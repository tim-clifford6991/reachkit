// BUILD §9 — the closed map from `destinations.kind` to its adapter.
//
// Its own file rather than a section of `index.ts` (ADR-092: the cycle is
// broken at file granularity, never by deleting a true dependency).
// `health/` must resolve an adapter, and `index.ts` must call `health/` to
// keep the read path's freshness promise; with `adapterFor` living here,
// both are ordinary one-way imports and neither module has to be folded
// into the other. `index.ts` re-exports it, so every caller's spelling is
// unchanged.
import type { DestinationAdapter, DestinationKind } from "../types";
import { HOSTED_ADAPTER } from "./hosted";

/** Every adapter this build carries. WordPress is absent, not stubbed: an
 *  adapter that exists is one `adapterFor` hands to `deliver`, and there is
 *  nothing yet to hand (#54). */
const REGISTRY: Readonly<Partial<Record<DestinationKind, DestinationAdapter>>> = Object.freeze({
  hosted: HOSTED_ADAPTER,
});

/** The adapter for a kind, or `null` where this build has none. */
export function adapterFor(kind: DestinationKind): DestinationAdapter | null {
  return REGISTRY[kind] ?? null;
}
