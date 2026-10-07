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
import { languagePack } from "@/lib/locale/language";
import type { Language } from "@/lib/locale/locales";
import { RIVAL_DEMAND } from "@/lib/config/constants";
import { comparisonName } from "@/lib/market/questions/well-formed";
import type { BrandDemand, MarketConclusion, RivalConclusion } from "./types";

const key = (text: string): string => text.toLowerCase().replace(/\s+/g, " ").trim();

/** Whether a brand with this volume is one buyers search for. A volume
 *  never read is not. */
export function searched(volume: number | undefined): boolean {
  return volume !== undefined && volume >= RIVAL_DEMAND.MIN_VOLUME;
}

/** Whether a rival does the business's own job, for its own buyer (issue
 *  1314). One the conclusion did not weigh is read as doing so. */
export function direct(rival: Pick<RivalConclusion, "closeness">): boolean {
  return rival.closeness !== "partial";
}

/** A domain's first label, lower-cased. */
function labelOf(domain: string): string {
  return key(domain.replace(/^www\./, "").split(".")[0] ?? "");
}

/**
 * Whether a one-word name needs a word beside it to mean its product (issue
 * 1285): its company's own domain holds the name with something added
 * ("mybrandi.ai", "tryprofound.com"), which is what a company registers
 * when the bare word is an ordinary word or a first name. "Brandi" was read
 * at 22,200 searches for the name; "brandi ai" has 260.
 */
export function nameNeedsQualifier(name: string, domain: string): boolean {
  const bare = key(name);
  const label = labelOf(domain);
  return bare.length >= 3 && !bare.includes(" ") && label !== bare && label.includes(bare);
}

/** The keywords a rival's brand volume is read under: what the conclusion
 *  says buyers type, else — a rival concluded before D50 — its name. Never
 *  the bare name where that needs a qualifier: then the qualified forms,
 *  else the domain's own label. */
export function brandKeywords(rival: Pick<RivalConclusion, "name" | "searchNames"> & { domain?: string }): string[] {
  const names = (rival.searchNames ?? [rival.name]).map(key).filter(Boolean);
  if (rival.domain === undefined || !nameNeedsQualifier(rival.name, rival.domain)) return names;
  const qualified = names.filter((keyword) => keyword !== key(rival.name));
  return qualified.length > 0 ? qualified : [labelOf(rival.domain)];
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
  rivals: readonly Pick<RivalConclusion, "name" | "searchNames" | "domain">[];
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
  /** The comparison searches read in the same call (D64); kept apart from
   *  the brands. */
  searched?: readonly string[];
  volumes: readonly { keyword: string; searchVolume: number }[];
  own: readonly string[];
  at: Date;
}): BrandDemand {
  const old = stale(a.demand, a.at);
  const fresh = new Map(a.volumes.map((row) => [key(row.keyword), Math.max(0, row.searchVolume)]));
  const brands: Record<string, number> = old ? {} : { ...(a.demand?.brands ?? {}) };
  for (const keyword of a.bought) brands[key(keyword)] = fresh.get(key(keyword)) ?? 0;
  const searches: Record<string, number> = old ? {} : { ...(a.demand?.searches ?? {}) };
  for (const search of a.searched ?? []) searches[key(search)] = fresh.get(key(search)) ?? 0;
  return {
    // Names added to a read that still stands keep its date, so the whole
    // list is read again together.
    at: old || a.demand === undefined ? a.at.toISOString() : a.demand.at,
    own: Math.max(0, ...a.own.map((keyword) => brands[keyword] ?? 0)),
    brands,
    ...(Object.keys(searches).length > 0 ? { searches } : {}),
  };
}

/**
 * The comparison searches a set of rivals yields (SPEC §6, D50): "{rival}
 * alternatives" for each one, and either "{product} vs {rival}" for each
 * where the business's own brand is searched, or the `RIVAL_DEMAND.PAIRS`
 * most-searched set against each other. One derivation, so the searches a
 * pass reads the volume of (D64) are the searches it then proposes.
 * `searchedOnly` leaves out a rival nobody searches, which is what a topic
 * needs; the volume read asks about every candidate, searched or not yet
 * read.
 *
 * A rival is named by its name, never by its domain (issue 1314,
 * `comparisonName`).
 */
export function comparisonsOf(a: {
  rivals: readonly (Pick<RivalConclusion, "name" | "domain" | "searchNames"> & { volume?: number })[];
  product: string | null;
  ownSearched: boolean;
  searchedOnly: boolean;
  /** The language the searches are written in (D66). Absent is English. */
  language?: Language;
}): { query: string; rival: string }[] {
  const pack = languagePack(a.language ?? "en");
  const out: { query: string; rival: string }[] = [];
  const inDemand = a.rivals.filter((rival) => searched(rival.volume)).sort((x, y) => (y.volume ?? 0) - (x.volume ?? 0));
  for (const rival of a.searchedOnly ? inDemand : a.rivals) out.push({ query: pack.alternativesSearch(comparisonName(rival)), rival: rival.domain });
  if (a.product !== null && a.ownSearched) {
    for (const rival of a.rivals) out.push({ query: pack.versusSearch(a.product, comparisonName(rival)), rival: rival.domain });
  } else {
    const leading = inDemand.slice(0, RIVAL_DEMAND.PAIRS);
    leading.forEach((first, i) => {
      for (const second of leading.slice(i + 1)) out.push({ query: pack.versusSearch(comparisonName(first), comparisonName(second)), rival: first.domain });
    });
  }
  return out;
}

/** The comparison searches whose volume the market does not hold: every one
 *  where the brands are older than their 30 days, as the brands are. */
export function searchesOwed(a: { demand: BrandDemand | undefined; wanted: readonly string[]; at: Date }): string[] {
  const held = stale(a.demand, a.at) ? {} : (a.demand?.searches ?? {});
  return [...new Set(a.wanted.map(key))].filter((search) => held[search] === undefined);
}

/**
 * The candidates with their volume, the ones buyers search for first: most
 * searched first, and of two searched alike the one an AI answer or a top
 * ten names before the one named from knowledge. The rest follow in the
 * order the conclusion gave them, closest first.
 *
 * Demand orders rivals that do the same job; it never lets a different
 * product lead because it is famous (SPEC §6, 2026-10-07, issue 1314). A
 * scheduling product's most-searched "rival" was a free poll tool at
 * 110,000 searches a month. So a searched rival that does only part of the
 * job comes after every searched rival that does all of it.
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
      if (direct(a.rival) !== direct(b.rival)) return direct(a.rival) ? -1 : 1;
      return b.rival.volume - a.rival.volume || sighted(a.rival) - sighted(b.rival) || a.order - b.order;
    })
    .map((entry) => entry.rival);
}

/** Whether the business's own brand is one buyers search for (D50): only
 *  then is "{business} vs X" a target. */
export function ownSearched(market: Pick<MarketConclusion, "demand"> | null): boolean {
  return searched(market?.demand?.own);
}
