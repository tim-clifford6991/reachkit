// BUILD §4.6 — Calendar (with day panel), at `/app/calendar`.
//
// "Head: 'One page a day. Every day.' + month switcher." Then §4.6's four
// parts: the stage filter cards, the Mon–Sun grid, the 290px day panel
// beside it, and the footnote.
//
// The screen reads once — `readMonth`, request-cached — and hands the
// assembled model to one client component that owns the two interactions
// (`CalendarView`). Everything else on this page is server-rendered and
// static, so a customer with no client runtime still gets the month, its
// accounts and its footnote.
//
// **The month switcher is two links, and its labels are the months
// themselves.** A month name is a value, not a sentence (§2.3 covers it,
// the copy registry does not), so the switcher needs no owner-owed string
// to be usable — and being links rather than buttons is what puts the month
// in the address, where it can be linked to and survives a reload. They are
// not wrapped in a `Join`: daisyUI's `join` does not wrap, and three month
// names welded into one row overflow a 320px document.
//
// It declares no `Surface`: the shell's layout owns this route's screen
// root (`../layout.tsx`), and a second one would be a second
// `[data-surface]` in the document (ADR-093 decision 6).
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import { CalendarView } from "./CalendarView";
import { addMonths, monthLabel } from "./dates";
import { parseMonth, readMonth } from "./provider";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const asked = (await searchParams).month;
  const month = parseMonth(typeof asked === "string" ? asked : undefined);
  const model = await readMonth(month);

  const previous = addMonths(month, -1);
  const next = addMonths(month, 1);
  // §4.6's footnote. The supply half is owner-owed and renders as nothing
  // until it is written — never as a placeholder sentence.
  const plannedNote = writtenLine("calendar.footnote.planned");
  const supplyNote = writtenLine("calendar.footnote.supply");

  return (
    <div className="flex flex-col gap-4">
      <h1>{copy("calendar.head")}</h1>
      <nav
        className="flex flex-wrap items-baseline gap-3"
        data-testid="month-switcher"
      >
        <a
          href={`/app/calendar?month=${previous}`}
          className="num"
          data-testid="month-previous"
        >
          {monthLabel(previous)}
        </a>
        <span className="num" data-testid="month-current">
          {monthLabel(month)}
        </span>
        <a
          href={`/app/calendar?month=${next}`}
          className="num"
          data-testid="month-next"
        >
          {monthLabel(next)}
        </a>
      </nav>

      <CalendarView model={model} />

      <footer className="flex flex-col gap-1" data-testid="calendar-footnote">
        {plannedNote === null ? null : <p className="rk-prov">{plannedNote}</p>}
        {supplyNote === null ? null : <p className="rk-prov">{supplyNote}</p>}
      </footer>
    </div>
  );
}
