// BUILD §7 — why this page exists.
//
// §4.6's day panel prints a "Why this page" block, and its five rows are
// copy keys (`calendar.why.*`). This is what fills them: handles and the
// values stored at creation, and not one sentence — the words are the
// registry's, and a module that composed one here would be the second
// place the product speaks.
//
// **Nothing is recomputed.** No volume is refreshed, no band is
// re-derived, no position is re-measured. The evidence was copied off the
// scan at creation with its own dates, so the panel still reads correctly
// after the next weekly measurement has moved every one of those numbers —
// which is the point: the explanation is why this page was chosen *then*,
// not what the market looks like now.
import { opportunityStore, readOpportunity } from "../store";
import type { Acceptance, Evidence, Family, OpportunityType, Winnability } from "../types";

export interface Choice {
  opportunityId: string;
  type: OpportunityType;
  family: Family;
  /** Null only for `unblock`. */
  fitBand: Winnability | null;
  acceptance: Acceptance;
  evidence: Evidence;
}

/** `null` where no such opportunity exists — a day panel asking about a
 *  row that has been purged reads "we have nothing to show", never a
 *  thrown error on a read path. */
export async function explainChoice(opportunityId: string): Promise<Choice | null> {
  const row = await opportunityStore().byId(opportunityId);
  if (row === null) return null;
  const opportunity = readOpportunity(row);
  return {
    opportunityId: opportunity.id,
    type: opportunity.type,
    family: opportunity.family,
    fitBand: opportunity.fitBand,
    acceptance: opportunity.acceptance,
    evidence: opportunity.evidence,
  };
}
