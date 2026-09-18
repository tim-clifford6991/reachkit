// BUILD §12 — what the mail vendor is asked, and what it may answer.
//
// The request this module accepts is already finished: two bodies and a
// rendered subject. It decides nothing about whether to send — that is
// `send.ts`'s, and it has already been decided by the time a `VendorSend`
// exists.
//
// `VendorResult` is a value, never an exception. `retriable` is kept apart
// from any customer-facing reason so a caller's retry window can end early
// rather than spending its whole budget on an address that will never
// accept mail.
import type { MailKind } from "../kinds";

export interface VendorSend {
  kind: MailKind;
  to: string;
  /** Already rendered by `composeMail()`; this module renders nothing. */
  subject: string;
  html: string;
  text: string;
  /** The address a mail client POSTs to when its own Unsubscribe control is
   *  pressed — RFC 8058's one-click endpoint, issue 889. Present exactly
   *  where the mail carries a stop control, absent on the kinds that carry
   *  none (a sign-in link is not unsubscribable). Absent means the two
   *  headers are not sent, never that they are sent empty. */
  listUnsubscribe?: string;
}

export type VendorResult =
  | { ok: true; id: string }
  | { ok: false; retriable: boolean; retryUntil?: Date };
