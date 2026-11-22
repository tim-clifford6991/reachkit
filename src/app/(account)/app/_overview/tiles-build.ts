// SPEC §4 *Overview's four tiles* — the one function behind each tile and its detail. It returns the
// tiles with the list models their details render, so a tile, its detail's card and its list are
// counted once, from the same rows. Pure: stored reads in, the whole model out.
import { contentOf, type ContentModel, type PublishedRead } from "@/lib/measure/published";
import type { AnswerQuestion } from "./answers-model";
import { aiPagesFor, type AiPages } from "./ai-pages";
import { googlePagesOf, type GooglePages } from "./google-pages";
import { AI_WINDOW_WEEKS, aiAnswersOf, aiWindowOf, tilesOf, type AiAnswers, type RivalsFirstPage, type TilePage, type TilePass, type TilesModel } from "./tiles";

/** The tiles, and the models of the lists they open: Pages Live's (This Week's *Live pages*), On Google's and the AI tile's. */
export interface TilesView extends TilesModel {
  pages: ContentModel;
  google: GooglePages;
  ai: AiPages | null;
  /** The AI tile's own figure, which its detail's lead states; `null` where none was read. */
  answers: AiAnswers | null;
  /** The first live page's go-live, as the Pages tile counts it. */
  firstLive: Date | null;
}

export function buildTiles(a: {
  published: PublishedRead;
  passes: readonly TilePass[];
  rows: readonly TilePage[];
  rivals: RivalsFirstPage | null;
  /** The latest asking of each page's question, for the AI list's per-engine marks. */
  pageQuestions: readonly AnswerQuestion[];
  /** The site's domain, which a stored answer's mention is read against. */
  domain: string;
  week: string;
  coming: number;
  goLive: boolean;
}): TilesView | null {
  const pages = contentOf(a.published);
  if (pages === null) return null;
  const now = a.published.now;
  const google = googlePagesOf(pages.pages, now);
  const latest = [...a.passes].sort((x, y) => x.weekStart.localeCompare(y.weekStart)).at(-1);
  const window = latest === undefined ? null : aiWindowOf(a.passes, a.rows, latest.weekStart, a.domain);
  const ai =
    window === null
      ? null
      : aiPagesFor(pages.pages, a.pageQuestions, now, { weeks: AI_WINDOW_WEEKS, asked: [...window.asked], linked: [...window.linked], mentioned: [...window.mentioned] });
  const firstLive = pages.pages.at(-1)?.publishedAt ?? null;
  const model = tilesOf({
    passes: a.passes,
    pages: a.rows,
    rivals: a.rivals,
    lists: {
      live: pages.pages.length,
      firstLive,
      google: { live: google.live, placed: google.placed },
    },
    now,
    week: a.week,
    domain: a.domain,
    coming: a.coming,
    goLive: a.goLive,
  });
  return { ...model, pages, google, ai, answers: latest === undefined ? null : aiAnswersOf(a.passes, latest.weekStart, a.domain), firstLive };
}
