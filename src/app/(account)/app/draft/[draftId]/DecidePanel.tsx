// SPEC §7 — the draft's rail: decide (Approve, Edit, Veto), what happens if
// you do nothing, and the checks the draft passed.
//
// A daisyUI card in an `<aside>`, the same box the calendar's day panel
// stands in: beside the page and sticky from `xl`, in flow under it below.
// Not a drawer, at any width.
//
// **Below `md` the three controls are a bar at the foot of the viewport**
// (owner's review of #931, 2026-09-21). The page in its frame is ~5,300px
// tall on a phone, and the rail was the last thing under it: a reviewer
// could not approve or stop a page without scrolling past the whole of it
// and every card. So the controls come to the reviewer.
//
// **One DOM, and one set of controls.** There is no phone copy of this rail:
// the same three buttons and the same do-nothing line are lifted out of flow
// by `max-md:` classes, the sentence takes the row above the buttons through
// `order-first`, and from `md` up every class is inert and the rail is
// exactly what it was. A second copy would be a second thing to keep in step
// with §9's transition table, and the day the two disagreed the phone would
// offer an action the machine refuses.
//
// **The checks stay below the page**, in this card, where the owner's review
// asked for them: a reviewer reads them once, before deciding, and a
// four-row list in a fixed bar would cover the page it is about.
//
// Two numbers here are the shell's, not this file's: the bar sits at
// `4rem + env(safe-area-inset-bottom)` because that is the height daisyUI
// gives the `dock` the shell draws below `lg` (`dock.css`), and it stacks at
// `z-[2]` — above the page and the dock's own `z-index: 1`, below the
// drawer's `10`, so an open navigation drawer still covers it.
//
// **Nothing here decides which controls exist.** `draftActionsFor` projects
// them from §9's transition table, so this rail and the calendar's day panel
// cannot offer different actions for one state (REQ-044 c3). What this file
// decides is the rank: Approve is the screen's one solid primary across the
// column; Edit is ghost and Veto the warning outline, sharing the row under
// it. A state that offers none of them draws no control block at all.
//
// The state it projects from is the screen's, not the stored view's (issue
// #913): while a decision is in flight that is the state the decision asks
// for, so the rail answers the press at once and rolls back with it if the
// machine refuses.
"use client";

import type React from "react";
import { CircleCheck, Info } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { formatDateTime } from "../../_shell/format";
import { writtenLine } from "../../_shell/written";
import { draftActionsFor, type DraftCommand } from "./actions";
import { CHECK_COPY_KEY, checkRows, type RailCheck } from "./checks";
import type { State } from "../../calendar/stages";
import type { ClaimState, DraftView } from "./model";

const EYEBROW = "text-xs font-semibold uppercase tracking-wide opacity-70";

export function DecidePanel(p: {
  view: DraftView;
  /** The page's §9 state as the screen believes it — the stored one, or,
   *  while a decision is in flight, the one that decision asks for (issue
   *  #913). The controls are projected from it, so pressing Stop takes
   *  both Stop and Approve off the rail at once rather than leaving a
   *  second press that could only be refused. */
  state: State;
  /** Whether a decision this rail asked for is still in flight. Both
   *  controls are inert while one is. */
  deciding: boolean;
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
  const actions = draftActionsFor(p.state);
  const rows = checkRows({
    grounded: p.grounded,
    groundedUrl: view.grounded.url,
    claim: p.claim,
    recorded: p.recordedChecks,
    known: view.knownCheck,
  });

  const doNothingLine =
    view.doNothing.key === null
      ? null
      : view.doNothing.publishesAt === null
        ? writtenLine(view.doNothing.key)
        : writtenLine(view.doNothing.key, {
            at: formatDateTime(view.doNothing.publishesAt, view.timeZone),
          });

  return (
    <aside
      className="card card-border bg-base-100 min-w-0 xl:sticky xl:top-4"
      // Named, because the shell puts a second `<aside>` on this screen —
      // the side panel — and two complementary landmarks with no names are
      // two landmarks a reader cannot tell apart (`landmark-unique`, #328).
      // The name is the block's own heading, which is hidden below `md`;
      // hence `aria-label` rather than `aria-labelledby`, and the
      // registry's sentence rather than a second spelling of it.
      aria-label={copy("draft.decide.title")}
      data-testid="draft-decide"
    >
      <div className="card-body min-w-0 gap-3 p-4">
        {/* The bar. In flow inside the card from `md` up — where every
            `max-md:` class below is inert and this is a plain
            `flex flex-col gap-3`, which is what `card-body` already was —
            and fixed to the foot of the viewport below it. */}
        <div
          className="flex min-w-0 flex-col gap-3 max-md:fixed max-md:inset-x-0 max-md:bottom-[calc(4rem+env(safe-area-inset-bottom))] max-md:z-[2] max-md:gap-1 max-md:border-t max-md:border-base-300 max-md:bg-base-100 max-md:px-4 max-md:py-2"
          // Below `md` the heading that named this block is hidden (a bar
          // with a heading in it is a third line on a phone), so the group
          // carries the same words as its accessible name instead. The name
          // is the registry's, not a second spelling of it.
          role="group"
          aria-label={copy("draft.decide.title")}
          data-testid="draft-decide-bar"
        >
          <h2 className={`${EYEBROW} max-md:hidden`}>
            {copy("draft.decide.title")}
          </h2>

          {actions.length === 0 ? null : (
            <div
              className="grid grid-cols-2 gap-2 max-md:auto-cols-fr max-md:grid-flow-col max-md:grid-cols-none"
              data-testid="draft-actions"
            >
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
                    disabled={p.deciding}
                    onClick={() => p.onCommand("veto")}
                  >
                    {copy(action.key)}
                  </button>
                ) : (
                  <button
                    key={action.key}
                    type="button"
                    // `col-span-2` is the two-column rail's: Approve is the
                    // screen's one solid primary across the column. In the
                    // bar the three controls share one row, so it spans one.
                    className="btn btn-sm btn-primary col-span-2 max-md:col-span-1"
                    data-testid={`draft-action-${action.key}`}
                    disabled={p.deciding}
                    onClick={() => p.onCommand("approve")}
                  >
                    {copy(action.key)}
                  </button>
                ),
              )}
            </div>
          )}

          {/* "What happens if you do nothing". The time is a value and renders
            whether or not the sentence around it has been written — and the
            box is **absent** where there is neither, rather than a heading
            with nothing under it (an autopilot page that has already gone
            out: `doNothingOf` says why it has nothing to say). */}
          {doNothingLine === null &&
          view.doNothing.publishesAt === null ? null : (
            <div
              role="note"
              // `max-md:flex`, because `.alert` is a **grid** whose columns are
              // `auto minmax(auto, 1fr)` — content-sized — so the row inside it
              // laid out 576px wide inside a 358px bar and the containment
              // check reported it, measured. A flex row gives that child a
              // definite width to shrink into, which is what `min-w-0` and the
              // clamp below need in order to mean anything. (`block` was tried
              // first and did not constrain it; `flex` does, at 358px.)
              className="alert items-start text-sm max-md:order-first max-md:flex max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:shadow-none"
              data-testid="draft-do-nothing"
            >
              {/* The glyph is the card's. In the bar it would take a third of
                the one line the sentence has. */}
              <Info
                size={20}
                strokeWidth={1.75}
                className="max-md:hidden"
                aria-hidden
              />
              <div className="flex min-w-0 flex-col gap-1 max-md:flex-row max-md:items-baseline max-md:gap-2">
                {/* The label names the block in the rail; in the bar the
                  sentence says the same thing in its own words, and a
                  phone has one line for both. */}
                <span className="font-semibold max-md:hidden">
                  {copy("draft.do-nothing.title")}
                </span>
                {doNothingLine === null ? null : (
                  // **One clamped line below `md`, and the clamp is on the
                  // prose.** The clamping element holds its own text node, is
                  // not in the mono face, and `.truncate` is on
                  // `NO_OVERFLOW_CLAMPED_TEXT` — the three things
                  // `tests/ui/layout/checks.ts` asks of a clamp. The *value*
                  // beside it is never clamped, which is the same file's
                  // rule: a date cut in half is a different date.
                  <span className="min-w-0 max-md:truncate max-md:text-xs">
                    {doNothingLine}
                  </span>
                )}
                {view.doNothing.publishesAt === null ? null : (
                  <span
                    // **Hidden in the bar, and nothing is lost by it.** The
                    // sentence beside it already carries this instant — it is
                    // the `{at}` slot of `draft.do-nothing.autopilot` — so on
                    // a phone this line would print the same time twice and
                    // take the room the sentence needs to be read in. In the
                    // rail it stays: a value on its own line, in the mono
                    // face, where there is room for it.
                    className="num text-xs opacity-70 max-md:hidden"
                    data-testid="draft-do-nothing-at"
                  >
                    {formatDateTime(view.doNothing.publishesAt, view.timeZone)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* The rule between the controls and the checks. Below `md` the
            controls are not above it any more, so there is nothing for it to
            separate — and a card that opened with a rule would look like a
            block with its head cut off. */}
        <div className="divider my-0 max-md:hidden" />

        <h2 className={EYEBROW}>{copy("draft.checks.title")}</h2>
        {/* A row is only ever drawn for a pass (`checkRows`). */}
        <ul className="flex flex-col gap-2 text-sm" data-testid="draft-checks">
          {rows.map((row) => (
            <li
              className="flex items-start gap-2"
              key={row.rule}
              data-testid={`draft-check-${row.rule}`}
            >
              <CircleCheck
                className="text-success mt-0.5 shrink-0"
                size={16}
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="min-w-0">
                {copy(row.key ?? CHECK_COPY_KEY[row.rule], row.vars)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
