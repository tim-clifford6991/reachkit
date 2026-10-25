// BUILD §9 — the closed map from `destinations.kind` to its adapter.
// Its own file (ADR-092) because `health/` resolves an adapter and `index.ts` calls `health/`: here both imports run one way.
import type { DestinationAdapter, DestinationKind } from "../types";
import { HOSTED_ADAPTER } from "./hosted";
import { WORDPRESS_ADAPTER } from "./wordpress/adapter";

/** Closed: a kind absent from it resolves to `null`, which holds a page rather than sending it somewhere nobody chose.
 *  §10's `destinations.kind` enum has two values, and this map has both. */
const REGISTRY: Readonly<Partial<Record<DestinationKind, DestinationAdapter>>> = Object.freeze({
  hosted: HOSTED_ADAPTER,
  wordpress: WORDPRESS_ADAPTER,
});

/** The adapter for a kind, or `null` where this build has none. */
export function adapterFor(kind: DestinationKind): DestinationAdapter | null {
  return REGISTRY[kind] ?? null;
}
