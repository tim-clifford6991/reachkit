// The derivation, end to end: derive deterministically, label through the model, persist; nothing after deriving adds a candidate.
// An empty `created` is a success with counts, never a throw: the counters tell "supply ran out" from "unreadable".
import type { Locale } from "@/lib/locale/locales";
import { siteLocale } from "@/lib/locale/site";
import type { KnowledgeDigest } from "@/lib/site-profile/knowledge/read";
import { ASKED_TOPICS, PLAN_DEPTH, TOPIC_FIT, WEEK_RESEARCH } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { ownSearched } from "@/lib/market/infer/demand";
import type { MarketConclusion } from "@/lib/market/infer/types";
import { malformedSearch } from "@/lib/market/questions/well-formed";
import { measured, type Measured } from "@/lib/measure/measured";
import type { StoredReport } from "@/lib/scan/report";
import type { InventoryRow } from "@/lib/site-profile/types";
import type { RankedCounts } from "../winnability/counts";
import { pageTypeOf } from "../page-type";
import { addRejections, isRetarget, noRejections, type Evidence, type Opportunity, type RejectionCount } from "../types";
import type { Candidate } from "./candidate";
import { earnCandidates } from "./earn";
import { fixCandidates } from "./fix";
import { improveCandidates } from "./improve";
import { brandTokensOf, collapse, queryKey, topTenRowsOf, topTensOf } from "../cluster";
import { rebandFor } from "../readiness";
import { opportunityStore, readOpportunity, type DismissedSearch } from "../store";
import { persist } from "./persist";
import { judgeSameQuestion } from "./same-question";
import { refineType } from "./typing";
import { applyKnownContent, type KnownContentGate } from "./known";
import { writeCandidates } from "./write";
import { judgeFit, type FitJudgement, type FitSearch } from "./fit";
import { askedOfReport, askedSupply, askedTopics, brandsOf, type ProposedTopic, candidateFor, namesOwnOnly, noLongerRelevant, productsNamed, proposedTopics, rivalBrandOnly, rivalNamesOf, rivalPriceOf, sourceOf } from "./topics";
import { judgeTyped, writeBuyerSearches } from "./buyer-searches";
import { ledgerSourceOf, supplyLedger, writable, type LedgerSource, type SupplyLedger } from "./ledger";
import { topUpRecord, topUpWithPurchase, type TopUpTopic } from "./top-up";
import type { TopUpSpend } from "@/lib/market/questions/top-up-buy";
import { competitorWins } from "@/lib/market/competitor-wins";
import type { RankedRow } from "@/lib/vendors/dataforseo/types";
import { EARNING, earnedSearches, pageSearchOf } from "@/lib/measure/page-reading";
import { closestPrompt } from "../intent";

export interface DeriveInput {
  siteId: string;
  /** The language the searches are written in; absent, the site's stored one. */
  locale?: Locale;
  scanId: string;
  report: StoredReport;
  /** Unmeasured reads as the cold-start 0, so every band stays assignable for a site that ranks for nothing. */
  ownRanked: Measured<number>;
  /** One ranked count per sized domain; a missing entry is `undeterminable`, never 0. */
  rankedCounts: RankedCounts;
  /** The hosted destination's host, whose pages get no `fix_page`. */
  hostedHost?: string | null;
  /** The pages the crawl read, which Improve matches to the market's questions. */
  inventory?: readonly InventoryRow[];
  /** The net-new gate; absent converts and refuses nothing, rather than calling every topic new. */
  known?: KnownContentGate;
  /** The market fit is judged against; absent, fit reads the report's profile and only read searches are proposed. */
  market?: MarketConclusion | null;
  knowledge?: KnowledgeDigest | null;
  /** `sites.competitors`: still rivals an answer may cite where the report left them out. */
  competitors?: readonly string[];
  /** The unbranded tracked prompts the buyer's searches are written from. */
  prompts?: readonly string[];
  /** Where the business serves, which no offering's topic may name. */
  area?: MarketConclusion["serves"];
  /** The weekly pass may top a short site up, buying under its own cap (SPEC §7 *Pages left*); the deep pass and the evening never do. */
  topUp?: { spend?: TopUpSpend };
  /** The held rows the commit refuses as a live page's twin, which supply does not count. */
  liveTwins?: ReadonlySet<string>;
  /** Each competitor's ranked rows as its sizing cached them; absent reads as none read. */
  rivalRows?: ReadonlyMap<string, readonly RankedRow[]>;
}

/** How many held rows one pass's judgement may also score. */
const HELD_ROWS_JUDGED = 20;

export interface DeriveOutcome {
  created: Opportunity[];
  /** Targets looked at, whether or not they became opportunities. */
  assessed: number;
  rejected: RejectionCount;
  supply: SupplyLedger;
}

export function ownRankedValue(ownRanked: Measured<number>): number {
  return ownRanked.kind === "unmeasured" ? 0 : ownRanked.value;
}

/** One page per search: handed candidates in precedence (Improve, Earn, Write), keeps the first for each search. Pure. */
export function onePerSearch(ordered: readonly Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return ordered.filter((candidate) => {
    const key = candidate.targetQuery?.trim().toLowerCase();
    if (key === undefined || key === "") return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function deriveOpportunities(
  c: CostContext,
  a: DeriveInput
): Promise<DeriveOutcome> {
  const ownRanked = ownRankedValue(a.ownRanked);
  const base = { siteId: a.siteId, scanId: a.scanId, report: a.report };

  const market = a.market ?? null;
  const locale = a.locale ?? (await siteLocale(a.siteId));
  const named = brandsOf({ report: a.report, market });
  // The business competitors in force; the search competitors are the report's.
  const business = [...(market?.rivals.map((rival) => rival.domain) ?? []), ...(a.competitors ?? [])];
  const brands = [...named.own, ...named.rivals];
  const write = writeCandidates({
    ...base,
    ownRanked,
    rankedCounts: a.rankedCounts,
    marketRivals: business,
    brands,
  });
  const improve = improveCandidates({
    ...base,
    ownRanked,
    rankedCounts: a.rankedCounts,
    inventory: a.inventory ?? [],
  });
  const earn = earnCandidates({ ...base, ownRanked, rankedCounts: a.rankedCounts });
  const fix = fixCandidates({ ...base, hostedHost: a.hostedHost ?? null });

  const rejected = [write, improve, earn, fix]
    .map((result) => result.rejected)
    .reduce(addRejections, noRejections());
  const assessed = write.assessed + improve.assessed + earn.assessed + fix.assessed;

  // Before labelling, so the type is judged on the row that will be written: one page per search, then net-new.
  const planned = onePerSearch([...improve.candidates, ...earn.candidates, ...write.candidates]);
  const store = opportunityStore();
  const heldRows = await store.clusterable(a.siteId);
  const held = heldRows.map(readOpportunity);
  // A row the committed week dated keeps its day: no re-check this pass empties it (ruling 97).
  const dated = new Set(heldRows.filter((row) => row.planned_for != null).map((row) => row.id));

  // A rival's own price is never a page about the rival alone; it gives way to the product against that rival.
  const rivalNames = rivalNamesOf({ report: a.report, market });
  const comparisons: { query: string; rival: string }[] = [];
  const aRivalsPrice = (row: { family: Candidate["family"]; targetQuery: string | null }): boolean => {
    if (row.family !== "write" || row.targetQuery === null) return false;
    const priced = rivalPriceOf(row.targetQuery, { own: named.own, ownSearched: ownSearched(market), rivals: rivalNames, language: locale.language });
    if (priced === null) return false;
    if (priced.comparison !== null) comparisons.push({ query: priced.comparison, rival: priced.rival });
    return true;
  };
  // An undrafted, unretargeted open topic goes where it names a former rival or another market; an unknown store prunes nothing.
  const drafted = await store.draftedOpportunityIds(a.siteId).catch(() => null);
  const irrelevant = (row: (typeof held)[number]): boolean =>
    drafted !== null &&
    !drafted.has(row.id) &&
    row.targetQuery !== null &&
    !isRetarget(row) &&
    noLongerRelevant(row.targetQuery, { market, own: named.own }) !== null;
  // A search that is only a rival's brand is navigational, never a topic.
  const aRivalsBrand = (row: { targetQuery: string | null }): boolean =>
    row.targetQuery !== null && rivalBrandOnly(row.targetQuery, { market, own: named.own, rivals: named.rivals });
  // Nor is a search nobody would type as it stands.
  const notASearch = (row: { targetQuery: string | null }): boolean =>
    row.targetQuery !== null && malformedSearch(row.targetQuery, market?.rivals) !== null;
  const gone = new Set<string>();
  for (const row of held) {
    if (row.status !== "open") continue;
    const neverDrafted = drafted !== null && !drafted.has(row.id) && !isRetarget(row);
    if (aRivalsPrice(row) || irrelevant(row) || (neverDrafted && (aRivalsBrand(row) || notASearch(row)))) gone.add(row.id);
  }
  // A dismissed topic returns only on a higher measured volume, and a stopped one never.
  const dismissed = await store.dismissedSearches(a.siteId).catch(() => []);
  let stillDismissed = 0;
  const notDismissed = (candidate: Pick<Candidate, "targetQuery" | "volume">): boolean => {
    if (!dismissedUnchanged(candidate, dismissed)) return true;
    stillDismissed += 1;
    return false;
  };
  const ownNewPage = (candidate: Candidate): boolean => candidate.family === "write" && namesOwnOnly(candidate.targetQuery ?? "", named);
  const mine = planned.filter((candidate) => !aRivalsPrice(candidate) && !aRivalsBrand(candidate) && !notASearch(candidate) && !ownNewPage(candidate) && notDismissed(candidate));
  const derived: Candidate[] = [
    ...(a.known === undefined ? mine : applyKnownContent(mine, a.known)),
    ...fix.candidates,
  ];

  // One fit judgement a pass, over derived, proposed and unjudged open rows; stored on the row.
  const judgedHere = derived.filter((candidate) => candidate.family !== "fix" && candidate.targetQuery !== null);
  const written = await writeBuyerSearches(c, { market, prompts: a.prompts ?? [], brands, locale });
  // SPEC §6: what buyers were seen asking beside the site's searches, from this report's SERPs and the store, at 0¢.
  const stored = await store.askedBeside(a.siteId, ASKED_TOPICS.maxAgeDays).catch(() => []);
  const seen = [...askedOfReport(a.report), ...stored];
  const asked = askedTopics(seen, a.report.verdict.measuredAt);
  const ownSearches = [...planned.filter(ownNewPage).flatMap((row) => row.targetQuery ?? []), ...written, ...askedTopics(seen, a.report.verdict.measuredAt, Infinity).map((topic) => topic.query)];
  const ownBrand = new Set(ownSearches.filter((query) => namesOwnOnly(query, named)).map(queryKey)).size;
  const taken = [...derived, ...held].flatMap((row) => row.targetQuery ?? []);
  // The asked questions this pass would write unscored are scored in its one fit call, as no score is not planned.
  const unreached = askedSupply({ report: a.report, market, asked: seen, refused: [], taken: [...taken, ...held.flatMap((row) => row.absorbedQueries)], dismissed: dismissed.map((row) => row.query), now: a.report.verdict.measuredAt });
  const beyond = unreached.filter((topic) => !asked.some((one) => queryKey(one.query) === queryKey(topic.query))).length;
  const room = Math.max(0, TOPIC_FIT.maxCandidates - judgedHere.length - HELD_ROWS_JUDGED - beyond);
  const searchRivals = a.report.rivals.kind === "measured" ? a.report.rivals.value.map((rival) => rival.domain) : [];
  // SPEC §6 (owner, 2026-11-16): an earlier healthy pass's answers, as this pass checks its health after deriving and its late answers land later still.
  const answered = await import("@/lib/scan/health-record").then(({ healthyPrompts }) => healthyPrompts(a.siteId)).catch(() => null);
  const have = held.filter((row) => !gone.has(row.id) && !a.liveTwins?.has(row.id) && writable(row)).length;
  const topUp = a.topUp === undefined ? undefined : topUpRecord(have);
  const topping: TopUpTopic[] = topUp === undefined ? [] : await topUpWithPurchase(a.topUp?.spend, { record: topUp, report: a.report, market, ownRanked, language: locale.language, locale, ...named, written, asked: askedTopics(seen, a.report.verdict.measuredAt, Infinity), taken, area: a.area ?? null, max: room });
  const toppedUp = new Set<unknown>(topping);
  const earnedKeys = new Set([...taken, ...topping.map((topic) => topic.query)].map(queryKey));
  const earned = earnedTopics(await store.refreshPages(a.siteId).catch(() => []), {
    taken: earnedKeys,
    wordings: askedTopics(seen, a.report.verdict.measuredAt, Infinity).map((topic) => topic.query),
    refused: (query) => namesOwnOnly(query, named) || aRivalsBrand({ targetQuery: query }) || notASearch({ targetQuery: query }),
  }).slice(0, Math.max(0, room - topping.length));
  const { gaps, unworded } = competitorWins({ section: answered, competitors: [...business, ...searchRivals], ranked: a.rivalRows ?? new Map(), report: a.report, ownRanked: a.ownRanked, asked: askedTopics(seen, a.report.verdict.measuredAt, Infinity), taken: [...earnedKeys], market, ...named, max: room - topping.length - earned.length });
  const proposing = [...topping, ...earned, ...gaps, ...proposedTopics({
    report: a.report,
    market,
    taken: [...earnedKeys, ...gaps.map((gap) => gap.query)],
    ownRanked,
    max: room - topping.length - earned.length - gaps.length,
    comparisons,
    written,
    language: locale.language,
    asked,
    seen,
    short: have < PLAN_DEPTH,
    area: a.area ?? null,
  })];
  // Never judged again where a row on the search was dismissed (issue 1549).
  const offered = proposing.filter((topic) => {
    const volume = topic.volume === null ? null : measured(topic.volume, a.report.verdict.measuredAt);
    return notDismissed({ targetQuery: topic.query, volume });
  });

  // "Would a buyer search this?" over every unmeasured search; a seen-asked search needs no check, as Google showed it.
  const unmeasuredOffers = offered.filter((topic) => topic.volume === null && topic.asked === undefined);
  const unmeasuredRows = held.filter((row) => row.status === "open" && !gone.has(row.id) && !dated.has(row.id) && row.family === "write" && row.targetQuery !== null && row.source !== "ai_gap" && (row.volume === null || row.volume.kind === "unmeasured"));
  const typed = await judgeTyped(c, {
    searches: [...unmeasuredOffers.map((topic) => topic.query), ...unmeasuredRows.map((row) => row.targetQuery!)],
    market,
    brands,
    locale,
  });
  const proposals = offered.filter(
    (topic) => topic.volume !== null || topic.asked !== undefined || typed?.has(unmeasuredOffers.indexOf(topic)) === true
  );
  if (typed !== null) {
    unmeasuredRows.forEach((row, index) => {
      if (!typed.has(unmeasuredOffers.length + index)) gone.add(row.id);
    });
  }
  // An open comparison row written down unmeasured takes the volume this pass read for its search.
  const readVolumes = market?.demand?.searches ?? {};
  const readAt = new Date(market?.demand?.at ?? a.report.verdict.measuredAt);
  const existing: typeof held = [];
  for (const row of held) {
    if (gone.has(row.id)) continue;
    const read = row.targetQuery === null ? 0 : (readVolumes[queryKey(row.targetQuery)] ?? 0);
    const unmeasured = row.status === "open" && row.evidence.family === "write" && row.volume !== null && row.volume.kind === "unmeasured";
    if (!unmeasured || row.evidence.family !== "write" || read <= 0) {
      existing.push(row);
      continue;
    }
    const volume = measured(read, readAt);
    const evidence = { ...row.evidence, volume };
    await store.setVolume(row.id, read, evidence);
    existing.push({ ...row, volume, evidence });
  }

  const isNewPage = (row: { family: Opportunity["family"] }) => row.family === "write" || row.family === "earn";
  const open = existing.filter((row) => row.status === "open" && row.family !== "fix" && row.targetQuery !== null);
  // Every unscored row is judged, as it is held until it is; a new page judged without a passage is judged again, up to the cap.
  const unjudged = [
    ...open.filter((row) => (row.businessFit ?? null) === null),
    ...open.filter((row) => isNewPage(row) && (row.businessFit ?? 0) >= TOPIC_FIT.gate && !("fitFact" in row.evidence)).slice(0, HELD_ROWS_JUDGED),
  ];
  const sourceFor = (row: { targetQuery: string | null; source?: Candidate["source"] }) =>
    row.source ?? sourceOf(row.targetQuery ?? "", { brands, products: Object.keys(market?.demand?.brands ?? {}) });
  const writtenKeys = new Set(written.map(queryKey));
  const classOf = new Map<string, LedgerSource>();
  const classed = (topic: Parameters<typeof ledgerSourceOf>[0] & { query: string }): LedgerSource => {
    const source = ledgerSourceOf({ ...topic, written: writtenKeys.has(queryKey(topic.query)) });
    classOf.set(queryKey(topic.query), source);
    return source;
  };
  const derivedPages = judgedHere.filter(isNewPage);
  const derivedClasses = derivedPages.map((candidate) => classed({ query: candidate.targetQuery!, source: sourceFor(candidate) }));
  const offeredClasses = proposing.map(classed);
  const scoredAsked = unreached.filter((topic) => !proposals.some((one) => queryKey(one.query) === queryKey(topic.query)));
  // What already ranks for each search, from its stored top ten at 0¢: an angle promises what these titles do not.
  const ranked = topTenRowsOf(a.report);
  const ranks = (query: string): string[] => (ranked.get(queryKey(query))?.rows ?? []).slice(0, 5).map((row) => row.title);
  const searches: FitSearch[] = [
    ...judgedHere.map((candidate) => ({ query: candidate.targetQuery!, source: sourceFor(candidate), update: !isNewPage(candidate) })),
    ...unjudged.map((row) => ({ query: row.targetQuery!, source: sourceFor(row), update: !isNewPage(row) })),
    ...proposals.map((topic) => ({ query: topic.query, source: topic.source })),
    ...scoredAsked.map((topic) => ({ query: topic.query, source: topic.source })),
  ].map((search) => ({ ...search, ranks: ranks(search.query) }));
  const fits = await judgeFit(c, {
    searches,
    market,
    profile: a.report.market.kind === "unmeasured" ? null : a.report.market.value.profile,
    domain: a.report.domain,
    knowledge: a.knowledge ?? null,
    locale,
  });

  const angle = new Map<Candidate, string>();
  const scored = derived.map((candidate) => {
    if (candidate.family === "fix" || candidate.targetQuery === null) return candidate;
    // The source is the search's own, judged or not.
    const sourced = { ...candidate, source: sourceFor(candidate) };
    const judged = fits.get(judgedHere.indexOf(candidate));
    if (judged === undefined) return sourced;
    const withFit = withFact({ ...sourced, businessFit: judged.fit }, judged);
    if (judged.title !== null) angle.set(withFit, judged.title);
    return withFit;
  });
  for (const [index, row] of unjudged.entries()) {
    const judged = fits.get(judgedHere.length + index);
    if (judged === undefined) continue;
    const source = sourceFor(row);
    await store.setBusinessFit(row.id, judged.fit, source, pageTypeOf({ ...row, source }));
    if (isNewPage(row)) await store.setEvidence(row.id, withFact(row, judged).evidence);
  }
  // Fit ranks a proposal and gates only what the business does not sell; one the fit call left unanswered is kept unscored for the next pass.
  const proposed: Candidate[] = [];
  // An asked question judged off the business is never written, nor offered again unscored by the asked supply.
  const refused: string[] = [];
  // A top-up search is measured, so it is written at the gate, or unscored where the fit call gave none, up to the rows the week lacks.
  let lacking = WEEK_RESEARCH.rowsMax - have;
  for (const [index, topic] of proposals.entries()) {
    const judged = fits.get(judgedHere.length + unjudged.length + index);
    if (toppedUp.has(topic) && topUp !== undefined) {
      const source = (topic as TopUpTopic).topUp;
      if (judged !== undefined && judged.fit < TOPIC_FIT.gate) topUp.rejected.low_fit += 1;
      else if (lacking <= 0) topUp.rejected.not_needed += 1;
      else {
        const candidate = candidateFor(topic, { ...base, market, ownRanked });
        if (candidate === null) continue;
        proposed.push(judged === undefined ? { ...candidate, businessFit: null } : withFact({ ...candidate, businessFit: judged.fit, title: judged.title }, judged));
        topUp.sources[source].added += 1;
        // A topic a live page covers waits as that page's update, so it fills none of the rows the week lacks.
        if ((a.known?.covered(candidate) ?? (await a.known?.read?.(candidate)) ?? null) === null) lacking -= 1;
      }
      continue;
    }
    // An earned search is kept at the fit it was judged, so readiness holds a low one and an unscored one waits.
    if (topic.source === "earned") {
      const candidate = candidateFor(topic, { ...base, market, ownRanked });
      if (candidate !== null) proposed.push(judged === undefined ? { ...candidate, businessFit: null } : withFact({ ...candidate, businessFit: judged.fit, title: judged.title }, judged));
      continue;
    }
    if (judged !== undefined && judged.fit < TOPIC_FIT.gate) {
      if (topic.asked !== undefined) refused.push(topic.query);
      continue;
    }
    const candidate = candidateFor(topic, { ...base, market, ownRanked });
    if (candidate !== null) proposed.push(judged === undefined ? { ...candidate, businessFit: null } : withFact({ ...candidate, businessFit: judged.fit, title: judged.title }, judged));
  }
  // A question buyers asked beside this pass's proposals is written at the fit it was judged, as a section of its results page's topic.
  scoredAsked.forEach((topic, index) => {
    const judged = fits.get(judgedHere.length + unjudged.length + proposals.length + index);
    if (judged === undefined) return;
    if (judged.fit < TOPIC_FIT.gate) return void refused.push(topic.query);
    classed(topic);
    proposed.push(withFact({ ...candidateFor(topic, { ...base, market, ownRanked }), businessFit: judged.fit }, judged));
  });

  const labelled: Candidate[] = [];
  for (const candidate of scored) {
    // A target the business is not the answer to is stored with its reason and never written, so no label is bought.
    const fit = candidate.businessFit ?? null;
    if (fit !== null && fit < TOPIC_FIT.gate) {
      labelled.push(candidate);
      continue;
    }
    // Sequential, so the cost seam's cap is re-checked between calls.
    const refined = await refineType(c, candidate, locale.language);
    // The title is the page's angle for this buyer, as the fit judgement worded it against the market, not the keyword.
    const title = angle.get(candidate);
    labelled.push(title === undefined || refined.family === "improve" ? refined : { ...refined, title });
  }
  // A proposal's type is read off its own words and its title is the angle it was judged with, so it buys no label.
  labelled.push(...proposed);
  const questions = askedSupply({
    report: a.report,
    market,
    asked: seen,
    refused,
    taken: [...labelled.flatMap((row) => row.targetQuery ?? []), ...existing.flatMap((row) => [row.targetQuery ?? [], ...row.absorbedQueries].flat())],
    dismissed: dismissed.map((row) => row.query),
    now: a.report.verdict.measuredAt,
  }).map((topic) => candidateFor(topic, { ...base, market, ownRanked }));

  // One survivor per parent topic over held rows and this pass's, after labelling since the type decides precedence.
  // `today` re-bands held rows only where this pass measured the footprint; an unmeasured one would read as 0.
  const brandTokens = brandTokensOf(a.report);
  const measuredOwnRanked = a.ownRanked.kind === "unmeasured" ? null : a.ownRanked.value;

  // One URL per question: two searches are one topic where their stored top tens share four addresses or the judgement says so.
  const topTens = new Map(await store.topTens([...new Set(existing.map((row) => row.scanId))]));
  for (const [query, urls] of topTensOf(a.report)) topTens.set(query, urls);
  // Held open rows are judged too, against each other and every topic with a page behind it, published ones included.
  const judgedSame = await judgeSameQuestion(c, {
    searches: [
      ...labelled.filter(isNewPage).flatMap((candidate) => candidate.targetQuery ?? []),
      ...existing.filter((row) => row.status === "open" && isNewPage(row)).flatMap((row) => row.targetQuery ?? []),
    ],
    topics: existing.flatMap((row) => row.targetQuery ?? []),
    buyer: market?.buyer,
    angles: new Map([...existing, ...labelled].flatMap((row) => (row.targetQuery === null || row.title == null ? [] : [[queryKey(row.targetQuery), row.title] as const]))),
  });
  // Two searches that name different products are never one question, whatever the judgement says.
  const products = (query: string): string => productsNamed(query, { market, rivals: named.rivals });
  const sameQuestion = new Map([...judgedSame].filter(([search, sameAs]) => products(search) === products(sameAs)));

  const plan = collapse({
    existing,
    candidates: [...labelled, ...questions],
    brandTokens,
    topTens,
    sameQuestion,
    market,
    live: await store.liveOpportunityIds?.(a.siteId).catch(() => undefined),
    ...(measuredOwnRanked === null
      ? {}
      : { today: (row: Opportunity) => rebandFor(row, measuredOwnRanked) }),
  });
  // Every survivor is written before any loser is dismissed, so a failure part-way dismisses no topic.
  for (const row of plan.update) await store.setCluster(row.id, row.clusterKey, row.absorbedQueries);
  const { created, duplicates } = await persist({ candidates: plan.insert });
  for (const id of [...gone, ...plan.dismiss]) await store.markDismissed(id);
  const topFit = (index: number) => (fits.get(index)?.fit ?? 0) >= TOPIC_FIT.top;
  const classOfRow = (row: Candidate) => classOf.get(queryKey(row.targetQuery ?? "")) ?? ledgerSourceOf(row);
  for (const question of questions) classOf.set(queryKey(question.targetQuery ?? ""), ledgerSourceOf({ source: question.source, asked: true }));
  const unjudgedFit = new Map(unjudged.map((row, index) => [row.id, fits.get(judgedHere.length + index)?.fit ?? row.businessFit ?? null]));
  const dismissedNow = new Set(plan.dismiss);
  const supply = supplyLedger({
    stages: {
      offered: [...derivedClasses, ...offeredClasses],
      searched: [...derivedClasses, ...proposals.map((topic) => classOf.get(topic.query)!)],
      fit: [
        ...derivedPages.flatMap((candidate, n) => (topFit(judgedHere.indexOf(candidate)) ? [derivedClasses[n]!] : [])),
        ...proposals.flatMap((topic, index) => (topFit(judgedHere.length + unjudged.length + index) ? [classOf.get(topic.query)!] : [])),
      ],
      candidates: [...labelled, ...questions].filter((row) => isNewPage(row) && (row.businessFit ?? TOPIC_FIT.gate) >= TOPIC_FIT.gate).map(classOfRow),
      added: plan.insert.filter(isNewPage).map(classOfRow),
    },
    rows: [
      ...existing.filter((row) => !dismissedNow.has(row.id)).map((row) => ({ ...row, businessFit: unjudgedFit.get(row.id) ?? row.businessFit })),
      ...created,
    ],
    unworded,
    ...(topUp === undefined ? {} : { topUp }),
    fitUnmeasured: searches.length > 0 && fits.size === 0,
  });
  // A candidate the collapse folded into a held row is that row's duplicate: an equivalent open or queued row exists.
  const folded = labelled.length + questions.length - plan.insert.length;
  return {
    created,
    assessed,
    rejected: { ...rejected, own_brand: rejected.own_brand + ownBrand, duplicate_open: rejected.duplicate_open + duplicates + folded + stillDismissed },
    supply,
  };
}

/** Whether a search was dismissed with no higher measured volume since, or stopped. Pure. */
export function dismissedUnchanged(
  candidate: Pick<Candidate, "targetQuery" | "volume">,
  dismissed: readonly DismissedSearch[]
): boolean {
  if (candidate.targetQuery === null) return false;
  const key = queryKey(candidate.targetQuery);
  const now = candidate.volume === null || candidate.volume.kind === "unmeasured" ? 0 : candidate.volume.value;
  return dismissed.some((row) => queryKey(row.query) === key && (row.stopped || now <= (row.volume ?? 0)));
}

/** Searches Search Console measured the live pages on at `EARNING.offered` that none targets, a typed-in prompt worded as searched. Pure; adds to `taken`. */
export function earnedTopics(pages: readonly { reading?: unknown; row: Pick<Opportunity, "acceptance" | "targetQuery"> }[], a: { taken: Set<string>; wordings: readonly string[]; refused: (query: string) => boolean }): ProposedTopic[] {
  const { min, max, impressions, words } = EARNING.offered;
  const wordings = a.wordings.map((text) => ({ id: text, text }));
  return earnedSearches(pages.map((page) => ({ reading: page.reading, search: pageSearchOf(page.row.acceptance, page.row.targetQuery) }))).flatMap((row): ProposedTopic[] => {
    const query = queryKey(row.query.split(" ").length > words ? (closestPrompt(row.query, wordings)?.text ?? "") : row.query);
    if (row.position < min || row.position > max || row.impressions < impressions || query === "" || a.taken.has(query) || a.refused(query)) return [];
    a.taken.add(query);
    return [{ query, source: "earned", volume: null, rival: null }];
  });
}

/** A new page's evidence with the passage its fit was judged on and the angle it keeps, `null` where judged with none; unjudged has neither key. */
function withFact<T extends { evidence: Evidence }>(row: T, judged: Pick<FitJudgement, "fact" | "angle">): T {
  return row.evidence.family === "write" || row.evidence.family === "earn" ? { ...row, evidence: { ...row.evidence, fitFact: judged.fact, angle: judged.angle } } : row;
}
