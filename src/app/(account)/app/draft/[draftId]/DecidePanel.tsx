// `Canvas: DailyAction` — the draft's right-hand rail: two cards, Decide
// above Checks. 290px and sticky beside the page at the wide band; in flow
// under it below. Not a drawer, at any width.
//
// **Nothing here decides which controls exist.** `draftActionsFor` projects
// them from §9's transition table, so this rail and the calendar's day
// panel cannot offer different actions for one state (REQ-044 c3). What
// this file decides is the *rank* each takes: Approve is the screen's one
// solid primary and takes the full column; Edit is the quiet tertiary and
// Veto the warn outline, sharing the row under it. A state that offers none
// of them — a page past review — draws no control block at all rather than
// an empty row.
"use client";

import type React from "react";
import { Check } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { Btn } from "@/ui/components/Btn";
import { formatDateTime } from "../../_shell/format";
import { writtenLine } from "../../_shell/written";
import { draftActionsFor, type DraftCommand } from "./actions";
import { CHECK_COPY_KEY, checkRows } from "./checks";
import type { ClaimState, DraftView } from "./model";
import { CARD, EYEBROW, QUIET, TINTED } from "./skin";

export function DecidePanel(p: {
  view: DraftView;
  /** Whether the recorded fact is still in the body as it now stands —
   *  the same value the highlight is drawn from, so the grounded row and
   *  the mark cannot disagree. */
  grounded: boolean;
  /** The claim state as it now stands, which after an edit is not the
   *  stored one (REQ-045 c9). */
  claim: ClaimState;
  /** Hours and minutes left of the veto window, resolved on the server
   *  against the one clock. Absent where the window has run out or the
   *  page has none. */
  countdown?: { hours: number; minutes: number } | null;
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

  const publishesAt = view.doNothing.publishesAt;
  const doNothingLine =
    publishesAt === null
      ? writtenLine(view.doNothing.key)
      : writtenLine(view.doNothing.key, { at: formatDateTime(publishesAt, view.timeZone) });

  return (
    <aside
      className="flex w-full min-w-0 flex-col gap-(--s-5) xl:w-(--w-day-panel) xl:flex-none"
      data-testid="draft-decide"
    >
      <div className="flex flex-col gap-(--s-5) xl:sticky xl:top-0">
        <section className={CARD}>
          <span className={EYEBROW}>{copy("draft.decide.title")}</span>

          {/* §4.6's "what happens if you do nothing", on the accent tint the
              canvas gives it. The time is a value and renders whether or not
              the sentence around it has been written; under copilot there is
              no time, because nothing happens. */}
          <div className={TINTED} data-testid="draft-do-nothing">
            {publishesAt === null ? null : (
              <span className="text-(length:--h4) font-semibold">
                {copy("draft.do-nothing.publishes", {
                  at: formatDateTime(publishesAt, view.timeZone),
                })}
              </span>
            )}
            {p.countdown == null ? null : (
              <span
                className="num text-(length:--h2) font-semibold"
                data-testid="draft-do-nothing-countdown"
              >
                {copy("draft.do-nothing.countdown", {
                  hours: p.countdown.hours,
                  minutes: p.countdown.minutes,
                })}
              </span>
            )}
            <span className={QUIET}>{copy("draft.do-nothing.title")}</span>
            {doNothingLine === null ? null : <span className={QUIET}>{doNothingLine}</span>}
            {publishesAt === null ? null : (
              <span className={`num num-phrase ${QUIET}`} data-testid="draft-do-nothing-at">
                {formatDateTime(publishesAt, view.timeZone)}
              </span>
            )}
          </div>

          {actions.length === 0 ? null : (
            <div className="flex flex-wrap items-center gap-(--s-3)" data-testid="draft-actions">
              {actions.map((action) => {
                const solid = action.kind === "command" && action.command === "approve";
                return (
                  <span
                    key={action.key}
                    className={solid ? "w-full" : "flex-1"}
                    data-testid={`draft-action-${action.key}`}
                  >
                    {action.kind === "edit" ? (
                      <Btn
                        label={copy(action.key)}
                        variant="tertiary"
                        size="sm"
                        pill
                        block
                        onClick={p.onEdit}
                      />
                    ) : action.command === "veto" ? (
                      <Btn
                        label={copy(action.key)}
                        variant="secondary"
                        tone="warn"
                        size="sm"
                        pill
                        block
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
        </section>

        <section className={CARD}>
          <span className={EYEBROW}>{copy("draft.checks.title")}</span>
          <div className="flex flex-col gap-(--s-2)" data-testid="draft-checks">
            {rows.map((row) => (
              <p
                className={`flex items-start gap-(--s-2) ${QUIET}`}
                key={row.rule}
                data-testid={`draft-check-${row.rule}`}
              >
                <span className="flex-none text-(color:--ok)">
                  <Check size={16} strokeWidth={1.75} aria-hidden />
                </span>
                <span>{copy(CHECK_COPY_KEY[row.rule], row.vars)}</span>
              </p>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
