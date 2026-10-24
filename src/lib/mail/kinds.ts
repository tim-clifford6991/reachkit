// BUILD §12 — the register of mail kinds: `MailKind` is its keys, so a mail on any other occasion does not compile, and there is no marketing row.
// `stoppable` is the dispatch (ADR-042), one store per send: 'opt-out' asks the address-wide suppression store (§4.2, `leads/`),
// 'toggle' asks the customer's three switches on `users.notify` (BUILD §4.7, `notifications/`), and false asks neither.
// The stores never merge: an address-wide unsubscribe reaching `magic-link` would lock a paying customer out.
// ADR-040: each kind's template is `src/lib/mail/templates/<kind>/`, held to the kind's name by `tests/mail/kinds/template-directories.test.ts`.
// The product sends no marketing, newsletter or promotional mail at all — there is no row for one, and adding one is a change to this file, read by the owner, not a call-site argument.
// This module holds no template, no shell and no vendor knowledge.

/** What a row says. `occasionsFrom` cites the BUILD.md sections stating the occasion, checked by `tests/mail/kinds/register-legality.test.ts`. */
export interface KindRow {
  readonly occasionsFrom: string;
  readonly stoppable: false | "toggle" | "opt-out";
  /** The one named occasion a `'toggle'` kind is sent anyway; only on `draft-ready`. */
  readonly unsuppressibleWhen?: string;
}

export const MAIL_KINDS = Object.freeze({
  "magic-link": { occasionsFrom: "§13", stoppable: false },
  report: { occasionsFrom: "§12", stoppable: false },
  "first-page": { occasionsFrom: "§4.2", stoppable: false },
  "first-page-unavailable": { occasionsFrom: "§4.2", stoppable: false },
  nurture: { occasionsFrom: "§4.2", stoppable: "opt-out" },
  "draft-ready": {
    occasionsFrom: "§12",
    stoppable: "toggle",
    unsuppressibleWhen: "autopilot at a veto window of zero — the mail is the whole of the telling (§4.7)",
  },
  published: { occasionsFrom: "§12", stoppable: "toggle" },
  weekly: { occasionsFrom: "§12", stoppable: "toggle" },
  "setup-reminder": { occasionsFrom: "§4.3", stoppable: false },
  account: { occasionsFrom: "§13", stoppable: false },
  // The owner's alarm (§6.5): sent to `OWNER_EMAILS` about unasked spend, with no address to unsubscribe. A stoppable alarm is not an alarm.
  ops: { occasionsFrom: "§6.5", stoppable: false },
  // SPEC §8, Retention: the address-wide opt-out stops the win-back; payment-failed and cancellation are account notices nothing stops.
  "payment-failed": { occasionsFrom: "SPEC §8", stoppable: false },
  cancellation: { occasionsFrom: "SPEC §8", stoppable: false },
  "win-back": { occasionsFrom: "SPEC §8", stoppable: "opt-out" },
} as const satisfies Readonly<Record<string, KindRow>>);

export type MailKind = keyof typeof MAIL_KINDS;

/** The kinds the three switches reach, derived from the register; `TOGGLABLE_KINDS` is asserted equal to it. */
export const TOGGLE_KINDS: readonly MailKind[] = Object.freeze(
  (Object.keys(MAIL_KINDS) as MailKind[]).filter((kind) => MAIL_KINDS[kind].stoppable === "toggle")
);
