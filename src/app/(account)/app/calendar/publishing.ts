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
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-05: Calendar actions are projected from the publishing transition table,
//   never listed per stage; Move/Skip/Veto call a declared publishing interface whose stub
//   rejects with `PublishingNotBuiltError` — a control never appears to work before its engine
//   exists. — #99

import type { DayKey } from "./dates";
import { approveDraft, regenerateDraft, skipDraft, vetoDraft } from "./publishing-actions";

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
/** 2026-09-07, issue #143: §9's `needs_attention → generating` — the
 *  customer's own restart, and the one edge §9 opens for them and for no
 *  one else. Its own type beside `StopCommand` because it is the opposite
 *  of one: every stop command ends a page's run at its date, and this one
 *  starts it over. */
export type RestartCommand = "regenerate";

export type PublishingCommand = StopCommand | RestartCommand | "approve";

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
  regenerate(a: { draftId: string }): Promise<void>;
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
  regenerate(a: { draftId: string }): Promise<void> {
    return run("regenerate", regenerateDraft(a.draftId));
  },
});
