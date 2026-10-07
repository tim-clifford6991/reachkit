// src/lib/market/infer/stability.ts — when a conclusion replaces the one in
// force (#1185, owner 2026-10-02): "a newly inferred market replaces the
// stored one only when it is consistently better across two passes, or
// clearly better on evidence. Never on one noisy guess." Rivals are
// re-checked every pass, and a new or dropped rival is a change the product
// makes and reports. A field the founder overrode is never replaced.
//
// Pure: no I/O, no clock. The caller reads and writes `sites.market`.
import { searched } from "./demand";
import { RIVALS_MAX, type MarketConclusion, type RivalConclusion, type StoredMarket } from "./types";

export type MarketFields = Omit<MarketConclusion, "rivals">;

/** What one adoption changed, kept for the weekly mail (§8). */
export interface MarketChange {
  /** The pass (or setup's claimed row) that made the change. */
  scanId: string;
  at: string;
  category: { from: string | null; to: string; reason: string } | null;
  added: readonly RivalConclusion[];
  dropped: readonly string[];
}

/** `sites.market` with the change the latest pass made. */
export interface StoredMarketWithChange extends StoredMarket {
  lastChange?: MarketChange | null;
}

const STOP = new Set(["and", "for", "the", "with", "software", "tool", "tools", "platform", "app", "apps", "of", "to", "a", "an"]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && !STOP.has(w))
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));
}

function names(m: Pick<MarketFields, "category" | "synonyms">): Set<string> {
  return new Set([m.category, ...m.synonyms].map((n) => words(n).join(" ")).filter((n) => n !== ""));
}

/** Two conclusions name one market when either's category is the other's
 *  category or one of its synonyms, words compared without case, plurals
 *  or filler ("software", "tool"). */
export function sameMarket(
  a: Pick<MarketFields, "category" | "synonyms">,
  b: Pick<MarketFields, "category" | "synonyms">
): boolean {
  const ka = words(a.category).join(" ");
  const kb = words(b.category).join(" ");
  if (ka === kb) return true;
  return names(a).has(kb) || names(b).has(ka);
}

/** How much of a market's own name the site's own words carry: the share
 *  of the distinct words in its category and synonyms that appear in the
 *  site's text. 0–1. */
export function support(m: Pick<MarketFields, "category" | "synonyms">, siteText: string): number {
  const said = new Set(words(siteText));
  const named = new Set([m.category, ...m.synonyms].flatMap(words));
  if (named.size === 0) return 0;
  let found = 0;
  for (const w of named) if (said.has(w)) found += 1;
  return found / named.size;
}

/** How much more of its own name the site must carry for a new market to be
 *  "clearly better on evidence" and replace the standing one at once. */
export const CLEARLY_BETTER = 0.5;

/**
 * The market after one pass's conclusion.
 *
 * - The founder's category stands: nothing is adopted.
 * - No market concluded yet: the fresh one is adopted.
 * - The same market again: the standing one is kept, and a pending one is
 *   forgotten.
 * - A different market seen the pass before as well, or clearly better
 *   supported by the site's own words: adopted.
 * - Otherwise it waits as `pending` for the next pass.
 *
 * `standing` is the category passes measure today (`sites.category`), which
 * a site that never had a conclusion still has — set at setup before #1185.
 */
export function settleMarket(a: {
  stored: StoredMarketWithChange;
  standing: string | null;
  fresh: MarketFields;
  siteText: string;
  scanId: string;
  at: Date;
}): { next: StoredMarketWithChange; adopted: boolean } {
  const { stored, fresh } = a;
  if (stored.categoryOverridden) return { next: stored, adopted: false };

  const adopt = (): { next: StoredMarketWithChange; adopted: boolean } => {
    const from = stored.current?.category ?? a.standing;
    const moved = from === null || !sameMarket({ category: from, synonyms: [] }, fresh);
    return {
      next: {
        ...stored,
        current: { ...fresh, rivals: stored.current?.rivals ?? [] },
        adoptedAt: a.at.toISOString(),
        pending: null,
        lastChange: moved
          ? {
              scanId: a.scanId,
              at: a.at.toISOString(),
              category: { from, to: fresh.category, reason: fresh.categoryReason },
              added: [],
              dropped: [],
            }
          : null,
      },
      adopted: true,
    };
  };

  const current = stored.current;
  if (current === null) return adopt();
  if (sameMarket(current, fresh)) {
    return { next: { ...stored, pending: null }, adopted: false };
  }
  if (stored.pending !== null && sameMarket(stored.pending, fresh)) return adopt();
  if (support(fresh, a.siteText) - support(current, a.siteText) >= CLEARLY_BETTER) return adopt();
  return { next: { ...stored, pending: { ...fresh, rivals: [] } }, adopted: false };
}

/**
 * The rivals after one pass's conclusion (SPEC §6, owner D65 of 2026-10-07,
 * issue 1303). `fresh` is every rival the pass concluded, more than five
 * where it found more: the ones buyers search for first where their volume
 * was read (D50), then closest first. The five D50 would choose from it are
 * what the pass *wants*; the set moves towards them one careful step at a
 * time, so one pass's noise never swaps a rival:
 *
 * - A rival in force that the pass left out stays, and is remembered as
 *   left out. It is dropped only when the next pass leaves it out as well.
 * - A new rival enters at once only where a place is free and buyers search
 *   it more than the weakest rival in force; otherwise it waits one pass,
 *   and enters on the next pass that wants it again, where a place is free.
 * - Never more than `RIVALS_MAX`.
 *
 * A site with no rivals yet takes the pass's own. A pass that concluded
 * none changes nothing, and the founder's own set stands.
 */
export function settleRivals(a: {
  stored: StoredMarketWithChange;
  standing: readonly string[];
  fresh: readonly RivalConclusion[];
  scanId: string;
  at: Date;
}): { next: StoredMarketWithChange; rivals: readonly string[]; changed: boolean } {
  const { stored } = a;
  if (stored.rivalsOverridden || stored.current === null || a.fresh.length === 0) {
    return { next: stored, rivals: a.standing, changed: false };
  }
  // D50: the rivals buyers search for are chosen first; among those, and
  // then among the rest, a standing one before a new one.
  const standing = (r: RivalConclusion): boolean => a.standing.includes(r.domain);
  const wanted = [
    ...a.fresh.filter((r) => searched(r.volume) && standing(r)),
    ...a.fresh.filter((r) => searched(r.volume) && !standing(r)),
    ...a.fresh.filter((r) => !searched(r.volume) && standing(r)),
    ...a.fresh.filter((r) => !searched(r.volume) && !standing(r)),
  ].slice(0, RIVALS_MAX);
  const wants = new Set(wanted.map((r) => r.domain));

  // A rival in force as this pass read it, else as it is stored.
  const held = new Map(stored.current.rivals.map((r) => [r.domain, r]));
  const read = new Map(a.fresh.map((r) => [r.domain, r]));
  const recordOf = (domain: string): RivalConclusion =>
    read.get(domain) ?? held.get(domain) ?? { domain, name: domain, basis: "same_job", reason: "" };

  const leftOutBefore = new Set(stored.rivalsLeftOut ?? []);
  const kept: string[] = [];
  const leftOut: string[] = [];
  const dropped: string[] = [];
  for (const domain of a.standing) {
    if (wants.has(domain)) kept.push(domain);
    else if (leftOutBefore.has(domain)) dropped.push(domain);
    else {
      kept.push(domain);
      leftOut.push(domain);
    }
  }

  const weakest = Math.min(...kept.map((domain) => recordOf(domain).volume ?? 0));
  const waitedBefore = new Set(stored.rivalsWaiting ?? []);
  const entering: RivalConclusion[] = [];
  const waiting: string[] = [];
  for (const rival of wanted) {
    if (a.standing.includes(rival.domain)) continue;
    const room = kept.length + entering.length < RIVALS_MAX;
    const outranks = kept.length === 0 || (searched(rival.volume) && (rival.volume ?? 0) > weakest);
    if (room && (outranks || waitedBefore.has(rival.domain))) entering.push(rival);
    else waiting.push(rival.domain);
  }

  // The order the pass read them in — most searched first (D50) — with a
  // rival it did not read placed by the volume it holds.
  const order = new Map(a.fresh.map((r, i) => [r.domain, i]));
  const ordered = [...kept.map(recordOf), ...entering]
    .map((rival, i) => ({ rival, i }))
    .sort((x, y) => {
      const sx = searched(x.rival.volume);
      const sy = searched(y.rival.volume);
      if (sx !== sy) return sx ? -1 : 1;
      if (sx && x.rival.volume !== y.rival.volume) return (y.rival.volume ?? 0) - (x.rival.volume ?? 0);
      return (order.get(x.rival.domain) ?? a.fresh.length + x.i) - (order.get(y.rival.domain) ?? a.fresh.length + y.i);
    })
    .map((entry) => entry.rival);
  const domains = ordered.map((r) => r.domain);
  const changed = entering.length > 0 || dropped.length > 0;

  const sameScan = stored.lastChange?.scanId === a.scanId ? stored.lastChange : null;
  return {
    next: {
      ...stored,
      current: { ...stored.current, rivals: ordered },
      rivalsLeftOut: leftOut,
      rivalsWaiting: waiting,
      lastChange: changed
        ? {
            scanId: a.scanId,
            at: a.at.toISOString(),
            category: sameScan?.category ?? null,
            added: entering,
            dropped,
          }
        : (stored.lastChange ?? null),
    },
    rivals: domains,
    changed,
  };
}

/**
 * Whether setup's saved rivals are the founder's own (owner D55 of
 * 2026-10-06, issue 1281): only adding or removing one is their choice
 * (D28). `shown` is what the step showed — ReachKit's own rivals as the
 * site held them, which may be fewer than it concluded. Saving those as
 * they are changes nothing, and a set put back to the concluded one hands
 * the rivals back to ReachKit.
 */
export function setupRivalsOverridden(a: {
  marked: boolean;
  shown: readonly string[];
  concluded: readonly string[];
  answer: readonly string[];
}): boolean {
  const same = (one: readonly string[], other: readonly string[]): boolean =>
    new Set(one).size === new Set(other).size && one.every((domain) => other.includes(domain));
  if (same(a.answer, a.shown)) return a.marked;
  return !same(a.answer, a.concluded);
}
