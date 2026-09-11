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
import type { Tone } from "@/ui/types";
import {
  unpublishedLine,
  verificationLine,
  type VerificationKind,
} from "@/lib/publish/record/lines";
import { formatDate, formatDateTime } from "../_shell/format";
import { writtenLine } from "../_shell/written";
import { actionsFor } from "./actions";
import { EMPTY_ACCOUNT_COPY_KEY, isLawCause, stopForEmptyDay } from "./empty";
import { emptyLineFor } from "./CalendarView";
import { nextPublishStatement, stoppedWorkStatement, type WorkStop } from "@/lib/presentation/stopped";
import { fullDate } from "./dates";
import { STAGE_FILTER_COPY_KEY, STAGE_TONE } from "./stages";
import { publishing, type PublishingCommand } from "./publishing";
import { WhyThisPage } from "./WhyThisPage";
import type { DayCell, PageOnDay } from "./month";

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

/** How each standing looks on the panel — the same map the draft view's
 *  record block keeps, and total over `VerificationKind` for the same
 *  reason: an eighth standing is a compile error rather than a line with no
 *  tone. `page_not_found` warns and `could_not_confirm` does not, which is
 *  the only place the two differ to look at (ADR-085). */
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
 *  a planned or generating date has never been delivered, and a line saying
 *  no check will run for it would be an account of a page that does not
 *  exist yet. */
function recordSummary(page: PageOnDay): { text: string; tone: Tone; at: Date | null } | null {
  if (page.unpublishOutcome !== null) {
    const text = writtenLine(unpublishedLine(page.unpublishOutcome));
    return text === null ? null : { text, tone: "neutral", at: null };
  }
  const line = verificationLine(page.verification);
  // A page nothing has delivered says nothing here. Its state already says
  // where it is, and the panel is not the place to explain that a check
  // cannot run on a page that has not gone out.
  if (line.kind === "never_no_live_address") return null;
  const text = writtenLine(line.copy);
  return text === null ? null : { text, tone: VERIFICATION_TONE[line.kind], at: line.at };
}

/** A `DayKey` as the instant that calendar day is marked by — UTC
 *  midnight, the day having already been resolved in the site's zone
 *  (`_overview/week.ts` states the same convention). Never rendered. */
function dayMarker(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/**
 * The panel's controls, in the ranks the approved S15 draws (issue #354).
 *
 * Each rank is read off what the action *is*, not off a second table
 * beside `actions.ts`:
 *
 *  - **The day's one way in takes the full column** — the link its stage
 *    earns. `actionsFor` offers at most one, so the block control cannot
 *    become two. It is the SOLID rank where it leads further into the
 *    customer's own work (read the page; reconnect the destination), and
 *    the OUTLINE rank where it leaves the product for the live page: §9.1
 *    gives a screen one filled button, and a control that navigates away
 *    is not the thing the panel is asking for.
 *  - **A stop is the outline rank on `warn`** — the arm issue #271 spent
 *    that tone on, for exactly this pairing: a veto stands beside an
 *    approve, the two are opposite consequences and one destroys the
 *    draft. `skip` is the same §9 edge under §4.6's other word, so it
 *    takes the same rank.
 *  - **Move and a restart are quiet.** Move re-deadlines a page and asks
 *    nothing of anyone; a restart stands beside a reconnect that already
 *    holds the fill.
 *
 * The two half-width controls share one row under the block one, each
 * taking half of it however long its word is (`day-panel.css`).
 *
 * The link is an anchor carrying the registered `btn` classes rather than
 * a `Btn`, the way the month switcher's neighbours and the Overview's two
 * links already are: it navigates, so it is an `<a>` with no client
 * runtime, and `Btn` renders a `<button>` with an `onClick`. Declared in
 * `tests/ui/design/component-registry.test.ts`'s exception list with that
 * reason.
 */
function DayActions(p: { cell: DayCell }): React.JSX.Element {
  return (
    <>
      {actionsFor(p.cell).map((action) => {
        if (action.kind === "link") {
          const leavesTheProduct = action.key === "calendar.action.view-live-page";
          return (
            <span key={action.key} className="rk-daypanel-block">
              <a
                href={action.href}
                className={
                  leavesTheProduct
                    ? "btn btn-sm btn-ghost rk-btn-outline rk-daypanel-wide"
                    : "btn btn-sm btn-primary rk-daypanel-wide"
                }
                data-testid={`day-action-${action.key}`}
              >
                {copy(action.key)}
              </a>
            </span>
          );
        }
        const stop = action.command === "veto" || action.command === "skip";
        return (
          <span
            key={action.key}
            className="rk-daypanel-half"
            data-testid={`day-action-${action.key}`}
          >
            {stop ? (
              <Btn
                label={copy(action.key)}
                variant="secondary"
                tone="warn"
                size="sm"
                onClick={() => run(action.command, action.draftId, p.cell.day)}
              />
            ) : (
              <Btn
                label={copy(action.key)}
                variant="tertiary"
                size="sm"
                onClick={() => run(action.command, action.draftId, p.cell.day)}
              />
            )}
          </span>
        );
      })}
    </>
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
    // The date's account **in full** — `EMPTY_ACCOUNT_COPY_KEY`, not the
    // grid's map. DECISIONS 2026-09-07 (#209): the cell states the first
    // line alone and the panel states all of it, and S14/S15 draw that same
    // split for an exhausted supply.
    const account =
      cell.empty === null || law !== null
        ? null
        : emptyLineFor(
            cell.empty,
            cell.day,
            p.stopped,
            p.timeZone,
            EMPTY_ACCOUNT_COPY_KEY,
          );
    // S15's `empty` arm: the chip, the date, a rule, the one account — and
    // no action. REQ-043 c11 ("it offers no action that would publish or
    // approve a page") holds by construction: `actionsFor` returns nothing
    // for a cell with no page, so there is no filter here to forget.
    //
    // No provenance line either, and that is the honest arm rather than a
    // missing one: the set ends this state on "measured {date}", and a date
    // holding no page carries no measurement to name. A month-level date
    // printed here would be a measurement of something else.
    return (
      <DayPanel
        heading={
          <div className="rk-daypanel-heading" data-testid="day-head">
            <Badge tone="neutral">{copy("calendar.empty.day-badge")}</Badge>
            <span className="num rk-prov">{date}</span>
          </div>
        }
        account={
          <>
            <hr className="rk-daypanel-rule" />
            <div className="flex flex-col gap-2" data-testid="day-account">
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
          </>
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

  // The record's own summary, or nothing. `unpublishOutcome` is stated in
  // preference to the check: a page ReachKit took down is accounted for by
  // what the takedown found, and the check that will never run beside it
  // would say the same thing twice. Everything else states the check.
  const recordLine = recordSummary(page);

  return (
    <DayPanel
      heading={
        <div className="rk-daypanel-heading" data-testid="day-head">
          <Badge tone={STAGE_TONE[page.stage]}>
            {copy(STAGE_FILTER_COPY_KEY[page.stage])}
          </Badge>
          <span className="num rk-prov">{date}</span>
        </div>
      }
      account={
        <div className="flex flex-col gap-3" data-testid="day-account">
          {/* S15's four parts, in its order: the page's own heading, then a
              rule, then the status lines its stage earns, then "Why this
              page", then the rule the controls sit under. */}
          <p className="rk-daypanel-title" data-testid="day-title">
            {page.title}
          </p>
          <hr className="rk-daypanel-rule" />
          {/* Status rows — one per fact this stage actually has. */}
          {publishLine === null ? null : (
            <p data-testid="day-publish-line">{publishLine}</p>
          )}
          {vetoLine === null ? null : (
            <p data-testid="day-veto-line">{vetoLine}</p>
          )}
          {/* What became of the page, in one line (issue #217). The same
              two facts the draft view's record block states, read through
              the same keys, so the panel and that view cannot disagree
              about one page.

              **The address is not repeated here.** The panel already
              offers the way through to the page (REQ-043 c12), and an
              address printed in a 290px column wraps to three lines to say
              what the link says. Nor is REQ-060 c4's line: c4 puts it on
              "that page's own record — and no other surface", and the
              draft view is that surface. */}
          {recordLine === null ? null : (
            <p className="flex flex-wrap items-baseline gap-2" data-testid="day-record-line">
              <Badge tone={recordLine.tone} wrap>{recordLine.text}</Badge>
              {recordLine.at === null ? null : (
                <span className="num rk-prov">{formatDate(recordLine.at, p.timeZone)}</span>
              )}
            </p>
          )}
          {/* REQ-043 c8's winnability, through BAND_LABELS (ADR-001) — never
              a band word this component writes. */}
          <Badge tone="neutral">
            {copy(BAND_LABELS.winnability[page.why.winnability])}
          </Badge>
          <WhyThisPage why={page.why} />
          <hr className="rk-daypanel-rule" />
        </div>
      }
      provenance={
        /* "one dim provenance line" — §2.5: "Provenance is always visible
           but always quiet … mono, dim, small." It is the panel's last
           element in every one of S15's arms, which is why it is the
           component's own slot rather than the tail of the account. */
        provenance === null ? undefined : (
          <p className="rk-prov" data-testid="day-provenance">
            {provenance}
          </p>
        )
      }
      actions={<DayActions cell={cell} />}
    />
  );
}
