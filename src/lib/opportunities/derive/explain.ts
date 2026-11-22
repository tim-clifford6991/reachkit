// SPEC §7 *Why this page*: the handles and values stored at creation that fill the day panel's copy keys. Nothing is
// recomputed, so the panel says why the page was chosen then, not what the market looks like now.
import { opportunityStore, readOpportunity } from "../store";
import type { Acceptance, BusinessFit, Evidence, Family, Opportunity, OpportunityType, PlanReason, Winnability } from "../types";

export interface Choice {
  opportunityId: string;
  type: OpportunityType;
  family: Family;
  /** Null only for `unblock`. */
  fitBand: Winnability | null;
  /** SPEC §0 business fit, as the pass judged it; absent or `null` where
   *  no pass has (issue 1395). */
  businessFit?: BusinessFit | null;
  acceptance: Acceptance;
  evidence: Evidence;
  /** Why the committed week placed it; `null` where no commit holds it. */
  planReason?: PlanReason | null;
}

/** `null` where no such opportunity exists — a day panel asking about a
 *  row that has been purged reads "we have nothing to show", never a
 *  thrown error on a read path. */
export async function explainChoice(opportunityId: string): Promise<Choice | null> {
  const row = await opportunityStore().byId(opportunityId);
  return row === null ? null : choiceOf(readOpportunity(row));
}

/** The same account of a row already read, so a screen holding the row reads it no second time. */
export function choiceOf(opportunity: Opportunity): Choice {
  return {
    opportunityId: opportunity.id,
    type: opportunity.type,
    family: opportunity.family,
    fitBand: opportunity.fitBand,
    businessFit: opportunity.businessFit ?? null,
    acceptance: opportunity.acceptance,
    evidence: opportunity.evidence,
    planReason: opportunity.planReason ?? null,
  };
}
