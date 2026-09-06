// BUILD §4.6 — the stage-appropriate actions, and the machine behind them.
//
// §4.6 gives four stages a control that changes something: review → Move or
// Veto, planned → Move or Skip; the draft view adds Approve. Every one of
// those is a write against §9's state machine, which now exists:
// `src/lib/publish/`, issue #45.
//
// So this file is the seam and no longer the stub. Three of the four
// commands are §9 edges and go to `transition()` — the one mover of state —
// through the Server Functions in `./publishing-actions`. The fourth,
// `move`, is **not a transition at all**: moving a page to another date
// changes `drafts.scheduled_for` and the veto deadline that hangs off it,
// which is the re-deadline rule (#46). It still refuses, and it says so
// naming what it needs — a control that resolved without moving anything
// would look exactly like one that worked.
//
// **A refusal rejects; it never resolves.** `transition()` answers with a
// value, not an exception, and the panel's contract is the opposite: a
// click that changed nothing must not settle as though it had. So the seam
// turns a refusal into `PublishingRefusedError`, carrying the machine's own
// word for why, and the panel goes on telling the customer nothing — there
// is no registry sentence for a refused write, and inventing one is what
// the copy law forbids.
import type { DayKey } from "./dates";
import { approveDraft, skipDraft, vetoDraft } from "./publishing-actions";

/** The three writes §4.6's day panel offers. Named for what the customer
 *  does, not for the transition underneath — `veto` is REQ-046's veto and
 *  `skip` is BUILD §9's `skipped`, and they reach the same state by two
 *  different promises. */
export type StopCommand = "move" | "skip" | "veto";

/** 2026-09-06, issue #17: §4.6's *draft view* offers a fourth — "Approve /
 *  Edit / Veto". `edit` is not here and never will be: editing is a text
 *  write against the draft's own store (`draft/[draftId]/save.ts`), not a
 *  transition of §9's state machine, and putting it in this union would
 *  make one seam answer for two different promises. Approve is the
 *  `in_review → approved` edge and belongs here beside its own opposite. */
export type PublishingCommand = StopCommand | "approve";

export interface PublishingMachine {
  /** Move a planned or in-review page to another site-local date. */
  move(a: { draftId: string; to: DayKey }): Promise<void>;
  /** Take a planned page off its date without publishing it. */
  skip(a: { draftId: string }): Promise<void>;
  /** Stop a page in review before its veto window closes (§9). */
  veto(a: { draftId: string }): Promise<void>;
  /** Approve a page in review, ahead of the veto window (§9: "Copilot =
   *  explicit approve only"). */
  approve(a: { draftId: string }): Promise<void>;
}

/** Thrown when the machine refused the move. It carries the machine's own
 *  refusal word — `not_a_transition`, or the name of the guard that said no
 *  — so a click that could not go anywhere says exactly why in the one
 *  place a developer looks, and never to the customer. */
export class PublishingRefusedError extends Error {
  constructor(
    public readonly command: PublishingCommand,
    public readonly refused: string
  ) {
    super(
      `The publishing machine refused "${command}": ${refused}. ` +
        `The page keeps the state it holds; nothing was written.`
    );
    this.name = "PublishingRefusedError";
  }
}

/** Thrown by `move` alone. Moving a page to another date is not one of §9's
 *  fifteen edges: it rewrites the schedule and the veto deadline that hangs
 *  off it, which is issue #46's re-deadline rule. */
export class PublishingNotBuiltError extends Error {
  constructor(public readonly command: PublishingCommand) {
    super(
      `The publishing machine cannot yet run "${command}": moving a page to another date ` +
        `is not one of BUILD §9's transitions — it rewrites the schedule and the veto ` +
        `deadline that hangs off it (issue #46's re-deadline rule). The calendar renders ` +
        `the control its stage earns and calls this interface; nothing writes a draft ` +
        `until that lands.`
    );
    this.name = "PublishingNotBuiltError";
  }
}

async function run(command: PublishingCommand, refusal: Promise<string | null>): Promise<void> {
  const refused = await refusal;
  if (refused !== null) throw new PublishingRefusedError(command, refused);
}

/** The declared seam. One module-level constant, so a later issue swaps an
 *  implementation in one place; no caller constructs its own. */
export const publishing: PublishingMachine = Object.freeze({
  move(): Promise<void> {
    return Promise.reject(new PublishingNotBuiltError("move"));
  },
  skip(a: { draftId: string }): Promise<void> {
    return run("skip", skipDraft(a.draftId));
  },
  veto(a: { draftId: string }): Promise<void> {
    return run("veto", vetoDraft(a.draftId));
  },
  approve(a: { draftId: string }): Promise<void> {
    return run("approve", approveDraft(a.draftId));
  },
  approve(): Promise<void> {
    return Promise.reject(new PublishingNotBuiltError("approve"));
  },
});
