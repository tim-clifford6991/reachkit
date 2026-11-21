// SPEC §7 *This week*, at `/app/calendar`: one card a day and the pane a
// card opens, its spares and every page published under the cards.
//
// The screen reads the week once — `readWeek`, request-cached — builds the
// one screen model from it (`weekScreen`), and hands that to the one client
// component that owns which day the pane is on. The bodies of the week's
// written pages are rendered here, on the server.
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
import { PlanHead } from "./PlanHead";
import { PlanSkeleton } from "./PlanSkeleton";
import { PLAN } from "./frame";
import { planToday, readPlanHead, readPlanPublished, readStalledWeek, readSupplyNotice, readWeek, readWeekBodies } from "./provider";
import { stalledLine, supplyLine } from "./supply";
import { readOnboarding } from "../_shell/onboarding";
import { FirstPageNotice } from "../_shell/OnboardingStatus";
import { SupplyNotice } from "./SupplyNotice";
import { PublishedList, updateDays } from "./PublishedList";
import { contentOf } from "@/lib/measure/published";
import { demoteHeadings, parseMarkdown, toHtml } from "@/lib/publish/render/markdown";
import { DRAFT_BODY_CLASSES } from "../draft/[draftId]/present";
import { weekScreen, writtenDrafts } from "./week-screen";

/** /app/calendar's own `<title>`. */
export const metadata: Metadata = { title: copy("meta.app.plan.title") };

export default async function CalendarPage(): Promise<React.JSX.Element> {
  // Started before the week is awaited and awaited in their own boundaries below, so none holds it.
  for (const read of [readSupplyNotice(), readStalledWeek()]) read.catch(() => null);
  const [week, onboarding, head, published] = await Promise.all([planToday().then(readWeek), readOnboarding(), readPlanHead(), readPlanPublished().catch(() => null)]);
  const read = await readWeekBodies(writtenDrafts(week)).catch(() => null);
  const screen = weekScreen({ week, head, published, bodies: read === null ? null : new Set(read.keys()) });
  const bodies = Object.fromEntries(
    [...(read ?? new Map<string, string>())].map(([id, bodyMd]) => [
      id,
      // The one serialiser escapes every text node, so its HTML is safe to set as is.
      <div key={id} className="min-w-0 break-words" dangerouslySetInnerHTML={{ __html: toHtml(demoteHeadings(parseMarkdown(bodyMd)), DRAFT_BODY_CLASSES) }} />,
    ])
  );
  return (
    <div className={PLAN}>
      <PlanHead words={screen.head} />

      <FirstPageNotice state={onboarding} />
      {/* §7's one statement of supply, at the screen's top and nowhere else. */}
      <Suspense fallback={null}>
        <Supply timeZone={week.timeZone} />
      </Suspense>
      {/* Why pages stall, as one line under the statement of supply. */}
      <Suspense fallback={null}>
        <Stalled />
      </Suspense>
      <Suspense fallback={<PlanSkeleton />}>
        <CalendarView
          week={week}
          screen={screen}
          bodies={bodies}
          published={
            published === null ? null : (
              <PublishedList content={contentOf(published)} timeZone={week.timeZone} now={published.now} updates={updateDays(week)} />
            )
          }
        />
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
