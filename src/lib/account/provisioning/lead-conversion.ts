// src/lib/account/provisioning/lead-conversion.ts — BUILD §13
//
// §13: "stamp lead converted". Two things happen when a lead becomes a
// customer, and they are two mechanisms rather than one (ADR-042):
//
//   · `leads.converted_at` is stamped — the fact that this address bought.
//   · The address is suppressed with cause `subscribed` — so the nurture
//     sequence, which exists to persuade somebody to buy, stops writing to
//     somebody who has.
//
// The suppression goes through `suppressAddress`, the leads feature's own
// exported seam, and this file writes no `leads` row of its own: `leads` is
// BP-029's migration topic and stamping one column through the store is the
// whole of what §13 asks for here.
//
// **Neither failure stops provisioning.** A founder's account must not fail
// to open because a nurture sequence could not be stopped. Both outcomes
// are reported back and neither throws.
import { suppressAddress } from "@/lib/mail/leads";
import { accountStore } from "../store";

export interface ConversionOutcome {
  readonly stamped: number;
  readonly suppressed: boolean;
}

export async function convertLead(email: string, at: Date): Promise<ConversionOutcome> {
  const stampedRead = await accountStore().stampLeadConverted(email, at);
  const suppression = await suppressAddress(email, "subscribed");
  const outcome: ConversionOutcome = {
    stamped: stampedRead.ok ? stampedRead.stamped : 0,
    suppressed: suppression.suppressed,
  };
  console.log(JSON.stringify({ event: "lead_converted", ...outcome }));
  return outcome;
}
