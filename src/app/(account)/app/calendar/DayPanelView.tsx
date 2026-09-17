// SPEC §7 — the day panel beside the calendar grid.
//
// A daisyUI card in an `<aside>`: stage badge and date, then the day's one
// account, then the controls its stage earns, then one quiet provenance line
// last. Never a drawer — nothing slides over anything and nothing is
// dismissed.
//
// Two arms, and the union `DayCell` gives them is what keeps them apart:
//
//  - **A page.** Stage badge and date, the title, the status lines its stage
//    earns, "Why this page", the controls and the provenance line.
//  - **No page.** The date's **one** account and nothing else — "An empty
//    day states its cause and offers no publish" (§7). `actionsFor` returns
//    nothing for a cell with no page, so there is no filter to forget.
//
// Every sentence is read through `writtenLine`, not `copy`: a line the owner
// has not written renders as nothing rather than throwing on a route the
// customer reaches.
//
// The commands call the declared publishing seam (`publishing.ts`). Nothing
// here tells the customer a command succeeded.
"use client";

import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { BAND_LABELS } from "@/lib/presentation/bands";
import type { Tone } from "@/ui/types";
import {
  unpublishedLine,
  verificationLine,
  type VerificationKind,
} from "@/lib/publish/record/lines";
import { formatDate, formatDateTime } from "../_shell/format";
import { writtenLine } from "../_shell/written";
import { actionsFor } from "./actions";
import { EMPTY_ACCOUNT_COPY_KEY, isLawCause, isSupplyCause, stopForEmptyDay } from "./empty";
import { emptyLineFor } from "./CalendarView";
import { nextPublishStatement, stoppedWorkStatement, type WorkStop } from "@/lib/presentation/stopped";
import { fullDate } from "./dates";
import { STAGE_FILTER_COPY_KEY, STAGE_TONE, TONE_BADGE } from "./stages";
import { publishing, type PublishingCommand } from "./publishing";
import { WhyThisPage } from "./WhyThisPage";
import type { DayCell, PageOnDay } from "./month";

/** The writes the panel can ask for. `skip`, `veto` and `regenerate` are §9
 *  edges and go to the state machine through the seam; `move` still
 *  refuses, because moving a page to another date is a re-deadline, not a
 *  transition (issue #46). A refused write tells the customer nothing: there
 *  is no registry sentence for it. The screen stays as it was. */
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

/** How each standing looks — the same map the draft view's record block
 *  keeps, total over `VerificationKind`. `page_not_found` warns and
 *  `could_not_confirm` does not (ADR-085). */
const VERIFICATION_TONE: Readonly<Record<VerificationKind, Tone>> = Object.freeze({
  found: "ok",
  page_not_found: "warn",
  could_not_confirm: "neutral",
  not_yet: "neutral",
  due: "neutral",
  never_taken_down_first: "neutral",
  never_no_live_address: "neutral",
});

/** The record's one line, or `null` where the page has nothing to report —
 *  a page nothing has delivered says nothing here. */
function recordSummary(page: PageOnDay): { text: string; tone: Tone; at: Date | null } | null {
  if (page.unpublishOutcome !== null) {
    const text = writtenLine(unpublishedLine(page.unpublishOutcome));
    return text === null ? null : { text, tone: "neutral", at: null };
  }
  const line = verificationLine(page.verification);
  if (line.kind === "never_no_live_address") return null;
  const text = writtenLine(line.copy);
  return text === null ? null : { text, tone: VERIFICATION_TONE[line.kind], at: line.at };
}

/** A `DayKey` as the instant that calendar day is marked by — UTC midnight,
 *  the day having already been resolved in the site's zone. Never rendered. */
function dayMarker(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/**
 * The panel's controls. The day's one way in (at most one, from
 * `actionsFor`) takes the full width: solid primary where it leads further
 * into the customer's own work, outline where it leaves the product for the
 * live page. A stop (veto, skip) is the warning outline; move and a restart
 * are ghost. The rest share a two-column row.
 */
function DayActions(p: { cell: DayCell }): React.JSX.Element | null {
  const actions = actionsFor(p.cell);
  if (actions.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {actions.map((action) => {
        if (action.kind === "link") {
          const leavesTheProduct = action.key === "calendar.action.view-live-page";
          return (
            <a
              key={action.key}
              href={action.href}
              className={`btn btn-sm col-span-2 ${leavesTheProduct ? "btn-outline" : "btn-primary"}`}
              data-testid={`day-action-${action.key}`}
            >
              {copy(action.key)}
            </a>
          );
        }
        const stop = action.command === "veto" || action.command === "skip";
        return (
          <button
            key={action.key}
            type="button"
            className={`btn btn-sm ${stop ? "btn-outline btn-warning" : "btn-ghost"}`}
            data-testid={`day-action-${action.key}`}
            onClick={() => run(action.command, action.draftId, p.cell.day)}
          >
            {copy(action.key)}
          </button>
        );
      })}
    </div>
  );
}

function Panel(p: { heading: React.ReactNode; children: React.ReactNode }): React.JSX.Element {
  return (
    <aside className="card card-border bg-base-100 min-w-0 xl:sticky xl:top-4" data-testid="day-panel">
      <div className="card-body min-w-0 gap-3 p-4">
        {p.heading}
        {p.children}
      </div>
    </aside>
  );
}

function Heading(p: { badge: string; tone: Tone; date: string }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2" data-testid="day-head">
      <span className={`badge ${TONE_BADGE[p.tone]}`}>{p.badge}</span>
      <span className="num text-xs opacity-70">{p.date}</span>
    </div>
  );
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
    // Exactly one account. A law-caused day is that one account in the three
    // lines REQ-092 owes it — that ReachKit stopped, what is needed from the
    // customer, and when it resumes — read from `stoppedWorkStatement`
    // together and never assembled here (ADR-011, issue #113).
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
    // The date's account **in full** — the cell states the first line alone
    // and the panel states all of it (#209).
    // A supply cause is the calendar's one supply statement, at its top, and
    // is not repeated here (issue 857).
    const account =
      cell.empty === null || law !== null || isSupplyCause(cell.empty.cause)
        ? null
        : emptyLineFor(cell.empty, cell.day, p.stopped, p.timeZone, EMPTY_ACCOUNT_COPY_KEY);
    // No provenance line: a date holding no page carries no measurement.
    return (
      <Panel heading={<Heading badge={copy("calendar.empty.day-badge")} tone="neutral" date={date} />}>
        <div className="divider my-0" />
        <div className="flex flex-col gap-2 text-sm" data-testid="day-account">
          {account === null ? null : <p data-testid="day-empty-line">{account}</p>}
          {law === null ? null : (
            <>
              <p data-testid="day-empty-line">{law.line}</p>
              <p data-testid="day-stopped-needs">{law.needsLine}</p>
              <p data-testid="day-stopped-resumes">{law.resumesLine}</p>
            </>
          )}
        </div>
      </Panel>
    );
  }

  const page = cell.page;
  const provenance = writtenLine("calendar.provenance.measured", {
    date: formatDateTime(page.measuredAt, p.timeZone),
  });
  // The veto window, for the one stage that has one.
  const vetoLine =
    page.vetoDeadline === null
      ? null
      : writtenLine("calendar.status.veto-deadline", {
          at: formatDateTime(page.vetoDeadline, p.timeZone),
        });
  // The scheduled publish, spoken through the cross-cutting `next-publish`
  // law (issue #113): while ReachKit has stopped its own work the statement
  // names the stop and the date is not shown beside it.
  const publishLine =
    page.publishAt === null
      ? null
      : nextPublishStatement({
          stopped: p.stopped !== null,
          otherwise: { tag: "scheduled", at: formatDateTime(page.publishAt, p.timeZone) },
        }).line;
  // What became of the page, in one line (issue #217) — the same keys the
  // draft view's record block reads, so the two cannot disagree.
  const recordLine = recordSummary(page);

  return (
    <Panel
      heading={
        <Heading
          badge={copy(STAGE_FILTER_COPY_KEY[page.stage])}
          tone={STAGE_TONE[page.stage]}
          date={date}
        />
      }
    >
      <div className="flex min-w-0 flex-col gap-3" data-testid="day-account">
        <h2 className="card-title break-words text-base" data-testid="day-title">
          {page.title}
        </h2>
        <div className="divider my-0" />
        <div className="flex flex-col gap-1 text-sm">
          {publishLine === null ? null : <p data-testid="day-publish-line">{publishLine}</p>}
          {vetoLine === null ? null : <p data-testid="day-veto-line">{vetoLine}</p>}
        </div>
        {recordLine === null ? null : (
          <p className="flex flex-wrap items-baseline gap-2" data-testid="day-record-line">
            <span
              className={`badge h-auto whitespace-normal py-1 text-left ${TONE_BADGE[recordLine.tone]}`}
            >
              {recordLine.text}
            </span>
            {recordLine.at === null ? null : (
              <span className="num text-xs opacity-70">{formatDate(recordLine.at, p.timeZone)}</span>
            )}
          </p>
        )}
        {/* Winnability, through BAND_LABELS (ADR-001) — never a band word this
            component writes. */}
        <span className="badge badge-ghost">{copy(BAND_LABELS.winnability[page.why.winnability])}</span>
        <WhyThisPage why={page.why} />
      </div>
      <div className="divider my-0" />
      <DayActions cell={cell} />
      {provenance === null ? null : (
        <p className="text-xs opacity-60" data-testid="day-provenance">
          {provenance}
        </p>
      )}
    </Panel>
  );
}
