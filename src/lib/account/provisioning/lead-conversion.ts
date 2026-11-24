// src/lib/account/provisioning/lead-conversion.ts — BUILD §13
//
// §13: "stamp lead converted". `leads.converted_at` is the one fact that this
// address bought; the nurture sequence reads it and stops, so no suppression
// row is written for a customer (a sign-in mail must never read one as a refusal).
//
// **A failure does not stop provisioning.** A founder's account must not fail
// to open because a lead could not be stamped; the outcome is reported and nothing throws.
import { accountStore } from "../store";

export interface ConversionOutcome {
  readonly stamped: number;
}

export async function convertLead(email: string, at: Date): Promise<ConversionOutcome> {
  const stampedRead = await accountStore().stampLeadConverted(email, at);
  const outcome: ConversionOutcome = { stamped: stampedRead.ok ? stampedRead.stamped : 0 };
  console.log(JSON.stringify({ event: "lead_converted", ...outcome }));
  return outcome;
}
