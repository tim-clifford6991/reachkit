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
import { readGoogleVisitWeeks } from "../../_overview/blog-reads-provider";
import { doingOf, type Doing } from "../../_overview/search-model";
import { climbingSearches, readPlanned } from "../../_overview/google-pages";
import { GooglePages } from "../../_overview/GooglePages";
import { SearchTable } from "../../_overview/SearchTable";
import { SearchTiles } from "../../_overview/SearchTiles";
import { SearchTableSkeleton } from "../../_overview/skeletons";
import { OVERVIEW } from "../../_overview/frame";
import { TabHead } from "../../_overview/TabHead";
import { DetailTiles } from "../../_overview/Tiles";
import { readTiles } from "../../_overview/tiles-provider";
import { marketOf } from "../../_overview/tiles";

/** /app/search's own `<title>` (#945). Without it this screen announced
 *  nothing at all — the `(account)` layout's fallback is the floor, not
 *  the name of this screen. */
export const metadata: Metadata = { title: copy("meta.app.search.title") };

export default async function SearchTabPage(): Promise<React.JSX.Element> {
  const [shell, model, visits, planned, tiles] = await Promise.all([
    readShell(),
    readSearch(),
    readGoogleVisitWeeks(),
    readPlanned(),
    readTiles(0, false),
  ]);
  // The card and the list read the On Google tile's own model: one count, from the same rows.
  const pages = tiles?.google ?? null;
  const climbing = pages === null ? new Set<string>() : climbingSearches(pages);
  const doing: Record<string, Doing> = {};
  for (const row of model.rows) doing[row.id] = doingOf(row, planned, climbing);

  return (
    <div className={OVERVIEW} data-testid="search-tab">
      <DetailTiles model={tiles} tab="google" />
      <TabHead
        eyebrow={shell.weeks.kind === "counted" ? copy("overview.tab.eyebrow", { n: String(shell.weeks.weeks) }) : null}
        title={copy("overview.tab.search")}
        testId="search"
        measured={
          model.measuredAt === null ? null : (
            <p className="text-base-content/70" data-testid="search-measured">
              {copy("overview.search.measured", { on: formatDay(model.measuredAt, shell.timeZone) })}
            </p>
          )
        }
      />

      <SearchTiles pages={pages} visits={visits} market={marketOf(tiles)} />

      <GooglePages pages={pages} planned={planned} timeZone={shell.timeZone} />

      <Suspense fallback={<SearchTableSkeleton />}>
        <SearchTable model={model} doing={doing} />
      </Suspense>
    </div>
  );
}
