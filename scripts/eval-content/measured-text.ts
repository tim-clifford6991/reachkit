// scripts/eval-content/measured-text.ts — the one read the run replaces.
//
// `scripts/eval-content.mjs` aliases this module over `@/lib/measure/text`
// for the run only, so the grounding read and the near-duplicate sets get the
// snapshot's pages instead of a Postgres read. What they then do with the
// pages is the product's own code. The signatures are the real module's.
import type { MeasuredText } from "../../src/lib/measure/text";

let current: { siteId: string; domain: string; pages: MeasuredText[] } | null = null;

/** The domain being written for. One at a time: the run is sequential. */
export function servePages(a: { siteId: string; domain: string; pages: MeasuredText[] } | null): void {
  current = a === null ? null : { ...a, pages: ordered(a.pages) };
}

function ordered(pages: readonly MeasuredText[]): MeasuredText[] {
  return [...pages].sort((a, b) => {
    const byDate = a.measuredAt.getTime() - b.measuredAt.getTime();
    if (byDate !== 0) return byDate;
    return a.url < b.url ? -1 : a.url > b.url ? 1 : 0;
  });
}

export async function readMeasuredText(a: { siteId: string; scanId?: string }): Promise<MeasuredText[]> {
  return current !== null && a.siteId === current.siteId ? current.pages : [];
}

export async function readDomainText(domain: string): Promise<MeasuredText[]> {
  return current !== null && domain === current.domain ? current.pages : [];
}
