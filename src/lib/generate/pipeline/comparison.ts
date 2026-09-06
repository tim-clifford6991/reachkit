// BUILD §8 hard rule 5 — the customer's own published set.
//
// "≥85% similarity vs the customer's published set = never queued." Three
// sets in practice, and every member of every one of them is this
// customer's:
//
//   * `published` — the pages of theirs that went live;
//   * `measured` — the pages of theirs the product measured, re-read out of
//     the `fetches` ledger rather than fetched again (BUILD §6.4 bars
//     per-draft re-probing), bounded by `MEASURED_PAGES_MAX`;
//   * `queued` — the drafts already waiting for them and not yet published.
//
// The queued set is included deliberately: a page must not compete with one
// the customer already has waiting. That is why the gate runs at queue time
// rather than at derivation time, and why the answer depends on what else
// is waiting.
//
// **No code path in this file takes a site id other than the one it was
// called with**, and no store method it calls is unscoped — which is how
// "never another customer's page" is a property of the code rather than a
// promise about it.
import { BATTERY } from "@/lib/config/constants";
import { readMeasuredText } from "@/lib/measure/text";
import { renderOf } from "../rules/text";
import type { ComparisonSet } from "../rules/types";
import { generateStore, type StoredPage } from "../store";

/** The reader's words for a page the product wrote — the same derivation
 *  the candidate goes through, so both sides of every comparison are the
 *  same kind of text. */
function renderedPage(page: StoredPage): { ref: string; title: string; rendered: string } {
  return { ref: page.ref, title: page.title, rendered: renderOf(page.markdown) };
}

export async function buildComparisonSet(a: {
  siteId: string;
  /** The draft being generated, which is in the store by the time the gate
   *  runs and must not be compared against itself. */
  exceptDraftId?: string;
}): Promise<ComparisonSet> {
  const store = generateStore();
  const published = await store.publishedPages(a.siteId);
  const queued = await store.queuedPages(a.siteId, a.exceptDraftId ?? null);
  const measured = await readMeasuredText({ siteId: a.siteId });

  return {
    published: published.map(renderedPage),
    queued: queued.map(renderedPage),
    // Already rendered text — `readMeasuredText` extracts it with the same
    // extractor the measurement scored the page on, so the comparison set
    // cannot disagree with what the page was measured as.
    measured: measured.slice(0, BATTERY.MEASURED_PAGES_MAX).map((page) => ({
      ref: page.url,
      title: page.url,
      rendered: page.text,
    })),
  };
}
