// SPEC §7 (2026-09-20, #908, issue 930) — the day panel: **closable**, and
// label-and-value rows rather than sentences.
//
//   head      the stage word, the date, and the control that closes it
//   title     the page, two lines
//   chips     what the page is (new or an update), its band
//   Search    the rows `TargetRows` draws — one projection, one renderer,
//             shared with the draft screen
//   AI answers the three engines, in the same block
//   goes live the one dated line the page's own stage earns
//   actions   `actions.ts`, exactly as #942 left them — every one answers
//
// Two arms, and the union `DayCell` gives them is what keeps them apart:
//
//  - **A page.** The whole of the above.
//  - **No page.** The date's **one** account, in full — the card states two
//    words and the panel states all of it (#209) — and nothing else. "An
//    empty day states its cause and offers no publish" (§7); `actionsFor`
//    returns nothing for a cell with no page, so there is no filter to
//    forget.
//
// Every sentence is read through `writtenLine`, not `copy`: a line the
// owner has not written renders as nothing rather than throwing on a route
// the customer reaches.
//
// The commands call the declared publishing seam (`publishing.ts`), and
// **every one of them answers** (SPEC §7, 2026-09-20, #908, issue #913):
// the stage changes on the press (React 19 `useOptimistic`), the seam's
// answer is spoken as a `sonner` toast drawn with daisyUI `alert` classes,
// and a refusal rolls the stage back to the one the page still holds. None
// of that changed here; the controls moved and the writes did not.
"use client";

import type React from "react";
import { useOptimistic, useTransition } from "react";
import { X } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { Tone } from "@/ui/types";
import {
  NEEDS_YOU_COPY,
  unpublishedLine,
  verificationLine,
  type VerificationKind,
} from "@/lib/publish/record/lines";
import { formatDate, formatDateTime } from "../_shell/format";
import { writtenLine } from "../_shell/written";
import { actionsFor, type DayCommand, type DestinationStanding } from "./actions";
import { EMPTY_ACCOUNT_COPY_KEY, HELD_BY_SETTING_COPY_KEY, isLawCause, isSupplyCause, stopForEmptyDay, type OneLineCause } from "./empty";
import { kindWord } from "./card-lines";
import { nextPublishStatement, stoppedWorkStatement, type WorkStop } from "@/lib/presentation/stopped";
import { fullDate } from "./dates";
import { STAGE_FILTER_COPY_KEY, STAGE_OF, STAGE_TONE, TONE_BADGE } from "./stages";
import { COMMAND_TARGET, publishing } from "./publishing";
import { say } from "../../../_toast/say";
import { TargetRows } from "./TargetRows";
import type { DayCell, PageOnDay } from "./month";
import type { State } from "@/lib/publish/types";
import { CHANGE_COPY_KEY } from "./change-line";

/** What each write says when it lands. Total over the three commands the
 *  panel can offer, so a fourth cannot ship without a sentence — which is
 *  the mechanical half of "every action answers". A refused write says the
 *  one thing every refusal has in common, and never the machine's own word
 *  for why. */
const ANSWER_COPY_KEY: Readonly<Record<DayCommand, CopyKey>> = Object.freeze({
  skip: "calendar.answer.skip",
  veto: "calendar.answer.veto",
  regenerate: "calendar.answer.regenerate",
});

/** The writes the panel can ask for. All three are §9 edges and go to the
 *  state machine through the seam. */
function ask(command: DayCommand, draftId: string): ReturnType<typeof publishing.skip> {
  if (command === "skip") return publishing.skip({ draftId });
  if (command === "veto") return publishing.veto({ draftId });
  return publishing.regenerate({ draftId });
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
 * The whole account a date with no page carries — the panel's half of the
 * two forms every cause now has (`card-lines.ts`; DECISIONS 2026-09-07,
 * #209). The card states two words; this states all of it.
 *
 * It lives here rather than in `card-lines.ts` because two of its arms need
 * this panel's own inputs: the stop the law causes are read from, and the
 * site's zone the held date is formatted in.
 */
function accountLine(a: {
  cell: DayCell;
  stopped: WorkStop | null;
  timeZone: string;
}): string | null {
  const empty = a.cell.empty;
  // Issue 857's horizon, in full. The card has room for two words
  // ("Planned Mon"); this is the sentence they stand for, and it is the
  // whole account of a date the next weekly pass has not decided yet.
  if (empty === null) return a.cell.horizonMarker ? writtenLine("calendar.horizon.marker") : null;
  // Issue 857: a supply cause is the calendar's one supply statement, at
  // its top, and is never repeated here.
  if (isSupplyCause(empty.cause) || isLawCause(empty.cause)) return null;
  // REQ-043 c4: the setting that holds pages, each with its own line (#754).
  if (empty.cause === "customer_change_holds_pages") {
    return writtenLine(HELD_BY_SETTING_COPY_KEY[empty.setting]);
  }
  // REQ-071 c11's two slots. Both values are the engine's — the held answer
  // named through its own registry key, and the resumption date formatted
  // in the site's zone (issue #204).
  if (empty.cause === "change_holds_generation") {
    // Issue 866: a category is measured again at once, so its held day names
    // the measurement it waits on and no date.
    if (empty.because === "category") {
      return writtenLine("calendar.empty.change-holds-pages.category");
    }
    return writtenLine(EMPTY_ACCOUNT_COPY_KEY.change_holds_generation, {
      change: copy(CHANGE_COPY_KEY[empty.because]),
      date: formatDate(empty.resumesOn, a.timeZone),
    });
  }
  return writtenLine(EMPTY_ACCOUNT_COPY_KEY[empty.cause as OneLineCause]);
}

/**
 * The panel's controls. The day's one way in (at most one, from
 * `actionsFor`) takes the full width: solid primary where it leads further
 * into the customer's own work, outline where it leaves the product for the
 * live page. A stop (veto, skip) is the warning outline; a restart is ghost.
 * The rest share a two-column row.
 */
function DayActions(p: {
  cell: DayCell;
  destination: DestinationStanding | null;
  /** Ask for a write. The panel owns the optimistic state, so the press
   *  reports up rather than calling the seam here. */
  onCommand: (command: DayCommand, draftId: string) => void;
  /** Whether a write this panel asked for is still in flight. Every
   *  command control is inert while one is: a second press would ask the
   *  machine for an edge the page has already left, and would answer with
   *  a refusal for a write that in fact worked. */
  busy: boolean;
}): React.JSX.Element | null {
  const actions = actionsFor(p.cell, p.destination);
  if (actions.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2" data-testid="day-actions">
      {actions.map((action) => {
        if (action.kind === "link") {
          const leavesTheProduct = action.key === "calendar.action.view-live-page";
          return (
            <a
              key={action.key}
              href={action.href}
              className={`btn btn-sm col-span-2 ${leavesTheProduct ? "btn-soft btn-primary" : "btn-primary"}`}
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
            className={`btn btn-sm ${stop ? "btn-ghost btn-warning" : "btn-ghost"}`}
            data-testid={`day-action-${action.key}`}
            disabled={p.busy}
            onClick={() => p.onCommand(action.command, action.draftId)}
          >
            {copy(action.key)}
          </button>
        );
      })}
    </div>
  );
}

/** The head (issue 1071, board R12-5-Plan): the date at the near edge, the
 *  stage as a soft badge beside it, and the close control at the far one.
 *  The panel is a whole column wide at every width it is drawn at, so the
 *  badge that could not shrink inside a day card (#944) has room here; the
 *  cards keep their dot and word. */
function Heading(p: { word: string; tone: Tone; date: string; onClose: () => void }): React.JSX.Element {
  const badge = p.tone === "neutral" ? "badge-ghost" : `badge-soft ${TONE_BADGE[p.tone]}`;
  return (
    <div className="flex min-w-0 items-center gap-2" data-testid="day-head">
      <span className="num rk-cal-label min-w-0 truncate text-xs opacity-70">{p.date}</span>
      {/* A stage word is never truncated (owner, PR #961). */}
      <span
        className={`badge badge-sm ml-auto shrink-0 whitespace-nowrap font-semibold ${badge}`}
        data-testid="panel-stage-word"
      >
        {p.word}
      </span>
      <button
        type="button"
        className="btn btn-sm btn-ghost btn-square shrink-0"
        aria-label={copy("calendar.panel.close")}
        data-testid="day-panel-close"
        onClick={p.onClose}
      >
        <X size={16} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

function Panel(p: {
  heading: React.ReactNode;
  /** Whether this day was opened by nobody — an absent `?day`. Such a
   *  panel is open from `md` up and closed below it (`CalendarView`'s
   *  header). One utility, on one DOM. */
  hiddenOnPhone: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <aside
      // One element and three layouts, never three copies of the panel:
      //
      //   phone   the sheet SPEC §7 asks for, opened from the bottom and
      //           clear of the 68px bottom menu (#940) plus the device's
      //           own safe area — the same number the answer stack stands
      //           above (`_toast/Answers.tsx`'s `BOTTOM_MENU_PX`). The
      //           month behind it is a list, which the sheet is meant to
      //           sit over.
      //   md–xl   in flow, under the month. A sheet fixed over a month
      //           that is still a seven-column grid would cover the very
      //           dates it is about.
      //   xl      the card beside the month, sticky as the month scrolls
      //           (issue 1071, board R12-5-Plan).
      //
      // On the phone alone it is capped and scrolls. The cap is what keeps
      // a sheet from growing off the top of the screen, where its own head
      // and its close control would be out of reach; the scroll is the
      // honest answer for a day whose account is longer than the room —
      // the same answer a `textarea` and an `overflow-x-auto` table give,
      // and the proof measures that neither the fixture's longest day nor
      // the owner's stress case reaches it.
      className={`card card-border bg-base-100 fixed inset-x-2 bottom-[calc(80px+env(safe-area-inset-bottom,0px))] z-30 max-h-[calc(100dvh-104px)] min-w-0 overflow-y-auto shadow-2xl md:static md:z-auto md:max-h-none md:overflow-visible md:shadow-none xl:sticky xl:top-6 ${
        p.hiddenOnPhone ? "max-md:hidden" : ""
      }`}
      data-testid="day-panel"
      data-implicit={p.hiddenOnPhone ? "" : undefined}
    >
      <div className="card-body min-w-0 gap-3 p-4">
        {p.heading}
        {p.children}
      </div>
    </aside>
  );
}

export function DayPanelView(p: {
  cell: DayCell;
  timeZone: string;
  /** SPEC §7 / REQ-043 c7 as the owner now reads it (PR #961): a day
   *  nobody asked for is open from `md` up and closed below it, because
   *  below `md` this panel is a sheet over the month. `false` for a day
   *  the address names — an explicit `?day` is obeyed at every width. */
  hiddenOnPhone?: boolean;
  /** What the site publishes to (issue 880) — which decides whether a page
   *  waiting on delivery is offered a reconnect or the neutral control. */
  destination?: DestinationStanding | null;
  /** REQ-092 c3's fact, carried from the model. Both of this panel's law
   *  statements — the publish line and a stopped day's account — turn on
   *  it, and they must turn on the same one. */
  stopped: WorkStop | null;
  /** SPEC §7 (2026-09-20): the panel is closable. Closing clears the open
   *  day from the address, so a closed panel survives a reload too. */
  onClose: () => void;
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
    const account = accountLine({ cell, stopped: p.stopped, timeZone: p.timeZone });
    // No provenance line: a date holding no page carries no measurement.
    return (
      <Panel
        hiddenOnPhone={p.hiddenOnPhone ?? false}
        heading={
          <Heading
            word={copy("calendar.empty.day-badge")}
            tone="neutral"
            date={date}
            onClose={p.onClose}
          />
        }
      >
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

  return (
    <PageDayPanel
      cell={cell}
      page={cell.page}
      date={date}
      timeZone={p.timeZone}
      destination={p.destination ?? null}
      stopped={p.stopped}
      hiddenOnPhone={p.hiddenOnPhone ?? false}
      onClose={p.onClose}
    />
  );
}

/**
 * The arm for a date that holds a page — and the one place on this screen
 * that owns a write in flight.
 *
 * Its own component because of the hooks. `useOptimistic` and
 * `useTransition` may not be called on a path a render can skip, and the
 * empty arm above returns before any of this exists; splitting the arm is
 * how the page arm gets state without the empty one pretending to have a
 * page.
 *
 * **What the optimism is.** The value is §9's own state, not the stage's
 * word: the stage, the controls and the head are all projections of the
 * state (`STAGE_OF`, `actionsFor`), so moving the one value moves all three
 * together and none of them can disagree. On a press the panel shows the
 * state the command asks for (`COMMAND_TARGET`); when the transition ends
 * React drops the optimistic value and the panel renders the state the
 * server now reports — which, after a write that landed, is the state it
 * guessed, and after a refusal is the state the page never left.
 */
function PageDayPanel(p: {
  cell: DayCell;
  page: PageOnDay;
  date: string;
  timeZone: string;
  destination: DestinationStanding | null;
  stopped: WorkStop | null;
  hiddenOnPhone: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const { cell, date, page, timeZone, stopped } = p;
  const [state, expect] = useOptimistic<State>(page.state);
  const [busy, startTransition] = useTransition();

  /** One press: show what the command asks for, ask for it, and say what
   *  came back. The sentence is read from the registry either way — there
   *  is no silent arm and no arm that invents a line. */
  function command(asked: DayCommand, draftId: string): void {
    startTransition(async () => {
      expect(COMMAND_TARGET[asked]);
      const outcome = await ask(asked, draftId);
      say(copy(outcome.ok ? ANSWER_COPY_KEY[asked] : "calendar.answer.refused"), outcome.ok ? "ok" : "bad");
    });
  }

  // The stage as this render believes it, which during a write is the stage
  // the write is asking for. `null` is a state that occupies no date at all
  // (`skipped`, `unpublished`) — a stopped page — and the panel then shows
  // what an empty date shows and offers nothing, which is exactly what the
  // server renders once the re-read lands.
  const stage = STAGE_OF[state];
  const shown: DayCell =
    stage === null ? { ...cell, page: null } : { ...cell, page: { ...page, state, stage } };

  const provenance = writtenLine("calendar.provenance.measured", {
    date: formatDateTime(page.measuredAt, timeZone),
  });
  // The veto window, for the one stage that has one.
  const vetoLine =
    page.vetoDeadline === null
      ? null
      : writtenLine("calendar.status.veto-deadline", {
          at: formatDateTime(page.vetoDeadline, timeZone),
        });
  // The scheduled publish, spoken through the cross-cutting `next-publish`
  // law (issue #113): while ReachKit has stopped its own work the statement
  // names the stop and the date is not shown beside it.
  const publishLine =
    page.publishAt === null
      ? null
      : nextPublishStatement({
          stopped: stopped !== null,
          otherwise: { tag: "scheduled", at: formatDateTime(page.publishAt, timeZone) },
        }).line;
  // What became of the page, in one line (issue #217) — the same keys the
  // draft view's record block reads, so the two cannot disagree.
  const recordLine = recordSummary(page);
  // Why the page needs them (issue 880), from its own record and never from
  // its stage. One sentence per cause, chosen once in `NEEDS_YOU_COPY`, so
  // this panel and the Overview alert cannot tell one page's story two ways.
  const needsYouLine = page.needsYou === null ? null : writtenLine(NEEDS_YOU_COPY[page.needsYou.kind]);

  return (
    <Panel
      hiddenOnPhone={p.hiddenOnPhone}
      heading={
        <Heading
          word={copy(stage === null ? "calendar.empty.day-badge" : STAGE_FILTER_COPY_KEY[stage])}
          tone={stage === null ? "neutral" : STAGE_TONE[stage]}
          date={date}
          onClose={p.onClose}
        />
      }
    >
      <div className="flex min-w-0 flex-col gap-3" data-testid="day-account">
        {/* The panel's title. `card-title` is a class and the `h2` size rule
            in `src/ui/type.css` is an element selector, so the class wins —
            which is the approach already working on main, and this PR
            changes no heading rule (#941 is rk-900's). */}
        <h2 className="card-title rk-cal-label line-clamp-2 min-w-0" data-testid="day-title">
          {page.title}
        </h2>
        <span className="badge badge-sm badge-ghost max-w-full self-start" data-testid="day-kind">
          {kindWord(page.update)}
        </span>

        <div className="flex flex-col gap-1 text-sm">
          {needsYouLine === null ? null : <p data-testid="day-needs-you-line">{needsYouLine}</p>}
          {publishLine === null ? null : <p data-testid="day-publish-line">{publishLine}</p>}
          {vetoLine === null ? null : <p data-testid="day-veto-line">{vetoLine}</p>}
        </div>
        {recordLine === null ? null : (
          <p className="flex flex-wrap items-baseline gap-2" data-testid="day-record-line">
            <span className="text-sm">{recordLine.text}</span>
            {recordLine.at === null ? null : (
              <span className="num text-xs opacity-70">{formatDate(recordLine.at, timeZone)}</span>
            )}
          </p>
        )}
        <TargetRows facts={page.why} />
      </div>
      <DayActions cell={shown} destination={p.destination} onCommand={command} busy={busy} />
      {provenance === null ? null : (
        <p className="text-xs opacity-60" data-testid="day-provenance">
          {provenance}
        </p>
      )}
    </Panel>
  );
}
