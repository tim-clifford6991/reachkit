// BUILD §4.7 — the seven actions, as declared interfaces.
//
// REQ-070 criterion 2's list is closed at seven (`ACTIONS`), and every one of
// them belongs to a module this screen does not own: billing and the Stripe
// surface (#34), identity and sign-out (#35), export, unpublish-everything
// and deletion (#52). WO-180 `## File plan` calls each one "a thin delegation"
// for that reason — the screen offers the action and states its consequence;
// what the action *does* is the owning module's, and always was.
//
// None of those modules exists yet: `src/lib/account/**` is not on disk. So
// this file declares the interface the screen calls and supplies a stub, and
// the stub's whole job is to be **honest about not being wired**. It returns
// a state — `not-yet`, with the issue number that wires it — rather than
// resolving as though the work happened. The alternative shapes were both
// worse: a stub that returned success would put "your account was deleted" in
// front of a customer whose account is untouched, and a stub that threw would
// make a preview of this screen crash on a click.
//
// `ActionOutcome`'s other two arms are not speculative — they are the two
// shapes the real implementations already have, published in the blueprints
// this screen is cut against. `elsewhere` is REQ-097 criterion 1's: the
// billing controls hand the customer to Stripe's own surface and ReachKit
// renders no step of its own. `here` is what sign-out, export and the two
// danger-zone actions return once #35 and #52 land. Declaring all three now is
// what lets the wiring change `FIXTURE_ACTIONS` for a real implementation
// without the screen changing at all.
//
// This module reaches nothing: no database, no vendor, no `fetch`. That is
// what lets a client component import it directly (`"use client"` panels call
// these), which is the only way a control can be wired at all before server
// actions have a server to act on.
import { ACTIONS, type ActionKey } from "./settable";

/** What an action did. Every arm is a state the screen can render today; none
 *  of them pretends work happened that did not. */
export type ActionOutcome =
  /** Done somewhere that is not ReachKit — Stripe's own billing surface
   *  (REQ-097 c1), or a file handed to the browser. `href` is where. */
  | { done: "elsewhere"; href: string }
  /** Done here, in full. */
  | { done: "here" }
  /** Not wired yet, and this is the issue that wires it. Never a failure and
   *  never an error: nothing was attempted, so nothing failed. */
  | { done: "not-yet"; issue: number };

/** The seven, as one interface. Total over `ActionKey`, so an eighth action
 *  cannot be called without first being added to `ACTIONS` — and an action
 *  added to `ACTIONS` with no implementation is a compile error here. */
export type SettingsActions = Readonly<Record<ActionKey, () => Promise<ActionOutcome>>>;

/** Which issue wires each action. Total over `ActionKey` for the same reason
 *  the interface is: an action with no owner is not an action, it is a button.
 *
 *  #34 — Access + billing: portal link, cancel/resume events (REQ-076/097).
 *  #35 — Identity: `signOut`, the account card and email change (REQ-077/098).
 *  #52 — Export everything, danger zone, `confirmDangerAction`,
 *        `deleteAccount`, the 30-day purge (REQ-078/079). */
export const WIRED_BY: Record<ActionKey, number> = {
  invoices: 34,
  cancel: 34,
  resume: 34,
  sign_out: 35,
  export: 52,
  unpublish_all: 52,
  delete_account: 52,
};

/**
 * The stub. Every action answers with the issue that wires it, and changes
 * nothing anywhere — there is no code path from this object to a store, a
 * vendor or a mail. Replacing an entry with its real delegation is the whole
 * of what wiring one costs; the screen is not touched.
 */
export const FIXTURE_ACTIONS: SettingsActions = Object.freeze(
  Object.fromEntries(
    ACTIONS.map((key) => [key, (): Promise<ActionOutcome> => Promise.resolve({ done: "not-yet", issue: WIRED_BY[key] })])
  ) as Record<ActionKey, () => Promise<ActionOutcome>>
);
