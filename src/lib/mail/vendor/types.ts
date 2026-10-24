// BUILD §12 — what the mail vendor is asked (a finished request; `send.ts` already decided to send) and what it may answer.
// `VendorResult` is a value, never an exception; `retriable` lets a caller's retry window end early on an address that will never accept mail.
import type { MailKind } from "../kinds";

export interface VendorSend {
  kind: MailKind;
  to: string;
  /** Already rendered by `composeMail()`; this module renders nothing. */
  subject: string;
  html: string;
  text: string;
  /** RFC 8058's one-click address, present exactly where the mail carries a stop control; absent sends no headers, never empty ones. */
  listUnsubscribe?: string;
}

export type VendorResult =
  | { ok: true; id: string }
  | { ok: false; retriable: boolean; retryUntil?: Date };
