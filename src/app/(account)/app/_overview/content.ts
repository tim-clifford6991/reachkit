// SPEC §4 (owner, 2026-10-15, issue 1457) — the Content tile and the list
// it opens, in one shape.
//
// The pages published and still standing, newest first; how many went live
// in the last `CONTENT_RECENT_WEEKS` weeks; and the newest. One selector:
// Overview's Content tile and Plan's *Published* list both read
// `contentOf`, so the tile's numbers are the list's rows.
//
// **This file is pure.** Reading the pages is `content-provider.ts`'s.
import { CONTENT_RECENT_WEEKS } from "@/lib/config/constants";

export interface PublishedPage {
  id: string;
  title: string;
  /** The address it is live at, where the publish recorded one. */
  url: string | null;
  publishedAt: Date;
  /** The draft it is a version of, which *Take down* acts on (issue 1532). */
  draftId?: string;
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
}

const MS_PER_WEEK = 7 * 86_400_000;

export function contentOf(read: PublishedRead): ContentModel | null {
  if (read.pages === null) return null;
  const pages = [...read.pages].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime() || a.id.localeCompare(b.id));
  const since = read.now.getTime() - CONTENT_RECENT_WEEKS * MS_PER_WEEK;
  return {
    pages,
    recent: pages.filter((page) => page.publishedAt.getTime() > since && page.publishedAt <= read.now),
    last: pages[0] ?? null,
  };
}
