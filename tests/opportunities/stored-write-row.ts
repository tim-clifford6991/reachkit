// A Write row as stored before rivals left sources out, naming `rivalDomain`.
import type { OpportunityRow } from "@/lib/opportunities/store";

export const AT = "2026-10-20T09:00:00.000Z";

export function storedWriteRow(rivalDomain: string, id = "opp-1"): OpportunityRow {
  return {
    id,
    site_id: "site-1",
    scan_id: "scan-1",
    type: "write",
    family: "write",
    target_query: "sourdough bakery",
    target_ref: "sourdough bakery",
    proposed_slug: null,
    title: null,
    volume: 320,
    evidence: {
      family: "write",
      query: "sourdough bakery",
      volume: { kind: "measured", value: 320, at: AT },
      rival: {
        domain: rivalDomain,
        url: { kind: "measured", value: `https://${rivalDomain}/`, at: AT },
        position: { kind: "measured", value: 2, at: AT },
      },
    },
    acceptance: { form: "top20", query: "sourdough bakery" },
    fit_band: "now",
    effort: 1,
    status: "open",
    cluster_key: null,
    absorbed_queries: [],
    ready: true,
    unready_reason: null,
    created_at: AT,
  };
}
