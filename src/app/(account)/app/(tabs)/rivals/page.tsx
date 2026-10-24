// SPEC §4 (board AppCompetitors) — the Competitors tab: who your buyers see
// first, who is on the first page, who AI answers mention, the searches
// competitors win with what ReachKit is doing about each, and how far ahead
// competitors are.
//
// **Every read is a stored one.** `readRivals()` is this tab's own; the gap
// card is `readOverview()`'s `overview.rivals`, the module Overview reads; who
// AI answers mention is the month's reputation reading Overview's months card
// draws; Plan's week is reached at the call, as the Google tab reaches it. No
// measurement, vendor call or model call happens on render.
//
// **It declares no `Surface`**: the shell's own layout owns this route's
// screen root, and the tab bar above it is `(tabs)/layout.tsx`'s.
//
// **`Suspense`**: the table holds the chosen rival in the URL through `nuqs`,
// which reads `useSearchParams` and so wants a `<Suspense/>` boundary
// (`01-app/03-api-reference/04-functions/use-search-params.md`).
import type React from "react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ANSWER_RATE_WEEKS } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import { formatDay } from "../../_shell/format";
import { readShell } from "../../_shell/provider";
import { readOverview } from "../../_overview/provider";
import { readPromptsAt } from "../../_overview/prompts-provider";
import { readRivals } from "../../_overview/rivals-provider";
import { readPlanned } from "../../_overview/google-pages";
import { searchKey, type Planned } from "../../_overview/search-model";
import { formatCount } from "../../_overview/present";
import { namedOf } from "../../_overview/rivals-model";
import { RivalModule } from "../../_overview/RivalModule";
import { RivalPresence } from "../../_overview/RivalPresence";
import { RivalTable } from "../../_overview/RivalTable";
import { RivalTableSkeleton } from "../../_overview/skeletons";
import { TabHead } from "../../_overview/TabHead";
import { TAB_HREF } from "../../_overview/tabs";

/** /app/rivals's own `<title>` (#945). */
export const metadata: Metadata = { title: copy("meta.app.rivals.title") };

export default async function RivalsTabPage(): Promise<React.JSX.Element> {
  const [shell, model, overview, planned] = await Promise.all([readShell(), readRivals(), readOverview(), readPlanned()]);
  const reputation = await readPromptsAt(overview.months?.reading?.week ?? null);

  const after = model.top.searches.filter((search) => planned.has(searchKey(search))).length;
  const started =
    model.firstPageAtStart === null
      ? null
      : copy("overview.rivals.first-page.started", { count: formatCount(model.firstPageAtStart), of: formatCount(model.firstPage.of) });
  const named = namedOf(reputation);
  const namedLead =
    reputation.kind === "measured"
      ? copy("overview.rivals.named.lead", {
          answers: formatCount(reputation.rate.samples),
          questions: formatCount(reputation.prompts.filter((prompt) => prompt.kind !== "branded").length),
          weeks: formatCount(ANSWER_RATE_WEEKS),
        })
      : copy("overview.rivals.named.lead.none");
  // SPEC §4 (2026-10-09, issue 1365): a card on which no tracked rival was
  // counted says so, and names who holds those first pages where it can.
  const holders = model.firstPageHolders.join(", ");
  // What each row's search gets from Plan's week, as plain facts the client table can take.
  const doing: Record<string, Planned> = {};
  for (const row of model.rows) {
    const week = planned.get(searchKey(row.search));
    if (week !== undefined) doing[row.search] = week;
  }

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="rivals-tab">
      <TabHead
        eyebrow={shell.weeks.kind === "counted" ? copy("overview.tab.eyebrow", { n: String(shell.weeks.weeks) }) : null}
        title={copy("overview.tab.rivals")}
        testId="rivals"
        measured={
          model.measuredAt === null ? null : (
            <p className="text-xs text-base-content/70" data-testid="rivals-measured">
              {copy("overview.search.measured", { on: formatDay(model.measuredAt, shell.timeZone) })}
            </p>
          )
        }
      />

      <RivalPresence
        top={model.top}
        after={after}
        firstPage={model.firstPage}
        startedLine={started}
        noRivalOnFirstPage={holders === "" ? copy("overview.rivals.first-page.none") : copy("overview.rivals.first-page.none.holders", { holders })}
        named={named}
        namedLead={namedLead}
        noRivalNamed={copy("overview.rivals.named.none")}
        answersHref={TAB_HREF.ai_answers}
      />

      <Suspense fallback={<RivalTableSkeleton />}>
        <RivalTable model={model} planned={doing} />
      </Suspense>

      <RivalModule rivals={overview.rivals} timeZone={shell.timeZone} weekZero={overview.weekZero} />
    </div>
  );
}
