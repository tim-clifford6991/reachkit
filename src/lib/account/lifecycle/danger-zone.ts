// BUILD §4.7 — "**Danger zone** (unpublish all, delete account; 'pages are
// exported to you first, never silently destroyed')".
//
// REQ-079 criterion 1: "exactly two actions are offered — unpublish every
// page, and delete the account — each with one written sentence saying what
// it removes, what it keeps, and whether the account survives it."
//
// Naming only. The sentences are the owner's, in the copy registry; what
// this file carries is which two actions exist, in which order, which key
// states each one's consequence, and — the fact the rest of this module
// branches on — whether the account is still there afterwards. A third
// member is a change to this constant *and* to REQ-079 criterion 1, which
// is why it is frozen and why nothing here derives the list from anything.
import type { CopyKey } from "@/lib/presentation/copy";

export const DANGER_ZONE = Object.freeze([
  Object.freeze({
    action: "unpublish_all",
    sentenceKey: "danger.unpublish-all.consequence" as CopyKey,
    accountSurvives: true,
  }),
  Object.freeze({
    action: "delete_account",
    sentenceKey: "danger.delete-account.consequence" as CopyKey,
    accountSurvives: false,
  }),
] as const);

export type DangerAction = (typeof DANGER_ZONE)[number]["action"];

export function isDangerAction(value: string): value is DangerAction {
  return DANGER_ZONE.some((entry) => entry.action === value);
}
