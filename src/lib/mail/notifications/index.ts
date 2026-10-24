// BUILD §12 · §4.7 — the three toggles over the recurring mails (BUILD §4.7, "Notifications (3 toggles)"), and the one question the send seam asks.
// They stop only their own kinds: with all three off, sign-in, account, setup and the unsuppressible draft-ready mail still arrive.
// `TOGGLABLE_KINDS` is derived from `kinds.ts` (asserted by `tests/mail/notifications/togglable-kinds.test.ts`); `MailKind` is type-only, so no cycle.
// ADR-042: keyed by user, with no path to the address-wide suppression store.
import { TOGGLE_KINDS, type MailKind } from "../kinds";
import { firstMondayMailSent, prefsFrom, readStored, writeStoredKey } from "./store";

/** The three recurring mails a customer can switch off, from the register's `'toggle'` rows. */
export type NotifyKind = Extract<MailKind, "draft-ready" | "published" | "weekly">;

export const TOGGLABLE_KINDS: readonly NotifyKind[] = Object.freeze(
  TOGGLE_KINDS.filter((kind): kind is NotifyKind => kind === "draft-ready" || kind === "published" || kind === "weekly")
);

export type NotifyPrefs = Readonly<Record<NotifyKind, boolean>>;

/** Every switch on: a customer who never opened Settings, never an unreadable store. */
export function allOn(): NotifyPrefs {
  return prefsFrom({}, TOGGLABLE_KINDS);
}

/** An absent key reads as on (`draft-ready`: until the first Monday mail). A failed read throws rather than show a setting never chosen;
 *  `stoppedByPreference()` asks the store directly, since it must not throw. */
export async function readNotifyPrefs(userId: string): Promise<NotifyPrefs> {
  const stored = await readStored(userId);
  if (!stored.readable) {
    throw new Error(`readNotifyPrefs: could not read notification settings (${stored.reason}).`);
  }
  return prefsFrom(stored.stored, TOGGLABLE_KINDS, await firstMondayMailSent(userId));
}

/** Writes one key. It enqueues nothing: a mail missed while off is never sent later, and no queue or catch-up path exists to send it. */
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

/** The seam's question immediately before the vendor call. `'unreadable'` is not `'send'`: mailing on our outage spends the customer's trust.
 *  A kind outside `TOGGLABLE_KINDS` answers `'send'` without touching the store, so the toggles cannot reach sign-in even with the database down. */
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
