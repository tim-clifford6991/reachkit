// The owner's spend alert — §6.5's ceilings, and the switch, reported.
//
// One directory per mail kind, named for the kind (ADR-040), holding a
// block list and nothing else: no shell, no formatter, no vendor
// knowledge, no sentence of its own.
//
// Five occasions, one shape. Which line is spoken is the only thing that
// varies, so the occasion is a parameter and never a branch in the caller:
// `buildSpendCeilingAlert({ occasion, spentCents, ceilingCents })` and the
// map below is the whole of the difference between them.
//
// **Two of the five are not the product's ceiling (issue 885), and the
// owner cannot act on either without knowing whose it was.** So a third
// fact row is drawn where the alert names a subject: the site's id, or the
// free-path bound that filled. A site id is a closed value — a UUID, or
// `unknown` — and a bound is one of two fixed words. Neither the network
// key nor the domain is ever written into this mail, the same rule
// `./incident` keeps for the same reason.
//
// **The figures are values, not sentences.** A fact row's `value` is the
// one field in a mail that carries a written string rather than a key
// (`blocks/types.ts`), because it is data — here, two cent figures. They
// are passed as integers rendered plainly and the *label* is the owner's
// key, so no unit, symbol or currency is invented here.
//
// The kill-switch occasion carries the same two figures. The switch stops
// scanning, generating and publishing (§11), so what the day had spent
// when it moved is exactly the context the owner wants beside it — and the
// two rows are already the ones this mail draws.
import type { CopyKey } from "@/lib/presentation/copy";
import type { MailBlock } from "../../blocks/types";

const SUBJECT = "mail.ops.spend-ceiling.subject" satisfies CopyKey;
const HEADING = "mail.ops.spend-ceiling.heading" satisfies CopyKey;
const FACT_SPENT = "mail.ops.spend-ceiling.fact.spent" satisfies CopyKey;
const FACT_CEILING = "mail.ops.spend-ceiling.fact.ceiling" satisfies CopyKey;
const FACT_SITE = "mail.ops.spend-ceiling.fact.site" satisfies CopyKey;
const FACT_BOUND = "mail.ops.spend-ceiling.fact.bound" satisfies CopyKey;

/** What happened. The two spend crossings are `SpendCrossing`'s own names
 *  (`src/lib/costs/daily.ts`); the third is the kill switch found engaged.
 *  There is no `kill-switch-released` arm, and it is not an omission: a
 *  release cannot be told from an ordinary boot without somewhere to
 *  remember what the last process saw (`src/jobs/kill-switch.ts`). */
export type OpsOccasion =
  | "warn"
  | "reached"
  /** Issue 885 — one site reached its own cap. Its own line, because what
   *  it means is the opposite of `reached`: the product is still serving
   *  everybody else. */
  | "site-reached"
  /** Issue 885 — a free-path bound filled: one network's day, or one
   *  address's. */
  | "free-scan-bound"
  | "kill-switch-engaged";

const BODY: Readonly<Record<OpsOccasion, CopyKey>> = Object.freeze({
  warn: "mail.ops.spend-ceiling.warn",
  reached: "mail.ops.spend-ceiling.reached",
  "site-reached": "mail.ops.spend-ceiling.site-reached",
  "free-scan-bound": "mail.ops.spend-ceiling.free-scan-bound",
  "kill-switch-engaged": "mail.ops.spend-ceiling.kill-switch-engaged",
});

/** The subject a non-product occasion names, as a closed value. A site is
 *  a UUID or `unknown`; a bound is one of the two words
 *  `src/lib/costs/daily.ts` declares. */
export type OpsSubject =
  | { readonly kind: "site"; readonly siteId: string }
  | { readonly kind: "free-scan"; readonly bound: "network-day" | "domain-day" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function subjectFact(subject: OpsSubject): { label: CopyKey; value: string } {
  if (subject.kind === "site") {
    return { label: FACT_SITE, value: UUID_RE.test(subject.siteId) ? subject.siteId : "unknown" };
  }
  return {
    label: FACT_BOUND,
    value: subject.bound === "network-day" || subject.bound === "domain-day" ? subject.bound : "unknown",
  };
}

export interface OpsAlertMail {
  readonly subject: CopyKey;
  readonly blocks: readonly MailBlock[];
}

export function buildSpendCeilingAlert(a: {
  occasion: OpsOccasion;
  spentCents: number;
  ceilingCents: number;
  /** Whose ceiling, where it is not the product's (issue 885). */
  subject?: OpsSubject;
}): OpsAlertMail {
  return {
    subject: SUBJECT,
    blocks: [
      { block: "heading", text: HEADING },
      { block: "paragraph", text: BODY[a.occasion] },
      {
        block: "facts",
        items: [
          ...(a.subject === undefined ? [] : [subjectFact(a.subject)]),
          { label: FACT_SPENT, value: String(Math.round(a.spentCents)) },
          { label: FACT_CEILING, value: String(Math.round(a.ceilingCents)) },
        ],
      },
    ],
  };
}

export { buildIncidentAlert, closedName, type OpsIncident } from "./incident";
