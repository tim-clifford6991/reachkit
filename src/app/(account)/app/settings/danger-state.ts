// BUILD §4.7, REQ-079 c2 — the shapes the danger handshake carries between
// the panel and its Server Functions, and the one comparison both sides
// make.
//
// A file of its own because a `"use server"` module may export only async
// functions: `danger-actions.ts` produces these values and `DangerZone.tsx`
// renders them, and neither can hold the types.
//
// **The word is compared here, by both sides, against the same registry
// value** (owner ruling, 2026-09-07). The client compares it to arm the
// control; the Server Function compares it again before the engine is
// reached, so a client that skipped its check changes nothing. Trimmed and
// case-insensitive, because a customer who typed a trailing space or a
// capital has confirmed exactly as clearly as one who did not — and the
// pause REQ-079 c2 asks for is that they typed the word at all, never that
// they typed it precisely.
import type { CopyKey } from "@/lib/presentation/copy";

/** The two §4.7 prints, as the settings screen's own action keys. */
export type DangerActionKey = "unpublish_all" | "delete_account";

/** The registry key holding the word each action is confirmed with. One
 *  key per action: they are two words the owner writes, and a single key
 *  with a slot would make the product's two most destructive confirmations
 *  share one sentence. */
export const CONFIRM_WORD_KEY: Readonly<Record<DangerActionKey, CopyKey>> = Object.freeze({
  unpublish_all: "danger.confirm-word.unpublish-all",
  delete_account: "danger.confirm-word.delete-account",
});

/** Whether what the customer typed is the word they were shown. `word` is
 *  the registry value both callers read, passed in rather than looked up
 *  here so this module reaches no registry of its own and the two sides
 *  cannot come to compare against different values. */
export function matchesConfirmWord(
  _action: DangerActionKey,
  typed: string,
  word: string
): boolean {
  return typed.trim().toLowerCase() === word.trim().toLowerCase();
}

/** REQ-079 c3's first gate. `taken` is the ticket's own stamp, never a
 *  client's memory of having pressed the control. */
export type HandoverState = { taken: boolean };

/** A destination whose pages this run could not take down (c4). */
export interface StillLive {
  readonly kind: string;
  readonly liveUrls: readonly string[];
}

/** What a confirmed action did, as the panel renders it. Every arm carries
 *  the key that says it; none carries a sentence. */
export type DangerOutcome =
  | { ran: false; lineKey: "danger.export-failed" | "danger.type-to-confirm" }
  | {
      ran: true;
      action: "unpublish_all";
      lineKey: "danger.some-still-live" | "danger.all-taken-down";
      takenDown: number;
      stillLive: readonly StillLive[];
    }
  /** The account is gone and the session with it: there is no line to
   *  render, because there is no screen left to render it on. */
  | { ran: true; action: "delete_account"; href: string };
