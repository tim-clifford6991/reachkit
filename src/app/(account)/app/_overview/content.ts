// SPEC §4 (owner, 2026-10-15, issue 1457) — the Content tile and the list
// it opens, in one shape.
//
// The pages published and still standing, newest first; how many went live
// in the last `CONTENT_RECENT_WEEKS` weeks; and the newest. One selector:
// Overview's Content tile and Plan's *Published* list both read
// `contentOf`, so the tile's numbers are the list's rows.
//
// Issue 1553: each page also carries how far it has got toward being found
// (`@/lib/measure/ladder`), and the tile counts the pages at each
// step. A step no page can be read on is absent, never a zero.
//
// **This file is pure.** Reading the pages is `content-provider.ts`'s.
import { CONTENT_RECENT_WEEKS } from "@/lib/config/constants";
import { ladderTotals, type Ladder, type LadderTotals } from "@/lib/measure/ladder";

export interface PublishedPage {
  id: string;
  title: string;
  /** The address it is live at, where the publish recorded one. */
  url: string | null;
  publishedAt: Date;
  /** The draft it is a version of, which *Take down* acts on (issue 1532). */
  draftId?: string;
  /** Published → crawled → indexed → impressions → best place → cited
   *  (issue 1553); absent where it could not be read. */
  ladder?: Ladder;
}

export interface PublishedRead {
  /** `null` where the pages could not be read — never an empty list,
   *  which would say nothing was published. */
  pages: readonly PublishedPage[] | null;
  /** The instant "the last four weeks" ends at. */
  now: Date;
}

export interface ContentModel {
  /** Every page published and not taken down, newest first. */
  pages: readonly PublishedPage[];
  /** Those published in the last `CONTENT_RECENT_WEEKS` weeks. */
  recent: readonly PublishedPage[];
  last: PublishedPage | null;
  /** The pages at each step of the ladder; `null` where no page has one. */
  found: LadderTotals | null;
}

const MS_PER_WEEK = 7 * 86_400_000;

export function contentOf(read: PublishedRead): ContentModel | null {
  if (read.pages === null) return null;
  const pages = [...read.pages].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime() || a.id.localeCompare(b.id));
  const since = read.now.getTime() - CONTENT_RECENT_WEEKS * MS_PER_WEEK;
  const ladders = pages.flatMap((page) => (page.ladder === undefined ? [] : [page.ladder]));
  return {
    pages,
    recent: pages.filter((page) => page.publishedAt.getTime() > since && page.publishedAt <= read.now),
    last: pages[0] ?? null,
    found: ladders.length === 0 ? null : ladderTotals(ladders),
  };
}
