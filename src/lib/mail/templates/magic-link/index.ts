// BUILD §13 — the sign-in link a completed payment sends.
//
// One directory per mail kind, named for the kind (ADR-040): a block list
// and nothing else. No shell, no formatter, no vendor knowledge, no
// conditional and no sentence of its own.
//
// **No opt-out control, and that is not an oversight.** On magic-link auth
// this mail *is* the credential. ADR-042 exists because an address-wide
// unsubscribe that reached `magic-link` would lock a paying customer out of
// the product with no recovery channel — the register row says
// `stoppable: false`, the send seam therefore asks no store, and this
// template carries no way to stop the one mail that is the way back in.
//
// The link arrives already built. This template does not know how a token
// is made, how long it lives or where it is redeemed — that is issue #35's
// — and it cannot compose itself without one, which is why `href` is a
// required field rather than an optional that could quietly render an
// action pointing nowhere.
import type { CopyKey } from "@/lib/presentation/copy";
import type { MailBlock } from "../../blocks/types";

const SUBJECT = "mail.magicLink.subject" satisfies CopyKey;
const HEADING = "mail.magicLink.heading" satisfies CopyKey;
const BODY = "mail.magicLink.body" satisfies CopyKey;
const ACTION = "mail.magicLink.action" satisfies CopyKey;
const FACT_FOR = "mail.magicLink.fact.for" satisfies CopyKey;
const REASON = "mail.reason.magicLink" satisfies CopyKey;

// The welcome arm's own sentences. The four steps quote the keys the setup
// screen already speaks — a second copy of "Paid" or "Three decisions, then
// we start." would be two sentences to keep in step, not one.
const WELCOME_EYEBROW = "mail.welcome.eyebrow" satisfies CopyKey;
const WELCOME_HEADING = "mail.welcome.heading" satisfies CopyKey;
const WELCOME_BODY = "mail.welcome.body" satisfies CopyKey;
const WELCOME_SCAN = "mail.welcome.step.scan" satisfies CopyKey;
const WELCOME_SCAN_LINE = "mail.welcome.step.scan.line" satisfies CopyKey;
const WELCOME_REASON = "mail.reason.welcome" satisfies CopyKey;
const WELCOME_ACTION = "mail.setupReminder.action" satisfies CopyKey;
const REACH_A_PERSON = "mail.account.reach_a_person" satisfies CopyKey;
const STEP_PAID = "setup.progress.paid" satisfies CopyKey;
const STEP_SETUP = "setup.progress.setup" satisfies CopyKey;
const STEP_SETUP_LINE = "setup.head" satisfies CopyKey;
const STEP_FIRST_PAGE = "setup.progress.first-page" satisfies CopyKey;
const STEP_FIRST_PAGE_LINE = "setup.submit" satisfies CopyKey;

export interface AccountMail {
  readonly subject: CopyKey;
  readonly blocks: readonly MailBlock[];
  /** UI-SPEC S20's footer line: why this mail arrived. Absent only on the
   *  kinds the approved set does not draw, whose line is not written yet —
   *  `tests/mail/shell/footer.test.ts` names those three. */
  readonly reason?: CopyKey;
}

/**
 * S20's shape, in the order the set draws it: heading, one short line, the
 * fact rows, one solid button.
 *
 * The address is a fact row and not a sentence. The set draws `for ·
 * you@company.com`, and it earns its place: this mail is a credential, so a
 * reader who was sent it at an address they do not recognise can see that
 * before they click.
 */
/** A mail whose footer names something under the reason line. */
export interface WelcomeMail extends AccountMail {
  readonly notes: readonly CopyKey[];
}

/**
 * The welcome mail, in the sections the canvas draws it in
 * (`docs/design/canvas/MailWelcome.dc.html`): where the reader is in the
 * onboarding sequence, the welcome, one line, the four steps with the paid
 * one already ticked, the way back in, and a footer naming a person.
 *
 * The provisioning occasion of §10's `magic-link` row, and a separate
 * builder from `buildMagicLink` on purpose: that one answers a sign-in
 * *request*, where a four-step onboarding panel would be wrong, and it is
 * the credential — six of this mail's sentences are still the owner's, and
 * an arm that cannot send must not be the arm a paying customer depends on.
 *
 * `href` is the sign-in link, landing on setup, exactly as the reminder's
 * is: the button is the way in, not decoration around a message.
 */
export function buildWelcome(a: { href: string }): WelcomeMail {
  return {
    subject: SUBJECT,
    reason: WELCOME_REASON,
    notes: [REACH_A_PERSON],
    blocks: [
      { block: "eyebrow", text: WELCOME_EYEBROW },
      { block: "heading", text: WELCOME_HEADING },
      { block: "paragraph", text: WELCOME_BODY },
      {
        block: "steps",
        items: [
          { label: STEP_PAID, done: true },
          { label: STEP_SETUP, line: STEP_SETUP_LINE },
          { label: WELCOME_SCAN, line: WELCOME_SCAN_LINE },
          { label: STEP_FIRST_PAGE, line: STEP_FIRST_PAGE_LINE },
        ],
      },
      { block: "action", label: WELCOME_ACTION, href: a.href },
    ],
  };
}

export function buildMagicLink(a: { href: string; address: string }): AccountMail {
  return {
    subject: SUBJECT,
    reason: REASON,
    blocks: [
      { block: "heading", text: HEADING },
      { block: "paragraph", text: BODY },
      { block: "facts", items: [{ label: FACT_FOR, value: a.address }] },
      { block: "action", label: ACTION, href: a.href },
    ],
  };
}
