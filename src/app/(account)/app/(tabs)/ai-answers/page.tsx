// SPEC §4 · §6 (board AppAI) — the AI tab: the week and the day AI was asked,
// three tiles, each page in AI answers, which AI read and sent visits, and the
// reputation card that closes on the grid of the twelve.
//
// **Every read is a stored one, and Overview's own.** The pages linked, the
// reads and the visits are the readers Overview's AI figure draws; the
// reputation is the month's reading Overview's months card draws. So a figure
// here and on Overview is one number. No measurement, vendor call or model
// call happens on render. "'AI rank position' and sentiment are never shown."
//
// **It declares no `Surface`**: the shell's own layout owns this route's
// screen root, and the tab bar above it is `(tabs)/layout.tsx`'s.
import type React from "react";
import type { Metadata } from "next";
import { copy } from "@/lib/presentation/copy";
import { contentOf } from "@/lib/measure/published";
import { formatDay } from "../../_shell/format";
import { readShell } from "../../_shell/provider";
import { readAnswers } from "../../_overview/answers-provider";
import { readBlogReads } from "../../_overview/blog-reads-provider";
import { readPublished } from "../../_overview/content-provider";
import { readOverview } from "../../_overview/provider";
import { readPromptsAt } from "../../_overview/prompts-provider";
import { readUnderstanding } from "../../_overview/understanding-provider";
import { aiPagesFor } from "../../_overview/ai-pages";
import { AnswerGrid } from "../../_overview/AnswerGrid";
import { AiPagesCard, AiTiles, Reputation, WhoReads } from "../../_overview/AiTab";
import { TabHead } from "../../_overview/TabHead";

/** /app/ai-answers's own `<title>` (#945). */
export const metadata: Metadata = { title: copy("meta.app.ai-answers.title") };

export default async function AiAnswersTabPage(): Promise<React.JSX.Element> {
  const [shell, model, reads, published, overview, understanding] = await Promise.all([
    readShell(),
    readAnswers(),
    readBlogReads(),
    readPublished(),
    readOverview(),
    readUnderstanding(),
  ]);
  const reputation = await readPromptsAt(overview.months?.reading?.week ?? null);
  const content = contentOf(published);
  const pages = content === null ? null : aiPagesFor(content.pages, model.pageQuestions, published.now);
  const grid = model.questions.length === 0 ? null : <AnswerGrid model={model} />;

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="ai-answers-tab">
      <TabHead
        eyebrow={shell.weeks.kind === "counted" ? copy("overview.tab.eyebrow", { n: String(shell.weeks.weeks) }) : null}
        title={copy("overview.tile.ai-answers.label")}
        testId="ai-answers"
        measured={
          model.measuredAt === null ? null : (
            <p className="text-xs text-base-content/70" data-testid="ai-answers-measured">
              {copy("overview.search.measured", { on: formatDay(model.measuredAt, shell.timeZone) })}
            </p>
          )
        }
      />

      <AiTiles pages={pages} reads={reads} />

      <AiPagesCard pages={pages} place={understanding.where.place?.name ?? null} />

      <WhoReads reads={reads} />

      {reputation.kind === "measured" ? (
        <Reputation model={reputation}>{grid}</Reputation>
      ) : grid === null ? (
        <section className="card card-border min-w-0 bg-base-100" data-testid="ai-empty">
          <p className="card-body p-5 text-sm text-base-content/70">{copy("overview.answers.empty")}</p>
        </section>
      ) : (
        <section className="card card-border min-w-0 bg-base-100 px-4">{grid}</section>
      )}
    </div>
  );
}
