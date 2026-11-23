// SPEC §4 *Pages Live detail* (plate O2) — `/app/pages`: under the tile row, every page the Pages Live tile
// counts, read from the tile's own model, so the rows and the tile are one number. Stored rows only.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { copy } from "@/lib/presentation/copy";
import { formatShortDay, formatTime } from "../../_shell/format";
import { readShell } from "../../_shell/provider";
import { loadFrom, loadShowAll, OVERVIEW } from "../../_overview/frame";
import { checkedOf, liveRowsOf, LivePages } from "../../_overview/LivePages";
import { TabHead } from "../../_overview/TabHead";
import { DetailTiles } from "../../_overview/Tiles";
import { readTiles } from "../../_overview/tiles-provider";

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
