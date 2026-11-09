// SPEC §7 — Plan, at `/app/calendar`: the committed week as one row per day
// (E5, 2026-10-19), its spares under it, and every page published.
//
// The screen reads the week once — `readWeek`, request-cached — and hands
// it to one client component that owns the two interactions (`CalendarView`:
// which stage is showing, which day the panel is on). Everything else here
// is server-rendered, and what the week does not need streams in after it
// in its own boundary, with no fallback: `loading.tsx` draws no box for it.
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
import { CalendarView } from "./CalendarView";
import { PlanHead, planHeadWords } from "./PlanHead";
import { WeekFoot, WeekHead, weekGoesLive } from "./WeekCard";
import { addDays, longDate, weekRange } from "./dates";
import { zonePlace } from "../settings/format";
import { PlanSkeleton } from "./PlanSkeleton";
import { PLAN } from "./frame";
import { planToday, readPlanHead, readPlanPublished, readStalledWeek, readSupplyNotice, readWeek } from "./provider";
import { stalledLine, supplyLine } from "./supply";
import { readOnboarding } from "../_shell/onboarding";
import { FirstPageNotice } from "../_shell/OnboardingStatus";
import { SupplyNotice } from "./SupplyNotice";
import { PublishedList, updateDays } from "./PublishedList";
import { contentOf } from "@/lib/measure/published";
import type { WeekModel } from "./month";

/** /app/calendar's own `<title>` (#945). Without it this screen announced
 *  nothing at all — the `(account)` layout's fallback is the floor, not
 *  the name of this screen. */
export const metadata: Metadata = { title: copy("meta.app.plan.title") };

export default async function CalendarPage(): Promise<React.JSX.Element> {
  // Started before the week is awaited and awaited in their own boundaries below, so none holds it.
  for (const read of [readSupplyNotice(), readStalledWeek(), readPlanPublished()]) read.catch(() => null);
  const [week, onboarding, head] = await Promise.all([planToday().then(readWeek), readOnboarding(), readPlanHead()]);
  const first = week.cells[0]?.day ?? week.today;
  const last = week.cells.at(-1)?.day ?? week.today;
  const time = weekGoesLive(week, head.publishTime);
  return (
    <div className={PLAN}>
      <PlanHead words={planHeadWords(head, week.counts.all)} />

      <FirstPageNotice state={onboarding} />
      {/* §7's one statement of supply, at the calendar's top and nowhere
          else: no cell and no day panel repeats it (issue 857). */}
      <Suspense fallback={null}>
        <Supply timeZone={week.timeZone} />
      </Suspense>
      {/* Issue 1184: why pages stall, as one line under the statement of supply. */}
      <Suspense fallback={null}>
        <Stalled />
      </Suspense>
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
      <Suspense fallback={null}>
        <Published week={week} />
      </Suspense>
    </div>
  );
}

/** At most one statement: the precedence between the three arms is the engine's. */
async function Supply({ timeZone }: { timeZone: string }): Promise<React.JSX.Element | null> {
  const line = supplyLine(await readSupplyNotice(), timeZone);
  return line === null ? null : <SupplyNotice line={line} />;
}

async function Stalled(): Promise<React.JSX.Element | null> {
  const line = stalledLine(await readStalledWeek());
  return line === null ? null : (
    <p className="min-w-0 text-sm wrap-anywhere" data-testid="calendar-stalled">
      {line}
    </p>
  );
}

async function Published({ week }: { week: WeekModel }): Promise<React.JSX.Element> {
  const published = await readPlanPublished();
  return <PublishedList content={contentOf(published)} timeZone={week.timeZone} now={published.now} updates={updateDays(week)} />;
}
