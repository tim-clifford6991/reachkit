// BUILD §8 hard rule 5 — the customer's own published set.
//
// "≥85% similarity vs the customer's published set = never queued." Three
// sets in practice, each of them this customer's:
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
// A fourth, `elsewhere` (D13, issue 1144), asked of a page ReachKit wrote, is
// every draft and live page written for **other** sites in the last twelve
// months, read as text alone:
// no id, no title, no site. So no page of another customer's is ever named,
// and the founder is told only that the page was too close to one.
import { BATTERY, ELSEWHERE } from "@/lib/config/constants";
import { readMeasuredText } from "@/lib/measure/text";
import { urlKey } from "../links/select";
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
  /** A new version of a live page is not a duplicate of the versions it
   *  replaces at its own address. */
  exceptVersionsAt?: { url: string; draftIds: readonly string[] };
  /** The pages written for other sites too: a page ReachKit wrote, never a founder's edit. */
  elsewhere?: true;
}): Promise<ComparisonSet> {
  const store = generateStore();
  const versions = new Set(a.exceptVersionsAt?.draftIds ?? []);
  const address = a.exceptVersionsAt === undefined ? null : urlKey(a.exceptVersionsAt.url);
  const published = (await store.publishedPages(a.siteId)).filter((page) => !versions.has(page.ref));
  const queued = await store.queuedPages(a.siteId, a.exceptDraftId ?? null);
  const measured = (await readMeasuredText({ siteId: a.siteId })).filter((page) => address === null || urlKey(page.url) !== address);

  return {
    published: published.map(renderedPage),
    queued: queued.map(renderedPage),
    // Already rendered text — `readMeasuredText` extracts each page's own
    // prose, without the chrome every page repeats.
    measured: measured.slice(0, BATTERY.MEASURED_PAGES_MAX).map((page) => ({
      ref: page.url,
      title: page.url,
      rendered: page.text,
    })),
    ...(a.elsewhere === true ? { elsewhere: await pagesElsewhere(a.siteId) } : {}),
  };
}

/** The pages written for other sites since `ELSEWHERE.months` before `now`, each as text alone. */
export async function pagesElsewhere(siteId: string, now = new Date()): Promise<NonNullable<ComparisonSet["elsewhere"]>> {
  const since = new Date(now);
  since.setUTCMonth(since.getUTCMonth() - ELSEWHERE.months);
  const others = await generateStore().pagesElsewhere(siteId, since, ELSEWHERE.pagesMax);
  if (others.length >= ELSEWHERE.pagesMax) console.warn(JSON.stringify({ event: "elsewhere_read_capped", siteId, pages: others.length }));
  return others.map((markdown) => ({ ref: "", title: "", rendered: renderOf(markdown) }));
}

/** A refresh's text is a new version of the page at its own address, so the
 *  versions it replaces there are not what it may not repeat. */
export async function ownVersions(
  siteId: string,
  opportunity: { type: string; targetRef: string } | null
): Promise<{ exceptVersionsAt?: { url: string; draftIds: string[] } }> {
  const store = generateStore();
  if (opportunity?.type !== "refresh_page") return {};
  return { exceptVersionsAt: { url: opportunity.targetRef, draftIds: await store.versionsAt(siteId, opportunity.targetRef) } };
}
