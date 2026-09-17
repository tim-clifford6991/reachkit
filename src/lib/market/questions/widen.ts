// SPEC §6 thin markets (owner defaults, 2026-09-16; #778) — how a pass short
// of twelve questions reads more of the market.
//
// "Seeds, in order: the confirmed category → a 2–3 word head term derived
// from it → the site profile's vocabulary … Candidates are pooled from
// suggestions, the rivals' ranked keywords and the site's own ranked
// keywords, de-duplicated before selection … Volume floor steps 50 → 20 →
// 10 /mo, only as far as needed to reach twelve questions."
//
// Pure, like `select.ts`: no context, no clock, no I/O, and nothing that
// reaches a Node built-in — the setup screen re-derives with it in the
// browser. The purchases the seed ladder names are the scan pipeline's
// (`src/lib/scan/run.ts`); this file only orders the seeds and selects.
//
// **An established market is unchanged.** The suggestions alone at the first
// step are always tried first, and their answer stands wherever it reaches
// twelve: the pool and the lower steps are read only while short. Never pad
// (2026-09-11) still holds — every row selected here is a measured search
// that passed the same gates.
import { BATTERY, SELECTION } from "@/lib/config/constants";
import type { SuggestionRow } from "./market-set";
import type { Profile } from "./profile";
import type { RankedRow } from "@/lib/vendors/dataforseo/types";
import { STOP_WORDS, selectTwelve, type MarketRow, type SelectedSearch } from "./select";

/** A ranked keyword pooled beside the suggestions: the site's own row
 *  (`rival: null`) or a tracked rival's. Rows the pass already bought — the
 *  site's own `ranked_keywords` and the rivals' sizing rows — never a new
 *  purchase. */
export interface PoolRow {
  keyword: string;
  volume: number;
  rival: string | null;
}

/** The lowest volume step. A row below it is never selected at any step. */
export const LOWEST_STEP: number = SELECTION.volumeSteps[SELECTION.volumeSteps.length - 1]!;

/** The pool from the ranked rows a pass already bought — the site's own,
 *  then each tracked rival's in the order sized — cut at the lowest step. */
export function poolFrom(a: {
  own: readonly RankedRow[];
  rivals: ReadonlyMap<string, readonly RankedRow[]>;
}): PoolRow[] {
  const pool: PoolRow[] = [];
  for (const row of a.own) {
    if (row.searchVolume >= LOWEST_STEP) pool.push({ keyword: row.keyword, volume: row.searchVolume, rival: null });
  }
  for (const [rival, rows] of a.rivals) {
    for (const row of rows) {
      if (row.searchVolume >= LOWEST_STEP) pool.push({ keyword: row.keyword, volume: row.searchVolume, rival });
    }
  }
  return pool;
}

function words(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter((w) => w !== "");
}

/**
 * The category's 2–3 word head term: the words before its first connective
 * ("user onboarding software for SaaS teams" → "user onboarding software"),
 * and of those the last three ("AI SEO content platform" → "seo content
 * platform"). Where fewer than two words come before the connective, the
 * noun phrase is read from the category's last content words instead, three
 * then two ("SEO and content marketing software" → "content marketing
 * software"; "SEO and marketing software" → "marketing software", issue 836).
 * `null` where every choice is the category itself or a single word — there
 * is then no distinct, broader seed to buy.
 */
export function headTermOf(category: string): string | null {
  const all = words(category);
  const cut = all.findIndex((word, i) => i > 0 && STOP_WORDS.has(word));
  const head = (cut === -1 ? all : all.slice(0, cut)).slice(-3);
  if (head.length >= 2) return head.join(" ") === all.join(" ") ? null : head.join(" ");
  const content = all.filter((word) => !STOP_WORDS.has(word));
  for (const size of [3, 2]) {
    const tail = content.slice(-size);
    if (tail.length === size && tail.join(" ") !== content.join(" ")) return tail.join(" ");
  }
  return null;
}

/**
 * The seeds in the order SPEC §6 buys them. The first is the one every pass
 * buys (#767): the confirmed category, else the profile's category, else its
 * first vocabulary term. The rest — the head term, then the vocabulary — are
 * bought only while short. Case-insensitively distinct; empty where the
 * profile names nothing.
 */
export function seedLadder(profile: Profile, confirmed?: string): string[] {
  const seeds: string[] = [];
  const add = (candidate: string): void => {
    const seed = candidate.trim();
    if (seed !== "" && !seeds.some((held) => held.toLowerCase() === seed.toLowerCase())) seeds.push(seed);
  };
  const category = [confirmed ?? "", profile.category].find((c) => c.trim() !== "");
  if (category === undefined) {
    for (const term of profile.vocabulary) add(term);
    return seeds;
  }
  add(category);
  const head = headTermOf(category);
  if (head !== null) add(head);
  for (const term of profile.vocabulary) add(term);
  return seeds;
}

/** Suggestions ∪ pooled rows, one row per search (case and spacing
 *  ignored), the first occurrence's volume kept, and every rival that ranks
 *  for it named on the row. */
export function pooledMarket(suggestions: readonly SuggestionRow[], pool: readonly PoolRow[]): MarketRow[] {
  const byKey = new Map<string, { row: SuggestionRow; rivals: string[] }>();
  const add = (row: SuggestionRow, rival: string | null): void => {
    const key = words(row.keyword).join(" ");
    if (key === "") return;
    let held = byKey.get(key);
    if (held === undefined) {
      held = { row: { keyword: row.keyword, volume: row.volume }, rivals: [] };
      byKey.set(key, held);
    }
    if (rival !== null && !held.rivals.includes(rival)) held.rivals.push(rival);
  };
  for (const row of suggestions) add(row, null);
  for (const row of pool) add(row, row.rival);
  return [...byKey.values()].map(({ row, rivals }) => (rivals.length === 0 ? row : { ...row, rivals }));
}

/**
 * The twelve over a market read as widely as SPEC §6 allows, and no wider
 * than it needs: the suggestions alone at the first step; while short, the
 * pooled market at each of `floors` in turn, stopping at the first that
 * reaches twelve. A wider read replaces the narrower one only where it
 * selects more.
 *
 * `floors` lets the pipeline check the first step between seed purchases
 * before any floor is lowered; the default walks every step.
 */
export function selectWidened(a: {
  profile: Profile;
  category?: string;
  suggestions: readonly SuggestionRow[];
  pool: readonly PoolRow[];
  floors?: readonly number[];
  /** The site's own ranked count — `selectTwelve`'s demand ceiling, applied
   *  at every step, so widening continues until twelve right-sized
   *  searches survive (issue 830). */
  ownRanked: number;
}): SelectedSearch[] {
  const category = a.category === undefined ? {} : { category: a.category };
  const { ownRanked } = a;
  let best = selectTwelve({ profile: a.profile, market: a.suggestions, ownRanked, ...category });
  if (best.length >= BATTERY.QUESTIONS) return best;

  const market = pooledMarket(a.suggestions, a.pool);
  for (const floor of a.floors ?? SELECTION.volumeSteps) {
    const widened = selectTwelve({ profile: a.profile, market, floor, ownRanked, ...category });
    if (widened.length > best.length) best = widened;
    if (best.length >= BATTERY.QUESTIONS) break;
  }
  return best;
}

/** Whether a selection is still short of the twelve. */
export function isShort(selected: readonly SelectedSearch[]): boolean {
  return selected.length < BATTERY.QUESTIONS;
}
