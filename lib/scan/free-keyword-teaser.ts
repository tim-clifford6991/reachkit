/**
 * Free-tier keyword-gap teaser (§6 #1 / PR B) — the honest, cheap "wow".
 *
 * ONE subject-only DataForSEO `ranked_keywords` call surfaces the searches with
 * real volume where the subject is NOT already winning (ranks, but below the top
 * few). That is genuine, provable discoverability loss — "buyers search this 8k
 * times/mo and you're on page 3" — WITHOUT any rival data: the competitors' ranks
 * that turn this into "and your rivals win it" stay a paid reveal, so the free
 * budget only ever pays for one domain's rankings (decision 2026-07-10: free ≤
 * ~$0.18, up from $0.10, to fund this single call).
 *
 * Fixtures-safe: `cachedRankedKeywords` → `fetchRankedKeywords` returns [] under
 * REACHKIT_USE_FIXTURES, so the teaser is simply empty in dev/test. Best-effort —
 * any failure yields an empty teaser and NEVER throws (the free report must still
 * ship). PURE aside from the one cached fetch.
 */

import { normalizeHost } from "@/lib/scan/referral/classify";
import { cachedRankedKeywords } from "@/lib/scan/cache/cached-adapters";
import type { RankedKeyword } from "@/lib/scan/adapters/dataforseo-ranked-keywords";

export interface FreeKeywordTeaserRow {
  keyword: string;
  volume: number;
  /** The subject's best SERP position for this term (from ranked_keywords, so
   *  always a real rank ≥ 1 here — "not ranking at all" needs rival data → paid). */
  yourPosition: number;
}

export interface FreeKeywordTeaserResult {
  /** Top rows by volume where the subject is not winning — the shown teaser. */
  rows: FreeKeywordTeaserRow[];
  /** Total not-winning searches found (drives the "unlock N more" count). */
  total: number;
}

/** Positions 1..WINNING_POSITION count as "already winning" — only front-page-ish
 *  ranks. A high-volume term where you sit below this is a real, honest gap. */
const WINNING_POSITION = 3;
/** Rows shown in the teaser (the public renderer slices further). */
const TOP_ROWS = 6;

const EMPTY: FreeKeywordTeaserResult = { rows: [], total: 0 };

/** Pure: turn a domain's ranked keywords into the "not winning" teaser (searches
 *  with volume where the best position is below the top {@link WINNING_POSITION}),
 *  ranked by volume. Deduped to the best position + max volume per keyword. */
export function buildFreeTeaser(kw: RankedKeyword[]): FreeKeywordTeaserResult {
  // Best (lowest) position + max volume per keyword (a domain can rank several
  // pages for the same term).
  const best = new Map<string, { volume: number; position: number }>();
  for (const k of kw) {
    if (k.volume <= 0 || k.position <= 0) continue;
    const cur = best.get(k.keyword);
    if (!cur) best.set(k.keyword, { volume: k.volume, position: k.position });
    else {
      cur.volume = Math.max(cur.volume, k.volume);
      if (k.position < cur.position) cur.position = k.position;
    }
  }

  const notWinning = [...best.entries()]
    .filter(([, v]) => v.position > WINNING_POSITION)
    .map(([keyword, v]) => ({ keyword, volume: v.volume, yourPosition: v.position }))
    .sort((a, b) => b.volume - a.volume);

  return { rows: notWinning.slice(0, TOP_ROWS), total: notWinning.length };
}

export async function gatherFreeKeywordTeaser(rawSelf: string): Promise<FreeKeywordTeaserResult> {
  try {
    const self = normalizeHost(rawSelf);
    const kw = await cachedRankedKeywords(self, 50);
    if (kw.length === 0) return EMPTY;
    return buildFreeTeaser(kw);
  } catch {
    return EMPTY;
  }
}
