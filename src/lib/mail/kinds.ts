// BUILD §12 — the register of mail kinds, and the partition of this module.
//
// Ten rows, and a mail on any other occasion does not compile: `MailKind`
// is the keys of this constant, and every seam that sends takes one. The
// product sends no marketing, newsletter or promotional mail at all —
// there is no row for one, and adding one is a change to this file, read
// by the owner, not a call-site argument.
//
// `stoppable` is the dispatch, not documentation (ADR-042). Exactly one
// store is consulted per send, chosen by this field:
//
//   'opt-out'  → the address-wide suppression store (§4.2's lead
//                opt-out; `src/lib/mail/leads/**`, issue #31)
//   'toggle'   → the customer's own three switches on `users.notify`
//                (BUILD §4.7 Notifications; `notifications/`)
//   false      → neither store is asked
//
// Merging the two stores is the cleanup ADR-042 exists to forbid: on
// magic-link auth the sign-in mail *is* the credential, so an address-wide
// unsubscribe that reached `magic-link` would lock a paying customer out
// of the product with no recovery channel. Two mechanisms, two stores, two
// token formats, permanently.
//
// ADR-040: a kind's template is a directory named for that kind,
// `src/lib/mail/templates/<kind>/`, owned by the feature that owns the
// occasion. `MailKind` and the directory name are the same string —
// `tests/mail/kinds/template-directories.test.ts` holds them to it. This
// module holds no template, no shell and no vendor knowledge.

/** What a row says. `occasionsFrom` cites the SPEC.md section(s) that
 *  state the occasion — asserted to resolve in
 *  `tests/mail/kinds/register-legality.test.ts`, so a kind cannot outlive
 *  the spec that justifies it. */
export interface KindRow {
  readonly occasionsFrom: string;
  readonly stoppable: false | "toggle" | "opt-out";
  /** The one occasion on which a `'toggle'` kind is sent anyway, named.
   *  Present on `draft-ready` and nowhere else. */
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
  // The eleventh kind, and the only one whose reader is the owner rather
  // than a customer (issue #329). §6.5 is its occasion: the cost seam's own
  // ceilings are what it reports. `stoppable: false` for a reason no other
  // kind has — there is no address to unsubscribe and no preference to
  // read, because the recipient is `OWNER_EMAILS` and the mail exists to
  // say the product is spending money nobody asked it to. A stoppable
  // alarm is not an alarm.
  ops: { occasionsFrom: "§6.5", stoppable: false },
} as const satisfies Readonly<Record<string, KindRow>>);

export type MailKind = keyof typeof MAIL_KINDS;

/** The kinds a customer's own three switches reach. Derived from the
 *  register, never stated twice: a fourth `'toggle'` row would appear here
 *  the moment it was added, and `TOGGLABLE_KINDS` (notifications/) is
 *  asserted equal to it. */
export const TOGGLE_KINDS: readonly MailKind[] = Object.freeze(
  (Object.keys(MAIL_KINDS) as MailKind[]).filter((kind) => MAIL_KINDS[kind].stoppable === "toggle")
);
