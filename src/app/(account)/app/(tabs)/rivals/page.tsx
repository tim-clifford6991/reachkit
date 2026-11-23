// SPEC §4 *Competitors tab* (plate O5) — Against Competitors: back to Overview, the tiles with Pages on Google
// current, the head, then the twelve main searches with the site beside each competitor and who AI answers mention.
//
// **Every read is a stored one**: the first-page counts are `readRivals().firstPage`, the one reader the Google detail's card
// and Settings › Market also read; the mentions are `namedOf` over the AI tile's own panel answers. No measurement, vendor
// call or model call happens on render. It declares no `Surface`: the shell's layout owns the screen root.
import type React from "react";
import type { Metadata } from "next";
import { copy } from "@/lib/presentation/copy";
import { formatShortDay } from "../../_shell/format";
import { readShell } from "../../_shell/provider";
import { readRivals } from "../../_overview/rivals-provider";
import { readPlanned } from "../../_overview/google-pages";
import { formatCount } from "../../_overview/present";
import { namedOf, type RivalsModel } from "../../_overview/rivals-model";
import { AI_WINDOW_WEEKS, type AiAnswers } from "@/lib/measure/results";
import { RivalTable } from "../../_overview/RivalTable";
import { loadShowAll, OVERVIEW } from "../../_overview/frame";
import { TabHead } from "../../_overview/TabHead";
import { DetailTiles } from "../../_overview/Tiles";
import { readTiles } from "../../_overview/tiles-provider";

/** /app/rivals's own `<title>` (#945). */
export const metadata: Metadata = { title: copy("meta.app.rivals.title") };

/** "AI answers that mentioned each, last 4 weeks: …", over the tracked competitors and the site, most first, on the AI tile's N. */
function aiLine(model: RivalsModel, answers: AiAnswers | null): string | null {
  const named = namedOf(answers, model.rivals);
  if (named.of === 0) return null;
  const counts = [...named.rivals.map((row) => ({ name: row.domain, n: row.count })), { name: copy("overview.rivals.you"), n: named.you.count }].sort((a, b) => b.n - a.n);
  const list = counts.map((row) => `${row.name} ${formatCount(row.n)}`).join(" · ");
  return copy("overview.rivals.ai", { w: formatCount(AI_WINDOW_WEEKS), list, m: formatCount(named.of) });
}

export default async function RivalsTabPage(p: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<React.JSX.Element> {
  const [shell, model, planned, tiles, { all }] = await Promise.all([
    readShell(),
    readRivals(),
    readPlanned(),
    readTiles(0, false),
    p.searchParams.then(loadShowAll),
  ]);
  const { firstPage, measuredAt } = model;
  const shown = model.rows.length > 0;

  // Before the first Monday the tile's own reading is the deep pass's; a newer failed pass keeps the last places.
  const start = tiles !== null && tiles.search.readAt === null;
  const pass = shell.pass;
  const failed = measuredAt !== null && pass?.kind === "ended" && pass.end.outcome === "failed" && Date.parse(pass.end.at) > measuredAt.getTime();
  const measured =
    measuredAt === null
      ? null
      : failed
        ? copy("overview.rivals.failed", { date: formatShortDay(measuredAt, shell.timeZone) })
        : copy(start ? "overview.rivals.start" : "overview.detail.checked", { date: formatShortDay(measuredAt, shell.timeZone) });

  // No tracked competitor counted: the site's column alone, and who holds those first pages (SPEC §4, 2026-10-09).
  const columns = firstPage.noRival ? [] : [...firstPage.rivals].sort((a, b) => b.count - a.count);
  const holders = model.firstPageHolders.join(", ");

  return (
    <div className={OVERVIEW} data-testid="rivals-tab">
      <DetailTiles model={tiles} tab="google" />
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
          ai={aiLine(model, tiles?.answers ?? null)}
        />
      ) : (
        <p className="max-w-prose text-base-content/70" data-testid="rivals-none">
          {copy("overview.rivals.card.unmeasured")}
        </p>
      )}
    </div>
  );
}
