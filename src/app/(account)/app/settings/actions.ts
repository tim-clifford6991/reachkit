// BUILD §4.7 — the seven actions, as declared interfaces.
//
// REQ-070 criterion 2's list is closed at seven (`ACTIONS`), and every one of
// them belongs to a module this screen does not own: billing and the Stripe
// surface (#34/#136), identity and sign-out (#35/#134), export,
// unpublish-everything and deletion (#52/#150). WO-180 `## File plan` calls
// each one "a thin delegation" for that reason — the screen offers the
// action and states its consequence; what the action *does* is the owning
// module's, and always was.
//
// **All seven are wired since issue #259, and the `not-yet` arm is gone
// with them.** It existed to be honest about a stub — it returned the issue
// that would wire the action rather than resolving as though the work had
// happened — and there is no stub left for it to describe. An arm nothing
// can return is worse than no arm: it reads as a state the screen must
// handle, and nothing would ever put the screen in it.
//
// `ActionOutcome`'s three arms are what the seven actually answer.
// `elsewhere` is REQ-097 criterion 1's billing surface, REQ-078 c2's export
// download, REQ-079 c3's archive hand-over and #134's sign-out — every case
// where the browser is handed an address rather than told an outcome.
// `here` is a completed run that shows itself in the screen it completed
// on. `unreachable` is REQ-097 criterion 6's.
//
// **The two irreversible actions are offered here as their export
// hand-off, never as their run** — see `SETTINGS_ACTIONS` below, and
// `./danger-actions.ts` for the confirmed run.
//
// This module still reaches nothing itself: no database, no vendor, no
// `fetch`. What it imports are `"use server"` modules — in a client bundle
// such an import is a reference to a Server Function, not the function's
// code, so a `"use client"` panel may still import this file directly and
// nothing that reaches Stripe or Postgres crosses into the browser.
import type { ActionKey } from "./settable";
import { cancelPlan, openBillingSurface, resumePlan } from "./billing-actions";
import { signOutAction } from "./account-actions";

/** REQ-078 c2's download, which is a route and not a function because a
 *  Server Function cannot stream a file. `GET /api/export` reaches the
 *  export leaf with the session's own site and no access gate — "never
 *  withheld on account of subscription state" — so this action is the
 *  address and nothing more. */
const EXPORT_HREF = "/api/export";

/** REQ-079 c3's hand-over, per action. Same reason it is an address: the
 *  archive is a stream the customer receives as a download. Beginning one
 *  destroys nothing — it builds the archive and writes a ticket that
 *  authorises nothing by itself. */
function handOverArchive(action: "unpublish_all" | "delete_account"): Promise<ActionOutcome> {
  return Promise.resolve({ done: "elsewhere", href: `/api/danger/${action}` });
}

function takeExport(): Promise<ActionOutcome> {
  return Promise.resolve({ done: "elsewhere", href: EXPORT_HREF });
}

/** What an action did. Every arm is a state the screen can render today; none
 *  of them pretends work happened that did not. */
export type ActionOutcome =
  /** Done somewhere that is not ReachKit — Stripe's own billing surface
   *  (REQ-097 c1), or a file handed to the browser. `href` is where. */
  | { done: "elsewhere"; href: string }
  /** Done here, in full. */
  | { done: "here" }
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

export const SETTINGS_ACTIONS: SettingsActions = Object.freeze({
  invoices: openBillingSurface,
  cancel: cancelPlan,
  resume: resumePlan,
  sign_out: signOutAction,
  export: takeExport,
  // The two irreversible actions are offered here as their **export
  // hand-off** and not as their run (issue #259). REQ-079 c2 is explicit
  // that a press which has not been confirmed destroys nothing, and c3 puts
  // the archive before either action — so what the danger zone's control
  // reaches through this map is the download, and the run is a separate
  // Server Function the step's own confirming control calls with the word
  // the customer typed (`danger-actions.ts`). An entry here that ran the
  // action would be the version where the offer and the confirmation are
  // one press.
  unpublish_all: () => handOverArchive("unpublish_all"),
  delete_account: () => handOverArchive("delete_account"),
});
