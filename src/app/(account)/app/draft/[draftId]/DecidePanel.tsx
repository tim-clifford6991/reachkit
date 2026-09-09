// UI-SPEC S16 — the draft's right-hand rail: "Decide · solid Approve · Edit
// · Veto (warn) · 'If you do nothing' info · Checks list".
//
// It is `Panel` — §2.2's one registered panel, the same box S15 stands the
// calendar's day detail in (`src/ui/components/custom/DayPanel.tsx` says
// why there is one box and not two). At and above the wide band it sits
// beside the page, 290px and sticky; below it, in flow under the page. Not
// a drawer, at any width.
//
// **Nothing here decides which controls exist.** `draftActionsFor` projects
// them from §9's transition table, so this rail and the calendar's day
// panel cannot offer different actions for one state (REQ-044 c3). What
// this file decides is the *rank* each takes in the rail, which is the
// idiom's and is read off the action itself rather than off its position:
// Approve is the screen's one solid primary and takes the full column;
// Edit is the quiet tertiary and Veto the warn outline, sharing the row
// under it. A state that offers none of them — a page past review — draws
// no control block at all rather than an empty row.
"use client";

import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { Btn } from "@/ui/components/Btn";
import { Panel } from "@/ui/components/custom";
import { formatDateTime } from "../../_shell/format";
import { writtenLine } from "../../_shell/written";
import { draftActionsFor, type DraftCommand } from "./actions";
import { CHECK_COPY_KEY, checkRows } from "./checks";
import type { ClaimState, DraftView } from "./model";

export function DecidePanel(p: {
  view: DraftView;
  /** Whether the recorded fact is still in the body as it now stands —
   *  the same value the highlight is drawn from, so the grounded row and
   *  the mark cannot disagree. */
  grounded: boolean;
  /** The claim state as it now stands, which after an edit is not the
   *  stored one (REQ-045 c9). */
  claim: ClaimState;
  onEdit: () => void;
  onCommand: (command: DraftCommand) => void;
}): React.JSX.Element {
  const { view } = p;
  const actions = draftActionsFor(view.state);
  const rows = checkRows({
    grounded: p.grounded,
    groundedUrl: view.grounded.url,
    claim: p.claim,
    recorded: view.recordedChecks,
  });

  const doNothingLine =
    view.doNothing.publishesAt === null
      ? writtenLine(view.doNothing.key)
      : writtenLine(view.doNothing.key, {
          at: formatDateTime(view.doNothing.publishesAt, view.timeZone),
        });

  return (
    <Panel testId="draft-decide">
      <p className="eyebrow rk-daypanel-eyebrow">{copy("draft.decide.title")}</p>

      {actions.length === 0 ? null : (
        <div className="rk-daypanel-actions" data-testid="draft-actions">
          {actions.map((action) => {
            const solid = action.kind === "command" && action.command === "approve";
            return (
              <span
                key={action.key}
                className={solid ? "rk-daypanel-block" : "rk-daypanel-half"}
                data-testid={`draft-action-${action.key}`}
              >
                {action.kind === "edit" ? (
                  <Btn
                    label={copy(action.key)}
                    variant="tertiary"
                    size="sm"
                    pill
                    onClick={p.onEdit}
                  />
                ) : action.command === "veto" ? (
                  <Btn
                    label={copy(action.key)}
                    variant="secondary"
                    tone="warn"
                    size="sm"
                    pill
                    onClick={() => p.onCommand("veto")}
                  />
                ) : (
                  <Btn
                    label={copy(action.key)}
                    variant="primary"
                    size="sm"
                    pill
                    block
                    onClick={() => p.onCommand("approve")}
                  />
                )}
              </span>
            );
          })}
        </div>
      )}

      <hr className="rk-daypanel-rule" />

      {/* §4.6's "what happens if you do nothing". The time is a value and
          renders whether or not the sentence around it has been written;
          under copilot there is no time, because nothing happens. */}
      <div className="rk-note" data-testid="draft-do-nothing">
        <span className="rk-note-title">{copy("draft.do-nothing.title")}</span>
        {doNothingLine === null ? null : <span>{doNothingLine}</span>}
        {view.doNothing.publishesAt === null ? null : (
          <span className="rk-prov" data-testid="draft-do-nothing-at">
            {formatDateTime(view.doNothing.publishesAt, view.timeZone)}
          </span>
        )}
      </div>

      <hr className="rk-daypanel-rule" />

      <p className="eyebrow rk-daypanel-eyebrow">{copy("draft.checks.title")}</p>
      <div className="flex flex-col gap-2" data-testid="draft-checks">
        {rows.map((row) => (
          <p className="rk-check" key={row.rule} data-testid={`draft-check-${row.rule}`}>
            <span className="rk-check-dot" aria-hidden />
            <span>{copy(CHECK_COPY_KEY[row.rule], row.vars)}</span>
          </p>
        ))}
      </div>
    </Panel>
  );
}
