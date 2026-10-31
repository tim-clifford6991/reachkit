// src/lib/scan/home-reads.ts — the stored reads of a site's home page the
// re-score scores a scan with, and the request that loads only those: the
// home read each report's on-page facts came from, and the rendered reads
// after it up to the first one that drew the site. The rest of the history
// changes no score, so it is never downloaded.
import { renderedDocumentOf } from "@/lib/measure/own-fetch";

/** A stored read of a site's home page (`fetches`). */
export interface StoredRead {
  source: "egress.safeFetch" | "on_page/instant_pages";
  created_at: string;
  payload: unknown;
}

/** A stored home read without its payload: `read_at` is `payload->readAt`. */
export interface HomeReadRow {
  id: string;
  source: StoredRead["source"];
  created_at: string;
  read_at: unknown;
}

function timeOf(at: unknown): number {
  return typeof at === "string" ? Date.parse(at) : Number.NaN;
}

function readAt(read: StoredRead): number {
  return timeOf((read.payload as { readAt?: unknown } | null)?.readAt);
}

/** The home read a report's on-page facts came from: the newest read at or
 *  before `onPageAt`. */
export function homeOf(onPageAt: number, reads: readonly StoredRead[]): { created_at: string; payload: unknown } | null {
  let best: StoredRead | null = null;
  for (const read of reads) {
    if (read.source !== "egress.safeFetch" || !(readAt(read) <= onPageAt)) continue;
    if (best === null || readAt(read) > readAt(best)) best = read;
  }
  return best === null ? null : { created_at: best.created_at, payload: best.payload };
}

/**
 * The reads `homeOf`, `readAsProtection` and the Content check use for
 * reports measured at `onPageAt`, loaded through `load` by id: each report's
 * home read (every tie, as `homeOf` may pick any), the rendered reads at or
 * after it in order until one draws the site, and where none follows, one
 * rendered read, because any rendered read keeps Content unread.
 */
export async function homeReadsFor(
  rows: readonly HomeReadRow[],
  onPageAt: readonly number[],
  load: (ids: readonly string[]) => Promise<readonly StoredRead[]>
): Promise<StoredRead[]> {
  const plain = rows.filter((r) => r.source === "egress.safeFetch");
  const rendered = rows.filter((r) => r.source === "on_page/instant_pages").sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const homes = new Map<string, HomeReadRow>();
  for (const at of new Set(onPageAt)) {
    const before = plain.filter((r) => timeOf(r.read_at) <= at);
    const newest = Math.max(...before.map((r) => timeOf(r.read_at)));
    for (const r of before) if (timeOf(r.read_at) === newest) homes.set(r.id, r);
  }
  if (homes.size === 0) return [];
  const out = [...(await load([...homes.keys()]))];
  const loaded = new Map<string, StoredRead>();
  for (const home of homes.values()) {
    for (const r of rendered.filter((x) => Date.parse(x.created_at) >= Date.parse(home.created_at))) {
      const read = loaded.get(r.id) ?? (await load([r.id]))[0];
      if (read === undefined) continue;
      loaded.set(r.id, read);
      if (renderedDocumentOf(read.payload) !== null) break;
    }
  }
  if (loaded.size === 0 && rendered.length > 0) out.push(...(await load([rendered.at(-1)!.id])));
  return [...out, ...loaded.values()];
}
