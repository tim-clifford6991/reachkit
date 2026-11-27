// SPEC §7 *Pages left*: a weekly pass short of WEEK_RESEARCH.rowsMax writable rows offers the site's stored, measured searches,
// right-sized first, to the pass's one fit call, so a short week fills from evidence and a dry one says which sources it tried.
import { WEEK_RESEARCH } from "@/lib/config/constants";
import type { Language, Locale } from "@/lib/locale/locales";
import { placeOf } from "@/lib/locale/place";
import type { MarketConclusion } from "@/lib/market/infer/types";
import { placelessSeeds } from "@/lib/market/questions/offerings";
import { marketSeeds } from "@/lib/market/questions/measured";
import { buyTopUp, type TopUpBought, type TopUpSpend } from "@/lib/market/questions/top-up-buy";
import { seedLadder } from "@/lib/market/questions/widen";
import { classifyIntent } from "@/lib/market/questions/select";
import { malformedSearch } from "@/lib/market/questions/well-formed";
import type { StoredReport } from "@/lib/scan/report";
import { queryKey } from "../cluster";
import { demandBand, difficultyBand } from "../winnability/band";
import { qualifyingDemand } from "../winnability/bars";
import { OUTSIZED, type Winnability } from "../types";
import { composedSearches, namesOwnOnly, noLongerRelevant, rivalBrandOnly, sourceOf, type AskedTopic, type ProposedTopic } from "./topics";

/** 1: a stored keyword row; 2: a row the top-up bought; 3: a question source (asked, written from prompts, composed) priced by a row. */
export type TopUpSource = 1 | 2 | 3;
export type TopUpTopic = ProposedTopic & { topUp: TopUpSource; band: Winnability };
const REASONS = ["not_a_topic", "unmeasured", "not_needed", "low_fit"] as const;
export type TopUpReason = (typeof REASONS)[number];

/** Whether it fired, the writable rows before it, each source's offers, additions and rejections, and what it bought. */
export interface TopUpRecord { fired: boolean; have: number; sources: Record<TopUpSource, { offered: number; added: number }>; rejected: Record<TopUpReason, number>; bought?: Omit<TopUpBought, "suggestions" | "volumes"> }

export function topUpRecord(have: number): TopUpRecord {
  return {
    fired: have < WEEK_RESEARCH.rowsMax,
    have,
    sources: { 1: { offered: 0, added: 0 }, 2: { offered: 0, added: 0 }, 3: { offered: 0, added: 0 } },
    rejected: Object.fromEntries(REASONS.map((reason) => [reason, 0])) as Record<TopUpReason, number>,
  };
}

type TopUpArgs = {
  record: TopUpRecord;
  report: StoredReport;
  market: MarketConclusion | null;
  ownRanked: number;
  language: Language;
  own: readonly string[];
  rivals: readonly string[];
  written: readonly string[];
  asked: readonly AskedTopic[];
  taken: readonly string[];
  area: MarketConclusion["serves"] | null;
  max: number;
  bought?: TopUpBought;
  /** Collects each candidate rejected only for want of a measured volume. */
  unpriced?: string[];
};

/** The 0¢ offers; where they fall short of what the week needs, they are bought for under the top-up's own cap. */
export async function topUpWithPurchase(spend: TopUpSpend | undefined, a: TopUpArgs & { locale: Locale }): Promise<TopUpTopic[]> {
  const free = topUpTopics(a);
  const profile = a.report.market.kind === "unmeasured" ? null : a.report.market.value.profile;
  if (spend === undefined || !a.record.fired || free.length >= wanted(a)) return free;
  const trial = (bought: TopUpBought, unpriced?: string[]) => topUpTopics({ ...a, record: topUpRecord(a.record.have), bought, ...(unpriced === undefined ? {} : { unpriced }) });
  const seeds = profile === null ? [] : seedLadder(profile, a.market?.category, a.market?.synonyms ?? [], marketSeeds(a.market));
  // A purchase that cannot run leaves the week its 0¢ offers, never a failed pass.
  const bought = await spend((c) => buyTopUp(c, { seeds, ownRanked: a.ownRanked, locale: a.locale, enough: (b) => trial(b).length >= wanted(a), unpriced: (b) => { const out: string[] = []; trial(b, out); return out; } })).catch(() => null);
  if (bought === null) {
    a.record.bought = { seeds: [], cents: 0, degraded: "failed" };
    return free;
  }
  Object.assign(a.record, topUpRecord(a.record.have), { bought: { seeds: bought.seeds, cents: bought.cents, ...(bought.degraded === undefined ? {} : { degraded: bought.degraded }) } });
  return topUpTopics({ ...a, bought });
}

/** Three offers a missing row, as the fit call refuses some, inside the room the call has left. */
const wanted = (a: Pick<TopUpArgs, "max" | "record">) => Math.max(0, Math.min(a.max, 3 * (WEEK_RESEARCH.rowsMax - a.record.have)));

/** Pure. The searches a short site's top-up offers, by source, winnable before reach before outsized, then by volume. */
export function topUpTopics(a: TopUpArgs): TopUpTopic[] {
  if (!a.record.fired) return [];
  const brands = [...a.own, ...a.rivals];
  const profile = a.report.market.kind === "unmeasured" ? null : a.report.market.value.profile;
  const stored = new Map<string, { volume: number; difficulty: number | null; topUp: 1 | 2 }>();
  const keep = (query: string, volume: number, difficulty: number | null = null, topUp: 1 | 2 = 1) => volume > 0 && !stored.has(queryKey(query)) && stored.set(queryKey(query), { volume, difficulty, topUp });
  for (const row of a.report.market.kind === "unmeasured" ? [] : a.report.market.value.suggestions) keep(row.keyword, row.volume, row.difficulty ?? null);
  for (const term of a.market?.terms ?? []) if (term.polluted !== true) keep(term.term, term.volume);
  for (const [search, volume] of Object.entries(a.market?.demand?.searches ?? {})) keep(search, volume);
  for (const row of a.bought?.suggestions ?? []) keep(row.keyword, row.volume, row.difficulty ?? null, 2);
  const priced = new Map(Object.entries(a.bought?.volumes ?? {}).map(([query, volume]) => [queryKey(query), { volume, difficulty: null }]));

  // Profile terms crossed with market terms, as the market's own composed searches are worded.
  const composed: string[] = [];
  if (a.market !== null) {
    const places = [a.market.serves ?? null, a.area, profile === null ? null : placeOf(profile.town)].filter((place) => place !== null && place !== undefined);
    const categories = [
      ...(a.market.terms ?? []).filter((term) => term.polluted !== true).map((term) => term.term),
      ...(profile === null ? [] : placelessSeeds({ ...profile, language: a.language }, places)),
    ];
    const lines = [a.market, ...categories.map((category) => ({ ...a.market!, category, synonyms: [], notOurMarket: [] }))];
    for (const line of lines) composed.push(...composedSearches(line, a.language).map((search) => search.query));
  }
  const offers: { query: string; topUp: TopUpSource; asked?: AskedTopic; composed?: true }[] = [
    ...[...stored].map(([query, read]) => ({ query, topUp: read.topUp })),
    ...a.written.map((query) => ({ query, topUp: 3 as const })),
    ...a.asked.map((topic) => ({ query: topic.query, topUp: 3 as const, asked: topic })),
    ...composed.map((query) => ({ query, topUp: 3 as const, composed: true as const })),
  ];

  const seen = new Set(a.taken.map(queryKey));
  const ceiling = qualifyingDemand(a.ownRanked);
  const out: TopUpTopic[] = [];
  const reasonOf = (key: string, read: { volume: number; difficulty: number | null } | undefined): TopUpReason | Winnability => {
    const named = { market: a.market, own: a.own, rivals: a.rivals };
    if (malformedSearch(key, a.market?.rivals) !== null || rivalBrandOnly(key, named) || namesOwnOnly(key, named) || noLongerRelevant(key, named) !== null || (profile !== null && classifyIntent(key, profile) === "own_brand")) return "not_a_topic";
    if (read === undefined) {
      a.unpriced?.push(key);
      return "unmeasured";
    }
    // A search under the floor ranks by its demand, and one too big for the site ranks last; neither is dropped.
    const band = difficultyBand({ difficulty: read.difficulty, ownRanked: a.ownRanked }) ?? demandBand({ volume: read.volume, ownRanked: a.ownRanked });
    return read.volume > ceiling ? OUTSIZED : band;
  };
  for (const offer of offers) {
    const key = queryKey(offer.query);
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    const read = stored.get(key) ?? priced.get(key);
    const band = reasonOf(key, read);
    if (band === "not_a_topic" || band === "unmeasured") a.record.rejected[band] += 1;
    else out.push({ query: key, source: sourceOf(key, { brands }), volume: read!.volume, difficulty: read!.difficulty, rival: null, topUp: offer.topUp, band, ...(offer.asked === undefined ? {} : { asked: { term: offer.asked.term, serpAt: offer.asked.serpAt } }), ...(offer.composed ?? false ? { composed: true as const } : {}) });
  }
  const order = (topic: TopUpTopic) => topic.topUp * 10 + ["winnable", "reach", OUTSIZED].indexOf(topic.band);
  const ranked = out.sort((x, y) => order(x) - order(y) || (y.volume ?? 0) - (x.volume ?? 0));
  const offered = ranked.slice(0, wanted(a));
  a.record.rejected.not_needed += ranked.length - offered.length;
  for (const topic of offered) a.record.sources[topic.topUp].offered += 1;
  return offered;
}
