// SPEC §4 *Competitors tab* (plate O5) — Against Competitors' detail: back to Overview, the tiles with this one
// current, the head, then the twelve main searches with the site beside each competitor and who AI answers mention.
//
// **Every read is a stored one**: the first-page counts are `readRivals().firstPage`, the one reader the tile and
// Settings › Market also read; the mentions are `namedOf` over the window's healthy passes. No measurement, vendor
// call or model call happens on render. It declares no `Surface`: the shell's layout owns the screen root.
import type React from "react";
import type { Metadata } from "next";
import { copy } from "@/lib/presentation/copy";
import { formatShortDay } from "../../_shell/format";
import { readShell } from "../../_shell/provider";
import { readOverview } from "../../_overview/provider";
import { readPromptsAt } from "../../_overview/prompts-provider";
import { readRivals } from "../../_overview/rivals-provider";
import { readPlanned } from "../../_overview/google-pages";
import { formatCount } from "../../_overview/present";
import { namedOf, type RivalsModel } from "../../_overview/rivals-model";
import type { PromptsModel } from "../../_overview/prompts-model";
import { RivalTable } from "../../_overview/RivalTable";
import { loadShowAll, OVERVIEW } from "../../_overview/frame";
import { TabHead } from "../../_overview/TabHead";
import { DetailTiles } from "../../_overview/Tiles";
import { readTiles } from "../../_overview/tiles-provider";

/** /app/rivals's own `<title>` (#945). */
export const metadata: Metadata = { title: copy("meta.app.rivals.title") };

/** "AI answers that mentioned each, last 4 weeks: …", over the tracked competitors and the site, most first. */
function aiLine(model: RivalsModel, reputation: PromptsModel): string | null {
  const named = namedOf(reputation);
  if (reputation.kind !== "measured" || named.of === 0) return null;
  const counts = [
    ...model.rivals.map((domain) => ({ name: domain, n: named.rivals.find((row) => row.domain === domain)?.count ?? 0 })),
    { name: copy("overview.rivals.you"), n: named.you.count },
  ].sort((a, b) => b.n - a.n);
  const list = counts.map((row) => `${row.name} ${formatCount(row.n)}`).join(" · ");
  const weeks = reputation.trend.length;
  return weeks === 1
    ? copy("overview.rivals.ai.one", { list, m: formatCount(named.of) })
    : copy("overview.rivals.ai", { w: formatCount(weeks), list, m: formatCount(named.of) });
}

export default async function RivalsTabPage(p: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<React.JSX.Element> {
  const [shell, model, overview, planned, tiles, { all }] = await Promise.all([
    readShell(),
    readRivals(),
    readOverview(),
    readPlanned(),
    readTiles(0, false),
    p.searchParams.then(loadShowAll),
  ]);
  const reputation = await readPromptsAt(overview.months?.reading?.week ?? null);
  const { firstPage, measuredAt } = model;
  const shown = model.rows.length > 0;

  // Before the first Monday the tile's own reading is the deep pass's; a newer failed pass keeps the last places.
  const start = tiles?.tiles.find((tile) => tile.key === "rivals")?.change?.kind === "start";
  const pass = shell.pass;
  const failed = measuredAt !== null && pass?.kind === "ended" && pass.end.outcome === "failed" && Date.parse(pass.end.at) > measuredAt.getTime();
  const measured =
    measuredAt === null
      ? null
      : failed
        ? copy("overview.rivals.failed", { date: formatShortDay(measuredAt, shell.timeZone) })
        : copy(start ? "overview.tile.rivals.start" : "overview.detail.checked", { date: formatShortDay(measuredAt, shell.timeZone) });

  // No tracked competitor counted: the site's column alone, and who holds those first pages (SPEC §4, 2026-10-09).
  const columns = firstPage.noRival ? [] : [...firstPage.rivals].sort((a, b) => b.count - a.count);
  const holders = model.firstPageHolders.join(", ");

  return (
    <div className={OVERVIEW} data-testid="rivals-tab">
      <DetailTiles model={tiles} tab="rivals" />
      <TabHead
        title={copy("overview.tab.rivals")}
        testId="rivals"
        lead={shown ? copy("overview.rivals.lead", { m: formatCount(firstPage.of) }) : null}
        measured={
          measured === null ? null : (
            <p className="text-base-content/70" data-testid="rivals-measured">
              {measured}
            </p>
          )
        }
      />
      {shown ? (
        <RivalTable
          model={model}
          columns={columns}
          planned={planned}
          all={all}
          started={model.firstPageAtStart === null ? null : copy("overview.rivals.started", { k: formatCount(model.firstPageAtStart) })}
          holders={firstPage.noRival ? (holders === "" ? copy("overview.rivals.first-page.none") : copy("overview.rivals.first-page.none.holders", { holders })) : null}
          ai={aiLine(model, reputation)}
        />
      ) : (
        <p className="max-w-prose text-base-content/70" data-testid="rivals-none">
          {copy("overview.rivals.card.unmeasured")}
        </p>
      )}
    </div>
  );
}
