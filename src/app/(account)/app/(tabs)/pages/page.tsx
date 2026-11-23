// DESIGN *Pages Live detail* (plate O2) — `/app/pages`: under the tile row, every page the Pages Live tile
// counts, read from the tile's own model, so the rows and the tile are one number. Opened from Visits, a
// source strip heads the list. Stored rows only.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { copy } from "@/lib/presentation/copy";
import { formatCount, formatShortDay, formatTime } from "../../_shell/format";
import { readShell } from "../../_shell/provider";
import { loadFrom, loadShowAll, OVERVIEW } from "../../_overview/frame";
import { checkedOf, liveRowsOf, LivePages } from "../../_overview/LivePages";
import { TabHead } from "../../_overview/TabHead";
import { DetailTiles } from "../../_overview/Tiles";
import { readTiles } from "../../_overview/tiles-provider";
import type { Visits } from "@/lib/publish/reads/visits";

export const metadata: Metadata = { title: copy("meta.app.pages.title") };

const INK = "min-w-0 text-sm text-base-content/70";

export default async function PagesLivePage(p: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<React.JSX.Element> {
  const [shell, tiles, { all }, { from }] = await Promise.all([readShell(), readTiles(0, false), p.searchParams.then(loadShowAll), p.searchParams.then(loadFrom)]);
  if (tiles === null) throw new Error("pages: tiles unreadable");
  const tz = shell.timeZone;
  const rows = liveRowsOf(tiles, shell.nextDueOn, tz);
  const checked = checkedOf(tiles);
  const next = shell.publishing.next;
  const paused = next === null && shell.publishing.because === "publishing_paused";

  return (
    <div className={OVERVIEW} data-testid="pages-tab">
      <DetailTiles model={tiles} tab={from ?? "pages"} />
      <TabHead
        title={copy("overview.tile.short.pages")}
        testId="pages"
        lead={copy("overview.pages.lead")}
        measured={checked === null ? null : <p className="text-base-content/70">{copy("overview.detail.checked", { date: formatShortDay(checked, tz) })}</p>}
      />
      {from === "visits" ? <Sources visits={tiles.visits} /> : null}
      {paused ? (
        <Link className={`link w-fit ${INK}`} href="/app/settings/pages" data-testid="pages-paused">
          {copy("overview.pages.paused")}
        </Link>
      ) : null}
      {rows.length > 0 ? (
        <LivePages rows={rows} all={all} timeZone={tz} />
      ) : paused ? null : (
        <p className={INK} data-testid="pages-none">
          {next === null ? copy("overview.tile.pages.none.of") : copy("overview.pages.none", { day: formatShortDay(next, tz), time: formatTime(next, tz) })}
        </p>
      )}
    </div>
  );
}

/** Where the 28 days' visits came from; opened directly stands apart, never added in. Unread draws nothing, never 0. */
function Sources(p: { visits: Visits | "wordpress" | null }): React.JSX.Element | null {
  const { visits } = p;
  if (visits === null) return null;
  if (visits === "wordpress") return <p className={INK} data-testid="pages-sources">{copy("overview.tile.visits.wordpress")}</p>;
  const { google, ai, other } = visits.bySource;
  return (
    <div className="flex min-w-0 flex-col gap-1" data-testid="pages-sources">
      <p className="min-w-0 font-semibold wrap-anywhere">
        {copy("pages.visits.sources", { a: formatCount(google), b: formatCount(ai), c: formatCount(other) })}
      </p>
      <p className="min-w-0 text-sm">{copy("pages.visits.direct", { d: formatCount(visits.direct) })}</p>
      <p className="min-w-0 text-xs text-base-content/70">{copy("pages.visits.direct.note")}</p>
    </div>
  );
}
