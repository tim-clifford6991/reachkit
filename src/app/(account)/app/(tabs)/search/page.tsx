// SPEC §4 (board AppGoogle) — the Google tab: the week and the day its places
// were read, the three tiles, each live page in Google, then your market's
// searches and what ReachKit is doing about each this week.
//
// **Every read is a stored one.** The pages and visits are Overview's own
// readers, so a figure here and on Overview is one number; Plan's week is
// reached at the call, as Overview reaches it, so this graph holds no vendor
// client. No measurement, vendor call or model call happens on render.
//
// **It declares no `Surface`**: the shell's own layout owns this route's
// screen root, and the tab bar above it is `(tabs)/layout.tsx`'s.
//
// **`Suspense`**: the table holds the chosen chip in the URL through `nuqs`,
// which reads `useSearchParams` and so wants a `<Suspense/>` boundary
// (`01-app/03-api-reference/04-functions/use-search-params.md`).
import type React from "react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { copy } from "@/lib/presentation/copy";
import { formatDay } from "../../_shell/format";
import { readShell } from "../../_shell/provider";
import { readSearch } from "../../_overview/search-provider";
import { readPublished } from "../../_overview/content-provider";
import { readGoogleVisits } from "../../_overview/blog-reads-provider";
import { readUnderstanding } from "../../_overview/understanding-provider";
import { doingOf, type Doing } from "../../_overview/search-model";
import { climbingSearches, googlePagesOf, readPlanned } from "../../_overview/google-pages";
import { contentOf } from "@/lib/measure/published";
import { GooglePages } from "../../_overview/GooglePages";
import { SearchTable } from "../../_overview/SearchTable";
import { SearchTiles } from "../../_overview/SearchTiles";
import { SearchTableSkeleton } from "../../_overview/skeletons";
import { TabHead } from "../../_overview/TabHead";

/** /app/search's own `<title>` (#945). Without it this screen announced
 *  nothing at all — the `(account)` layout's fallback is the floor, not
 *  the name of this screen. */
export const metadata: Metadata = { title: copy("meta.app.search.title") };

export default async function SearchTabPage(): Promise<React.JSX.Element> {
  const [shell, model, published, visits, understanding, planned] = await Promise.all([
    readShell(),
    readSearch(),
    readPublished(),
    readGoogleVisits(),
    readUnderstanding(),
    readPlanned(),
  ]);
  const content = contentOf(published);
  const pages = content === null ? null : googlePagesOf(content.pages, published.now);
  const climbing = pages === null ? new Set<string>() : climbingSearches(pages);
  const doing: Record<string, Doing> = {};
  for (const row of model.rows) doing[row.id] = doingOf(row, planned, climbing);
  // A local business is bought from in its place; one that sells further names none.
  const place = understanding.where.place?.name ?? null;
  const lead = place === null ? copy("overview.search.table.lead.anywhere") : copy("overview.search.table.lead", { place });

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="search-tab">
      <TabHead
        eyebrow={shell.weeks.kind === "counted" ? copy("overview.tab.eyebrow", { n: String(shell.weeks.weeks) }) : null}
        title={copy("overview.tab.search")}
        testId="search"
        measured={
          model.measuredAt === null ? null : (
            <p className="text-xs text-base-content/70" data-testid="search-measured">
              {copy("overview.search.measured", { on: formatDay(model.measuredAt, shell.timeZone) })}
            </p>
          )
        }
      />

      <SearchTiles pages={pages} visits={visits} market={model.market} />

      <GooglePages pages={pages} planned={planned} timeZone={shell.timeZone} />

      <Suspense fallback={<SearchTableSkeleton />}>
        <SearchTable model={model} doing={doing} lead={lead} />
      </Suspense>
    </div>
  );
}
