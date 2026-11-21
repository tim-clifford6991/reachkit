// SPEC §7 *This week* — the pane a card opens: about half the screen beside
// the cards from `lg`, the whole screen with a Back below it.
//
//   a written or live page  its title, the existing actions, then the body
//                           as written, which scrolls inside the pane
//   a planned day           the search it goes after, why, what is known of
//                           it, and when it goes live on its own; no control,
//                           as nothing is written yet
//   any other day           its own lines, and no control
//
// Every word is the screen model's (`week-screen.ts`). The commands go to the
// publishing seam and every one answers: the stage moves on the press
// (`useOptimistic`), the seam's answer is a toast, and a refusal rolls back.
"use client";

import type React from "react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { actionsFor, type DayCommand, type DestinationStanding } from "./actions";
import { DayStateBadge } from "./DayCard";
import { STAGE_OF } from "./stages";
import { COMMAND_TARGET, publishing } from "./publishing";
import { say } from "../../../_toast/say";
import { TakeDownControl } from "./TakeDown";
import { stopWords } from "./take-down-words";
import type { DayCell } from "./month";
import type { CardModel, PaneModel } from "./week-screen";

/** This Week draws every stage. */
const ALL = "all" as const;
import type { State } from "@/lib/publish/types";

/** What each write says when it lands; a refusal says the one thing every refusal has in common. */
export const ANSWER_COPY_KEY: Readonly<Record<DayCommand, CopyKey>> = Object.freeze({
  skip: "calendar.answer.skip",
  veto: "calendar.answer.veto",
  regenerate: "calendar.answer.regenerate",
});

/** The writes the pane can ask for. All three are §9 edges and go to the state machine through the seam. */
export function ask(command: DayCommand, draftId: string): ReturnType<typeof publishing.skip> {
  if (command === "skip") return publishing.skip({ draftId });
  if (command === "veto") return publishing.veto({ draftId });
  return publishing.regenerate({ draftId });
}

/** The day's controls, from `actionsFor`: the one way in is primary, the live page opens in a new tab, a stop warns. */
function DayActions(p: {
  cell: DayCell;
  destination: DestinationStanding | null;
  onCommand: (command: DayCommand, draftId: string) => void;
  /** A write is in flight: every command is inert, so a second press cannot ask for an edge the page has left. */
  busy: boolean;
  pressed: DayCommand | null;
  /** A live page's own stop, which takes it off the site. */
  takeDown: string | null;
  /** Only the commands: a day with nothing written has nothing to open. */
  commandsOnly?: boolean;
}): React.JSX.Element | null {
  const actions = actionsFor(p.cell, p.destination).filter((action) => p.commandsOnly !== true || action.kind === "command");
  if (actions.length === 0 && p.takeDown === null) return null;
  return (
    <div className="flex min-w-0 flex-wrap gap-2" data-testid="day-actions">
      {actions.map((action) => {
        if (action.kind === "link") {
          if (action.key === "calendar.action.view-live-page") {
            return (
              // eslint-disable-next-line local/no-plain-app-link -- the customer's live page, not a screen of the app
              <a
                key={action.key}
                href={action.href}
                target="_blank"
                rel="noopener"
                className="btn btn-sm btn-primary"
                data-testid={`day-action-${action.key}`}
              >
                <ExternalLink aria-hidden className="size-4" />
                {copy(action.key)}
                <span className="sr-only"> {copy("draft.live.new-tab")}</span>
              </a>
            );
          }
          return (
            <Link
              key={action.key}
              href={action.href}
              prefetch={true}
              className={`btn btn-sm ${p.cell.page?.stage === "live" ? "btn-ghost" : "btn-primary"}`}
              data-testid={`day-action-${action.key}`}
            >
              {copy(action.key)}
            </Link>
          );
        }
        const stop = action.command === "veto" || action.command === "skip";
        return (
          <button
            key={action.key}
            type="button"
            className={`btn btn-sm btn-ghost ${stop ? "btn-warning" : ""}`}
            data-testid={`day-action-${action.key}`}
            disabled={p.busy}
            onClick={() => p.onCommand(action.command, action.draftId)}
          >
            {p.pressed === action.command ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
            {copy(action.key)}
          </button>
        );
      })}
      {p.takeDown === null ? null : <TakeDownControl draftId={p.takeDown} mode="stop" words={stopWords()} />}
    </div>
  );
}

function Panel(p: {
  card: CardModel;
  cell: DayCell;
  date: string;
  host?: string | null;
  /** Opened by nobody (an absent `?day`): shown from `lg`, not below it. */
  hiddenOnPhone: boolean;
  onClose: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <aside
      // Below `lg` the pane is the whole screen over the list, with its own Back; from `lg` it is the right column.
      className={`card card-border bg-base-100 fixed inset-0 z-50 min-w-0 overflow-y-auto rounded-none lg:static lg:z-auto lg:min-h-0 lg:overflow-hidden lg:rounded-box ${
        p.hiddenOnPhone ? "hidden lg:flex" : ""
      }`}
      data-testid="day-panel"
      data-implicit={p.hiddenOnPhone ? "" : undefined}
    >
      <div className="card-body min-w-0 gap-3 p-4 lg:min-h-0">
        <button type="button" className="btn btn-ghost btn-sm self-start lg:hidden" data-testid="day-panel-close" onClick={p.onClose}>
          <ArrowLeft aria-hidden className="size-4" />
          {copy("draft.back")}
        </button>
        <div className="flex min-w-0 flex-wrap items-center gap-2" data-testid="day-head" aria-live="polite">
          <span className="num min-w-0 text-xs opacity-70">{p.date}</span>
          <DayStateBadge cell={p.cell} filter={ALL} word={p.cell === p.card.cell ? p.card.word : undefined} />
          {p.host == null ? null : <span className="num ms-auto min-w-0 text-xs opacity-70 wrap-anywhere">{p.host}</span>}
        </div>
        {p.children}
      </div>
    </aside>
  );
}

export function DayPanelView(p: {
  card: CardModel;
  /** The page's body as written, rendered on the server. */
  body?: React.ReactNode;
  destination?: DestinationStanding | null;
  hiddenOnPhone?: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const { card } = p;
  const pane = card.pane;
  const page = card.cell.page;
  if (pane.kind === "page" && page !== null) {
    return <PageDayPanel card={card} pane={pane} state={page.state} body={p.body} destination={p.destination ?? null} hiddenOnPhone={p.hiddenOnPhone ?? false} onClose={p.onClose} />;
  }
  if (pane.kind === "planned") {
    return (
      <Panel card={card} cell={card.cell} date={pane.date} hiddenOnPhone={p.hiddenOnPhone ?? false} onClose={p.onClose}>
        <h2 className="card-title min-w-0 wrap-anywhere" data-testid="day-title">
          {pane.title}
        </h2>
        {pane.why === null ? null : <p className="text-sm">{pane.why}</p>}
        <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm" data-testid="day-facts">
          {pane.facts.map((fact) => (
            <div key={fact.label} className="contents">
              <dt className="text-base-content/70">{fact.label}</dt>
              <dd className={`min-w-0 wrap-anywhere ${fact.mono === true ? "num" : ""}`}>{fact.value}</dd>
            </div>
          ))}
        </dl>
        {pane.next === null ? null : <p className="text-sm" data-testid="day-next">{pane.next}</p>}
        <PlannedStop cell={card.cell} />
      </Panel>
    );
  }
  return (
    <Panel card={card} cell={card.cell} date={pane.date} hiddenOnPhone={p.hiddenOnPhone ?? false} onClose={p.onClose}>
      <div className="flex flex-col gap-2 text-sm" data-testid="day-account">
        {(pane.kind === "lines" ? pane.lines : []).map((line) => (
          <p key={line} data-testid="day-empty-line">
            {line}
          </p>
        ))}
      </div>
    </Panel>
  );
}

/** A planned day that already has its row offers its stop, as the actions allow. */
function PlannedStop(p: { cell: DayCell }): React.JSX.Element | null {
  const [busy, startTransition] = useTransition();
  const [pressed, setPressed] = useState<DayCommand | null>(null);
  function command(asked: DayCommand, draftId: string): void {
    setPressed(asked);
    startTransition(async () => {
      const outcome = await ask(asked, draftId);
      say(copy(outcome.ok ? ANSWER_COPY_KEY[asked] : "calendar.answer.refused"), outcome.ok ? "ok" : "bad");
    });
  }
  return <DayActions cell={p.cell} destination={null} onCommand={command} busy={busy} pressed={busy ? pressed : null} takeDown={null} commandsOnly />;
}

/** The arm for a written or live page, and the one place on this screen that owns a write in flight. */
function PageDayPanel(p: {
  card: CardModel;
  pane: Extract<PaneModel, { kind: "page" }>;
  state: State;
  body: React.ReactNode;
  destination: DestinationStanding | null;
  hiddenOnPhone: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const { card, pane } = p;
  const page = card.cell.page!;
  const [state, expect] = useOptimistic<State>(p.state);
  const [busy, startTransition] = useTransition();
  const [pressed, setPressed] = useState<DayCommand | null>(null);

  function command(asked: DayCommand, draftId: string): void {
    setPressed(asked);
    startTransition(async () => {
      expect(COMMAND_TARGET[asked]);
      const outcome = await ask(asked, draftId);
      say(copy(outcome.ok ? ANSWER_COPY_KEY[asked] : "calendar.answer.refused"), outcome.ok ? "ok" : "bad");
    });
  }

  // During a write the page shows the state the write asks for; a stopped page offers nothing.
  const stage = state === page.state ? page.stage : STAGE_OF[state];
  const shown: DayCell =
    stage === null
      ? { ...card.cell, page: null, empty: { cause: "page_cannot_go_live", state: "skipped" }, stoppedByYou: true }
      : { ...card.cell, page: { ...page, state, stage } };
  const takeDown = page.stage === "live" && page.liveUrl !== null && page.draftId !== null ? page.draftId : null;

  return (
    <Panel card={card} cell={shown} date={pane.date} host={pane.host} hiddenOnPhone={p.hiddenOnPhone} onClose={p.onClose}>
      <h2 className="card-title rk-cal-label line-clamp-2 min-w-0 wrap-anywhere" data-testid="day-title">
        {pane.title}
      </h2>
      {pane.titleLabel === undefined ? null : <span className="text-xs text-base-content/70" data-testid="day-title-label">{pane.titleLabel}</span>}
      {pane.becameUpdate === null ? null : <p className="text-sm" data-testid="day-became-update-line">{pane.becameUpdate}</p>}
      {pane.notes.map((note) => (
        <p key={note} className="text-sm" data-testid="day-needs-you-line">
          {note}
        </p>
      ))}
      <DayActions cell={shown} destination={p.destination} onCommand={command} busy={busy} pressed={busy ? pressed : null} takeDown={stage === null ? null : takeDown} />
      {p.body === undefined ? null : (
        <div
          className="prose min-w-0 max-w-none border-t border-base-300 pt-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
          tabIndex={0}
          aria-label={copy("calendar.pane.body.label", { title: pane.title })}
          data-testid="day-body"
        >
          {p.body}
        </div>
      )}
      {pane.next === null ? null : <p className="text-sm" data-testid="day-next">{pane.next}</p>}
    </Panel>
  );
}
