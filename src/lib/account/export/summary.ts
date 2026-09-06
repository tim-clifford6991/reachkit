// BUILD §4.7 — "**Your content** (pages count, Export everything — always
// available)".
//
// REQ-078 criterion 1's count half: how many pages ReachKit has written for
// this site, "published, in review, vetoed and failed alike". The surface
// that renders it is §4.7's Settings card; the single action beside it is
// `exportEverything`.
//
// **A plain number, never a `Measured<T>`.** A count of ReachKit's own rows
// is always knowable, and wrapping it would make "we do not know how many
// pages we wrote for you" a representable state on the one screen where it
// would read as data loss. Zero is a true count and states itself: a site
// with no pages yet has none, which is a fact, not an empty state and not a
// failure.
//
// A store that cannot be read is the one thing this function will not
// answer, and it throws rather than returning a number nobody measured. The
// caller — one Settings read — is the place that decides what a screen does
// with an unreadable store, and it is not this leaf's decision to fold that
// into a `0`.
import { isWritten } from "./pages";
import { exportStore } from "./store";

export class ContentSummaryUnreadable extends Error {
  constructor(siteId: string) {
    super(`src/lib/account/export: the pages of site ${siteId} could not be read.`);
    this.name = "ContentSummaryUnreadable";
  }
}

export async function contentSummary(siteId: string): Promise<{ pages: number }> {
  const read = await exportStore().pages(siteId);
  if (!read.ok) throw new ContentSummaryUnreadable(siteId);
  return { pages: read.pages.filter((page) => isWritten(page.body_md)).length };
}
