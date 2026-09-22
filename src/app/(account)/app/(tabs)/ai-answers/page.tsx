// SPEC §4 · §6 (2026-09-20, #908) — Overview › AI answers.
//
// §4 of that date: "AI answers tab: see §6 of this date for the measures.
// 'AI rank position' and sentiment are never shown." §6(a): "A rolling
// four-week rate — answers that name or link the site over all answers
// asked — beside this week's n of 12; named and linked are counted apart."
//
// **Everything on it is already stored.** `readAnswers()` is the one call
// this file makes; neither the tiles nor the grid fetches for itself, so
// the render performs no measurement, no vendor call and no model call.
// Nothing on this screen is bought, and nothing is recomputed — the marks
// are §6.2's stored cells, split with the score's own `classifyReferences`.
//
// **It declares no `Surface`**: the shell's own layout owns this route's
// screen root, and the tab bar above it is `(tabs)/layout.tsx`'s. A second
// screen root would be a second `[data-surface]` in the document.
//
// **It writes no sentence.** Every word is the registry's.
//
// **No client bundle.** The whole screen is server-rendered: there is
// nothing on it to press, so there is no `"use client"`, no `nuqs` state
// and no `Suspense` boundary — unlike the Search tab next door, which
// holds its chosen chip in the URL.
//
// **The hosted-blog counts are the card at the bottom** (#921, §6 measure
// (d)). They are the one reading on this screen that is not bought from a
// vendor — they are ReachKit's own server counting what it served — and
// they are drawn only for a site whose pages we host and who has published
// one, because a card of zeroes would be a claim about engines rather than
// a fact about the record.
//
// **What is not here, and where it goes**: *Also appearing for* and the
// cited-pages tile wait on the LLM-Mentions pilot (#920). It is not stood
// in for, because a placeholder for an unbought measurement is a claim.
import type React from "react";
import type { Metadata } from "next";
import { copy } from "@/lib/presentation/copy";
import { formatDate } from "../../_shell/format";
import { readShell } from "../../_shell/provider";
import { readAnswers } from "../../_overview/answers-provider";
import { readBlogReads } from "../../_overview/blog-reads-provider";
import { AnswerGrid } from "../../_overview/AnswerGrid";
import { AnswerTiles } from "../../_overview/AnswerTiles";
import { BlogReads } from "../../_overview/BlogReads";

/** /app/ai-answers's own `<title>` (#945). Without it this screen announced
 *  nothing at all — the `(account)` layout's fallback is the floor, not
 *  the name of this screen. */
export const metadata: Metadata = { title: copy("meta.app.ai-answers.title") };

export default async function AiAnswersTabPage(): Promise<React.JSX.Element> {
  // The zone is the shell's one stored preference, read through the shell's
  // own request-cached provider rather than restated here: two readers of a
  // customer's time zone is how two parts of one screen come to state two
  // different days.
  const [shell, model, blogReads] = await Promise.all([
    readShell(),
    readAnswers(),
    readBlogReads(),
  ]);
  // A sentence with a date inside it, not a value — the same line, from the
  // same key, the Search tab states over its own table. One sentence, one
  // place to change it.
  const measured =
    model.measuredAt === null
      ? null
      : copy("overview.search.measured", { on: formatDate(model.measuredAt, shell.timeZone) });

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="ai-answers-tab">
      <header className="flex min-w-0 flex-col gap-1">
        <h1 className="card-title text-base!" data-testid="ai-answers-title">
          {copy("overview.tile.ai-answers.label")}
        </h1>
        <p className="max-w-prose text-sm text-base-content/70">{copy("overview.answers.lead")}</p>
        {measured === null ? null : (
          <p className="text-xs text-base-content/60" data-testid="ai-answers-measured">
            {measured}
          </p>
        )}
      </header>

      <AnswerTiles model={model} />
      <AnswerGrid model={model} />
      <BlogReads model={blogReads} />
    </div>
  );
}
