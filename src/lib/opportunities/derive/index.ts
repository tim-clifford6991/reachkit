// BUILD §7 — the derivation, end to end.
//
// Order, and there is no other: derive deterministically (Write, Improve,
// Earn, Fix), keeping one candidate per search → qualify and band (already
// applied inside each family module, over the same top tens) → label through
// the model → persist. **Nothing after
// the derivation step may add a candidate.** The model runs after
// qualification so that no candidate it touches is one measured evidence
// did not produce, and persistence runs last so that de-duplication is the
// index's.
//
// Returning `created: []` is a normal return with counts, never an error
// and never a throw: empty is a success state (§2.5), and the three
// rejection counters are what let §4.6's "supply ran out" day line be told
// apart from "we could not read this market".
//
// The engine spends nothing here beyond the rows the scan already bought:
// winnability reads counts already in `fetches`, and the only model call is
// `opportunity-typing`, inside the pass's own cap.
import type { Locale } from "@/lib/locale/locales";
import { siteLocale } from "@/lib/locale/site";
import type { KnowledgeDigest } from "@/lib/site-profile/knowledge/read";
import { ASKED_TOPICS, TOPIC_FIT } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { ownSearched } from "@/lib/market/infer/demand";
import type { MarketConclusion } from "@/lib/market/infer/types";
import { malformedSearch } from "@/lib/market/questions/well-formed";
import { measured, type Measured } from "@/lib/measure/measured";
import type { StoredReport } from "@/lib/scan/report";
import type { InventoryRow } from "@/lib/site-profile/types";
import type { RankedCounts } from "../winnability/counts";
import { pageTypeOf } from "../page-type";
import { addRejections, isRetarget, noRejections, type Opportunity, type RejectionCount } from "../types";
import type { Candidate } from "./candidate";
import { earnCandidates } from "./earn";
import { fixCandidates } from "./fix";
import { improveCandidates } from "./improve";
import { brandTokensOf, collapse, coveredTopics, queryKey, topTensOf } from "../cluster";
import { rebandFor } from "../readiness";
import { opportunityStore, readOpportunity } from "../store";
import { persist } from "./persist";
import { judgeSameQuestion } from "./same-question";
import { refineType } from "./typing";
import { applyKnownContent, type KnownContentGate } from "./known";
import { writeCandidates } from "./write";
import { judgeFit, type FitSearch } from "./fit";
import { askedOfReport, askedTopics, brandsOf, candidateFor, comparisonWithoutDemand, noLongerRelevant, productsNamed, proposedTopics, rivalBrandOnly, rivalNamesOf, rivalPriceOf, sourceOf } from "./topics";
import { judgeTyped, writeBuyerSearches } from "./buyer-searches";

export interface DeriveInput {
  siteId: string;
  /** The site's country and language (SPEC §6, owner D66): the searches
   *  this derivation writes are written in it. Absent, the site's stored
   *  one is read. */
  locale?: Locale;
  scanId: string;
  report: StoredReport;
  /** The customer's own measured ranked count. `unmeasured` reads as the
   *  cold-start 0 — which is the honest reading: the bars are then 500 and
   *  100, both positive, so every band stays assignable and the winnable
   *  set stays non-empty for a domain that ranks for nothing. Reading it
   *  as a large number instead would silently widen the bars for exactly
   *  the customers the product exists to serve. */
  ownRanked: Measured<number>;
  /** One ranked count per domain the deep pass sized — issue #37's
   *  `RivalSize[]`, projected by `rankedCountsFromSizes`. It stays a
   *  parameter now that `rivalSizes` is a member of `StoredReport`
   *  (issue #126, DECISIONS 2026-09-06): the projection is the caller's
   *  — `rankedCountsOf` in `../pass.ts` — so this directory reads a
   *  lookup and never the blob's sizing arm, and a suite can hand it a
   *  market of any shape without assembling a report for it. A missing
   *  entry is `undeterminable` and never a zero — see
   *  `winnability/counts.ts`. */
  rankedCounts: RankedCounts;
  /** The host the site's hosted destination serves at, whose pages get no
   *  `fix_page` (SPEC §9, 2026-09-14). Absent where the caller has none. */
  hostedHost?: string | null;
  /** The pages the crawl read (`site_profiles.inventory`), which Improve
   *  matches to the market's questions beside the site's ranked urls (SPEC
   *  §7, 2026-09-16). Absent reads as none. */
  inventory?: readonly InventoryRow[];
  /** SPEC §7 (2026-09-20, #928): the net-new rule's two answers — does the
   *  site already have a page on this topic, and can its destination publish
   *  an update of that page. Absent is a pass with no index to read, which
   *  plans exactly what it planned before #928: nothing is converted and
   *  nothing is refused, rather than every topic being called net new by a
   *  gate that was never asked. */
  known?: KnownContentGate;
  /** The site's structured market in force (issue 1159), which business fit
   *  is judged against and whose vocabulary and rivals propose write targets
   *  (SPEC §6, 2026-10-03, issue 1134). Absent or `null` is a site no pass
   *  has concluded a market for: fit is then judged against the report's
   *  profile, and only the searches the pass read are proposed. */
  market?: MarketConclusion | null;
  /** The site's knowledge base, as fit is shown it (SPEC §6, 2026-09-29,
   *  issue 1133). Absent or `null` is a site nothing has been read for. */
  knowledge?: KnowledgeDigest | null;
  /** The rivals the site is measured against (`sites.competitors`). A paid
   *  pass keeps a far-banded one out of the report's rivals (#858), and it
   *  is still a rival an answer may cite. Absent reads as none. */
  competitors?: readonly string[];
  /** The site's tracked buyer prompts (D19, `sites.tracked_prompts`), the
   *  branded ones left out: what its buyers ask answer engines, which the
   *  buyer's searches are written from (issue 1208). Absent reads as none. */
  prompts?: readonly string[];
}

/** How many held rows one pass's judgement may also score. */
const HELD_ROWS_JUDGED = 20;

export interface DeriveOutcome {
  created: Opportunity[];
  /** Targets looked at, whether or not they became opportunities. */
  assessed: number;
  rejected: RejectionCount;
}

export function ownRankedValue(ownRanked: Measured<number>): number {
  return ownRanked.kind === "unmeasured" ? 0 : ownRanked.value;
}

/** SPEC §6: "Improve of an owned URL outranks a new page", and an Earn
 *  asset outranks a plain Write for the same search (issue 474's order).
 *  Handed candidates in that precedence, it keeps the first for each search,
 *  so one search never plans two pages. Pure. */
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
  const brands = [...named.own, ...named.rivals];
  const write = writeCandidates({
    ...base,
    ownRanked,
    rankedCounts: a.rankedCounts,
    marketRivals: [...(market?.rivals.map((rival) => rival.domain) ?? []), ...(a.competitors ?? [])],
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

  // SPEC §7 (2026-09-20, #928), and **before** the model is asked to label
  // anything: a candidate that is a repeat of a page the site already has
  // becomes an update of that page, so what the typing step labels is the
  // row that will actually be written. One page per search is decided first
  // — the rule is about what the day would publish, and only one candidate
  // per search survives to be it.
  const planned = onePerSearch([...improve.candidates, ...earn.candidates, ...write.candidates]);
  const store = opportunityStore();
  const held = (await store.clusterable(a.siteId)).map(readOpportunity);

  // SPEC §6 (2026-10-03, issue 1208): a rival's own price is never a page
  // about the rival alone. A new page planned on one — this pass's or an
  // open row's — gives way to the product against that rival at its price,
  // which is proposed below like any other search nothing measured.
  const rivalNames = rivalNamesOf({ report: a.report, market });
  const comparisons: { query: string; rival: string }[] = [];
  const aRivalsPrice = (row: { family: Candidate["family"]; targetQuery: string | null }): boolean => {
    if (row.family !== "write" || row.targetQuery === null) return false;
    const priced = rivalPriceOf(row.targetQuery, { own: named.own, ownSearched: ownSearched(market), rivals: rivalNames, language: locale.language });
    if (priced === null) return false;
    if (priced.comparison !== null) comparisons.push({ query: priced.comparison, rival: priced.rival });
    return true;
  };
  // SPEC §6 (owner D50, issue 1271): an open row an earlier pass proposed
  // for a comparison of names nobody searches goes the same way.
  // Only once the brands' volumes were read: "never read" dismisses nothing.
  const unsearchedComparison = (row: (typeof held)[number]): boolean =>
    market?.demand !== undefined &&
    row.family === "write" &&
    row.targetQuery !== null &&
    row.source !== "ai_gap" &&
    (row.volume === null || row.volume.kind === "unmeasured") &&
    comparisonWithoutDemand(row.targetQuery, { market, own: named.own });
  // SPEC §6 (owner D59, issue 1287): context stays relevant. An open topic
  // nothing was ever drafted from goes where it names a rival that is no
  // longer current, or uses a term of a market that is not this one. A
  // topic with a draft or a publication is never touched, and neither is
  // the search an operator retargeted a live page to (issue 1285). A store
  // that cannot say which topics were drafted prunes nothing.
  const drafted = store.draftedOpportunityIds === undefined ? null : await store.draftedOpportunityIds(a.siteId).catch(() => null);
  const irrelevant = (row: (typeof held)[number]): boolean =>
    drafted !== null &&
    !drafted.has(row.id) &&
    row.targetQuery !== null &&
    !isRetarget(row) &&
    noLongerRelevant(row.targetQuery, { market, own: named.own }) !== null;
  // SPEC §6 (owner D64, issue 1301): a search that is only a rival's brand
  // name is navigational and never a topic — not planned by this pass, and
  // an open row for one that nothing was drafted from goes too.
  const aRivalsBrand = (row: { targetQuery: string | null }): boolean =>
    row.targetQuery !== null && rivalBrandOnly(row.targetQuery, { market, own: named.own, rivals: named.rivals });
  // SPEC §6 (2026-10-07, issue 1314): nor is a search nobody would type as
  // it stands — a phrase said twice, a comparison with one side, a web
  // address, a rival called by its domain.
  const notASearch = (row: { targetQuery: string | null }): boolean =>
    row.targetQuery !== null && malformedSearch(row.targetQuery, market?.rivals) !== null;
  const gone = new Set<string>();
  for (const row of held) {
    if (row.status !== "open") continue;
    const neverDrafted = drafted !== null && !drafted.has(row.id) && !isRetarget(row);
    if (aRivalsPrice(row) || unsearchedComparison(row) || irrelevant(row) || (neverDrafted && (aRivalsBrand(row) || notASearch(row)))) gone.add(row.id);
  }
  const mine = planned.filter((candidate) => !aRivalsPrice(candidate) && !aRivalsBrand(candidate) && !notASearch(candidate));
  const derived: Candidate[] = [
    ...(a.known === undefined ? mine : applyKnownContent(mine, a.known)),
    ...fix.candidates,
  ];

  // SPEC §6 *Topics by business fit* (2026-09-29, 2026-10-03; issue 1134):
  // one judgement a pass, over what it derived, what it proposes from the
  // market's own vocabulary and the searches it read, and the open rows no
  // pass has judged yet. Stored on the row; nothing downstream asks again.
  const judgedHere = derived.filter((candidate) => candidate.family !== "fix" && candidate.targetQuery !== null);
  const written = await writeBuyerSearches(c, { market, prompts: a.prompts ?? [], brands, locale });
  // SPEC §6 (issue 1519): what buyers were seen asking beside the site's
  // searches — this report's SERPs and D62's store — at 0¢.
  const stored = store.askedBeside === undefined ? [] : await store.askedBeside(a.siteId, ASKED_TOPICS.maxAgeDays).catch(() => []);
  const seen = [...askedOfReport(a.report), ...stored];
  const asked = askedTopics(seen, a.report.verdict.measuredAt);
  const offered = proposedTopics({
    report: a.report,
    market,
    taken: [...derived, ...held].flatMap((row) => row.targetQuery ?? []),
    ownRanked,
    max: Math.max(0, TOPIC_FIT.maxCandidates - judgedHere.length - HELD_ROWS_JUDGED),
    comparisons,
    written,
    language: locale.language,
    asked,
    seen,
  });

  // SPEC §6 (2026-10-03, issue 1208): "would a buyer search this?" — one
  // small-tier judgement over every search nothing measured: what this pass
  // offers, and the open rows an earlier pass wrote down the same way. One
  // that fails is not proposed, and a row that fails is dismissed; no
  // judgement proposes none of them and dismisses nothing.
  // A search buyers were seen asking needs no such check: Google showed it.
  const unmeasuredOffers = offered.filter((topic) => topic.volume === null && topic.asked === undefined);
  const unmeasuredRows = held.filter(
    (row) =>
      row.status === "open" &&
      !gone.has(row.id) &&
      row.family === "write" &&
      row.targetQuery !== null &&
      row.source !== "ai_gap" &&
      (row.volume === null || row.volume.kind === "unmeasured")
  );
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
  for (const id of gone) await store.markDismissed(id);
  // SPEC §6 (owner D64, issue 1301): an open comparison row an earlier pass
  // wrote down unmeasured takes the volume this pass read for its search.
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
    await store.setVolume?.(row.id, read, evidence);
    existing.push({ ...row, volume, evidence });
  }

  const unjudged = existing
    .filter((row) => row.status === "open" && row.family !== "fix" && row.targetQuery !== null)
    .filter((row) => (row.businessFit ?? null) === null)
    .slice(0, HELD_ROWS_JUDGED);
  const sourceFor = (row: { targetQuery: string | null; source?: Candidate["source"] }) =>
    row.source ?? sourceOf(row.targetQuery ?? "", { brands, products: Object.keys(market?.demand?.brands ?? {}) });
  const searches: FitSearch[] = [
    ...judgedHere.map((candidate) => ({ query: candidate.targetQuery!, source: sourceFor(candidate) })),
    ...unjudged.map((row) => ({ query: row.targetQuery!, source: sourceFor(row) })),
    ...proposals.map((topic) => ({ query: topic.query, source: topic.source })),
  ];
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
    const withFit = { ...sourced, businessFit: judged.fit };
    if (judged.title !== null) angle.set(withFit, judged.title);
    return withFit;
  });
  for (const [index, row] of unjudged.entries()) {
    const judged = fits.get(judgedHere.length + index);
    if (judged === undefined) continue;
    const source = sourceFor(row);
    await store.setBusinessFit(row.id, judged.fit, source, pageTypeOf({ ...row, source }));
  }
  // A proposal is a write target only at the top fit: below it the search
  // was never measured, and nothing but its fit speaks for it.
  const proposed: Candidate[] = [];
  for (const [index, topic] of proposals.entries()) {
    const judged = fits.get(judgedHere.length + unjudged.length + index);
    if (judged === undefined || judged.fit < TOPIC_FIT.writeAt) continue;
    const candidate = candidateFor(topic, { ...base, market, ownRanked });
    if (candidate !== null) proposed.push({ ...candidate, title: judged.title });
  }

  const labelled: Candidate[] = [];
  for (const candidate of scored) {
    // A target the business is not the answer to is stored with its reason
    // and never written, so no label is bought for it.
    const fit = candidate.businessFit ?? null;
    if (fit !== null && fit < TOPIC_FIT.gate) {
      labelled.push(candidate);
      continue;
    }
    // Sequential, not `Promise.all`: the cost seam's cap is re-checked
    // between calls, and a parallel fan-out would issue every call before
    // the first settled against it.
    const refined = await refineType(c, candidate);
    // SPEC §6 (2026-09-29): the title is the page's angle for this buyer,
    // which the fit judgement worded against the market — not the keyword.
    const title = angle.get(candidate);
    labelled.push(title === undefined || refined.family === "improve" ? refined : { ...refined, title });
  }
  // A proposal's type is read off its own words and its title is the angle
  // it was judged with, so it buys no label.
  labelled.push(...proposed);

  // SPEC §6: one survivor per parent topic, over the rows already held as
  // well as this pass's — after labelling, because the model may refine a
  // Write's type and the type decides precedence. Losing open rows go first,
  // so the one-open-row-per-cluster index never sees two.
  //
  // Issue 903: the collapse is also where a superseded row ends. It is told
  // which pass these candidates came from and which topics that pass read,
  // so a row from an earlier report on a topic this one covered and proposed
  // nothing for is dismissed rather than left open.
  //
  // `today` is 884's `rebandFor`, handed in because the readiness step that
  // normally applies it runs *after* this one: without it the collapse reads
  // a band from whichever pass wrote the row, which is the stale number 881
  // was written to stop competing with a right-sized candidate. Only where
  // this pass measured the footprint — an unmeasured one would re-band the
  // whole site as though it ranked for nothing, which is exactly the reading
  // `readiness.ts` refuses.
  const brandTokens = brandTokensOf(a.report);
  const measuredOwnRanked = a.ownRanked.kind === "unmeasured" ? null : a.ownRanked.value;

  // SPEC §6 (2026-09-29, #1131): one URL per question. Two searches are one
  // topic where their stored top tens share four addresses — a held row's
  // from the scan that derived it, this pass's own over any older one — or
  // where the one small-tier judgement below says they ask the same
  // question. Nothing is bought for either.
  const topTens = new Map(await store.topTens([...new Set(existing.map((row) => row.scanId))]));
  for (const [query, urls] of topTensOf(a.report)) topTens.set(query, urls);
  // #1181: the open rows already held are judged too, against each other
  // and against every topic with a page behind it, published ones included.
  const pages = (row: { family: Opportunity["family"] }) => row.family === "write" || row.family === "earn";
  const judgedSame = await judgeSameQuestion(c, {
    searches: [
      ...labelled.filter(pages).flatMap((candidate) => candidate.targetQuery ?? []),
      ...existing.filter((row) => row.status === "open" && pages(row)).flatMap((row) => row.targetQuery ?? []),
    ],
    topics: existing.flatMap((row) => row.targetQuery ?? []),
  });
  // SPEC §6 (owner D64, issue 1301): two searches that name different
  // products are never one question, whatever the judgement says.
  const products = (query: string): string => productsNamed(query, { market, rivals: named.rivals });
  const sameQuestion = new Map([...judgedSame].filter(([search, sameAs]) => products(search) === products(sameAs)));

  const plan = collapse({
    existing,
    candidates: labelled,
    brandTokens,
    pass: { scanId: a.scanId, covered: coveredTopics(a.report, brandTokens) },
    topTens,
    sameQuestion,
    ...(measuredOwnRanked === null
      ? {}
      : { today: (row: Opportunity) => rebandFor(row, measuredOwnRanked) }),
  });
  for (const id of plan.dismiss) await store.markDismissed(id);
  for (const row of plan.update) await store.setCluster(row.id, row.clusterKey, row.absorbedQueries);

  const { created, duplicates } = await persist({ candidates: plan.insert });
  // A candidate the collapse folded into a row already held is that row's
  // duplicate: an equivalent open or queued opportunity exists.
  const folded = labelled.length - plan.insert.length;
  return {
    created,
    assessed,
    rejected: { ...rejected, duplicate_open: rejected.duplicate_open + duplicates + folded },
  };
}
