// BUILD §4.6 — Calendar (with day panel), at `/app/calendar`.
//
// "Head: … + month switcher." Then §4.6's four
// parts: the stage filter cards, the Mon–Sun grid, the 290px day panel
// beside it, and the footnote.
//
// The screen reads once — `readMonth`, request-cached — and hands the
// assembled model to one client component that owns the two interactions
// (`CalendarView`). Everything else on this page is server-rendered and
// static, so a customer with no client runtime still gets the month, its
// accounts and its footnote.
//
// **The month switcher is two links around the month you are on, welded
// into one `join`.** A month name is a value, not a sentence (§2.3 covers
// it, the copy registry does not), so the switcher needs no owner-owed
// string to be usable — and the neighbours being links rather than buttons
// is what puts the month in the address, where it can be linked to, shared
// and survives a reload. That is also why this is not a `Tabs`: `Tabs`
// renders buttons with an `onSelect`, which would take the address, the
// back button and the no-client-runtime property with it.
//
// **It is a `join` since #269, and the neighbours dropped their year.**
// This file used to argue the opposite — "daisyUI's `join` does not wrap,
// and three month names welded into one row overflow a 320px document" —
// and the second half of that was the real finding: three *full* labels
// (`September 2026` three times) do not fit 320, and the switcher wrapped
// onto a second line with nothing marking which month you were on. The
// year belongs to the month you are looking at, so the neighbours carry
// `monthNameOnly` and the row fits on one line at 320 with room to spare.
// `join` not wrapping is then a property rather than a problem: a control
// that cannot wrap is one that has to fit, and the layout suite measures
// it at five widths.
//
// **The current month is marked and is not a link.** `aria-current="page"`
// plus the accent pair, the same pairing the sidebar's nav uses — it is
// where the customer already is, and a link to here is a control that does
// nothing.
//
// It declares no `Surface`: the shell's layout owns this route's screen
// root (`../layout.tsx`), and a second one would be a second
// `[data-surface]` in the document (ADR-093 decision 6).
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import { CalendarView } from "./CalendarView";
import { addMonths, monthNameOnly, monthShortLabel } from "./dates";
import { parseMonth, readMonth, readSupplyNotice } from "./provider";
import { supplyLine } from "./supply";

/**
 * The switcher's two arrows.
 *
 * **Fixed glyphs marking a direction, not product sentences** — the same
 * footing `Stat`'s em dash already stands on ("a fixed glyph marking
 * 'nothing measured', not a product sentence; BP-018 decision 2 is about
 * copy, not punctuation"). Neither needs a registry key and neither could
 * usefully have one: an owner-owed key renders as nothing, and a control
 * whose only content is nothing is a control nobody can see.
 *
 * The *name* of each control is a different question and is answered a
 * different way — the month it goes to, in the markup below, where a
 * screen reader reads it and an eye does not.
 */
const PREVIOUS_GLYPH = "\u2190";
const NEXT_GLYPH = "\u2192";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const asked = (await searchParams).month;
  const month = await parseMonth(typeof asked === "string" ? asked : undefined);
  const model = await readMonth(month);
  // §7's one statement of supply. At most one — the precedence between the
  // three arms is the engine's, and this screen renders whichever it
  // returned and never a second.
  const supplyStatement = supplyLine(await readSupplyNotice(), model.timeZone);

  const previous = addMonths(month, -1);
  const next = addMonths(month, 1);
  // §4.6's footnote. The supply half is owner-owed and renders as nothing
  // until it is written — never as a placeholder sentence.
  const plannedNote = writtenLine("calendar.footnote.planned");
  const supplyNote = writtenLine("calendar.footnote.supply");

  return (
    <div className="flex flex-col gap-4">
      {/* S14's head row: the head at the near edge and the month switcher at
          the far one, on one line (issue #354). It stacked before, which
          put a full-width row between the head and the filter and pushed
          the month down a whole band. It wraps rather than shrinking — at
          320 the switcher drops under the head, which is what ADR-093
          decision 2 asks for. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>{copy("calendar.head")}</h1>
        <nav className="flex items-center gap-2" data-testid="month-switcher">
          <a
            href={`/app/calendar?month=${previous}`}
            className="btn btn-sm btn-ghost"
            // The arrow is the drawing; the month it goes to is the
            // accessible name. A glyph with no name is a control nobody
            // can hear — and the name needs no registry key, because a
            // month is a value and not a sentence (§2.3). `aria-label` and
            // not an off-screen span: `sr-only` is an absolutely
            // positioned, clipped box, which the layout sweep reads as an
            // element escaping its parent and as text cut off — both true
            // of it, and both the reason it is the wrong mechanism here.
            aria-label={monthNameOnly(previous)}
            data-testid="month-previous"
          >
            {PREVIOUS_GLYPH}
          </a>
          {/* Not a link and not a control: this is where the customer
              already is. `aria-current` is what a screen reader reads and
              the emphasis is what an eye reads — the mark is never tone
              alone (§2.5). */}
          <span
            className="num font-semibold"
            aria-current="page"
            data-testid="month-current"
          >
            {monthShortLabel(month)}
          </span>
          <a
            href={`/app/calendar?month=${next}`}
            className="btn btn-sm btn-ghost"
            aria-label={monthNameOnly(next)}
            data-testid="month-next"
          >
            {NEXT_GLYPH}
          </a>
        </nav>
      </div>

      <CalendarView model={model} />

      {/* S14's footnote — **one** line under the grid, and the calendar's
          only one (issue #354). Its two halves are two sentences of one
          footnote rather than two footnotes: "Planned pages are written the
          evening before, from Monday's measurements. When opportunities run
          out, future days are empty — the calendar is never padded." Each
          is still its own registry key, so a half the owner has not written
          renders as nothing and the other still reads as a sentence.

          §7's supply statement is a separate paragraph because it is a
          separate claim: the footnote states the rule, and the statement
          states what supply is doing right now. At most one of the three
          arms is ever returned (`supplyLine`), so this is never a second
          footnote either. */}
      <footer className="flex flex-col gap-1" data-testid="calendar-footnote">
        {plannedNote === null && supplyNote === null ? null : (
          <p className="explain">
            {[plannedNote, supplyNote].filter((line) => line !== null).join(" ")}
          </p>
        )}
        {supplyStatement === null ? null : (
          <p className="explain" data-testid="calendar-supply-statement">
            {supplyStatement}
          </p>
        )}
      </footer>
    </div>
  );
}
