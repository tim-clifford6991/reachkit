// BUILD §4.7 — the seven actions, as declared interfaces.
//
// REQ-070 criterion 2's list is closed at seven (`ACTIONS`), and every one of
// them belongs to a module this screen does not own: billing and the Stripe
// surface (#34), identity and sign-out (#35), export, unpublish-everything
// and deletion (#52). WO-180 `## File plan` calls each one "a thin delegation"
// for that reason — the screen offers the action and states its consequence;
// what the action *does* is the owning module's, and always was.
//
// None of those modules existed when this file was written: `src/lib/account/**`
// was not on disk. So this file declares the interface the screen calls and
// supplies a stub, and
// the stub's whole job is to be **honest about not being wired**. It returns
// a state — `not-yet`, with the issue number that wires it — rather than
// resolving as though the work happened. The alternative shapes were both
// worse: a stub that returned success would put "your account was deleted" in
// front of a customer whose account is untouched, and a stub that threw would
// make a preview of this screen crash on a click.
//
// `ActionOutcome`'s other arms are not speculative — they are the two
// shapes the real implementations already have, published in the blueprints
// this screen is cut against. `elsewhere` is REQ-097 criterion 1's: the
// billing controls hand the customer to Stripe's own surface and ReachKit
// renders no step of its own. `here` is what sign-out, export and the two
// danger-zone actions return once #35 and #52 land. Declaring all three now is
// what lets the wiring change `FIXTURE_ACTIONS` for a real implementation
// without the screen changing at all.
//
// **Since issue #136, three of the seven are wired** (`SETTINGS_ACTIONS`),
// and the stub's shape is what made that cheap: the panels were not touched.
//
// This module still reaches nothing itself: no database, no vendor, no
// `fetch`. What it now imports is `./billing-actions`, a `"use server"`
// module — in a client bundle that import is a reference to a Server
// Function, not the function's code, so a `"use client"` panel may still
// import this file directly and nothing that reaches Stripe or Postgres
// crosses into the browser.
import { ACTIONS, type ActionKey } from "./settable";
import { cancelPlan, openBillingSurface, resumePlan } from "./billing-actions";

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
  | { done: "not-yet"; issue: number }
  /** REQ-097 criterion 6 (issue #136) — the billing surface could not be
   *  produced. "Stripe unreachable, or a session refused for any other
   *  reason" is one arm and not four, because which refusal it was is an
   *  operator's fact: what the customer is owed is that billing cannot be
   *  reached, that they may try again, and one way to reach a person, and
   *  none of those three sentences differs by reason. Nothing about the
   *  plan or the account changed, and the customer is still signed in —
   *  both by construction, since the only thing that ran was a session
   *  that was never created. */
  | { done: "unreachable" };

/** The seven, as one interface. Total over `ActionKey`, so an eighth action
 *  cannot be called without first being added to `ACTIONS` — and an action
 *  added to `ACTIONS` with no implementation is a compile error here. */
export type SettingsActions = Readonly<Record<ActionKey, () => Promise<ActionOutcome>>>;

/** Which issue wires each action. Total over `ActionKey` for the same reason
 *  the interface is: an action with no owner is not an action, it is a button.
 *
 *  #136 — The billing controls' press: a portal session minted at the press
 *         (REQ-097 c1) and resume past the date (REQ-076 c6). #34 built
 *         `portalLink()` underneath it.
 *  #35 — Identity: `signOut`, the account card and email change (REQ-077/098).
 *  #52 — Export everything, danger zone, `confirmDangerAction`,
 *        `deleteAccount`, the 30-day purge (REQ-078/079). */
export const WIRED_BY: Record<ActionKey, number> = {
  invoices: 136,
  cancel: 136,
  resume: 136,
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

/**
 * What the screen actually calls: the stub, with every wired action replaced
 * by its real delegation.
 *
 * Issue #136 wired the three billing controls, and the shape the stub was
 * built for is exactly what made that a three-line change — the panels were
 * not touched. The other four still answer `not-yet` with their issue, which
 * is the honest state and not a placeholder for success.
 *
 * The three delegations live in `./billing-actions`, a `"use server"` module:
 * a portal session is short-lived and must be minted at the press, and the
 * module that mints it reaches Stripe and the database, which no client
 * bundle may contain. Importing it here is what gives the panels a Server
 * Function reference to call.
 */
export const SETTINGS_ACTIONS: SettingsActions = Object.freeze({
  ...FIXTURE_ACTIONS,
  invoices: openBillingSurface,
  cancel: cancelPlan,
  resume: resumePlan,
});
