// The owner's spend alert — §6.5's ceilings and the kill switch, as a block list only (ADR-040). Five occasions, one shape: the occasion picks the line.
// A site cap or a free-path bound gets a third fact row naming whose ceiling it was, as a closed value; never a network key or a domain.
// The cent figures are fact-row values (data) under the owner's keyed labels, so no unit or currency is invented here.
// The kill-switch alert carries the day's two figures too: what was spent when it moved is the context the owner wants.
import type { CopyKey } from "@/lib/presentation/copy";
import type { MailBlock } from "../../blocks/types";

const SUBJECT = "mail.ops.spend-ceiling.subject" satisfies CopyKey;
const HEADING = "mail.ops.spend-ceiling.heading" satisfies CopyKey;
const FACT_SPENT = "mail.ops.spend-ceiling.fact.spent" satisfies CopyKey;
const FACT_CEILING = "mail.ops.spend-ceiling.fact.ceiling" satisfies CopyKey;
const FACT_SITE = "mail.ops.spend-ceiling.fact.site" satisfies CopyKey;
const FACT_BOUND = "mail.ops.spend-ceiling.fact.bound" satisfies CopyKey;

/** What happened. There is no `kill-switch-released`: a release cannot be told from a boot without remembered state (`src/jobs/kill-switch.ts`). */
export type OpsOccasion =
  | "warn"
  | "reached"
  /** One site reached its own cap; the product still serves everybody else. */
  | "site-reached"
  /** A free-path bound filled: one network's day, or one address's. */
  | "free-scan-bound"
  | "kill-switch-engaged";

const BODY: Readonly<Record<OpsOccasion, CopyKey>> = Object.freeze({
  warn: "mail.ops.spend-ceiling.warn",
  reached: "mail.ops.spend-ceiling.reached",
  "site-reached": "mail.ops.spend-ceiling.site-reached",
  "free-scan-bound": "mail.ops.spend-ceiling.free-scan-bound",
  "kill-switch-engaged": "mail.ops.spend-ceiling.kill-switch-engaged",
});

/** A non-product occasion's subject: a site UUID or `unknown`, or one of `src/lib/costs/daily.ts`'s two bound words. */
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
  /** Whose ceiling, where it is not the product's. */
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
