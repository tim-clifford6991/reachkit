// BUILD §4.6 — the stage-appropriate actions, and the machine behind them.
//
// §4.6 gives four stages a control that changes something: review → Veto,
// planned → Skip; needs-you → Write it again. The customer has no Approve
// (owner 2026-10-08, issue 1337): the veto window ending is what publishes.
// Every one of those is a write against §9's state machine, which now
// exists: `src/lib/publish/`, issue #45.
//
// So this file is the seam and no longer the stub. All three commands are
// §9 edges and go to `transition()` — the one mover of state — through the
// Server Functions in `./publishing-actions`.
//
// **Move is gone** (SPEC §7, 2026-09-20, #908, issue #913: "*Move* is
// removed until it can move"). Moving a page to another date is not one of
// §9's fifteen edges — it rewrites `drafts.scheduled_for` and the veto
// deadline that hangs off it, which is the re-deadline rule (#46) — so the
// command had no engine and always refused. A control that cannot act is
// not drawn, and a command nothing can call is not declared: the union
// below has three members and `actionsFor` offers no fourth.
//
// **A refusal is a value, not a rejection** (issue #913). It used to be
// thrown, on the reasoning that "a click that changed nothing must not
// settle as though it had" — but the screen then caught the throw and said
// nothing, so a customer pressing Stop on a page the machine refused saw
// exactly what a customer pressing Stop on a page it accepted saw. The
// contract is now the opposite and stronger: every command answers, the
// screen states which answer it got, and the machine's own word for why is
// carried on the refusal for the developer who has to read it.
import type { State } from "@/lib/publish/types";
import { regenerateDraft, skipDraft, vetoDraft } from "./publishing-actions";

/** The two writes §4.6's day panel offers that end a page's run at its
 *  date. Named for what the customer does, not for the transition
 *  underneath — `veto` is REQ-046's veto and `skip` is BUILD §9's
 *  `skipped`, and they reach the same state by two different promises. */
export type StopCommand = "skip" | "veto";

/** `edit` is not here and never will be: editing is a text write against
 *  the draft's own store (`draft/[draftId]/save.ts`), not a transition of
 *  §9's state machine. `approve` is not here either (owner 2026-10-08,
 *  issue 1337): `in_review → approved` is the system's edge alone. */
/** 2026-09-07, issue #143: §9's `needs_attention → generating` — the
 *  customer's own restart, and the one edge §9 opens for them and for no
 *  one else. Its own type beside `StopCommand` because it is the opposite
 *  of one: every stop command ends a page's run at its date, and this one
 *  starts it over. */
export type RestartCommand = "regenerate";

export type PublishingCommand = StopCommand | RestartCommand;

/**
 * The §9 state each command asks the machine to move the page to.
 *
 * It exists so a screen can draw the answer **before** the server has
 * given one — React 19's `useOptimistic` needs the value the write is
 * expected to produce, and the stage badge is a projection of the state
 * (`stages.ts`). It is the same target `./publishing-actions` passes to
 * `transition()`, stated once here so the optimistic badge and the write
 * cannot name two different edges.
 *
 * Total over the command union, so a fifth command cannot ship without an
 * answer to "what does the screen show while this is in flight".
 */
export const COMMAND_TARGET: Readonly<Record<PublishingCommand, State>> = Object.freeze({
  skip: "skipped",
  veto: "skipped",
  regenerate: "generating",
});

/**
 * What a command answered.
 *
 * `refused` carries the machine's own word — `not_a_transition`, the name
 * of the guard that said no, or `not_your_page` — and is **never rendered
 * to the customer**: there is no registry sentence for a machine's refusal
 * vocabulary, and inventing one is what the copy law forbids. The screen
 * reads the discriminant and states its own written line for "nothing
 * changed"; the word is what a developer reads in a log.
 */
export type PublishingOutcome = { ok: true } | { ok: false; refused: string };

export interface PublishingMachine {
  /** Take a planned page off its date without publishing it. */
  skip(a: { draftId: string }): Promise<PublishingOutcome>;
  /** Stop a page in review before its veto window closes (§9). */
  veto(a: { draftId: string }): Promise<PublishingOutcome>;
  /**
   * Write a page again — §9's `needs_attention → generating`, the
   * customer's own restart (issue #143).
   *
   * **Idempotent by the machine, not by a check here.** A second press
   * asks for the same edge from a state the page has already left, and
   * `transition()` answers `not_a_transition`: nothing is written twice
   * and no second draft is started. The guards are asked in the same
   * place they are asked for every other command — `never_entered_review`
   * and `customer_initiated` — so a page that has been read is refused
   * even if a control for it somehow reached a screen.
   */
  regenerate(a: { draftId: string }): Promise<PublishingOutcome>;
}

/**
 * One shape for every command: the Server Function answers `null` where
 * the machine moved the page and its own refusal word where it did not.
 *
 * A call that never reached the server at all — an offline browser, a
 * dropped connection — rejects, and that is the one case this turns into
 * a refusal rather than letting it escape: from the customer's side a
 * write that did not happen is a write that did not happen, and the
 * screen owes them the same sentence either way.
 */
async function run(asked: Promise<string | null>): Promise<PublishingOutcome> {
  try {
    const refused = await asked;
    return refused === null ? { ok: true } : { ok: false, refused };
  } catch {
    return { ok: false, refused: "unreachable" };
  }
}

/** The declared seam. One module-level constant, so a later issue swaps an
 *  implementation in one place; no caller constructs its own. */
export const publishing: PublishingMachine = Object.freeze({
  skip(a: { draftId: string }): Promise<PublishingOutcome> {
    return run(skipDraft(a.draftId));
  },
  veto(a: { draftId: string }): Promise<PublishingOutcome> {
    return run(vetoDraft(a.draftId));
  },
  regenerate(a: { draftId: string }): Promise<PublishingOutcome> {
    return run(regenerateDraft(a.draftId));
  },
});
