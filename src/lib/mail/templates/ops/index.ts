// The owner's spend alert — §6.5's ceilings, and the switch, reported.
//
// One directory per mail kind, named for the kind (ADR-040), holding a
// block list and nothing else: no shell, no formatter, no vendor
// knowledge, no sentence of its own.
//
// Four occasions, one shape. Which line is spoken is the only thing that
// varies, so the occasion is a parameter and never a branch in the caller:
// `buildSpendCeilingAlert({ occasion, spentCents, ceilingCents })` and the
// map below is the whole of the difference between them.
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

/** What happened. The two spend crossings are `SpendCrossing`'s own names
 *  (`src/lib/costs/daily.ts`); the third is the kill switch found engaged.
 *  There is no `kill-switch-released` arm, and it is not an omission: a
 *  release cannot be told from an ordinary boot without somewhere to
 *  remember what the last process saw (`src/jobs/kill-switch.ts`). */
export type OpsOccasion = "warn" | "reached" | "kill-switch-engaged";

const BODY: Readonly<Record<OpsOccasion, CopyKey>> = Object.freeze({
  warn: "mail.ops.spend-ceiling.warn",
  reached: "mail.ops.spend-ceiling.reached",
  "kill-switch-engaged": "mail.ops.spend-ceiling.kill-switch-engaged",
});

export interface OpsAlertMail {
  readonly subject: CopyKey;
  readonly blocks: readonly MailBlock[];
}

export function buildSpendCeilingAlert(a: {
  occasion: OpsOccasion;
  spentCents: number;
  ceilingCents: number;
}): OpsAlertMail {
  return {
    subject: SUBJECT,
    blocks: [
      { block: "heading", text: HEADING },
      { block: "paragraph", text: BODY[a.occasion] },
      {
        block: "facts",
        items: [
          { label: FACT_SPENT, value: String(Math.round(a.spentCents)) },
          { label: FACT_CEILING, value: String(Math.round(a.ceilingCents)) },
        ],
      },
    ],
  };
}
