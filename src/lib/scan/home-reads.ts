// src/lib/scan/home-reads.ts — the stored reads of a site's home page the
// re-score scores a scan with, and the one request that loads their facts:
// the home read each report's on-page facts came from, and the rendered reads
// after it. The rest of the history changes no score, so it is never asked for.
import type { PageFacts } from "./page-facts";

/** A stored read of a site's home page (`fetches`), as its facts. */
export interface StoredRead {
  source: "egress.safeFetch" | "on_page/instant_pages";
  created_at: string;
  facts: PageFacts;
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
  return timeOf(read.facts.readAt);
}

/** The home read a report's on-page facts came from: the newest read at or
 *  before `onPageAt`. */
export function homeOf(onPageAt: number, reads: readonly StoredRead[]): { created_at: string; facts: PageFacts } | null {
  let best: StoredRead | null = null;
  for (const read of reads) {
    if (read.source !== "egress.safeFetch" || !(readAt(read) <= onPageAt)) continue;
    if (best === null || readAt(read) > readAt(best)) best = read;
  }
  return best === null ? null : { created_at: best.created_at, facts: best.facts };
}

/**
 * The reads `homeOf`, `readAsProtection` and the Content check use for
 * reports measured at `onPageAt`, loaded through `load` in one call: each
 * report's home read (every tie, as `homeOf` may pick any) and the rendered
 * reads at or after the first of them, which decide whether one drew the
 * site; where none follows, one rendered read, because any rendered read
 * keeps Content unread.
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
  const first = Math.min(...[...homes.values()].map((r) => Date.parse(r.created_at)));
  const after = rendered.filter((r) => Date.parse(r.created_at) >= first);
  const picked = after.length > 0 ? after : rendered.slice(-1);
  return [...(await load([...homes.keys(), ...picked.map((r) => r.id)]))];
}
