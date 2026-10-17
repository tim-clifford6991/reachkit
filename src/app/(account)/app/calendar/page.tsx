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
// `<Suspense/>` boundary"). `PlanSkeleton` holds its place — the same boxes
// `loading.tsx` draws under the head, so the month waits in one shape.
//
// It declares no `Surface`: the shell's layout owns this route's screen
// root (`../layout.tsx`).
import type React from "react";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import { CalendarView } from "./CalendarView";
import { PlanHead } from "./PlanHead";
import { PlanNumbers } from "./PlanNumbers";
import { PlanSkeleton } from "./PlanSkeleton";
import { PLAN } from "./frame";
import { addMonths, monthNameOnly, monthShortLabel } from "./dates";
import { currentCalendarSite, parseMonth, readMonth, readStalledWeek, readSupplyNotice, readWeek } from "./provider";
import { stalledLine, supplyLine } from "./supply";
import { readOnboarding } from "../_shell/onboarding";
import { FirstPageNotice } from "../_shell/OnboardingStatus";
import { SupplyNotice } from "./SupplyNotice";
import { PublishedList } from "./PublishedList";
import { readPublishedFor } from "../_overview/content-provider";
import { contentOf } from "../_overview/content";
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
  const [model, onboarding, published] = await Promise.all([readMonth(month), readOnboarding(), currentCalendarSite().then((site) => readPublishedFor(site?.siteId ?? null))]);
  const week = await readWeek(model.today);
  // §7's one statement of supply. At most one — the precedence between the
  // three arms is the engine's, and this screen renders whichever it
  // returned and never a second.
  const [supplyNotice, stalled] = await Promise.all([readSupplyNotice(), readStalledWeek()]);
  const stalledStatement = stalledLine(stalled);
  const supplyStatement = supplyLine(supplyNotice, model.timeZone);
  // Issue 837: a calendar empty because the market was too small offers the
  // choice that fills it, unless the shell's panel already does.
  const choice =
    (onboarding.kind === "none" || onboarding.kind === "ended") && supplyNotice?.kind === "unmeasured" ? await readCategoryChoice() : null;

  const previous = addMonths(month, -1);
  const next = addMonths(month, 1);
  // The footnote's two halves are owner-owed keys; an unwritten half renders
  // as nothing, never as a placeholder sentence.
  const plannedNote = writtenLine("calendar.footnote.planned");
  const supplyNote = writtenLine("calendar.footnote.supply");
  return (
    <div className={PLAN}>
      <PlanHead>
        {/* One grouped control (issue 1071, board R12-5-Plan): the month
            between its two neighbours, and *Today* after a hairline. From
            `lg` only: below it Plan is this week and there is no month to
            switch (SPEC §7, 2026-10-08, issue 1340). */}
        <nav className="join rounded-field bg-base-100 shadow-(--shadow-card) hidden lg:inline-flex" data-testid="month-switcher">
          <Link
            href={`/app/calendar?month=${previous}`}
            prefetch={true}
            className="btn btn-sm btn-ghost join-item"
            aria-label={monthNameOnly(previous)}
            data-testid="month-previous"
          >
            <ChevronLeft size={20} strokeWidth={1.75} aria-hidden />
          </Link>
          <span
            className="btn btn-sm btn-ghost join-item num pointer-events-none font-semibold"
            aria-current="page"
            data-testid="month-current"
          >
            {monthShortLabel(month)}
          </span>
          <Link
            href={`/app/calendar?month=${next}`}
            prefetch={true}
            className="btn btn-sm btn-ghost join-item"
            aria-label={monthNameOnly(next)}
            data-testid="month-next"
          >
            <ChevronRight size={20} strokeWidth={1.75} aria-hidden />
          </Link>
          <Link
            href="/app/calendar"
            prefetch={true}
            className="btn btn-sm btn-ghost join-item border-s border-s-base-300"
            data-testid="month-today"
          >
            {copy("calendar.month.today")}
          </Link>
        </nav>
      </PlanHead>

      {/* The numbers open the screen (owner 2026-10-09, issue 1364). */}
      <PlanNumbers counts={model.counts} weekCounts={week.counts} month={monthShortLabel(month)} />

      <FirstPageNotice state={onboarding} />
      {/* §7's one statement of supply, at the calendar's top and nowhere
          else: no cell and no day panel repeats it (issue 857). A market
          never measured carries its two ways to measure again inline
          (issue 1071), in place of the broader-categories card. */}
      {supplyStatement === null ? null : (
        <SupplyNotice
          line={supplyStatement}
          choice={
            choice === null
              ? null
              : {
                  suggestion: choice.suggestions[0] ?? null,
                  tryLabel:
                    choice.suggestions[0] === undefined
                      ? null
                      : copy("calendar.supply.try", { category: choice.suggestions[0] }),
                  describe: copy("calendar.supply.describe"),
                  own: copy("setup.remeasure.own"),
                  submit: copy("setup.remeasure.submit"),
                }
          }
        />
      )}
      {/* Issue 1184: why pages stall, as one line under the statement of supply. */}
      {stalledStatement === null ? null : (
        <p className="min-w-0 text-sm wrap-anywhere" data-testid="calendar-stalled">
          {stalledStatement}
        </p>
      )}
      <Suspense fallback={<PlanSkeleton rows={week.cells.length} />}>
        <CalendarView model={model} week={week} />
      </Suspense>

      {/* Every page published (issue 1457): what Overview's Content tile
          counts, and where it opens. */}
      <PublishedList content={contentOf(published)} timeZone={model.timeZone} />

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
