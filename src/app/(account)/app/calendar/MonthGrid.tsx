// SPEC §7 (2026-09-20, #908, issue 930) — the month, on `react-day-picker`
// 9 (`docs/DESIGN.md`'s library list: it replaces "the hand-built month
// grid", and "the day card goes in its day slot").
//
// What the library owns here is everything about a month that this product
// has no opinion about: which dates fall in which Monday–Sunday week, the
// leading and trailing positions, the `<table role="grid">` the assistive
// tree wants, the roving `tabIndex` across 35 cells and the arrow-key
// movement between them. What this file owns is one slot — `DayButton` —
// and what goes inside it is `DayCard`.
//
// **The zone is the site's, and it is the library's own `timeZone` prop**
// (`@date-fns/tz`, on the same list). Every date this screen states is a
// site-local calendar day (`dates.ts`), so the month the library lays out
// has to be the site's month and not the browser's: a founder in UTC+13
// opening at 01:00 local must see their own today ringed.
//
// **daisyUI's `react-day-picker` skin, with the layout members replaced.**
// The skin is written for a date *picker* — an inline-block box of 2.25rem
// square days — and this is a month planner whose day is a fixed-height
// card in one of seven equal columns. So the root keeps the class, and with
// it daisyUI's nav, chevron, caption and weekday treatment; the members
// whose box this screen decides (`months`, `month`, `month_grid`, `week`,
// `day`, `weekday`) are passed our own class names, which *replaces* the
// `rdp-*` class on those elements, so the skin's rule no longer matches
// them at all. Nothing is overridden by force and no stylesheet is added:
// the classes below are Tailwind utilities in the file that renders, which
// is `docs/DESIGN.md` rule 1.
//
// The month itself is **not** state here: it is in the address, held by
// `nuqs` in `CalendarView`, so a month switched to survives a reload and
// can be linked to. This component is handed one and draws it.
"use client";

import type React from "react";
import { TZDate } from "@date-fns/tz";
import { DayPicker, type DayButtonProps } from "react-day-picker";
import { DayCard } from "./DayCard";
import { dayKeyOfLocalDate, type DayKey } from "./dates";
import type { DayCell, MonthModel } from "./month";
import type { StageFilter } from "./stages";

/** A `DayKey` as the instant the library lays it out at: that calendar day
 *  at midday in the site's own zone. Midday, not midnight, for the reason
 *  `src/lib/scan/weekly/week.ts` gives about stepping days: an hour of DST
 *  either way cannot move a date away from the day it names. */
function zoned(day: DayKey, timeZone: string): TZDate {
  const [y, m, d] = day.split("-").map(Number);
  return new TZDate(y ?? 0, (m ?? 1) - 1, d ?? 1, 12, 0, 0, timeZone);
}

/** The cell a date outside the assembled month takes. It holds a column
 *  position and nothing else — never padding (§4.6), and never a date this
 *  calendar has something to say about. */
function placeholderCell(day: DayKey): DayCell {
  return {
    day,
    when: "after",
    statesLine: false,
    horizonMarker: false,
    inMonth: false,
    today: false,
    page: null,
    empty: null,
  };
}

export function MonthGrid(p: {
  model: MonthModel;
  filter: StageFilter;
  /** The open day, or `null` while the panel is closed. */
  selected: DayKey | null;
  onSelect: (day: DayKey) => void;
}): React.JSX.Element {
  const { model } = p;
  const byDay = new Map(model.cells.map((cell) => [cell.day, cell]));
  const first = model.cells.find((cell) => cell.inMonth)?.day ?? `${model.month}-01`;

  /** The day slot. The library hands us its own `<button>` props — the
   *  roving `tabIndex`, the click and key handlers, its `aria-label` — and
   *  we keep every one of them and replace the label, because the card
   *  states more than a date (`card-lines.ts`). */
  function DayButton(props: DayButtonProps): React.JSX.Element {
    // `children` is dropped on purpose: the library's own child is the day
    // numeral, and the card draws the date itself alongside everything
    // else the day holds. Every other prop — the roving `tabIndex`, the
    // click and key handlers, `disabled` — is kept whole.
    const { day, modifiers, children, ...buttonProps } = props;
    void modifiers;
    void children;
    const key = dayKeyOfLocalDate(day.date);
    const cell = byDay.get(key) ?? placeholderCell(key);
    return (
      <DayCard
        cell={cell}
        filter={p.filter}
        selected={cell.inMonth && key === p.selected}
        buttonProps={buttonProps}
      />
    );
  }

  return (
    <DayPicker
      // The skin, and the layout this screen decides. See the header.
      className="react-day-picker block w-full border-0 bg-transparent p-0"
      classNames={{
        months: "flex w-full flex-col",
        month: "flex w-full flex-col gap-1.5",
        // One month, so the caption repeats the switcher above it. It is
        // what the grid is named by (`aria-labelledby`), and a name is
        // computed from a referenced element whether or not it is
        // displayed — so it is `hidden` rather than `sr-only`. `sr-only`
        // is a 1px clipping box, and the library's own caption label is
        // positioned inside it, which the layout sweep reads as an element
        // escaping its parent, correctly.
        month_caption: "hidden",
        month_grid: "w-full table-fixed border-separate border-spacing-1",
        weekdays: "",
        weekday: "eyebrow pb-1 text-center",
        week: "",
        day: "p-0 align-top",
        day_button: "",
      }}
      mode="single"
      // The open day, as the library's own selection: it draws
      // `aria-selected` on the cell from this, so the card's own mark and
      // the assistive tree cannot disagree.
      selected={p.selected === null ? undefined : zoned(p.selected, model.timeZone)}
      onSelect={(date) => {
        if (date === undefined) return;
        p.onSelect(dayKeyOfLocalDate(date));
      }}
      required={false}
      month={zoned(first, model.timeZone)}
      // The site-local today, which this model already resolved from the
      // site's own zone — never the browser's clock. The library marks its
      // own cell from this, so its `data-today` and the card's are one
      // fact and cannot name two different dates.
      today={zoned(model.today, model.timeZone)}
      timeZone={model.timeZone}
      // The switcher is the screen's, in its header, and it is in the
      // address (`nuqs`). A second pair of arrows inside the grid would be
      // a second place the month changes.
      hideNavigation
      weekStartsOn={1}
      showOutsideDays
      // A date outside this month is a column position, not a date this
      // calendar has anything to say about, so it cannot be opened.
      disabled={(date) => byDay.get(dayKeyOfLocalDate(date))?.inMonth !== true}
      components={{ DayButton }}
      data-testid="calendar-grid"
    />
  );
}
