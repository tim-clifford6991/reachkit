// The owner's spend alert — §6.5's ceilings and the kill switch, as a block list only (ADR-040). One shape: the occasion picks the line.
// Only a refused spend is told at once; a warning and a free-path bound are digest rows.
// A site cap gets a third fact row naming whose ceiling it was, as a closed value; never a domain.
// The cent figures are fact-row values (data) under the owner's keyed labels, so no unit or currency is invented here.
// The kill-switch alert carries the day's two figures too: what was spent when it moved is the context the owner wants.
// An unreadable ledger carries no figures: a spend nobody could read is never written as one.
import type { CopyKey } from "@/lib/presentation/copy";
import type { FactRow, MailBlock } from "../../blocks/types";

const SUBJECT = "mail.ops.spend-ceiling.subject" satisfies CopyKey;
const HEADING = "mail.ops.spend-ceiling.heading" satisfies CopyKey;
const FACT_SPENT = "mail.ops.spend-ceiling.fact.spent" satisfies CopyKey;
const FACT_CEILING = "mail.ops.spend-ceiling.fact.ceiling" satisfies CopyKey;
const FACT_SITE = "mail.ops.spend-ceiling.fact.site" satisfies CopyKey;

/** What happened. There is no `kill-switch-released`: a release cannot be told from a boot without remembered state (`src/jobs/kill-switch.ts`). */
export type OpsOccasion =
  | "warn"
  | "reached"
  /** One site reached its own cap; the product still serves everybody else. */
  | "site-reached"
  /** A free-path bound filled: one network's day, or one address's. */
  | "free-scan-bound"
  | "kill-switch-engaged"
  /** A spend ledger could not be read, so the calls it guards are refused. */
  | "ledger-unreadable";

/** Each occasion's place: its line, told at once, or the digest. */
const ROUTE: Readonly<Record<OpsOccasion, CopyKey | "digest">> = Object.freeze({
  warn: "digest",
  reached: "mail.ops.spend-ceiling.reached",
  "site-reached": "mail.ops.spend-ceiling.site-reached",
  "free-scan-bound": "digest",
  "kill-switch-engaged": "mail.ops.spend-ceiling.kill-switch-engaged",
  "ledger-unreadable": "mail.ops.spend-ceiling.ledger-unreadable",
});

/** A non-product occasion's subject: a site UUID or `unknown`, or one of `src/lib/costs/daily.ts`'s two bound words. */
export type OpsSubject =
  | { readonly kind: "site"; readonly siteId: string }
  | { readonly kind: "free-scan"; readonly bound: "network-day" | "domain-day" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface OpsAlertMail {
  readonly subject: CopyKey;
  readonly blocks: readonly MailBlock[];
}

export type SpendAlertInput =
  | {
      occasion: Exclude<OpsOccasion, "ledger-unreadable">;
      spentCents: number;
      ceilingCents: number;
      /** Whose ceiling, where it is not the product's. */
      subject?: OpsSubject;
    }
  /** `reason` is `<ledger>/<cause>`, both closed words from `src/lib/costs/daily.ts`. */
  | { occasion: "ledger-unreadable"; reason: string };

/** The mail told at once, or `null` where the occasion waits for the digest. */
export function buildSpendCeilingAlert(a: SpendAlertInput): OpsAlertMail | null {
  const line = ROUTE[a.occasion];
  if (line === "digest") return null;
  const heading = { block: "heading", text: HEADING } as const;
  if (a.occasion === "ledger-unreadable") return { subject: SUBJECT, blocks: [heading, { block: "paragraph", text: line, vars: { reason: a.reason } }] };
  const site: FactRow[] = a.subject?.kind === "site" ? [{ label: FACT_SITE, value: UUID_RE.test(a.subject.siteId) ? a.subject.siteId : "unknown" }] : [];
  return {
    subject: SUBJECT,
    blocks: [
      heading,
      { block: "paragraph", text: line },
      {
        block: "facts",
        items: [...site, { label: FACT_SPENT, value: String(Math.round(a.spentCents)) }, { label: FACT_CEILING, value: String(Math.round(a.ceilingCents)) }],
      },
    ],
  };
}

export { buildIncidentAlert, buildOwnerDigest, closedName, type AtOnce, type DigestLine, type MarketWeek, type OpsIncident } from "./incident";
