// SPEC §7 — the draft's rail: decide (Approve, Edit, Veto), what happens if
// you do nothing, and the checks the draft passed.
//
// A daisyUI card in an `<aside>`, the same box the calendar's day panel
// stands in: beside the page and sticky from `xl`, in flow under it below.
// Not a drawer, at any width.
//
// **Nothing here decides which controls exist.** `draftActionsFor` projects
// them from §9's transition table, so this rail and the calendar's day panel
// cannot offer different actions for one state (REQ-044 c3). What this file
// decides is the rank: Approve is the screen's one solid primary across the
// column; Edit is ghost and Veto the warning outline, sharing the row under
// it. A state that offers none of them draws no control block at all.
"use client";

import type React from "react";
import { CircleCheck, Info } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { formatDateTime } from "../../_shell/format";
import { writtenLine } from "../../_shell/written";
import { draftActionsFor, type DraftCommand } from "./actions";
import { CHECK_COPY_KEY, checkRows, type RailCheck } from "./checks";
import type { ClaimState, DraftView } from "./model";

const EYEBROW = "text-xs font-semibold uppercase tracking-wide opacity-70";

export function DecidePanel(p: {
  view: DraftView;
  /** Whether the recorded fact is still in the body as it now stands —
   *  the same value the highlight is drawn from, so the grounded row and
   *  the mark cannot disagree. */
  grounded: boolean;
  /** The claim state as it now stands, which after an edit is not the
   *  stored one (REQ-045 c9). */
  claim: ClaimState;
  /** The rules the last check recorded a pass for, on the text as it now
   *  stands — empty while an edit has not been re-checked (#789). */
  recordedChecks: readonly RailCheck[];
  onEdit: () => void;
  onCommand: (command: DraftCommand) => void;
}): React.JSX.Element {
  const { view } = p;
  const actions = draftActionsFor(view.state);
  const rows = checkRows({
    grounded: p.grounded,
    groundedUrl: view.grounded.url,
    claim: p.claim,
    recorded: p.recordedChecks,
  });

  const doNothingLine =
    view.doNothing.publishesAt === null
      ? writtenLine(view.doNothing.key)
      : writtenLine(view.doNothing.key, {
          at: formatDateTime(view.doNothing.publishesAt, view.timeZone),
        });

  return (
    <aside className="card card-border bg-base-100 min-w-0 xl:sticky xl:top-4" data-testid="draft-decide">
      <div className="card-body min-w-0 gap-3 p-4">
        <h2 className={EYEBROW}>{copy("draft.decide.title")}</h2>

        {actions.length === 0 ? null : (
          <div className="grid grid-cols-2 gap-2" data-testid="draft-actions">
            {actions.map((action) =>
              action.kind === "edit" ? (
                <button
                  key={action.key}
                  type="button"
                  className="btn btn-sm btn-ghost"
                  data-testid={`draft-action-${action.key}`}
                  onClick={p.onEdit}
                >
                  {copy(action.key)}
                </button>
              ) : action.command === "veto" ? (
                <button
                  key={action.key}
                  type="button"
                  className="btn btn-sm btn-outline btn-warning"
                  data-testid={`draft-action-${action.key}`}
                  onClick={() => p.onCommand("veto")}
                >
                  {copy(action.key)}
                </button>
              ) : (
                <button
                  key={action.key}
                  type="button"
                  className="btn btn-sm btn-primary col-span-2"
                  data-testid={`draft-action-${action.key}`}
                  onClick={() => p.onCommand("approve")}
                >
                  {copy(action.key)}
                </button>
              )
            )}
          </div>
        )}

        {/* "What happens if you do nothing". The time is a value and renders
            whether or not the sentence around it has been written. */}
        <div role="note" className="alert items-start text-sm" data-testid="draft-do-nothing">
          <Info size={20} strokeWidth={1.75} aria-hidden />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-semibold">{copy("draft.do-nothing.title")}</span>
            {doNothingLine === null ? null : <span>{doNothingLine}</span>}
            {view.doNothing.publishesAt === null ? null : (
              <span className="num text-xs opacity-70" data-testid="draft-do-nothing-at">
                {formatDateTime(view.doNothing.publishesAt, view.timeZone)}
              </span>
            )}
          </div>
        </div>

        <div className="divider my-0" />

        <h2 className={EYEBROW}>{copy("draft.checks.title")}</h2>
        {/* A row is only ever drawn for a pass (`checkRows`). */}
        <ul className="flex flex-col gap-2 text-sm" data-testid="draft-checks">
          {rows.map((row) => (
            <li className="flex items-start gap-2" key={row.rule} data-testid={`draft-check-${row.rule}`}>
              <CircleCheck className="text-success mt-0.5 shrink-0" size={16} strokeWidth={1.75} aria-hidden />
              <span className="min-w-0">{copy(CHECK_COPY_KEY[row.rule], row.vars)}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
