// src/app/(public)/signin/state.ts — REQ-098 c3/c6 (issue #19)
//
// What the sign-in screen renders after a submission, and the one wire name
// the form field carries. A plain module, deliberately: `./actions.ts` is a
// `"use server"` file, and such a file may export **only** async functions —
// Next strips everything else, so a const or a type exported from there
// reaches the client as nothing at all (`next build`: "The module has no
// exports at all"). The state and its initial value are shared by the action
// and the screen, so they live here and both import them.
export interface SignInState {
  /** Which of REQ-098's answers the screen is carrying. `none` is before any
   *  submission, when the screen answers nothing and so reveals nothing
   *  about any address (REQ-020 criterion 5). */
  answer: "none" | "invalid" | "sent" | "payment_held" | "no_account";
  /** What was typed, so a refused address is still there when the screen
   *  comes back (REQ-098 criterion 6) — including with no client runtime. */
  value: string;
}

export const SIGN_IN_INITIAL: SignInState = { answer: "none", value: "" };

/** The one field name the form submits. Not customer copy — a wire name the
 *  server reads, never a person (constitution rule 1.1). */
export const EMAIL_FIELD = "email";
