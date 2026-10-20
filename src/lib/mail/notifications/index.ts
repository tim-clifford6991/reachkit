// BUILD §12 · §4.7 — the three toggles, and the one question the send seam asks.
//
// Settings holds three switches over the three recurring mails
// (BUILD §4.7, "Notifications (3 toggles)"). They suppress no mail but
// their own: with all three off, the sign-in link, anything the product
// must say about the account or the subscription, the setup reminder and
// the one unsuppressible draft-ready announcement all still arrive.
//
// `TOGGLABLE_KINDS` is derived from the register (`kinds.ts`), never
// stated twice — a fourth `'toggle'` row would appear here the day it was
// added, and `tests/mail/notifications/togglable-kinds.test.ts` asserts
// the two agree. `MailKind` is imported **type-only** where it is only a
// type, so this module and the register cannot form a runtime cycle.
//
// ADR-042: this store is keyed by user and reaches exactly these three
// kinds. It never reads and never writes the address-wide suppression
// store, and there is no code path from one to the other.
import { TOGGLE_KINDS, type MailKind } from "../kinds";
import { firstMondayMailSent, prefsFrom, readStored, writeStoredKey } from "./store";

/** The three recurring mails a customer can switch off. Derived from the
 *  register's `stoppable: 'toggle'` rows. */
export type NotifyKind = Extract<MailKind, "draft-ready" | "published" | "weekly">;

export const TOGGLABLE_KINDS: readonly NotifyKind[] = Object.freeze(
  TOGGLE_KINDS.filter((kind): kind is NotifyKind => kind === "draft-ready" || kind === "published" || kind === "weekly")
);

export type NotifyPrefs = Readonly<Record<NotifyKind, boolean>>;

/** Every switch on — what a customer who has never opened Settings has,
 *  and what an unreadable store must never be mistaken for. */
export function allOn(): NotifyPrefs {
  return prefsFrom({}, TOGGLABLE_KINDS);
}

/** A key absent from `users.notify` reads as on (`draft-ready`: until the
 *  first Monday mail). A read that failed
 *  throws rather than answering "all on": a caller that wanted a
 *  displayable value and got a fabricated one would show the customer a
 *  setting they never chose. `stoppedByPreference()` below is the caller
 *  that must not throw, and it asks the store directly. */
export async function readNotifyPrefs(userId: string): Promise<NotifyPrefs> {
  const stored = await readStored(userId);
  if (!stored.readable) {
    throw new Error(`readNotifyPrefs: could not read notification settings (${stored.reason}).`);
  }
  return prefsFrom(stored.stored, TOGGLABLE_KINDS, await firstMondayMailSent(userId));
}

/** Writes one key and leaves the other two untouched.
 *
 *  It enqueues nothing. A mail missed while its toggle was off is not
 *  sent afterwards, and the way to guarantee that is to have no code path
 *  that could — there is no queue, no backlog and no catch-up call
 *  anywhere in this module's dependencies. */
export async function setNotifyPref(a: {
  userId: string;
  kind: NotifyKind;
  on: boolean;
}): Promise<NotifyPrefs> {
  const stored = await readStored(a.userId);
  if (!stored.readable) {
    throw new Error(`setNotifyPref: could not read notification settings (${stored.reason}).`);
  }
  const result = await writeStoredKey({ userId: a.userId, kind: a.kind, on: a.on, stored: stored.stored });
  if (!result.written) {
    throw new Error("setNotifyPref: could not write notification settings.");
  }
  return prefsFrom({ ...stored.stored, [a.kind]: a.on }, TOGGLABLE_KINDS, await firstMondayMailSent(a.userId));
}

/** The question the send seam asks immediately before the vendor call —
 *  never at schedule time, because a customer who switches a mail off
 *  between the two must not receive it.
 *
 *  `'unreadable'` is its own answer, not a `'send'`: this store is the
 *  only record of a choice the customer made, and mailing them because we
 *  could not read it spends their trust on our outage. A kind outside
 *  `TOGGLABLE_KINDS` answers `'send'` **without touching the store** —
 *  that is what makes these three toggles unable to reach the sign-in
 *  mail even when the database is down. */
export async function stoppedByPreference(a: {
  userId: string;
  kind: MailKind;
}): Promise<"send" | "stopped" | "unreadable"> {
  if (!(TOGGLABLE_KINDS as readonly string[]).includes(a.kind)) return "send";
  const stored = await readStored(a.userId);
  if (!stored.readable) return "unreadable";
  const chosen = stored.stored[a.kind];
  if (typeof chosen === "boolean") return chosen ? "send" : "stopped";
  if (a.kind !== "draft-ready") return "send";
  return (await firstMondayMailSent(a.userId)) ? "stopped" : "send";
}
