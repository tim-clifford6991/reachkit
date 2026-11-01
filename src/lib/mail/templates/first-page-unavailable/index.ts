// BUILD §4.2 — REQ-010 criterion 7's written statement that no page is coming, and why. Unstoppable: it closes the founder's request.
// No `pageBody` arm at all, so a half-written page never arrives wearing an apology. The cause arrives as a `CopyKey` from
// `leads/giveaway.ts`'s map, which the report also reads. Read ADR-041 before removing the opt-out: it stops what comes next.
import type { CopyKey } from "@/lib/presentation/copy";
import { optOutControlFor, type LeadMail } from "../first-page";

/** Named once, so the string-literal sweep never reads a key field as a written sentence. */
const SUBJECT = "mail.firstPageUnavailable.subject" satisfies CopyKey;
const PREHEADER = "mail.firstPageUnavailable.preheader" satisfies CopyKey;

export function buildFirstPageUnavailable(a: {
  email: string;
  causeLine: CopyKey;
}): LeadMail {
  return {
    subject: SUBJECT,
    preheader: PREHEADER,
    blocks: [{ block: "notice", text: a.causeLine }],
    optOut: optOutControlFor(a.email),
  };
}
