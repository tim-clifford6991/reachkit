// SPEC §7 — the draft's rail: when the page goes live on its own, Edit and
// Stop (or, on a page the rules stopped, Edit, Write it again, Skip; #1180),
// what happens if you do nothing, and the checks the draft passed.
//
// **There is no Approve** (owner 2026-10-08, issue 1337: "remove the approve
// button entirely, autopilot only … they can solely edit or stop the
// content"). The rail asks for nothing: the *Goes live in* countdown with
// the absolute time under it leads, then Stop (ghost warning) and Edit
// (soft) side by side, the checks, the do-nothing sentence and the two
// copy-out buttons. No control on it is a solid primary. Below `md` the bar
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
// twice, in two wordings for two widths, because the phone has no countdown.
//
// **The checks stay below the page** on a phone, in this card, where the
// owner's review asked for them: a list of rules in a fixed bar would cover
// the page it is about.
//
// **Nothing here decides which controls exist.** `draftActionsFor` projects
// them from §9's transition table, so this rail and the calendar's day panel
// cannot offer different actions for one state (REQ-044 c3). What this file
// decides is the rank: Stop leads as a ghost in warning and Edit is soft.
// A state that offers none of them draws no control block at all.
//
// The state it projects from is the screen's, not the stored view's (issue
// #913): while a decision is in flight that is the state the decision asks
// for, so the rail answers the press at once and rolls back with it if the
// machine refuses.
"use client";

import type React from "react";
import { useSyncExternalStore } from "react";
import { Check, Info, LoaderCircle, Minus, Pencil, CircleStop, RotateCcw, X } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { formatDate, formatDateTime } from "../../_shell/format";
import { writtenLine } from "../../_shell/written";
import { draftActionsFor, type DraftCommand } from "./actions";
import { CHECK_GROUPS, checkList, type CheckRow, type CheckStatus } from "./checks";
import type { RecordedChecks } from "@/lib/generate/rules/types";
import { CopyOut } from "./CopyOut";
import type { State } from "../../calendar/stages";
import { TakeDownControl } from "../../calendar/TakeDown";
import { putBackWords, takeDownWords } from "../../calendar/take-down-words";
import type { ClaimState, DraftView } from "./model";
import { SHAPE } from "./shape";

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

/** A row's mark: a small ring and a glyph. Green for a pass; the quiet ink
 *  for a rule the page was not asked, one it failed and the one still
 *  running — the words beside the mark say which. The glyph holds still:
 *  the calm layer's one loop is the review dot's pulse. */
const RING = "grid size-5 shrink-0 place-items-center rounded-full";
const QUIET = `${RING} bg-base-200 text-base-content/70`;
const MARK: Readonly<Record<CheckStatus, { ring: string; Icon: typeof Check }>> = {
  passed: { ring: `${RING} bg-success/15 text-success`, Icon: Check },
  skipped: { ring: QUIET, Icon: Minus },
  failed: { ring: QUIET, Icon: X },
  pending: { ring: QUIET, Icon: LoaderCircle },
};

/** What a row that is not a pass says under its sentence. */
function statusLine(status: CheckStatus): string | null {
  if (status === "skipped") return copy("draft.checks.status.skipped");
  if (status === "failed") return copy("draft.checks.status.failed");
  return status === "pending" ? copy("draft.claim.outstanding") : null;
}

function CheckItem(p: { row: CheckRow }): React.JSX.Element {
  const { ring, Icon } = MARK[p.row.status];
  const status = statusLine(p.row.status);
  return (
    <li
      className="flex items-start gap-2.5"
      data-testid={`draft-check-${p.row.rule}`}
      data-status={p.row.status}
    >
      <span className={ring} aria-hidden>
        <Icon size={12} strokeWidth={2.5} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className={p.row.status === "passed" ? undefined : "text-base-content/70"}>
          {copy(p.row.key, p.row.vars)}
        </span>
        {status === null ? null : <span className="text-xs text-base-content/70">{status}</span>}
      </span>
    </li>
  );
}

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
  /** Whether the recorded fact is still in the body as it now stands —
   *  the same value the highlight is drawn from, so the grounded row and
   *  the mark cannot disagree. */
  grounded: boolean;
  /** The claim state as it now stands, which after an edit is not the
   *  stored one (REQ-045 c9). */
  claim: ClaimState;
  /** The last check, rule by rule, on the text as it now stands — empty
   *  while an edit has not been re-checked (#789). */
  recordedChecks: RecordedChecks;
  /** The body as it now stands, for the copy-out buttons. */
  bodyMd: string;
  onEdit: () => void;
  onCommand: (command: DraftCommand) => void;
}): React.JSX.Element {
  const { view } = p;
  const actions = draftActionsFor({ state: p.state, enteredReview: view.enteredReview });
  const { rows, counts } = checkList({
    grounded: p.grounded,
    claim: p.claim,
    recorded: p.recordedChecks,
    known: view.knownCheck,
  });
  const publishesAt = view.doNothing.publishesAt;
  /** The countdown runs only while the page can still be stopped: the
   *  moment Stop is pressed the controls leave and so does it. */
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
          <Countdown at={publishesAt} timeZone={view.timeZone} />
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
                    // Stop leads a page in review: it is the one thing the
                    // customer can do that changes what happens.
                    className={`btn btn-sm btn-ghost btn-warning${action.command === "veto" ? " order-first" : ""}`}
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

          {/* SPEC §7 (issue 1532): a live page can be taken down, and put
              back inside its window. */}
          {view.takeDown === null ? null : (
            <div className="flex min-w-0 flex-col gap-2" data-testid="draft-take-down">
              {view.takeDown.kind === "put_back" ? (
                <p className="min-w-0 text-xs text-base-content/70 wrap-anywhere">
                  {copy("draft.put-back.until", { date: formatDate(view.takeDown.until, view.timeZone) })}
                </p>
              ) : null}
              {view.takeDown.kind === "put_back" ? (
                <TakeDownControl draftId={view.draftId} mode="put_back" words={putBackWords()} />
              ) : (
                <TakeDownControl draftId={view.draftId} mode="take_down" words={takeDownWords()} />
              )}
            </div>
          )}
        </div>

        <div className="divider my-0 max-md:hidden" />

        {/* SPEC §7 (2026-10-10, issue 1394): two levels. The headline and
            its counts are the glance; every rule is in the one closed note
            under it. The count is stated only where the run recorded which
            rules it asked (`checks.ts`). */}
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="eyebrow" data-testid="draft-checks-headline">
            {counts === null
              ? copy("draft.checks.title")
              : copy("draft.checks.headline", { passed: counts.passed, total: counts.total })}
          </h2>
          {counts === null || counts.fixed + counts.skipped + counts.failed === 0 ? null : (
            <p
              className="flex flex-wrap gap-x-3 text-xs text-base-content/70"
              data-testid="draft-checks-counts"
            >
              {counts.fixed === 0 ? null : (
                <span data-testid="draft-checks-fixed">
                  {copy("draft.checks.count.fixed", { n: counts.fixed })}
                </span>
              )}
              {counts.skipped === 0 ? null : (
                <span>{copy("draft.checks.count.skipped", { n: counts.skipped })}</span>
              )}
              {counts.failed === 0 ? null : (
                <span>{copy("draft.checks.count.failed", { n: counts.failed })}</span>
              )}
            </p>
          )}
        </div>
        {rows.length === 0 ? null : (
          <details className="collapse collapse-arrow bg-base-200" data-testid="draft-checks">
            <summary className="collapse-title text-sm font-medium">
              {copy("draft.checks.note.title")}
            </summary>
            <div className="collapse-content flex min-w-0 flex-col gap-4 text-sm">
              {counts === null ? null : (
                <p className="text-xs text-base-content/70">
                  {copy("draft.checks.note.lead", { total: counts.total })}
                </p>
              )}
              {CHECK_GROUPS.map(({ group, title }) => {
                const inGroup = rows.filter((row) => row.group === group);
                return inGroup.length === 0 ? null : (
                  <section className="flex min-w-0 flex-col gap-2" key={group}>
                    <h3 className="text-xs font-semibold">{copy(title)}</h3>
                    <ul className="flex flex-col gap-2.5">
                      {inGroup.map((row) => (
                        <CheckItem row={row} key={row.rule} />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </details>
        )}

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
