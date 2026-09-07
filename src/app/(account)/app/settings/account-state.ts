// BUILD §4.7 — the shape the account card's email-change form carries
// between a submit and the answer it gets back.
//
// A file of its own for the reason `src/app/(public)/signin/state.ts` is
// one: a `"use server"` module may export only async functions, so the
// state, its initial value and the field's wire name cannot live beside the
// Server Function that produces them. Both this file's importers — the
// action and the panel — need all three.
import type { CopyKey } from "@/lib/presentation/copy";

/** The native `name` on the one field. Internal (rule 1.1), not a sentence:
 *  it is a wire name a browser puts in `FormData`, which is why `Input`
 *  takes a `name` prop at all. */
export const NEW_EMAIL_FIELD = "new_email";

/** REQ-077 c2's three refusals, as the keys identity itself returns. The
 *  union is `BeginEmailChange`'s own `lineKey`s — not a second list — so a
 *  fourth refusal in the engine is a compile error on this screen rather
 *  than a silent fall-through to nothing. */
export type EmailChangeRefusal =
  | "settings.account.email-in-use"
  | "settings.account.email-invalid"
  | "settings.account.email-change-unavailable";

export type EmailChangeState =
  /** Nothing submitted yet in this render. */
  | { answer: "idle" }
  /** The link is out. The card does not say so in a line of its own: the
   *  read that follows shows the address awaiting confirmation and when it
   *  lapses, which is the same fact stated where the customer will look for
   *  it again tomorrow. */
  | { answer: "sent" }
  /** Refused. `value` is what they typed, kept intact — `Input`'s contract
   *  ("the invalid value stays intact"), and REQ-077's own shape: a
   *  customer told "that address already belongs to an account" must not
   *  also have to retype it. */
  | { answer: "refused"; lineKey: EmailChangeRefusal; value: string };

export const EMAIL_CHANGE_INITIAL: EmailChangeState = { answer: "idle" };

/** The written line a state owes, or `null`. `idle` and `sent` own no
 *  sentence, which is a decision and not an omission — see `sent` above. */
export function refusalKeyOf(state: EmailChangeState): CopyKey | null {
  return state.answer === "refused" ? state.lineKey : null;
}
