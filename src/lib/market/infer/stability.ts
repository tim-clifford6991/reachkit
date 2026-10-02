// src/lib/market/infer/stability.ts — when a conclusion replaces the one in
// force (#1185, owner 2026-10-02): "a newly inferred market replaces the
// stored one only when it is consistently better across two passes, or
// clearly better on evidence. Never on one noisy guess." Rivals are
// re-checked every pass, and a new or dropped rival is a change the product
// makes and reports. A field the founder overrode is never replaced.
//
// Pure: no I/O, no clock. The caller reads and writes `sites.market`.
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
 * The rivals after one pass's conclusion. `fresh` is every rival the pass
 * concluded, closest first, more than five where it found more. A standing
 * rival the pass concluded again keeps its place; new ones fill the rest, so
 * a set that is still right does not reshuffle week to week. A pass that
 * concluded none changes nothing, and the founder's own set stands.
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
  const kept = a.fresh.filter((r) => a.standing.includes(r.domain));
  const added = a.fresh.filter((r) => !a.standing.includes(r.domain));
  const chosen = [...kept, ...added].slice(0, RIVALS_MAX);
  const ordered = a.fresh.filter((r) => chosen.includes(r));
  const domains = ordered.map((r) => r.domain);
  const newOnes = ordered.filter((r) => !a.standing.includes(r.domain));
  const dropped = a.standing.filter((d) => !domains.includes(d));
  const changed = newOnes.length > 0 || dropped.length > 0;

  const sameScan = stored.lastChange?.scanId === a.scanId ? stored.lastChange : null;
  return {
    next: {
      ...stored,
      current: { ...stored.current, rivals: ordered },
      lastChange: changed
        ? {
            scanId: a.scanId,
            at: a.at.toISOString(),
            category: sameScan?.category ?? null,
            added: newOnes,
            dropped,
          }
        : (stored.lastChange ?? null),
    },
    rivals: domains,
    changed,
  };
}
