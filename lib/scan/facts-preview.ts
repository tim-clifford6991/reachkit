import type { PreliminaryFacts } from "@/lib/scan/types";

/**
 * The ONLY facts a public `scan_events` "facts" broadcast may carry.
 *
 * `/api/scan/[id]/stream` is unauthenticated and replays every scan_event by id,
 * so whatever we persist here is world-readable to anyone holding the scan id —
 * including a paid (`tier=full`) scan's. The full `PreliminaryFacts` (listing
 * description/pricing, every competitor URL, webProxy traffic estimates, themes,
 * sources) must NEVER cross this boundary — the "paywall hid it, the API didn't"
 * class (invariant #12). The full facts remain on `scans.preliminary_facts` for
 * authenticated pipeline steps; this is the redaction for the public wire.
 *
 * Scoped to exactly what the progress UI renders (`scan-stream.tsx`): mode,
 * listing.name, reviewVolume, and competitors.length (an empty-object array of
 * the right length — never a name or url on the free progress surface).
 */
export function scopeFactsForStream(facts: PreliminaryFacts): Record<string, unknown> {
  // Defensive: this runs on the scan critical path (a throw here would fail the
  // whole scan), and it is a REDACTION boundary — the safe failure is to emit less,
  // never to crash or leak. So null-coalesce every field rather than assume shape.
  return {
    mode: facts.mode ?? null,
    listing: { name: facts.listing?.name ?? null },
    reviewVolume: facts.reviewVolume ?? 0,
    competitors: (facts.competitors ?? []).map(() => ({})),
  };
}
