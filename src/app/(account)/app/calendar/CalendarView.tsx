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
import { parseAsString, useQueryState } from "nuqs";
import { copy } from "@/lib/presentation/copy";
import { DayPanelView } from "./DayPanelView";
import { WeekGrid } from "./WeekGrid";
import { BODY, COLUMN, REGION } from "./frame";
import type { DayKey } from "./dates";
import type { WeekModel } from "./month";
import type { WeekScreen } from "./week-screen";

/** The `?day=` value that means "no day open". */
export const DAY_CLOSED = "none";

export function CalendarView(p: {
  week: WeekModel;
  screen: WeekScreen;
  /** Each written page's body as written, rendered on the server, by draft. */
  bodies?: Readonly<Record<string, React.ReactNode>>;
  /** Every page published, under the cards. */
  published?: React.ReactNode;
}): React.JSX.Element {
  const [day, setDay] = useQueryState("day", parseAsString.withOptions({ history: "push" }));

  const implicit = day === null;
  const selected: DayKey | null = day === DAY_CLOSED ? null : (day ?? p.screen.opensOn);
  const card = selected === null ? undefined : p.screen.cards.find((found) => found.day === selected);

  function close(): void {
    void setDay(DAY_CLOSED).then(() => {
      if (selected !== null) document.querySelector<HTMLElement>(`[data-testid="calendar-cell-${selected}"] button`)?.focus();
    });
  }

  return (
    <div className={BODY} data-frame={REGION.body}>
      <div className={COLUMN} data-testid="plan-week-card">
        <WeekGrid cards={p.screen.cards} selected={selected} implicit={implicit} onSelect={(next) => void setDay(next)} />

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
        {p.published}
      </div>

      {card === undefined ? null : (
        <DayPanelView
          key={card.day}
          card={card}
          body={card.cell.page?.draftId == null ? undefined : p.bodies?.[card.cell.page.draftId]}
          destination={p.week.destination}
          hiddenOnPhone={implicit}
          onClose={close}
        />
      )}
    </div>
  );
}
