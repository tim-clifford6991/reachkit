// BUILD §7 — one opportunity, read the way a day's page reads it.
//
// The day's page itself is the committed week's (`plan.ts`, issue 1559).
import { opportunityStore, readOpportunity } from "./store";
import type { Opportunity } from "./types";

/** One opportunity by id — for a draft the customer restarted, which is
 *  written again for the opportunity it was written for (#788). */
export async function opportunityById(opportunityId: string): Promise<Opportunity | null> {
  const row = await opportunityStore().byId(opportunityId);
  return row === null ? null : readOpportunity(row);
}
