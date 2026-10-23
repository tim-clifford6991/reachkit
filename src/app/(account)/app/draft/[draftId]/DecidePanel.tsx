// SPEC §7 — the draft's rail (board `AppDraft`): when the page goes live on
// its own, Edit and Stop (or, on a page the rules stopped, Edit, Write it
// again, Skip; #1180), what Stop does, and the page's day.
//
// **There is no Approve** (owner 2026-10-08, issue 1337: "remove the approve
// button entirely, autopilot only … they can solely edit or stop the
// content"). The rail asks for nothing: the time it goes live, stated and
// never ticking, leads, then Edit (soft) and Stop (ghost warning), the
// line saying what Stop does, the day's timeline and the two copy-out
// buttons. No control on it is a solid primary. Below `md` the bar
// says the same thing in one line with the time in it.
//
// A daisyUI card in an `<aside>`, the same box the calendar's day panel
// stands in: beside the page and sticky from `xl`, in flow under it below —
// under the article and above the notes (2026-10-07, issue 1325), so the
// decision is never below them. Not a drawer, at any width.
//
// **Below `md` the three controls are a bar at the foot of the viewport**
// (owner's review of #931, 2026-09-21). The page in its frame is ~5,300px
// tall on a phone, and the rail was the last thing under it: a reviewer
// could not stop a page without scrolling past the whole of it
// and every card. So the controls come to the reviewer.
//
// **One set of controls.** There is no phone copy of the buttons: the same
// ones are lifted out of flow by `max-md:` classes, and from `md` up every
// such class is inert. A second copy would be a second thing to keep in step
// with §9's transition table. The do-nothing sentence is the one thing said
// twice, in two wordings for two widths, because the phone has no go-live box.
//
// **Nothing here decides which controls exist.** `draftActionsFor` projects
// them from §9's transition table, so this rail and the calendar's day panel
// cannot offer different actions for one state (REQ-044 c3). What this file
// decides is the rank: Edit is soft and Stop is a ghost in warning (E7).
// A state that offers none of them draws no control block at all.
//
// The state it projects from is the screen's, not the stored view's (issue
// #913): while a decision is in flight that is the state the decision asks
// for, so the rail answers the press at once and rolls back with it if the
// machine refuses.
"use client";

import type React from "react";
import { CircleCheck, CircleStop, Clock, Pencil, RotateCcw } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { formatDate, formatDateTime } from "../../_shell/format";
import { writtenLine } from "../../_shell/written";
import { draftActionsFor, type DraftCommand } from "./actions";
import { CopyOut } from "./CopyOut";
import type { State } from "../../calendar/stages";
import { firstReadingOn, type DraftView } from "./model";
import { SHAPE } from "./shape";

/** When the page goes live, as a stated time rather than a ticking clock:
 *  nothing is asked of the reader, so nothing on the rail should hurry them. */
function GoesLive(p: { at: Date; timeZone: string }): React.JSX.Element {
  return (
    <p className="rounded-box bg-base-200 min-w-0 p-4 text-sm max-md:hidden" data-testid="draft-goes-live">
      {copy("draft.decide.goes-live", { at: formatDateTime(p.at, p.timeZone) })}
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
function daySteps(view: DraftView, publishesAt: Date): DayStep[] {
  const steps: DayStep[] = [];
  if (view.writtenAt !== null) {
    steps.push({ key: "written", at: formatDateTime(view.writtenAt, view.timeZone), done: true });
  }
  if (view.emailedAt !== null) {
    steps.push({ key: "emailed", at: formatDateTime(view.emailedAt, view.timeZone), done: true });
  }
  steps.push({ key: "live", at: formatDateTime(publishesAt, view.timeZone), done: false });
  steps.push({ key: "reading", at: formatDate(firstReadingOn(publishesAt, view.timeZone), "UTC"), done: false });
  return steps;
}

function DayTimeline(p: { steps: readonly DayStep[] }): React.JSX.Element {
  return (
    <ul className="timeline timeline-vertical timeline-compact min-w-0" aria-label={copy("draft.day.title")} data-testid="draft-day">
      {p.steps.map((step, at) => (
        <li key={step.key} data-testid={`draft-day-${step.key}`}>
          {at === 0 ? null : <hr className={step.done ? "bg-success" : undefined} />}
          <div className={`timeline-middle ${step.done ? "text-success" : step.key === "live" ? "text-primary" : "text-base-content/70"}`}>
            {step.done ? <CircleCheck size={18} strokeWidth={1.75} aria-hidden /> : <Clock size={18} strokeWidth={1.75} aria-hidden />}
          </div>
          <div className="timeline-end mb-3 min-w-0 text-sm">
            <span className="block font-semibold">{copy(`draft.day.${step.key}`)}</span>
            <span className="block text-base-content/70">{step.at}</span>
          </div>
          {at === p.steps.length - 1 ? null : <hr className={step.done ? "bg-success" : undefined} />}
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

  /** The bar's one line (below `md`): the sentence with the time in it,
   *  because a phone has no room for the go-live box. */
  const barLine =
    view.doNothing.key === null
      ? null
      : publishesAt === null
        ? writtenLine(view.doNothing.key)
        : writtenLine(view.doNothing.key, { at: formatDateTime(publishesAt, view.timeZone) });
  const stops = actions.some((action) => action.kind === "command" && action.command === "veto");

  return (
    <aside
      className={`card card-border bg-base-100 xl:sticky xl:top-4 ${SHAPE.decide}`}
      // Named, because the shell puts a second `<aside>` on this screen —
      // the side panel — and two complementary landmarks with no names are
      // two landmarks a reader cannot tell apart (`landmark-unique`, #328).
      aria-label={copy("draft.decide.title")}
      data-testid="draft-decide"
    >
      <div className="card-body min-w-0 gap-4 p-5">
        <h2 className="eyebrow max-md:hidden">{copy("draft.decide.title")}</h2>

        {counting && publishesAt !== null ? (
          <GoesLive at={publishesAt} timeZone={view.timeZone} />
        ) : null}

        {/* The bar. In flow inside the card from `md` up, and fixed to the
            foot of the viewport below it (owner's review of #931): the page
            is ~5,300px tall on a phone, so the controls come to the
            reviewer. One DOM — the same buttons at every width, so
            the phone cannot offer an action §9's table refuses. It stacks
            at `z-[2]`, above the dock's `1` and below the drawer's `10`,
            and sits at the dock's own height (`4rem` + the safe area). */}
        <div
          className="flex min-w-0 flex-col gap-2 max-md:fixed max-md:inset-x-0 max-md:bottom-[calc(4rem+env(safe-area-inset-bottom))] max-md:z-[2] max-md:gap-1 max-md:border-t max-md:border-base-300 max-md:bg-base-100 max-md:px-4 max-md:py-2"
          // Below `md` the heading that named this block is hidden, so the
          // group carries the same words as its accessible name instead.
          role="group"
          aria-label={copy("draft.decide.title")}
          data-testid="draft-decide-bar"
        >
          {barLine === null ? null : (
            // **One clamped line, and the clamp is on the prose**: the
            // clamping element holds its own text node and is not in the
            // mono face, which is what `tests/ui/layout/checks.ts` asks.
            <p
              className="min-w-0 truncate text-center text-xs text-base-content/70 md:hidden"
              data-testid="draft-do-nothing-bar"
            >
              {barLine}
            </p>
          )}

          {actions.length === 0 ? null : (
            <div
              className="grid grid-cols-1 gap-2 max-md:auto-cols-fr max-md:grid-flow-col max-md:grid-cols-none"
              data-testid="draft-actions"
            >
              {actions.map((action) =>
                action.kind === "edit" ? (
                  <button
                    key={action.key}
                    type="button"
                    className="btn btn-sm btn-soft"
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
                    className="btn btn-sm btn-ghost btn-warning"
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
                    className="btn btn-sm btn-soft"
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

        </div>

        {stops ? (
          <p id={STOP_NOTE_ID} className="text-xs text-base-content/70" data-testid="draft-stop-note">
            {copy("draft.decide.stop-note")}
          </p>
        ) : null}

        {counting && publishesAt !== null ? <DayTimeline steps={daySteps(view, publishesAt)} /> : null}

        {/* Copy-out is always here — for a draft and a published page alike
            (c12): the words are theirs, for any destination. */}
        <CopyOut bodyMd={p.bodyMd} />
      </div>
    </aside>
  );
}
