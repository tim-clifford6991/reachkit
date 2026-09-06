// BUILD §4.7 — "Notifications (3 toggles)", projected from the register
// rather than counted out here.
//
// WO-179 decision 4 and its step 3, verbatim: project the rows over the
// stoppable subset of `MAIL_KINDS` — "**not** the three hard-coded toggles of
// `BUILD.md` §4.7 … a second copy of the register is the copy that goes
// stale, and a stoppable mail with no toggle is a customer who cannot stop a
// mail the product says they can."
//
// So `NotifyKind` is *derived* from `MAIL_KINDS` by the same conditional type
// `src/lib/mail/send.ts` uses, and `NOTIFICATION_COPY_KEY` is a total
// `Record` over it. A fourth `stoppable: 'toggle'` row therefore lands as a
// compile error in this file — a missing key in that map — and never as a
// toggle the screen quietly failed to draw. Deleting a row is symmetrical: an
// entry here for a kind that is no longer togglable stops compiling too.
//
// `@/lib/mail/kinds` is imported, not `@/lib/mail` — the register is a
// dependency-free module (`kinds.ts` imports nothing at all), while the send
// seam that re-exports it reaches Resend and the database. §4.7's screen wants
// the register and none of the machinery, and importing the leaf is how it
// gets exactly that.
import { MAIL_KINDS, TOGGLE_KINDS, type MailKind } from "@/lib/mail/kinds";
import type { CopyKey } from "@/lib/presentation/copy";

/** The kinds a customer's own switches reach — the `stoppable: 'toggle'`
 *  rows of the register, read off the register itself. */
export type NotifyKind = {
  [K in MailKind]: (typeof MAIL_KINDS)[K]["stoppable"] extends "toggle" ? K : never;
}[MailKind];

/** The registry key each switch is named from. Total over `NotifyKind`, so a
 *  fourth togglable mail cannot ship without a word for its switch. */
export const NOTIFICATION_COPY_KEY: Record<NotifyKind, CopyKey> = {
  "draft-ready": "settings.notifications.draft-ready",
  published: "settings.notifications.published",
  weekly: "settings.notifications.weekly",
};

/** One switch, as the screen renders it. */
export interface NotificationRow {
  kind: NotifyKind;
  on: boolean;
  copyKey: CopyKey;
}

function isNotifyKind(kind: MailKind): kind is NotifyKind {
  return MAIL_KINDS[kind].stoppable === "toggle";
}

/**
 * The switches, in the register's own order, each carrying the customer's
 * stored preference. A kind absent from `prefs` reads as on — the state a
 * customer who has never opened Settings is in
 * (`src/lib/mail/notifications`'s `allOn()`), restated here as a default
 * argument value rather than by reaching into that module, which reads the
 * database.
 */
export function notificationRows(prefs: Partial<Record<NotifyKind, boolean>>): readonly NotificationRow[] {
  return Object.freeze(
    TOGGLE_KINDS.filter(isNotifyKind).map((kind) =>
      Object.freeze({ kind, on: prefs[kind] ?? true, copyKey: NOTIFICATION_COPY_KEY[kind] })
    )
  );
}
