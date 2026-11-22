// SPEC §7 — a page's rail: when the page goes live on its own, Edit and Stop (or, on a page the rules stopped, Edit,
// Write it again, Skip; #1180), what Stop does, the page's day and the copy-out buttons. There is no Approve (owner
// 2026-10-08, issue 1337: autopilot only), and no control on it is a solid primary.
//
// Below `md` the controls and Stop's line are a bar at the foot (`SHAPE.foot`): one set of buttons at every width,
// so the phone cannot offer an action §9's table refuses. `draftActionsFor` projects them from that table, from the
// screen's state, so the rail answers a press at once and rolls back with it if the machine refuses (#913).
"use client";

import type React from "react";
import { CircleCheck, CircleStop, Clock4, Pencil, RotateCcw } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { formatDateTime, formatShortDay, formatTime, localDate } from "../../_shell/format";
import { draftActionsFor, type DraftCommand } from "./actions";
import { CopyOut } from "./CopyOut";
import type { State } from "../../calendar/stages";
import { firstReadingOn, type DraftView } from "./model";
import { SHAPE } from "./shape";

/** "Today, 9:00" or "Tue 24 Nov, 9:00", in the site's zone. */
function goesLiveAt(at: Date, timeZone: string): string {
  const time = formatTime(at, timeZone);
  return localDate(at, timeZone) === localDate(new Date(), timeZone)
    ? copy("draft.rail.today", { time })
    : copy("draft.rail.day", { day: formatShortDay(at, timeZone), time });
}

/** When the page goes live, as a stated time rather than a ticking clock:
 *  nothing is asked of the reader, so nothing on the rail should hurry them. */
function GoesLive(p: { at: Date; timeZone: string }): React.JSX.Element {
  return (
    <p className="flex min-w-0 flex-col gap-1" data-testid="draft-goes-live">
      <span className="eyebrow text-primary">{copy("draft.decide.goes-live")}</span>
      <span className="text-lg font-bold">{goesLiveAt(p.at, p.timeZone)}</span>
    </p>
  );
}

/** One step of the page's day. */
interface DayStep {
  key: "written" | "emailed" | "live" | "reading";
  at: string;
  done: boolean;
}

/** The page's day, in the order it happens: only steps with a recorded or
 *  scheduled moment are drawn, so a mail that never left is not a step. */
export function daySteps(view: DraftView, publishesAt: Date): DayStep[] {
  const steps: DayStep[] = [];
  if (view.writtenAt !== null) {
    steps.push({ key: "written", at: formatDateTime(view.writtenAt, view.timeZone), done: true });
  }
  if (view.emailedAt !== null) {
    steps.push({ key: "emailed", at: formatDateTime(view.emailedAt, view.timeZone), done: true });
  }
  steps.push({ key: "live", at: formatDateTime(publishesAt, view.timeZone), done: false });
  steps.push({ key: "reading", at: formatShortDay(firstReadingOn(publishesAt, view.timeZone), "UTC"), done: false });
  return steps;
}

// Done is filled success, the next moment filled primary, a later one an empty ring.
const DOT = {
  done: "bg-success text-success-content",
  next: "bg-primary text-primary-content",
  later: "border-base-300 bg-base-100 border-2",
} as const;

export function DayTimeline(p: { steps: readonly DayStep[] }): React.JSX.Element {
  return (
    <ul className="timeline timeline-vertical timeline-compact min-w-0" aria-label={copy("draft.day.title")} data-testid="draft-day">
      {p.steps.map((step, at) => (
        <li key={step.key} data-testid={`draft-day-${step.key}`}>
          {at === 0 ? null : <hr className="bg-base-300" />}
          <div className={`timeline-middle grid size-[22px] place-items-center rounded-full ${DOT[step.done ? "done" : step.key === "live" ? "next" : "later"]}`}>
            {step.done ? <CircleCheck size={16} strokeWidth={2} aria-hidden /> : step.key === "live" ? <Clock4 size={16} strokeWidth={2} aria-hidden /> : null}
          </div>
          <div className="timeline-end mb-3 min-w-0 text-sm">
            <span className="block font-semibold">{copy(`draft.day.${step.key}`)}</span>
            <span className="block text-base-content/70">{step.at}</span>
          </div>
          {at === p.steps.length - 1 ? null : <hr className="bg-base-300" />}
        </li>
      ))}
    </ul>
  );
}

const STOP_NOTE_ID = "draft-stop-note";

export function DecidePanel(p: {
  view: DraftView;
  /** The page's §9 state as the screen believes it — the stored one, or,
   *  while a decision is in flight, the one that decision asks for (issue
   *  #913). The controls are projected from it, so pressing Stop takes
   *  the controls off the rail at once rather than leaving a second press
   *  that could only be refused. */
  state: State;
  /** Whether a decision this rail asked for is still in flight. Both
   *  controls are inert while one is. */
  deciding: boolean;
  /** The command whose press is pending, which alone shows the spinner. */
  pressed: DraftCommand | null;
  /** The body as it now stands, for the copy-out buttons. */
  bodyMd: string;
  onEdit: () => void;
  onCommand: (command: DraftCommand) => void;
}): React.JSX.Element {
  const { view } = p;
  const actions = draftActionsFor({ state: p.state, enteredReview: view.enteredReview });
  const publishesAt = view.doNothing.publishesAt;
  /** Stated only while the page can still be stopped: the moment Stop is
   *  pressed the controls leave and so does it. */
  const counting = publishesAt !== null && actions.length > 0;

  const stops = actions.some((action) => action.kind === "command" && action.command === "veto");

  return (
    <aside
      className={SHAPE.rail}
      // Named: the shell's side panel is a second `<aside>` (`landmark-unique`, #328).
      aria-label={copy("draft.decide.title")}
      data-testid="draft-decide"
    >
      <div className="card-body min-w-0 gap-4 p-5">
        {counting && publishesAt !== null ? (
          <GoesLive at={publishesAt} timeZone={view.timeZone} />
        ) : view.doNothing.held !== undefined ? (
          <p className="text-sm text-base-content/70" data-testid="draft-unpaid">
            {copy(view.doNothing.held)}
          </p>
        ) : null}

        <div
          className={SHAPE.foot}
          role="group"
          aria-label={copy("draft.decide.title")}
          data-testid="draft-decide-bar"
        >
          {actions.length === 0 ? null : (
            <div
              className="grid grid-cols-1 gap-2 max-lg:auto-cols-fr max-lg:grid-flow-col max-lg:grid-cols-none"
              data-testid="draft-actions"
            >
              {actions.map((action) =>
                action.kind === "edit" ? (
                  <button
                    key={action.key}
                    type="button"
                    className="btn btn-soft btn-primary min-h-11"
                    data-testid={`draft-action-${action.key}`}
                    onClick={p.onEdit}
                  >
                    <Pencil size={14} strokeWidth={1.75} aria-hidden />
                    {copy(action.key)}
                  </button>
                ) : action.command === "veto" || action.command === "skip" ? (
                  <button
                    key={action.key}
                    type="button"
                    className="btn btn-ghost btn-warning border-warning/30 min-h-11"
                    data-testid={`draft-action-${action.key}`}
                    aria-describedby={action.command === "veto" ? STOP_NOTE_ID : undefined}
                    disabled={p.deciding}
                    onClick={() => p.onCommand(action.command)}
                  >
                    {p.pressed === action.command ? (
                      <span className="loading loading-spinner loading-xs" aria-hidden />
                    ) : (
                      <CircleStop size={14} strokeWidth={1.75} aria-hidden />
                    )}
                    {copy(action.key)}
                  </button>
                ) : (
                  <button
                    key={action.key}
                    type="button"
                    className="btn btn-soft min-h-11"
                    data-testid={`draft-action-${action.key}`}
                    disabled={p.deciding}
                    onClick={() => p.onCommand("regenerate")}
                  >
                    {p.pressed === "regenerate" ? (
                      <span className="loading loading-spinner loading-xs" aria-hidden />
                    ) : (
                      <RotateCcw size={14} strokeWidth={1.75} aria-hidden />
                    )}
                    {copy(action.key)}
                  </button>
                ),
              )}
            </div>
          )}
          {stops ? (
            <p id={STOP_NOTE_ID} className="text-xs text-base-content/70 max-md:order-first" data-testid="draft-stop-note">
              {copy("draft.decide.stop-note")}
            </p>
          ) : null}
        </div>

        {/* Below `lg` the day ends the Page tab instead. */}
        {counting && publishesAt !== null ? (
          <div className="max-lg:hidden">
            <DayTimeline steps={daySteps(view, publishesAt)} />
          </div>
        ) : null}

        {/* Copy-out is always here — for a draft and a published page alike
            (c12): the words are theirs, for any destination. */}
        <CopyOut bodyMd={p.bodyMd} />
      </div>
    </aside>
  );
}
