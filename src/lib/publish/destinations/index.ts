// BUILD §9 — the destination registry, and the one health read the machine
// makes.
//
// The registry is a closed map from `destinations.kind` to the adapter that
// serves it. A kind with no adapter resolves to `null`, and `publish()`
// turns that into the `no_destination` failure — never into a guess, and
// never into an adapter that silently does nothing.
//
// The adapters themselves are their own issues: hosted is #49, WordPress is
// #54, and the connect/disconnect/health lifecycle (including
// `destinations.deleted_at` and ADR-086's `HealthReason`) is #48. This file
// holds the seam and nothing more.
import { publishDb } from "../db";
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

export interface DestinationRow {
  id: string;
  kind: DestinationKind;
  health: "ok" | "expired" | "error";
  config: Readonly<Record<string, unknown>>;
}

/**
 * The site's destination of a kind, read fresh.
 *
 * Read inside the claim rather than cached: §9 makes an expired credential
 * a state the queue holds against, and a stale health reading is exactly
 * how a page goes out to a destination that had already stopped working.
 */
export async function destinationOf(
  siteId: string,
  kind: DestinationKind
): Promise<DestinationRow | null> {
  const { data, error } = await publishDb()
    .from<DestinationRow>("destinations")
    .select("id, kind, health, config")
    .eq("site_id", siteId)
    .eq("kind", kind)
    .limit(1);
  if (error !== null || data === null) return null;
  const [row] = data;
  return row ?? null;
}

/**
 * The `destination_working` guard's fact: the site has a destination and it
 * is healthy.
 *
 * `health = 'ok'` is the whole test. A destination row that is soft-deleted
 * is #48's column and is not read here; when it lands, this predicate gains
 * the clause and every caller is unchanged.
 */
export async function destinationWorking(siteId: string): Promise<boolean> {
  const { data, error } = await publishDb()
    .from<{ id: string }>("destinations")
    .select("id, health")
    .eq("site_id", siteId)
    .eq("health", "ok")
    .limit(1);
  if (error !== null || data === null) return false;
  return data.length > 0;
}
