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
// **It stayed a pair of links when `nuqs` arrived** (issue 930). `nuqs`
// replaces *hand-rolled* URL state, and an `<a href="?month=">` is not
// that: it is the month in the address already, server-rendered, with no
// client runtime, middle-clickable and shareable — the three properties
// #269 and #354 put here and `tests/app/calendar/month-switcher.test.ts`
// pins. What `nuqs` holds is the open day, which has no link to be
// (`CalendarView`). A month link carries no `day`, so switching months
// opens the new month on its own default rather than on a date that is not
// in it.
//
// **`Suspense`**: `nuqs` reads the query string through Next's own
// `useSearchParams`, which a client component may only do inside a boundary
// (`01-app/03-api-reference/04-functions/use-search-params.md`: "We
// recommend wrapping the Client Component that uses `useSearchParams` in a
// `<Suspense/>` boundary"). One daisyUI `skeleton` holds its place, which
// is what SPEC §5 (2026-09-20) asks of every waiting state in the app.
//
// It declares no `Surface`: the shell's layout owns this route's screen
// root (`../layout.tsx`).
import type React from "react";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import { CalendarView } from "./CalendarView";
import { addMonths, monthNameOnly, monthShortLabel } from "./dates";
import { parseMonth, readMonth, readSupplyNotice } from "./provider";
import { supplyLine } from "./supply";
import { readOnboarding } from "../_shell/onboarding";
import { FirstPageNotice, MarketChoice } from "../_shell/OnboardingStatus";
import { readCategoryChoice } from "../_shell/remeasure";

/** /app/calendar's own `<title>` (#945). Without it this screen announced
 *  nothing at all — the `(account)` layout's fallback is the floor, not
 *  the name of this screen. */
export const metadata: Metadata = { title: copy("meta.app.plan.title") };

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
  const supplyNotice = await readSupplyNotice();
  const supplyStatement = supplyLine(supplyNotice, model.timeZone);
  // Issue 837: a calendar empty because the market was too small offers the
  // choice that fills it, unless the shell's panel already does.
  const choice =
    onboarding.kind === "none" && supplyNotice?.kind === "unmeasured" ? await readCategoryChoice() : null;

  const previous = addMonths(month, -1);
  const next = addMonths(month, 1);
  // The footnote's two halves are owner-owed keys; an unwritten half renders
  // as nothing, never as a placeholder sentence.
  const plannedNote = writtenLine("calendar.footnote.planned");
  const supplyNote = writtenLine("calendar.footnote.supply");
  // SPEC §4 (2026-09-20, #908, issue #914): "*Plan* is the calendar's
  // on-screen name." The screen is named by the menu item that reaches it,
  // which is the idiom Settings and Overview already keep — their `h1` is
  // `shell.nav.*` and the written line sits under it. `calendar.head` is
  // that line here (the owner's sentence of 2026-09-11, #516), so nothing
  // it says is lost by the heading taking the name.
  const head = writtenLine("calendar.head");

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold">{copy("shell.nav.plan")}</h1>
          {head === null ? null : <p className="min-w-0 wrap-anywhere">{head}</p>}
        </div>
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
      {/* §7's one statement of supply, at the calendar's top and nowhere
          else: no cell and no day panel repeats it (issue 857). */}
      {supplyStatement === null ? null : (
        <div role="status" className="alert alert-soft text-sm" data-testid="calendar-supply-statement">
          {supplyStatement}
        </div>
      )}
      {choice === null ? null : (
        <section className="card card-border min-w-0 bg-base-100" data-testid="calendar-market-choice">
          <div className="card-body">
            <MarketChoice choice={choice} />
          </div>
        </section>
      )}
      <Suspense fallback={<div className="skeleton h-96 w-full" />}>
        <CalendarView model={model} />
      </Suspense>

      {/* One footnote under the grid: the rule. What supply is doing right
          now is stated at the top. */}
      <footer className="flex flex-col gap-1 text-sm opacity-70" data-testid="calendar-footnote">
        {plannedNote === null && supplyNote === null ? null : (
          <p>{[plannedNote, supplyNote].filter((line) => line !== null).join(" ")}</p>
        )}
      </footer>
    </div>
  );
}
