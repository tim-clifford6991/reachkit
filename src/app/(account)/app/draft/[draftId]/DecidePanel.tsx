// SPEC §7 — the draft's rail: decide (Approve, Edit, Veto — or, on a page
// the rules stopped, Edit, Write it again, Skip; #1180), what happens if you
// do nothing, and the checks the draft passed.
//
// **Board `R12-6-Page` (SPEC §7, 2026-09-24, #1072)**, top to bottom: the
// *Goes live in* countdown with the absolute time under it, Approve as the
// one solid button, Edit (soft) and Stop (ghost warning) side by side, the
// checks as they finish, the do-nothing sentence, and the two copy-out
// buttons as ghosts. The countdown and the sentence are the panel's; below
// `md` the bar says the same thing in one line with the time in it.
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
// **One set of controls.** There is no phone copy of the buttons: the same
// three are lifted out of flow by `max-md:` classes, and from `md` up every
// such class is inert. A second copy would be a second thing to keep in step
// with §9's transition table. The do-nothing sentence is the one thing said
// twice, in two wordings for two widths, because the phone has no countdown.
//
// **The checks stay below the page** on a phone, in this card, where the
// owner's review asked for them: a four-row list in a fixed bar would cover
// the page it is about.
//
// **Nothing here decides which controls exist.** `draftActionsFor` projects
// them from §9's transition table, so this rail and the calendar's day panel
// cannot offer different actions for one state (REQ-044 c3). What this file
// decides is the rank: Approve is the screen's one solid primary across the
// column; Edit is soft and Stop a ghost in warning, sharing the row under
// it. A state that offers none of them draws no control block at all.
//
// The state it projects from is the screen's, not the stored view's (issue
// #913): while a decision is in flight that is the state the decision asks
// for, so the rail answers the press at once and rolls back with it if the
// machine refuses.
"use client";

import type React from "react";
import { useSyncExternalStore } from "react";
import { Check, Info, LoaderCircle, Pencil, CircleStop, RotateCcw } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { formatDateTime } from "../../_shell/format";
import { writtenLine } from "../../_shell/written";
import { draftActionsFor, type DraftCommand } from "./actions";
import { CHECK_COPY_KEY, checkRows, type RailCheck } from "./checks";
import { CopyOut } from "./CopyOut";
import type { State } from "../../calendar/stages";
import type { ClaimState, DraftView } from "./model";

/** One tick a second, for the countdown. The server has no clock to share
 *  with the browser, so it renders the absolute time alone and the figure
 *  arrives on hydration — never a server "now" the client then contradicts. */
function subscribeSecond(onTick: () => void): () => void {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}
const nowSecond = (): number => Math.floor(Date.now() / 1000);
const noClock = (): null => null;

const pad = (n: number): string => String(n).padStart(2, "0");

/** The time left, in the registry's words. Days where there are any, down
 *  to the second inside the last day, and the third arm once the instant has
 *  passed while the screen was open — the publish job runs on its own clock,
 *  so the page goes out in a moment rather than at a negative time. */
function countdownText(at: Date, now: number): string {
  const left = Math.floor(at.getTime() / 1000) - now;
  if (left <= 0) return copy("draft.decide.countdown.due");
  const d = Math.floor(left / 86_400);
  const h = Math.floor((left % 86_400) / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  return d > 0
    ? copy("draft.decide.countdown.days", { d: String(d), h: String(h), m: pad(m) })
    : copy("draft.decide.countdown", { h: String(h), m: pad(m), s: pad(s) });
}

function Countdown(p: { at: Date; timeZone: string }): React.JSX.Element {
  const now = useSyncExternalStore(subscribeSecond, nowSecond, noClock);
  return (
    <div
      className="rounded-box bg-warning/10 flex min-w-0 flex-col gap-1 p-4 max-md:hidden"
      data-testid="draft-countdown"
    >
      <span className="text-sm font-semibold">{copy("draft.decide.goes-live-in")}</span>
      {/* A figure, so Jakarta 600 with tabular digits (`.num`): the width
          holds still as the seconds turn. Not a live region — a screen
          reader announcing every second would be the page talking over
          itself; the absolute time under it is the fact to read. */}
      {/* Drawn only once there is a clock: an empty figure on the server
          would be a blank where a value sits (REQ-091 c2). */}
      {now === null ? null : (
        <span className="num text-2xl" data-testid="draft-countdown-left">
          {countdownText(p.at, now)}
        </span>
      )}
      <span className="text-xs text-base-content/70" data-testid="draft-do-nothing-at">
        {formatDateTime(p.at, p.timeZone)}
      </span>
    </div>
  );
}

/** A check that passed: a tick in a small green ring, and its sentence. */
const TICK = "grid size-5 shrink-0 place-items-center rounded-full bg-success/15 text-success";
/** The one check still running: the same ring in the quiet ink. The glyph
 *  holds still — the calm layer's one loop is the review dot's pulse. */
const PENDING = "grid size-5 shrink-0 place-items-center rounded-full bg-base-200 text-base-content/70";

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
  /** The command whose press is pending, which alone shows the spinner. */
  pressed: DraftCommand | null;
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
  /** The body as it now stands, for the copy-out buttons. */
  bodyMd: string;
  onEdit: () => void;
  onCommand: (command: DraftCommand) => void;
}): React.JSX.Element {
  const { view } = p;
  const actions = draftActionsFor({ state: p.state, enteredReview: view.enteredReview });
  const rows = checkRows({
    grounded: p.grounded,
    groundedUrl: view.grounded.url,
    claim: p.claim,
    recorded: p.recordedChecks,
    known: view.knownCheck,
  });
  const publishesAt = view.doNothing.publishesAt;
  /** The countdown runs only while the page can still be stopped: the
   *  moment Stop or Approve is pressed the controls leave and so does it. */
  const counting = publishesAt !== null && actions.length > 0;

  /** The bar's one line (below `md`): the sentence with the time in it,
   *  because a phone has no room for the countdown box. */
  const barLine =
    view.doNothing.key === null
      ? null
      : publishesAt === null
        ? writtenLine(view.doNothing.key)
        : writtenLine(view.doNothing.key, { at: formatDateTime(publishesAt, view.timeZone) });
  /** The panel's sentence (from `md`): the time is the countdown's, so the
   *  sentence says what the schedule means rather than repeating it. */
  const panelLine =
    view.doNothing.key === null
      ? null
      : publishesAt === null
        ? writtenLine(view.doNothing.key)
        : writtenLine("draft.do-nothing.schedule");

  return (
    <aside
      className="card card-border bg-base-100 min-w-0 xl:sticky xl:top-4"
      // Named, because the shell puts a second `<aside>` on this screen —
      // the side panel — and two complementary landmarks with no names are
      // two landmarks a reader cannot tell apart (`landmark-unique`, #328).
      aria-label={copy("draft.decide.title")}
      data-testid="draft-decide"
    >
      <div className="card-body min-w-0 gap-4 p-5">
        <h2 className="eyebrow max-md:hidden">{copy("draft.decide.title")}</h2>

        {counting && publishesAt !== null ? (
          <Countdown at={publishesAt} timeZone={view.timeZone} />
        ) : null}

        {/* The bar. In flow inside the card from `md` up, and fixed to the
            foot of the viewport below it (owner's review of #931): the page
            is ~5,300px tall on a phone, so the controls come to the
            reviewer. One DOM — the same three buttons at every width, so
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
              className="grid grid-cols-2 gap-2 max-md:auto-cols-fr max-md:grid-flow-col max-md:grid-cols-none"
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
                ) : action.command === "regenerate" ? (
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
                ) : (
                  <button
                    key={action.key}
                    type="button"
                    // `col-span-2` and `order-first`: Approve is the one
                    // solid button, across the column and above the other
                    // two. In the bar the three share one row.
                    className="btn btn-primary order-first col-span-2 max-md:btn-sm max-md:order-none max-md:col-span-1"
                    data-testid={`draft-action-${action.key}`}
                    disabled={p.deciding}
                    onClick={() => p.onCommand("approve")}
                  >
                    {p.pressed === "approve" ? (
                      <span className="loading loading-spinner loading-xs" aria-hidden />
                    ) : (
                      <Check size={16} strokeWidth={1.75} aria-hidden />
                    )}
                    {copy(action.key)}
                  </button>
                ),
              )}
            </div>
          )}
        </div>

        <div className="divider my-0 max-md:hidden" />

        <h2 className="eyebrow">{copy("draft.checks.title")}</h2>
        {/* A row is drawn for a pass (`checks.ts`), and for the one check
            that can still be running — the claim check after an edit — as
            that, never as a pass. Rows rise in one after another, the
            screen-enter timing, as a list of things that finished. */}
        <ul className="flex flex-col gap-2.5 text-sm" data-testid="draft-checks">
          {rows.map((row, i) => (
            <li
              className="flex items-start gap-2.5 motion-safe:animate-rise"
              style={{ animationDelay: `${String(i * 60)}ms` }}
              key={row.rule}
              data-testid={`draft-check-${row.rule}`}
            >
              <span className={TICK} aria-hidden>
                <Check size={12} strokeWidth={2.5} />
              </span>
              <span className="min-w-0">
                {copy(row.key ?? CHECK_COPY_KEY[row.rule], row.vars)}
              </span>
            </li>
          ))}
          {p.claim.state === "outstanding" ? (
            <li
              className="flex items-start gap-2.5 text-base-content/70"
              data-testid="draft-check-pending"
            >
              <span className={PENDING} aria-hidden>
                <LoaderCircle size={12} strokeWidth={2.5} />
              </span>
              <span className="min-w-0">{copy("draft.claim.outstanding")}</span>
            </li>
          ) : null}
        </ul>

        {panelLine === null ? null : (
          <>
            <div className="divider my-0 max-md:hidden" />
            <p
              role="note"
              className="flex items-start gap-2 text-xs text-base-content/70 max-md:hidden"
              data-testid="draft-do-nothing"
            >
              <Info size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
              <span className="min-w-0">{panelLine}</span>
            </p>
          </>
        )}

        {/* Copy-out is always here — for a draft and a published page alike
            (c12): the words are theirs, for any destination. */}
        <CopyOut bodyMd={p.bodyMd} />
      </div>
    </aside>
  );
}
