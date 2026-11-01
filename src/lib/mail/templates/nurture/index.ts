// BUILD §4.2 — at most three touches a domain per address, at 24h, 72h and 168h, stopping on conversion or opt-out.
// Each touch's subject and line are indexed by a touch-number type with no fourth entry, so a fourth touch does not compile.
// The one lead kind registered `stoppable: 'opt-out'`: the address-wide suppression store exists to stop this mail.
import { WEEK_PLAN } from "@/lib/config/constants";
import { env } from "@/lib/config/env";
import type { CopyKey } from "@/lib/presentation/copy";
import { optOutControlFor, type LeadMail } from "../first-page";

const ACTION = "mail.nurture.action" satisfies CopyKey;
const REASON = "mail.reason.nurture" satisfies CopyKey;

/** The offer page (§3, S4), absolute from the boot-validated binding: an inbox resolves no relative path. */
function offerHref(): string {
  return new URL("/pricing", env.NEXT_PUBLIC_APP_URL).toString();
}

/** 1, 2 or 3 — REQ-010 c9's "at most three", stated as a type. */
export type NurtureTouch = 1 | 2 | 3;

const SUBJECTS: readonly [CopyKey, CopyKey, CopyKey] = [
  "mail.nurture.subject.1",
  "mail.nurture.subject.2",
  "mail.nurture.subject.3",
];

const BODIES: readonly [CopyKey, CopyKey, CopyKey] = [
  "mail.nurture.body.1",
  "mail.nurture.body.2",
  "mail.nurture.body.3",
];

export function buildNurture(a: {
  email: string;
  domain: string;
  touch: NurtureTouch;
}): LeadMail {
  const index = a.touch - 1;
  return {
    subject: SUBJECTS[index] as CopyKey,
    reason: REASON,
    blocks: [
      // Opens on its subject line, so the inbox row and the mail's first line cannot differ.
      { block: "heading", text: SUBJECTS[index] as CopyKey },
      { block: "paragraph", text: BODIES[index] as CopyKey, vars: { domain: a.domain, weekPages: String(WEEK_PLAN.days) } },
      // S20's one solid button on this mail is the offer.
      { block: "action", label: ACTION, href: offerHref() },
    ],
    optOut: optOutControlFor(a.email),
  };
}
