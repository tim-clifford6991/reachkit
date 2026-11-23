// SPEC §7 *This week* — the cards and the pane beside them, and which day
// the pane is on.
//
// **The open day lives in the address** (`nuqs`), pushed so Back returns:
//
//   ?day=2026-10-04  the open day, at every width.
//   ?day=none        no day open.
//   (absent)         the model's day from `lg` up, none below it: a phone
//                    lands on its list, not on a page.
"use client";

import type React from "react";
import { useEffect, useSyncExternalStore } from "react";
import { parseAsString, useQueryState } from "nuqs";
import Link from "next/link";
import { copy } from "@/lib/presentation/copy";
import { DayPanelView } from "./DayPanelView";
import { WeekGrid } from "./WeekGrid";
import { WeekFoot } from "./WeekCard";
import { BODY, COLUMN, REGION } from "./frame";
import type { DayKey } from "./dates";
import type { WeekModel } from "./month";
import type { WeekScreen } from "./week-screen";

/** Tailwind's `lg`: from here the pane sits beside the cards rather than over them. */
const WIDE = "(min-width: 64rem)";

function onWidth(change: () => void): () => void {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}

/** Where answers are announced: the toasts and Next's route announcer stay live while the pane holds the focus. */
const LIVE = '[aria-live], [data-sonner-toaster], next-route-announcer';

/** Makes everything outside `el` inert (the shell's dock and top bar included), so focus stays in it, but never a live
 *  region: one is left alone, and a box holding one is entered and its other children held. Returns the undo. */
function holdFocusIn(el: HTMLElement): () => void {
  const held: HTMLElement[] = [];
  const hold = (node: Element): void => {
    if (!(node instanceof HTMLElement) || node.inert || node.matches(LIVE)) return;
    if (node.querySelector(LIVE) === null) {
      node.inert = true;
      held.push(node);
      return;
    }
    for (const child of Array.from(node.children)) hold(child);
  };
  for (let at: HTMLElement | null = el; at !== null && at !== document.body; at = at.parentElement) {
    for (const sibling of Array.from(at.parentElement?.children ?? [])) if (sibling !== at) hold(sibling);
  }
  return () => held.forEach((node) => (node.inert = false));
}

/** The `?day=` value that means "no day open". */
export const DAY_CLOSED = "none";

export function CalendarView(p: {
  week: WeekModel;
  screen: WeekScreen;
  /** Each written page's body as written, rendered on the server, by draft. */
  bodies?: Readonly<Record<string, React.ReactNode>>;
  /** At least one page is live, so the link to the one list of them is drawn. */
  anyLive?: boolean;
}): React.JSX.Element {
  const [day, setDay] = useQueryState("day", parseAsString.withOptions({ history: "push" }));

  const wide = useSyncExternalStore(onWidth, () => window.matchMedia(WIDE).matches, () => true);
  const implicit = day === null;
  const selected: DayKey | null = day === DAY_CLOSED ? null : (day ?? p.screen.opensOn);
  const card = selected === null ? undefined : [...p.screen.cards, ...p.screen.nextWeek].find((found) => found.day === selected);
  // Below `lg` the pane covers the list, and an implicit day opens nothing there.
  const shown = card === undefined || (implicit && !wide) ? null : card.day;
  const covers = shown !== null && !wide;
  useEffect(() => {
    const pane = covers ? document.querySelector<HTMLElement>('[data-testid="day-panel"]') : null;
    if (pane === null) return undefined;
    const release = holdFocusIn(pane);
    // On close the page behind is live again first, then focus returns to the card that opened the pane.
    return () => {
      release();
      document.querySelector<HTMLElement>(`[data-testid="calendar-cell-${shown}"] button`)?.focus();
    };
  }, [covers, shown]);

  function close(): void {
    void setDay(DAY_CLOSED).then(() => {
      // From `lg` nothing was held, so focus returns here.
      if (wide && selected !== null) document.querySelector<HTMLElement>(`[data-testid="calendar-cell-${selected}"] button`)?.focus();
    });
  }

  return (
    <div className={BODY} data-frame={REGION.body}>
      <div className={COLUMN} data-testid="plan-week-card">
        <WeekGrid cards={p.screen.cards} nextWeek={p.screen.nextWeek} selected={shown} onSelect={(next) => void setDay(next)} />

        {/* The week's spares, used only where a day's page cannot be written. */}
        {p.week.spares.length === 0 ? null : (
          <details className="collapse collapse-arrow card-border bg-base-100" data-testid="calendar-spares">
            <summary className="collapse-title flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-semibold">
                <span className="num">{p.week.spares.length}</span> {copy("calendar.spares.title")}
              </span>
              <span className="text-sm text-base-content/70">{copy("calendar.spares.note")}</span>
            </summary>
            <ul className="collapse-content list min-w-0">
              {p.week.spares.map((search) => (
                <li key={search} className="list-row min-w-0 px-0 wrap-anywhere" data-testid="calendar-spare">
                  {search}
                </li>
              ))}
            </ul>
          </details>
        )}
        <WeekFoot words={p.screen.head.foot} />
        {p.anyLive === true ? (
          <p className="min-w-0 text-sm">
            <Link href="/app/pages" className="link link-primary inline-flex min-h-11 items-center" data-testid="calendar-pages-link">
              {copy("calendar.pages.link")}
            </Link>
          </p>
        ) : null}
      </div>

      {card === undefined ? null : (
        <DayPanelView
          key={card.day}
          card={card}
          body={card.cell.page?.draftId == null ? undefined : p.bodies?.[card.cell.page.draftId]}
          destination={p.week.destination}
          hiddenOnPhone={implicit}
          takesFocus={covers}
          onClose={close}
        />
      )}
    </div>
  );
}
