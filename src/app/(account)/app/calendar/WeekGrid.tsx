// SPEC §7 *This week* — one card a day, in date order: the day, New or
// Update, its stage, the title, and the stage's lines. Every word is the
// screen model's (`week-screen.ts`); a card opens its day in the pane.
"use client";

import type React from "react";
import Link from "next/link";
import { copy } from "@/lib/presentation/copy";
import { DayStateBadge, KindChip } from "./DayCard";
import type { DayKey } from "./dates";
import { DAY_ROW, REGION, WEEK_LIST } from "./frame";
import type { CardModel } from "./week-screen";

/** This Week draws every stage. */
const ALL = "all" as const;

function DayRow(p: { card: CardModel; selected: boolean; onSelect: (day: DayKey) => void }): React.JSX.Element {
  const { card } = p;
  return (
    <li
      className={[
        DAY_ROW,
        card.state === "skipped" ? "border-dashed" : "",
        p.selected ? "border-primary" : "",
      ].join(" ")}
      data-testid={`calendar-cell-${card.day}`}
      data-today={card.cell.today ? "" : undefined}
      data-empty={card.cell.page === null ? "" : undefined}
    >
      <button
        type="button"
        className="flex min-w-0 flex-col items-start gap-1.5 text-left"
        aria-current={p.selected ? "true" : undefined}
        aria-label={card.ariaLabel}
        onClick={() => p.onSelect(card.day)}
      >
        <span className="flex w-full min-w-0 flex-wrap items-center gap-2">
          <span className="num text-xs font-semibold whitespace-nowrap" data-testid="cell-date">
            {card.dayLabel}
          </span>
          {card.kind === null ? null : <KindChip update={card.kind === "update"} />}
          <span className="ms-auto">
            <DayStateBadge cell={card.cell} filter={ALL} />
          </span>
        </span>
        {card.title === null ? null : (
          <span className={`min-w-0 text-sm font-semibold leading-snug wrap-anywhere ${card.search ? "num" : "rk-cal-label line-clamp-2"}`} data-testid="cell-label">
            {card.title}
          </span>
        )}
        {card.titleLabel === undefined ? null : <span className="min-w-0 text-xs text-base-content/70" data-testid="cell-title-label">{card.titleLabel}</span>}
        {card.lines.length === 0 ? null : (
          <span className="min-w-0 text-sm text-base-content/70 wrap-anywhere" data-testid="cell-lines">
            {card.lines.join(" · ")}
          </span>
        )}
        {card.emptyLine === null ? null : (
          <span className="min-w-0 text-sm text-base-content/70 wrap-anywhere" data-testid={card.cell.horizonMarker ? "calendar-horizon-marker" : "cell-empty-line"}>
            {card.emptyLine}
          </span>
        )}
        {card.stateLine === null ? null : (
          <span className="min-w-0 text-sm text-base-content/70 wrap-anywhere" data-testid="cell-state-line">
            {card.stateLine}
          </span>
        )}
      </button>
      {card.fix === null ? null : (
        <Link href={`/app/issues#${card.fix}`} className="link link-primary link-hover inline-flex min-h-11 items-center text-sm" data-testid="cell-fix-link">
          {copy("calendar.day.held-for-fix.link")}
        </Link>
      )}
    </li>
  );
}

export function WeekGrid(p: {
  cards: readonly CardModel[];
  /** The day the pane shows, where it shows one. */
  selected: DayKey | null;
  onSelect: (day: DayKey) => void;
}): React.JSX.Element {
  return (
    <ol className={WEEK_LIST} data-testid="calendar-week" data-frame={REGION.week}>
      {p.cards.map((card) => (
        <DayRow key={card.day} card={card} selected={card.day === p.selected} onSelect={p.onSelect} />
      ))}
    </ol>
  );
}
