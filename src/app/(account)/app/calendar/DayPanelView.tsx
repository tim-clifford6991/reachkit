// BUILD §4.6 — the day panel's contents.
//
// "**Day panel** (290px, sticky, beside the grid — not a drawer): **today
// selected on open**. Contents: stage badge + date · title · status rows ·
// 'Why this page' … · stage-appropriate actions … · one dim provenance
// line."
//
// Two arms, and the union `DayCell` gives them is what keeps them apart:
//
//  - **A page.** Stage badge and date, the title, the status row its stage
//    earns, the five "Why this page" rows, and the one provenance line
//    (REQ-043 c10).
//  - **No page.** The date's **one** account and nothing else (c11: "it
//    states which kind of empty day it is, carrying the one account
//    criterion 5 gives that date and no other … and it offers no action
//    that would publish or approve a page"). No action is filtered out
//    here: `actionsFor` returns nothing for a cell with no page, so there
//    is no filter to forget.
//
// Every sentence is read through `writtenLine`, not `copy`: this panel
// renders on a route the customer reaches, in states whose lines the owner
// has not written yet, and a screen that throws is worse in every way than
// a screen that omits a line nobody has written (the shell's own
// `written.ts`, issue #9, states the argument in full).
//
// The action controls are `Btn` — the registered component — and the three
// commands call the declared publishing seam (`publishing.ts`), which is
// stubbed honestly until §9 lands. Nothing here tells the customer a
// command succeeded.
"use client";

import type React from "react";
import { Badge } from "@/ui/components/Badge";
import { Btn } from "@/ui/components/Btn";
import { DayPanel } from "@/ui/components/custom";
import { copy } from "@/lib/presentation/copy";
import { BAND_LABELS } from "@/lib/presentation/bands";
import { formatDate, formatDateTime } from "../_shell/format";
import { writtenLine } from "../_shell/written";
import { actionsFor } from "./actions";
import { EMPTY_COPY_KEY, isLawCause, stopForEmptyDay, type CalendarOwnCause } from "./empty";
import { nextPublishStatement, stoppedWorkStatement, type WorkStop } from "@/lib/presentation/stopped";
import { fullDate } from "./dates";
import { STAGE_FILTER_COPY_KEY, STAGE_TONE } from "./stages";
import { publishing, type PublishingCommand } from "./publishing";
import { WhyThisPage } from "./WhyThisPage";
import type { DayCell } from "./month";

/** The writes the panel can ask for. `skip`, `veto` and `regenerate` are §9
 *  edges and go to the state machine through the seam; `move` still
 *  refuses, because moving a page to another date is not a transition but
 *  a re-deadline (issue #46). This handler deliberately tells the customer nothing when a
 *  write is refused: there is no registry sentence for a refused write, and
 *  inventing one is exactly what the copy law forbids. The rejection is the
 *  developer's signal; the screen stays as it was. */
function run(command: PublishingCommand, draftId: string, to: string): void {
  const asked =
    command === "move"
      ? publishing.move({ draftId, to })
      : command === "skip"
        ? publishing.skip({ draftId })
        : command === "regenerate"
          ? publishing.regenerate({ draftId })
          : publishing.veto({ draftId });
  void asked.catch(() => undefined);
}

/** A `DayKey` as the instant that calendar day is marked by — UTC
 *  midnight, the day having already been resolved in the site's zone
 *  (`_overview/week.ts` states the same convention). Never rendered. */
function dayMarker(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export function DayPanelView(p: {
  cell: DayCell;
  timeZone: string;
  /** REQ-092 c3's fact, carried from the model. Both of this panel's law
   *  statements — the publish line and a stopped day's account — turn on
   *  it, and they must turn on the same one. */
  stopped: WorkStop | null;
}): React.JSX.Element {
  const { cell } = p;
  const date = fullDate(cell.day);

  if (cell.page === null) {
    // REQ-043 c5: exactly one account, and no second one. `accountFor` has
    // already decided which — this renders that decision and never
    // re-derives it.
    //
    // A law-caused day is that one account stated in the three lines
    // REQ-092 owes it: c1's that ReachKit stopped, c2's what is needed from
    // the customer (and, when nothing is, that nothing is) and c4's
    // resumption date or the explicit statement that none is promised.
    // Three lines of one account, not three accounts — which is why they
    // are read from `stoppedWorkStatement` together and never assembled
    // here (ADR-011, issue #113).
    const law =
      cell.empty !== null && isLawCause(cell.empty.cause)
        ? stoppedWorkStatement(
            stopForEmptyDay({
              cause: cell.empty.cause,
              stop: p.stopped,
              since: dayMarker(cell.day),
            }),
            { formatDate: (on) => formatDate(on, p.timeZone) }
          )
        : null;
    const account =
      cell.empty === null || law !== null
        ? null
        : writtenLine(EMPTY_COPY_KEY[cell.empty.cause as CalendarOwnCause]);
    return (
      <DayPanel
        heading={<span className="num">{date}</span>}
        account={
          <div data-testid="day-account">
            {account === null ? null : (
              <p data-testid="day-empty-line">{account}</p>
            )}
            {law === null ? null : (
              <>
                <p data-testid="day-empty-line">{law.line}</p>
                <p data-testid="day-stopped-needs">{law.needsLine}</p>
                <p data-testid="day-stopped-resumes">{law.resumesLine}</p>
              </>
            )}
          </div>
        }
      />
    );
  }

  const page = cell.page;
  const provenance = writtenLine("calendar.provenance.measured", {
    date: formatDateTime(page.measuredAt, p.timeZone),
  });
  // BUILD §9's veto window, for the one stage that has one.
  const vetoLine =
    page.vetoDeadline === null
      ? null
      : writtenLine("calendar.status.veto-deadline", {
          at: formatDateTime(page.vetoDeadline, p.timeZone),
        });
  // The scheduled publish, spoken through the cross-cutting `next-publish`
  // law rather than a second sentence of the calendar's own (issue #113).
  //
  // This is a statement of when the next page publishes, so REQ-092 c7
  // reaches it: while ReachKit has stopped its own work the statement names
  // the stop and gives no other reason — the date is not shown beside it,
  // and `nextPublishStatement` is what makes that true here rather than an
  // `if` this file could lose. A page with no publish moment makes no such
  // statement at all, so there is nothing for the stop to suppress.
  const publishLine =
    page.publishAt === null
      ? null
      : nextPublishStatement({
          stopped: p.stopped !== null,
          otherwise: { tag: "scheduled", at: formatDateTime(page.publishAt, p.timeZone) },
        }).line;

  return (
    <DayPanel
      heading={
        <div className="rk-daypanel-heading" data-testid="day-head">
          <Badge tone={STAGE_TONE[page.stage]}>
            {copy(STAGE_FILTER_COPY_KEY[page.stage])}
          </Badge>
          <span className="num">{date}</span>
        </div>
      }
      account={
        <div className="flex flex-col gap-2" data-testid="day-account">
          <p className="font-bold" data-testid="day-title">
            {page.title}
          </p>
          {/* Status rows — one per fact this stage actually has. */}
          {publishLine === null ? null : (
            <p data-testid="day-publish-line">{publishLine}</p>
          )}
          {vetoLine === null ? null : (
            <p data-testid="day-veto-line">{vetoLine}</p>
          )}
          {/* REQ-043 c8's winnability, through BAND_LABELS (ADR-001) — never
              a band word this component writes. */}
          <Badge tone="neutral">
            {copy(BAND_LABELS.winnability[page.why.winnability])}
          </Badge>
          <WhyThisPage why={page.why} />
          {/* "one dim provenance line" — §2.5: "Provenance is always visible
              but always quiet … mono, dim, small." */}
          {provenance === null ? null : (
            <p className="rk-prov" data-testid="day-provenance">
              {provenance}
            </p>
          )}
        </div>
      }
      actions={
        <>
          {actionsFor(cell).map((action) =>
            action.kind === "link" ? (
              <a
                key={action.key}
                href={action.href}
                data-testid={`day-action-${action.key}`}
              >
                {copy(action.key)}
              </a>
            ) : (
              <span key={action.key} data-testid={`day-action-${action.key}`}>
                <Btn
                  label={copy(action.key)}
                  variant="ghost"
                  size="sm"
                  onClick={() => run(action.command, action.draftId, cell.day)}
                />
              </span>
            ),
          )}
        </>
      }
    />
  );
}
