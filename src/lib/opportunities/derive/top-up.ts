// SPEC §7 *Pages left*: a weekly pass short of PLAN_DEPTH writable rows offers the site's stored, measured, right-sized
// searches to the pass's one fit call, so a short week fills from evidence and a dry one says which sources it tried.
import { PLAN_DEPTH, WRITE_VOLUME_FLOOR_PER_MONTH } from "@/lib/config/constants";
import { SHAPES } from "@/lib/locale/language";
import type { Language } from "@/lib/locale/locales";
import { placeOf } from "@/lib/locale/place";
import type { MarketConclusion } from "@/lib/market/infer/types";
import { placelessSeeds } from "@/lib/market/questions/offerings";
import { classifyIntent } from "@/lib/market/questions/select";
import { malformedSearch } from "@/lib/market/questions/well-formed";
import type { StoredReport } from "@/lib/scan/report";
import { queryKey } from "../cluster";
import { demandBand, difficultyBand } from "../winnability/band";
import { qualifyingDemand } from "../winnability/bars";
import type { Winnability } from "../types";
import { composedSearches, namesOwnOnly, noLongerRelevant, rivalBrandOnly, sourceOf, type AskedTopic, type ProposedTopic } from "./topics";

/** 1: a stored keyword row; 3: a question source (asked, written from prompts, composed) priced by a stored row. */
export type TopUpSource = 1 | 3;
export type TopUpTopic = ProposedTopic & { topUp: TopUpSource; band: Winnability };
const REASONS = ["not_a_topic", "comparison", "unmeasured", "under_floor", "outsized", "not_needed", "low_fit"] as const;
export type TopUpReason = (typeof REASONS)[number];

/** Whether it fired, the writable rows before it, and each source's offers, additions and rejections. */
export interface TopUpRecord { fired: boolean; have: number; sources: Record<TopUpSource, { offered: number; added: number }>; rejected: Record<TopUpReason, number> }

export function topUpRecord(have: number): TopUpRecord {
  return {
    fired: have < PLAN_DEPTH,
    have,
    sources: { 1: { offered: 0, added: 0 }, 3: { offered: 0, added: 0 } },
    rejected: Object.fromEntries(REASONS.map((reason) => [reason, 0])) as Record<TopUpReason, number>,
  };
}

/** Pure. The searches a short site's top-up offers, source 1 before source 3, winnable before reach, then by volume. */
export function topUpTopics(a: {
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
}): TopUpTopic[] {
  if (!a.record.fired) return [];
  const brands = [...a.own, ...a.rivals];
  const profile = a.report.market.kind === "unmeasured" ? null : a.report.market.value.profile;
  const stored = new Map<string, { volume: number; difficulty: number | null }>();
  const keep = (query: string, volume: number, difficulty: number | null = null) => volume > 0 && !stored.has(queryKey(query)) && stored.set(queryKey(query), { volume, difficulty });
  for (const row of a.report.market.kind === "unmeasured" ? [] : a.report.market.value.suggestions) keep(row.keyword, row.volume, row.difficulty ?? null);
  for (const term of a.market?.terms ?? []) if (term.polluted !== true) keep(term.term, term.volume);
  for (const [search, volume] of Object.entries(a.market?.demand?.searches ?? {})) keep(search, volume);

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
    ...[...stored.keys()].map((query) => ({ query, topUp: 1 as const })),
    ...a.written.map((query) => ({ query, topUp: 3 as const })),
    ...a.asked.map((topic) => ({ query: topic.query, topUp: 3 as const, asked: topic })),
    ...composed.map((query) => ({ query, topUp: 3 as const, composed: true as const })),
  ];

  const seen = new Set(a.taken.map(queryKey));
  const ceiling = qualifyingDemand(a.ownRanked);
  const out: TopUpTopic[] = [];
  const reasonOf = (key: string, read: { volume: number; difficulty: number | null } | undefined): TopUpReason | Exclude<Winnability, "not-yet"> => {
    const named = { market: a.market, own: a.own, rivals: a.rivals };
    if (malformedSearch(key, a.market?.rivals) !== null || rivalBrandOnly(key, named) || namesOwnOnly(key, named) || noLongerRelevant(key, named) !== null || (profile !== null && classifyIntent(key, profile) === "own_brand")) return "not_a_topic";
    // A comparison or listicle is what the out-of-reach hold waits on, so it never fills a short week.
    if (SHAPES.comparison.test(key) || SHAPES.best.test(key)) return "comparison";
    if (read === undefined) return "unmeasured";
    if (read.volume < WRITE_VOLUME_FLOOR_PER_MONTH) return "under_floor";
    const band = difficultyBand({ difficulty: read.difficulty, ownRanked: a.ownRanked }) ?? demandBand({ volume: read.volume, ownRanked: a.ownRanked });
    return read.volume > ceiling || band === "not-yet" ? "outsized" : band;
  };
  for (const offer of offers) {
    const key = queryKey(offer.query);
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    const read = stored.get(key);
    const band = reasonOf(key, read);
    if (band !== "winnable" && band !== "reach") a.record.rejected[band] += 1;
    else out.push({ query: key, source: sourceOf(key, { brands }), volume: read!.volume, rival: null, topUp: offer.topUp, band, ...(offer.asked === undefined ? {} : { asked: { term: offer.asked.term, serpAt: offer.asked.serpAt } }), ...(offer.composed ?? false ? { composed: true as const } : {}) });
  }
  const order = (topic: TopUpTopic) => topic.topUp * 10 + (topic.band === "winnable" ? 0 : 1);
  const ranked = out.sort((x, y) => order(x) - order(y) || (y.volume ?? 0) - (x.volume ?? 0));
  // Three offers a missing row, as the fit call refuses some, inside the room the call has left.
  const offered = ranked.slice(0, Math.max(0, Math.min(a.max, 3 * (PLAN_DEPTH - a.record.have))));
  a.record.rejected.not_needed += ranked.length - offered.length;
  for (const topic of offered) a.record.sources[topic.topUp].offered += 1;
  return offered;
}
