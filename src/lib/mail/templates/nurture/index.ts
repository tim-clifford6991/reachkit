// BUILD §4.2 — the three touches, and the third is the last.
//
// Max three mails per domain per address, at 24h, 72h and 168h from the
// sequence's start, stopping on conversion or opt-out. Each touch is its
// own pair of keys — a subject and a line — indexed by the touch number, so
// which touch this is is carried by the **type**, not by a conditional
// inside the template. There is no fourth entry in either tuple, so a
// fourth touch does not compile.
//
// `nurture` is the one lead-directed kind whose register row says
// `stoppable: 'opt-out'`: the send seam consults the address-wide
// suppression store immediately before the vendor call, and this is the
// mail that store exists to stop.
import { env } from "@/lib/config/env";
import type { CopyKey } from "@/lib/presentation/copy";
import { optOutControlFor, type LeadMail } from "../first-page";

const ACTION = "mail.nurture.action" satisfies CopyKey;
const REASON = "mail.reason.nurture" satisfies CopyKey;

/** The one offer page (§3, S4). Absolute, because a mail client resolves no
 *  relative path — the same construction `draft-ready` uses for its veto
 *  link, reading the one binding `env.ts` validates at boot. */
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
      { block: "paragraph", text: BODIES[index] as CopyKey, vars: { domain: a.domain } },
      // S20 draws one solid button on the nurture mail and it is the
      // offer. The heading and the body stay the owner's — every nurture
      // string the set draws is bracketed — so this is the one sentence
      // this kind speaks that 11a approves.
      { block: "action", label: ACTION, href: offerHref() },
    ],
    optOut: optOutControlFor(a.email),
  };
}
