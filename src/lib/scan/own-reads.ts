// src/lib/scan/own-reads.ts — a paying scan's measured pages as the re-score
// reads them, and the stored reads of ReachKit's live pages it
// keeps: the newest of each address at or before the scan's last own read.
// The rest of the history changes no score, so it is never downloaded.
import type { PageFacts } from "./page-facts";
import type { RescoreScan } from "./rescore";

/** One own-document read as `fetches` keeps it: its address and its facts. */
export interface OwnRead {
  url: string;
  created_at: string;
  facts: PageFacts;
}

/** What `measuredOf` reads a scan's measured pages from. */
export interface OwnReads {
  /** The scan's own reads, in the order it read them. */
  own: readonly OwnRead[];
  /** The site's pages ReachKit had live when the scan ran, newest first. */
  ours: readonly string[];
  /** Stored reads of those pages from before the scan's last own read. */
  oursReads: readonly OwnRead[];
}

/** A publication as `livePagesAt` reads it. */
export interface StoredPublication {
  live_url: string | null;
  published_at: string | null;
  unpublished_at: string | null;
}

/** A stored read of a live page without its payload. */
export interface OwnReadRow {
  id: string;
  cache_key: string;
  created_at: string;
}

/** The pages that were live at `at`, newest first. */
export function livePagesAt(publications: readonly StoredPublication[], at: string): string[] {
  const t = Date.parse(at);
  return publications
    .filter((p): p is StoredPublication & { live_url: string; published_at: string } => p.live_url !== null && p.published_at !== null)
    .filter((p) => Date.parse(p.published_at) <= t && (p.unpublished_at === null || Date.parse(p.unpublished_at) > t))
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .map((p) => p.live_url);
}

function lastOf(own: readonly { created_at: string }[]): string {
  return own.reduce((max, read) => (read.created_at > max ? read.created_at : max), own[0]!.created_at);
}

/**
 * A scan's measured pages as its own reads hold them, in the order a pass
 * names them — ReachKit's live pages first, then the pages the scan read
 * itself — with each address's read: the scan's own where it read it, else
 * the newest stored read before its last one. `undefined` where the scan
 * ledgered no read of its own (its reads were served from an earlier pass's
 * rows, which are not this scan's pages).
 */
export function measuredOf(r: OwnReads): RescoreScan["measured"] {
  if (r.own.length === 0) return undefined;
  const reads = new Map<string, PageFacts>();
  for (const read of r.own) reads.set(read.url, read.facts);
  const last = lastOf(r.own);
  const older = [...r.oursReads].filter((read) => read.created_at <= last).sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const read of older) if (!reads.has(read.url)) reads.set(read.url, read.facts);
  const crawled = r.own.filter((read) => read.facts.page).map((read) => read.url);
  return { pages: [...new Set([...r.ours, ...crawled])], reads };
}

/** The ids of the reads `measuredOf` can keep for a scan whose own reads are
 *  `own`: the newest of each address at or before the last, every tie. */
export function oursPicked(rows: readonly OwnReadRow[], own: readonly { created_at: string }[]): string[] {
  if (own.length === 0) return [];
  const last = lastOf(own);
  const newest = new Map<string, string>();
  for (const r of rows) if (r.created_at <= last && r.created_at > (newest.get(r.cache_key) ?? "")) newest.set(r.cache_key, r.created_at);
  return rows.filter((r) => newest.get(r.cache_key) === r.created_at).map((r) => r.id);
}

/** `load` asked once per id for a run: a read several scans keep, or a
 *  home that is also a scan's own read, is asked for once. */
export function onceById<T>(load: (ids: readonly string[]) => Promise<ReadonlyMap<string, T>>) {
  const held = new Map<string, T | null>();
  return async (ids: readonly string[]): Promise<Map<string, T>> => {
    const missing = [...new Set(ids.filter((id) => !held.has(id)))];
    if (missing.length > 0) {
      const got = await load(missing);
      for (const id of missing) held.set(id, got.get(id) ?? null);
    }
    const out = new Map<string, T>();
    for (const id of ids) {
      const value = held.get(id);
      if (value !== undefined && value !== null) out.set(id, value);
    }
    return out;
  };
}
