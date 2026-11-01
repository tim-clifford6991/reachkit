// SPEC §7 — Plan, at `/app/calendar`: the committed week as seven days
// (E5, 2026-10-19), its spares under it, and every page published.
//
// The screen reads the week once — `readWeek`, request-cached — and hands
// it to one client component that owns the two interactions (`CalendarView`:
// which stage is showing, which day the panel is on). Everything else here
// is server-rendered.
//
// **`Suspense`**: `nuqs` reads the query string through Next's own
// `useSearchParams`, which a client component may only do inside a boundary
// (`01-app/03-api-reference/04-functions/use-search-params.md`).
// `PlanSkeleton` holds its place — the same boxes `loading.tsx` draws.
//
// It declares no `Surface`: the shell's layout owns this route's screen
// root (`../layout.tsx`).
import type React from "react";
import { Suspense } from "react";
import type { Metadata } from "next";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import { CalendarView } from "./CalendarView";
import { PlanHead, planHeadWords } from "./PlanHead";
import { PlanNumbers } from "./PlanNumbers";
import { WeekFoot, WeekHead, weekGoesLive } from "./WeekCard";
import { addDays, longDate, weekRange } from "./dates";
import { zonePlace } from "../settings/format";
import { PlanSkeleton } from "./PlanSkeleton";
import { PLAN } from "./frame";
import { currentCalendarSite, planToday, readPlanHead, readStalledWeek, readSupplyNotice, readWeek } from "./provider";
import { stalledLine, supplyLine } from "./supply";
import { readOnboarding } from "../_shell/onboarding";
import { FirstPageNotice } from "../_shell/OnboardingStatus";
import { SupplyNotice } from "./SupplyNotice";
import { PublishedList, updateDays } from "./PublishedList";
import { readPublishedFor } from "../_overview/content-provider";
import { contentOf } from "@/lib/measure/published";

/** /app/calendar's own `<title>` (#945). Without it this screen announced
 *  nothing at all — the `(account)` layout's fallback is the floor, not
 *  the name of this screen. */
export const metadata: Metadata = { title: copy("meta.app.plan.title") };

export default async function CalendarPage(): Promise<React.JSX.Element> {
  const [week, onboarding, published, head] = await Promise.all([
    planToday().then(readWeek),
    readOnboarding(),
    currentCalendarSite().then((site) => readPublishedFor(site?.siteId ?? null)),
    readPlanHead(),
  ]);
  const content = contentOf(published);
  const first = week.cells[0]?.day ?? week.today;
  const last = week.cells.at(-1)?.day ?? week.today;
  const time = weekGoesLive(week, head.publishTime);
  // §7's one statement of supply. At most one — the precedence between the
  // three arms is the engine's, and this screen renders whichever it
  // returned and never a second.
  const [supplyNotice, stalled] = await Promise.all([readSupplyNotice(), readStalledWeek()]);
  const stalledStatement = stalledLine(stalled);
  const supplyStatement = supplyLine(supplyNotice, week.timeZone);

  // The footnote's two halves are owner-owed keys; an unwritten half renders
  // as nothing, never as a placeholder sentence.
  const plannedNote = writtenLine("calendar.footnote.planned");
  const supplyNote = writtenLine("calendar.footnote.supply");
  return (
    <div className={PLAN}>
      <PlanHead words={planHeadWords(head, week.counts.all)} />

      <PlanNumbers
        figures={{
          week: week.counts.all,
          live: content === null ? null : content.pages.length,
          spares: week.spares.length,
          stopped: week.cells.filter((cell) => cell.empty?.cause === "page_cannot_go_live").length,
        }}
      />

      <FirstPageNotice state={onboarding} />
      {/* §7's one statement of supply, at the calendar's top and nowhere
          else: no cell and no day panel repeats it (issue 857). */}
      {supplyStatement === null ? null : <SupplyNotice line={supplyStatement} />}
      {/* Issue 1184: why pages stall, as one line under the statement of supply. */}
      {stalledStatement === null ? null : (
        <p className="min-w-0 text-sm wrap-anywhere" data-testid="calendar-stalled">
          {stalledStatement}
        </p>
      )}
      <Suspense fallback={<PlanSkeleton />}>
        <CalendarView
          week={week}
          goesLive={time}
          head={
            <WeekHead
              range={weekRange(first, last)}
              time={time === null ? null : copy("calendar.week.time", { time, place: zonePlace(week.timeZone) })}
            />
          }
          foot={<WeekFoot next={longDate(addDays(first, 7))} />}
        />
      </Suspense>

      {/* Every page published (issue 1457): what Overview's Content tile
          counts, and where it opens. */}
      <PublishedList content={content} timeZone={week.timeZone} now={published.now} updates={updateDays(week)} />

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
