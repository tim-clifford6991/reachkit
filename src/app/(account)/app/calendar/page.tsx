// SPEC §7 — the calendar, at `/app/calendar`.
//
// The screen reads once — `readMonth`, request-cached — and hands the
// assembled model to one client component that owns the two interactions
// (`CalendarView`: which stage is showing, which day the panel is on).
// Everything else here is server-rendered.
//
// **The month switcher is two links around the month you are on**, in a
// daisyUI `join`. The neighbours are links rather than buttons so the month
// lives in the address: it can be linked to, shared and survives a reload.
// Each arrow is a lucide glyph named by the month it goes to — a month is a
// value, not a sentence, so the name needs no registry key. The current
// month is marked with `aria-current` and weight, and is not a link.
//
// It declares no `Surface`: the shell's layout owns this route's screen
// root (`../layout.tsx`).
import type React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import { CalendarView } from "./CalendarView";
import { addMonths, monthNameOnly, monthShortLabel } from "./dates";
import { parseMonth, readMonth, readSupplyNotice } from "./provider";
import { supplyLine } from "./supply";
import { readOnboarding } from "../_shell/onboarding";
import { FirstPageNotice } from "../_shell/OnboardingStatus";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const asked = (await searchParams).month;
  const month = await parseMonth(typeof asked === "string" ? asked : undefined);
  const [model, onboarding] = await Promise.all([readMonth(month), readOnboarding()]);
  // §7's one statement of supply. At most one — the precedence between the
  // three arms is the engine's, and this screen renders whichever it
  // returned and never a second.
  const supplyStatement = supplyLine(await readSupplyNotice(), model.timeZone);

  const previous = addMonths(month, -1);
  const next = addMonths(month, 1);
  // The footnote's two halves are owner-owed keys; an unwritten half renders
  // as nothing, never as a placeholder sentence.
  const plannedNote = writtenLine("calendar.footnote.planned");
  const supplyNote = writtenLine("calendar.footnote.supply");

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{copy("calendar.head")}</h1>
        <nav className="join" data-testid="month-switcher">
          <a
            href={`/app/calendar?month=${previous}`}
            className="btn btn-sm btn-ghost join-item"
            aria-label={monthNameOnly(previous)}
            data-testid="month-previous"
          >
            <ChevronLeft size={20} strokeWidth={1.75} aria-hidden />
          </a>
          <span
            className="btn btn-sm btn-ghost join-item num pointer-events-none font-semibold"
            aria-current="page"
            data-testid="month-current"
          >
            {monthShortLabel(month)}
          </span>
          <a
            href={`/app/calendar?month=${next}`}
            className="btn btn-sm btn-ghost join-item"
            aria-label={monthNameOnly(next)}
            data-testid="month-next"
          >
            <ChevronRight size={20} strokeWidth={1.75} aria-hidden />
          </a>
        </nav>
      </div>

      <FirstPageNotice state={onboarding} />
      <CalendarView model={model} />

      {/* One footnote under the grid. §7's supply statement is a separate
          paragraph because it is a separate claim: the footnote states the
          rule, the statement states what supply is doing right now. */}
      <footer className="flex flex-col gap-1 text-sm opacity-70" data-testid="calendar-footnote">
        {plannedNote === null && supplyNote === null ? null : (
          <p>{[plannedNote, supplyNote].filter((line) => line !== null).join(" ")}</p>
        )}
        {supplyStatement === null ? null : (
          <p data-testid="calendar-supply-statement">{supplyStatement}</p>
        )}
      </footer>
    </div>
  );
}
