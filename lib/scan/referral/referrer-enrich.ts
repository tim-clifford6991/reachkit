/**
 * Enriches quality referrers with "platform reach" (the referring host's own
 * organic ETV — how big the venue is, NOT measured click-through to the rival)
 * and a borderline-relevance flag. Reach comes from fetchTrafficForHosts; a host
 * missing from the map keeps etv = null (we never invent a number).
 */
/** Structural mirror of funnel.ts's QualityReferrer (host/authority in, etv/relevance
 *  out) — defined locally, NOT imported from funnel.ts, to avoid a circular
 *  dependency (funnel.ts imports this module for the bulk-reach wiring). */
interface ReferrerLike {
  host: string;
  authority?: number | null;
  etv?: number | null;
  relevance?: "core" | "low";
}

/** A referrer with near-zero reach AND weak authority is marginal → "low". */
export const REACH_FLOOR = 100;      // monthly organic visits
export const AUTHORITY_FLOOR = 150;  // domain_from_rank (0–1000)

export function enrichReferrers<T extends ReferrerLike>(
  refs: T[],
  reach: Map<string, number>,
): T[] {
  return refs.map((r) => {
    const etv = reach.has(r.host) ? (reach.get(r.host) ?? 0) : null;
    const weakReach = (etv ?? 0) < REACH_FLOOR;
    const weakAuthority = (r.authority ?? 0) < AUTHORITY_FLOOR;
    const relevance: ReferrerLike["relevance"] = weakReach && weakAuthority ? "low" : "core";
    return { ...r, etv, relevance };
  });
}
