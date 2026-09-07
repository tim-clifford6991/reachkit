// BUILD §4.6 — "Approve / Edit / Veto" on the draft view, projected from
// the same table the calendar's day panel projects from.
//
// REQ-045 criterion 4 puts all three in the view "without leaving it", and
// the archived BP-044 fixes how the set is chosen: "which of them is
// offered follows the same projection from BP-015's `TRANSITIONS` that
// BP-039 decision 2 describes, so the two surfaces cannot offer different
// actions for one state." So this file reads §9's own transition
// table (`src/lib/publish/machine/table.ts`) rather than restating it — a
// hand-list here would be a second copy of the state machine, and the two
// would drift the first time an edge changed. Until issue #130 it read the
// calendar's transcription of that table; it now reads the table itself,
// so "the two surfaces read one table" is true in the literal sense.
//
// Three rules, one edge each:
//
//   Approve — the `→ approved` edge (§9: "Copilot = explicit approve only").
//   Veto    — the `→ skipped` edge, under the word §9 gives it at that tail
//             (`STOP_COMMAND`, the calendar's own projection).
//   Edit    — offered on exactly the states that can still reach `approved`.
//             Editing is not a transition, so it has no edge of its own; the
//             fact it *rides* on is that text which can still be approved is
//             text that has not gone out, and that is the same condition
//             read off the same table rather than a second list of state
//             names.
import { isTransition } from "@/lib/publish/machine/table";
import type { CopyKey } from "@/lib/presentation/copy";
import { STOP_COMMAND } from "../../calendar/actions";
import type { PublishingCommand } from "../../calendar/publishing";
import type { State } from "../../calendar/stages";

/** A control the draft view offers. Two arms and no third: `command` is a
 *  write against the declared publishing seam, `edit` changes what this
 *  screen shows and writes nothing until the autosave runs. Neither
 *  carries a sentence — the `key` is read through `copy()` by whatever
 *  renders it. */
export type DraftCommand = Extract<PublishingCommand, "approve" | "veto">;

export type DraftAction =
  | { key: CopyKey; kind: "command"; command: DraftCommand }
  | { key: CopyKey; kind: "edit" };

export function isEditable(state: State): boolean {
  return isTransition(state, "approved");
}

export function draftActionsFor(state: State): readonly DraftAction[] {
  const actions: DraftAction[] = [];

  if (isTransition(state, "approved")) {
    actions.push({ key: "draft.action.approve", kind: "command", command: "approve" });
  }
  if (isEditable(state)) {
    actions.push({ key: "draft.action.edit", kind: "edit" });
  }
  if (STOP_COMMAND[state] === "veto") {
    actions.push({ key: "draft.action.veto", kind: "command", command: "veto" });
  }

  return actions;
}
