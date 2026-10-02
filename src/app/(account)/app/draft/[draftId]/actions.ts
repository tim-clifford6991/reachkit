// BUILD §4.6 — the draft view's controls, projected from the same table the
// calendar's day panel projects from.
//
// REQ-045 criterion 4 puts them in the view "without leaving it", and the
// archived BP-044 fixes how the set is chosen: "which of them is offered
// follows the same projection from BP-015's `TRANSITIONS` that BP-039
// decision 2 describes, so the two surfaces cannot offer different actions
// for one state." So this file reads §9's own transition table
// (`src/lib/publish/machine/table.ts`) and the calendar's own words for its
// edges (`STOP_COMMAND`, `RESTART_COMMAND`) rather than restating them.
//
//   Approve    — the `→ approved` edge (§9: "Copilot = explicit approve only").
//   Edit       — `isEditableDraft`: text that can still be approved, or a
//                page the rules stopped before review (SPEC §7, #833,
//                #1180), whose passing save takes it into review.
//   Regenerate — the customer's `needs_attention → generating`, on a page
//                that never entered review (the edge's own guard).
//   Veto/Skip  — the `→ skipped` edge, under the word §9 gives it at that
//                tail.
import { isEditableDraft, isTransition } from "@/lib/publish/machine/table";
import type { CopyKey } from "@/lib/presentation/copy";
import { RESTART_COMMAND, STOP_COMMAND } from "../../calendar/actions";
import type { PublishingCommand } from "../../calendar/publishing";
import type { State } from "../../calendar/stages";

/** A control the draft view offers. Two arms and no third: `command` is a
 *  write against the declared publishing seam, `edit` changes what this
 *  screen shows and writes nothing until the autosave runs. Neither
 *  carries a sentence — the `key` is read through `copy()` by whatever
 *  renders it. */
export type DraftCommand = PublishingCommand;

export type DraftAction =
  | { key: CopyKey; kind: "command"; command: DraftCommand }
  | { key: CopyKey; kind: "edit" };

/** The page as the projection reads it: its state, and whether it ever
 *  entered review — two pages can both read `needs_attention` and only one
 *  of them may be edited or written again. */
export interface DraftStanding {
  state: State;
  enteredReview: boolean;
}

export function isEditable(page: DraftStanding): boolean {
  return isEditableDraft(page.state, page.enteredReview);
}

export function draftActionsFor(page: DraftStanding): readonly DraftAction[] {
  const actions: DraftAction[] = [];
  const { state } = page;

  if (isTransition(state, "approved")) {
    actions.push({ key: "draft.action.approve", kind: "command", command: "approve" });
  }
  if (isEditable(page)) {
    actions.push({ key: "draft.action.edit", kind: "edit" });
  }
  if (isTransition(state, "generating") && RESTART_COMMAND[state] === "regenerate" && !page.enteredReview) {
    actions.push({ key: "calendar.action.regenerate", kind: "command", command: "regenerate" });
  }
  const stop = STOP_COMMAND[state];
  if (stop === "veto") {
    actions.push({ key: "draft.action.veto", kind: "command", command: "veto" });
  } else if (stop === "skip" && state === "needs_attention") {
    // A planned page has no draft to open; Skip on this screen is the
    // stopped page's (#833: "Skip releases the opportunity").
    actions.push({ key: "calendar.action.skip", kind: "command", command: "skip" });
  }

  return actions;
}
