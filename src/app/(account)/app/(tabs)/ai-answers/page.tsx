// SPEC §4 (plate O3) — Linked by AI's detail: back to Overview, the tiles with
// this one current, the head and its lead, then each page question asked in
// the last four weeks.
//
// **Every read is a stored one, and the tile's own**: the rows are the Linked
// by AI tile's pages, so the tile, the lead and the table state one number. No
// measurement, vendor call or model call happens on render.
//
// **It declares no `Surface`**: the shell's own layout owns this route's
// screen root.
import type React from "react";
import type { Metadata } from "next";
import { copy } from "@/lib/presentation/copy";
import { formatShortDay } from "../../_shell/format";
import { readShell } from "../../_shell/provider";
import { aiLead, AiNone, AiQuestionsCard } from "../../_overview/AiTab";
import { loadShowAll, OVERVIEW } from "../../_overview/frame";
import { TabHead } from "../../_overview/TabHead";
import { DetailTiles } from "../../_overview/Tiles";
import { readTiles } from "../../_overview/tiles-provider";

/** /app/ai-answers's own `<title>` (#945). */
export const metadata: Metadata = { title: copy("meta.app.ai-answers.title") };

export default async function AiAnswersTabPage(p: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<React.JSX.Element> {
  const [shell, tiles, { all }] = await Promise.all([readShell(), readTiles(0, false), p.searchParams.then(loadShowAll)]);
  const model = tiles?.questions ?? null;
  const shown = model !== null && model.rows.length > 0 && model.engines.length > 0 ? model : null;

  return (
    <div className={OVERVIEW} data-testid="ai-answers-tab">
      <DetailTiles model={tiles} tab="ai" />
      <TabHead
        title={copy("overview.tile.ai-answers.label")}
        testId="ai-answers"
        lead={shown === null ? null : aiLead(shown)}
        measured={
          shown?.checkedAt == null ? null : (
            <p className="text-base-content/70" data-testid="ai-answers-measured">
              {copy("overview.detail.checked", { date: formatShortDay(shown.checkedAt, shell.timeZone) })}
            </p>
          )
        }
      />
      {shown === null ? <AiNone due={shell.nextDueOn} timeZone={shell.timeZone} /> : <AiQuestionsCard model={shown} all={all} timeZone={shell.timeZone} />}
    </div>
  );
}
