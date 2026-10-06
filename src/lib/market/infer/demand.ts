// src/lib/market/infer/demand.ts — rivals weighed by brand search volume
// (SPEC §6, owner D50 of 2026-10-05, issue 1271).
//
// The evidence that names a rival says it competes; it does not say anyone
// looks for it. reachkit.app's concluded rivals were AEO Engine (70
// searches a month) and MaxAEO (none), while buyers search Profound (6,600),
// Peec AI (2,400) and Otterly (720) (`docs/walk/titles-and-vocabulary.md`),
// and its pages were aimed at comparisons nobody types. So each on-market
// candidate carries its brand's volume, and the searched ones come first.
//
// Pure: no I/O. `read-demand.ts` buys the volumes.
import { RIVAL_DEMAND } from "@/lib/config/constants";
import type { BrandDemand, MarketConclusion, RivalConclusion } from "./types";

const key = (text: string): string => text.toLowerCase().replace(/\s+/g, " ").trim();

/** Whether a brand with this volume is one buyers search for. A volume
 *  never read is not. */
export function searched(volume: number | undefined): boolean {
  return volume !== undefined && volume >= RIVAL_DEMAND.MIN_VOLUME;
}

/** The keywords a rival's brand volume is read under: what the conclusion
 *  says buyers type, else — a rival concluded before D50 — its name. */
export function brandKeywords(rival: Pick<RivalConclusion, "name" | "searchNames">): string[] {
  return (rival.searchNames ?? [rival.name]).map(key).filter(Boolean);
}

/** The keywords the business's own brand is read under: its domain's label
 *  and its site name where that is a short name. Its volume is the larger. */
export function ownKeywords(a: { domain: string; siteName: string | null }): string[] {
  const label = key(a.domain.replace(/^www\./, "").split(".")[0] ?? "");
  const name = key(a.siteName ?? "");
  const out = [label, name.split(" ").length <= 3 ? name : ""].filter((k) => k.length >= 3);
  return [...new Set(out)];
}

/** Whether a stored read is too old to stand, or was never made. */
function stale(demand: BrandDemand | undefined, at: Date): boolean {
  if (demand === undefined) return true;
  const read = Date.parse(demand.at);
  return Number.isNaN(read) || at.getTime() - read >= RIVAL_DEMAND.REFRESH_DAYS * 86_400_000;
}

/** The keywords a pass still has to buy: every one where the stored read
 *  is older than `REFRESH_DAYS` or was never made, else the ones it does
 *  not hold. */
export function keywordsOwed(a: {
  demand: BrandDemand | undefined;
  rivals: readonly Pick<RivalConclusion, "name" | "searchNames">[];
  own: readonly string[];
  at: Date;
}): string[] {
  const wanted = [...new Set([...a.own, ...a.rivals.flatMap(brandKeywords)])];
  const held = stale(a.demand, a.at) ? {} : (a.demand?.brands ?? {});
  return wanted.filter((keyword) => held[keyword] === undefined);
}

/** What the market holds after a read of `bought`: the fresh volumes over
 *  the ones it held and may still keep, and the business's own brand from
 *  them. A keyword the vendor returned no row for has no searches. */
export function mergeDemand(a: {
  demand: BrandDemand | undefined;
  bought: readonly string[];
  volumes: readonly { keyword: string; searchVolume: number }[];
  own: readonly string[];
  at: Date;
}): BrandDemand {
  const old = stale(a.demand, a.at);
  const fresh = new Map(a.volumes.map((row) => [key(row.keyword), Math.max(0, row.searchVolume)]));
  const brands: Record<string, number> = old ? {} : { ...(a.demand?.brands ?? {}) };
  for (const keyword of a.bought) brands[key(keyword)] = fresh.get(key(keyword)) ?? 0;
  return {
    // Names added to a read that still stands keep its date, so the whole
    // list is read again together.
    at: old || a.demand === undefined ? a.at.toISOString() : a.demand.at,
    own: Math.max(0, ...a.own.map((keyword) => brands[keyword] ?? 0)),
    brands,
  };
}

/**
 * The candidates with their volume, the ones buyers search for first: most
 * searched first, and of two searched alike the one an AI answer or a top
 * ten names before the one named from knowledge. The rest follow in the
 * order the conclusion gave them, closest first.
 */
export function byDemand(rivals: readonly RivalConclusion[], demand: BrandDemand): RivalConclusion[] {
  const sighted = (r: RivalConclusion): number => (r.basis === "same_job" ? 1 : 0);
  return rivals
    .map((rival, order) => ({
      order,
      rival: { ...rival, volume: Math.max(0, ...brandKeywords(rival).map((keyword) => demand.brands[keyword] ?? 0)) },
    }))
    .sort((a, b) => {
      const sa = searched(a.rival.volume);
      const sb = searched(b.rival.volume);
      if (sa !== sb) return sa ? -1 : 1;
      if (!sa) return a.order - b.order;
      return b.rival.volume - a.rival.volume || sighted(a.rival) - sighted(b.rival) || a.order - b.order;
    })
    .map((entry) => entry.rival);
}

/** Whether the business's own brand is one buyers search for (D50): only
 *  then is "{business} vs X" a target. */
export function ownSearched(market: Pick<MarketConclusion, "demand"> | null): boolean {
  return searched(market?.demand?.own);
}
