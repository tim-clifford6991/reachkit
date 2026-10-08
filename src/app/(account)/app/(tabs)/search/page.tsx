// SPEC §4 (2026-09-20, #908) — Overview › Search.
//
// "Search tab: every search ReachKit is going after — searches a month,
// difficulty against the site's ceiling, the site's position and change,
// the best rival and its position, and status (page is live · your review ·
// up next · too big for now). Read from stored opportunities, the site's
// own ranked keywords and the weekly verdicts; nothing is bought for the
// screen."
//
// **One read, and the two modules are pure over it.** `readSearch()` is the
// one call this file makes; neither the tiles nor the table fetches for
// itself, so the render performs no measurement, no vendor call and no
// model call.
//
// **It declares no `Surface`**: the shell's own layout owns this route's
// screen root, and the tab bar above it is `(tabs)/layout.tsx`'s. A second
// screen root would be a second `[data-surface]` in the document.
//
// **It writes no sentence.** Every word is the registry's.
//
// **The numbers first** (SPEC §4, 2026-10-07, issue 1324): the head is the
// screen's name and the day it was measured, then the tiles, then the
// table. No sentence stands above them; what a number means is closed on
// its own tile.
//
// **`Suspense`**: the table holds the chosen chip in the URL through
// `nuqs`, which reads the query string with Next's own `useSearchParams` —
// "We recommend wrapping the Client Component that uses `useSearchParams`
// in a `<Suspense/>` boundary"
// (`01-app/03-api-reference/04-functions/use-search-params.md`). The
// table's own skeleton holds its place — the one `loading.tsx` draws.
import type React from "react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { copy } from "@/lib/presentation/copy";
import { formatDate } from "../../_shell/format";
import { readShell } from "../../_shell/provider";
import { readSearch } from "../../_overview/search-provider";
import { SearchTable } from "../../_overview/SearchTable";
import { SearchTiles } from "../../_overview/SearchTiles";
import { SearchTableSkeleton } from "../../_overview/skeletons";
import { TabHead } from "../../_overview/TabHead";

/** /app/search's own `<title>` (#945). Without it this screen announced
 *  nothing at all — the `(account)` layout's fallback is the floor, not
 *  the name of this screen. */
export const metadata: Metadata = { title: copy("meta.app.search.title") };

export default async function SearchTabPage(): Promise<React.JSX.Element> {
  // The zone is the shell's one stored preference, read through the shell's
  // own request-cached provider rather than restated here: two readers of a
  // customer's time zone is how two parts of one screen come to state two
  // different days.
  const [shell, model] = await Promise.all([readShell(), readSearch()]);
  const measured =
    model.measuredAt === null
      ? null
      : copy("overview.search.measured", { on: formatDate(model.measuredAt, shell.timeZone) });

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="search-tab">
      <TabHead
        title={copy("overview.tab.search")}
        testId="search"
        measured={
          measured === null ? null : (
            // A sentence with a date inside it, not a value: the UI face,
            // the same way the shell states "re-measured 1 Oct 2026" beside
            // the site (owner's review of this PR).
            <p className="text-xs text-base-content/70" data-testid="search-measured">
              {measured}
            </p>
          )
        }
      />

      <SearchTiles tiles={model.tiles} />

      <Suspense fallback={<SearchTableSkeleton />}>
        <SearchTable model={model} />
      </Suspense>
    </div>
  );
}
