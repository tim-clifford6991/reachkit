// BUILD §4.6 — the stage-appropriate actions, and the machine behind them.
//
// §4.6 gives four stages a control that changes something: review → Move or
// Veto, planned → Move or Skip. Every one of those is a write against
// BUILD §9's state machine and the veto rule — `src/lib/publish/`, issues
// #45 and #46, which do not exist yet.
//
// So this file declares the interface those controls call and **stubs it
// honestly**: each method rejects with an error naming the issue that will
// supply it. It does not pretend to succeed, it does not write a draft
// somewhere else, and it does not quietly resolve — a stub that resolved
// would put a control on the screen that appears to work and changes
// nothing, which is worse than one that cannot run at all.
//
// The shape is the real one, so #46 replaces this module's implementation
// and no caller changes: the panel already projects which commands a stage
// may carry (`actions.ts`), and that projection is the thing REQ-043
// criterion 9 constrains ("no action is offered that would be refused
// because of that stage").
import type { DayKey } from "./dates";

/** The three writes §4.6's day panel offers. Named for what the customer
 *  does, not for the transition underneath — `veto` is REQ-046's veto and
 *  `skip` is BUILD §9's `skipped`, and they reach the same state by two
 *  different promises. */
export type PublishingCommand = "move" | "skip" | "veto";

export interface PublishingMachine {
  /** Move a planned or in-review page to another site-local date. */
  move(a: { draftId: string; to: DayKey }): Promise<void>;
  /** Take a planned page off its date without publishing it. */
  skip(a: { draftId: string }): Promise<void>;
  /** Stop a page in review before its veto window closes (BUILD §9). */
  veto(a: { draftId: string }): Promise<void>;
}

/** Thrown by every method of the stub. It names what was asked and which
 *  issue supplies it, so a click that cannot go anywhere says exactly that
 *  in the one place a developer looks — and never to the customer, who is
 *  told nothing this product cannot yet do. */
export class PublishingNotBuiltError extends Error {
  constructor(public readonly command: PublishingCommand) {
    super(
      `The publishing machine is not built: "${command}" needs BUILD §9's state machine ` +
        `(src/lib/publish/, issues #45 and #46). The calendar renders the control its stage ` +
        `earns and calls this interface; nothing writes a draft until that lands.`
    );
    this.name = "PublishingNotBuiltError";
  }
}

/** The declared seam. One module-level constant, so a later issue swaps the
 *  implementation in one place; no caller constructs its own. */
export const publishing: PublishingMachine = Object.freeze({
  move(): Promise<void> {
    return Promise.reject(new PublishingNotBuiltError("move"));
  },
  skip(): Promise<void> {
    return Promise.reject(new PublishingNotBuiltError("skip"));
  },
  veto(): Promise<void> {
    return Promise.reject(new PublishingNotBuiltError("veto"));
  },
});
