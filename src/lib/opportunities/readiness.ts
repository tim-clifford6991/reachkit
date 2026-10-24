// SPEC §6 — "A day is filled only by an opportunity that passes readiness.
// Never pad the calendar."
//
// `eligible()` is the one check, and its answer is stored on the row
// (`ready`, `unready_reason`), so supply and next-work read the column and
// never re-derive it. It answers one of six reasons (owner ruling C6,
// 2026-10-19), in this order:
//
//   - `resting` — the topic's draft was stopped or skipped (D26), its cluster
//     was judged not working, or its URL retired (`suppression.ts`);
//   - `destination_cannot_address` — an Improve the destination cannot
//     deliver (issue 781), or a topic a page of the site already covers
//     (#928);
//   - `low_fit` — a stored business fit below the gate (§6, 2026-09-29), or
//     a fresh top ten of another kind of business (`derive/top-ten-kind.ts`);
//   - `no_grounding_fact` — the site's own pages ground no fact, or none of
//     the kind an Earn asset needs (`earn-grounding.ts`);
//   - `no_intent` — a comparison nobody was seen asking (issue 1506), a
//     keyword page below its gate (§6, 2026-09-15; waived at fit 3 and for a
//     question buyers asked), a format page with no format word, or a topic
//     with no measured volume and no tracked prompt near it (D60);
//   - `outsized` — SPEC §6's right-sizing law (issue 884).
//
// It is assessed in two places only: the week's commit (`planWeek`) and the
// evening check of the committed rows (`pageForDay`).
//
// And SPEC §7's offering page (owner ruling B6, 2026-10-19): the same fresh
// top ten decides whether a new Write page is written as one, stored on the
// row's evidence (`shapedEvidence`) so every reader types it alike.
//
// The Fix family keeps its own check (`fixPageReadiness`): its readiness is a
// question about the destination, not about the market.
import { SHAPES } from "@/lib/locale/language";
import { KEYWORD_PAGE_MIN_VOLUME, TOPIC_FIT } from "@/lib/config/constants";
import { classifyIntent, type PlacedBusiness } from "@/lib/market/questions/select";
import type { Profile } from "@/lib/market/questions/profile";
import { isOwnDomain, registrableDomain } from "@/lib/market/rivals/domains";
import type { StoredReport } from "@/lib/scan/report";
import { addressesOwnPage, type HostedOwnPages } from "@/lib/publish/destinations/hosted/own-page";
import { opportunityStore, readOpportunity } from "./store";
import { isResting, OUTSIZED, qualifiesForADay, type Winnability } from "./types";
import { demandBand } from "./winnability/band";
import { difficultyCeiling } from "./winnability/bars";
import { NO_EARN_GROUNDING, type EarnGrounding } from "./earn-grounding";
import { heldByVerdict, suppressionOf, type Suppression } from "./suppression";
import { hasGoal, intentFor, type IntentPrompt } from "./intent";
import type { KnownMatch } from "@/lib/known-content/types";
import { queryKey } from "./cluster";
import { SHAPED } from "./content-type";
import { comparisonBrands, comparisonUnasked, composedSearch, type AskedBeside, type ComparisonBrands, type MeasuredAnswer } from "./derive/topics";
import { freshRead, freshTopTen, offeringTopTen, otherKindTopTen, OTHER_KIND_TOP_TEN, servedPlace, type KindOfBusiness, type TopTenRead, type TopTenRow } from "./derive/top-ten-kind";
import type { Evidence, Opportunity, UnreadyReason } from "./types";

export interface ReadinessContext {
  /** The clock a topic's rest is read against. */
  now: Date;
  /** The site's own measured pages yield at least one passage. */
  grounded: boolean;
  /** Which Earn assets the site's own pages hold a passage for. */
  earnGrounding: EarnGrounding;
  /** What this site's Monday verdicts hold back. */
  suppression: Suppression;
  /** The profile §6.7's classifier reads. `null` classifies nothing, so no
   *  keyword page passes its intent gate. */
  profile: Profile | null;
  /** Whether an owned URL ranks for this search, as the newest report
   *  measured it. */
  ownRanks: (query: string) => boolean;
  /** Whether the site's destination can deliver an update of the page at
   *  this address (issue 781). */
  canUpdate: (url: string) => boolean;
  /** SPEC §7 (2026-09-20, #928): the page this site already has on the
   *  row's topic, where it has one. Resolved before the loop — the index is
   *  narrowed by the database, one topic at a time — so this predicate stays
   *  what every other member here is: a pure answer the decision reads.
   *  A row whose topic is covered and which is **not** itself the update of
   *  the covering page never fills a day. */
  coveredBy: (o: Opportunity) => KnownMatch | null;
  /** SPEC §6 (D60, issue 1288): the prompts the site tracks today. Absent
   *  or empty where it has no set yet — its first weekly pass builds one —
   *  and then no topic is held for lacking a prompt. */
  prompts?: readonly IntentPrompt[];
  /** Issue 1506: the names a "vs" search is read by. Absent reads no search
   *  as one between products. */
  brands?: ComparisonBrands;
  /** Issue 1506: what buyers were seen asking beside the market's searches
   *  (D62's store). Absent reads none. */
  asked?: readonly AskedBeside[];
  /** Issue 1520: the newest measured answers to the tracked prompts.
   *  Absent reads none. */
  answers?: readonly MeasuredAnswer[];
  /** Issue 1520: whether a search is one ReachKit composed from the market
   *  in force. Absent reads only the row's own mark. */
  composed?: (query: string) => boolean;
  /** Issue 1506: the stored top ten for a row's search, `null` where none
   *  was stored, and the business it is read against. */
  topTen?: (o: Opportunity) => readonly TopTenRow[] | null;
  business?: KindOfBusiness | null;
}

/** The business the classifier reads a local search against (issue 1561). */
function placedBusiness(business: KindOfBusiness | null | undefined): PlacedBusiness | null {
  if (business == null) return null;
  return {
    kind: business.kind ?? null,
    serves: servedPlace(business),
    ...(business.words === undefined ? {} : { marketWords: business.words }),
  };
}

/** SPEC §6's commercial and transactional searches, in §6.7's classifier's
 *  own arms: a decision search (best / vs / alternative / top) and a
 *  solution search ({category} software / tool / app / platform). */
const COMMERCIAL_INTENTS: ReadonlySet<string> = new Set(["decision", "solution"]);

/** The format words, as whole words, plural or not — the pin's four and
 *  the owner's "vs". */
const FORMAT_WORDS = SHAPES.format;

function volumeOf(o: Opportunity): number {
  return o.volume === null || o.volume.kind === "unmeasured" ? 0 : o.volume.value;
}

/** Issue 1506, as issue 1520 amended it: a comparison, alternatives or
 *  composed search that nothing observed anyone asking
 *  (`comparisonUnasked`). The answer a row was found in counts where it
 *  named one of its rivals: an Earn row's AI answer, or an `ai_gap` row's.
 *  A topic buyers were seen asking (issue 1519) is observed. A composed
 *  search is a Write row's: an update is of a page that exists. */
export function comparisonWithoutAsking(
  o: Opportunity,
  ctx: Pick<ReadinessContext, "brands" | "prompts" | "asked" | "answers" | "composed">
): boolean {
  if (ctx.brands === undefined) return false;
  if (o.evidence.family === "write" && o.evidence.askedBeside !== undefined) return false;
  const query = o.targetQuery ?? "";
  const composed =
    o.family === "write" && ((o.evidence.family === "write" && o.evidence.composed === true) || ctx.composed?.(query) === true);
  const answeredRival =
    o.evidence.family === "earn" && o.evidence.source.surface === "ai_answer"
      ? o.evidence.rival.domain
      : o.source === "ai_gap" && "rival" in o.evidence
        ? o.evidence.rival.domain
        : null;
  return comparisonUnasked({
    query,
    volume: volumeOf(o),
    brands: ctx.brands,
    prompts: ctx.prompts ?? [],
    answers: ctx.answers ?? [],
    answeredRival,
    asked: ctx.asked ?? [],
    composed,
  });
}

/** Why this row may not fill a day, or `null` where it may. Pure. */
export function eligible(o: Opportunity, ctx: ReadinessContext): UnreadyReason | null {
  if (isResting(o, ctx.now) || heldByVerdict(o, ctx.suppression)) return "resting";
  if (o.family === "improve" && !ctx.canUpdate(o.targetRef)) return "destination_cannot_address";
  // An Improve row is the update of the page that covers its topic.
  if (o.family !== "improve" && ctx.coveredBy(o) !== null) return "destination_cannot_address";
  const fit = o.businessFit ?? null;
  if (o.family !== "fix" && fit !== null && fit < TOPIC_FIT.gate) return "low_fit";
  const topTen = o.family === "fix" ? null : (ctx.topTen?.(o) ?? null);
  if (topTen !== null && otherKindTopTen(topTen, ctx.business ?? null, o) !== null) return "low_fit";
  if (!ctx.grounded) return "no_grounding_fact";
  if (o.evidence.family === "earn" && !ctx.earnGrounding[o.evidence.asset]) return "no_grounding_fact";
  const query = o.targetQuery ?? "";
  // A question buyers were seen asking beside the site's searches is observed demand (issue 1519).
  const observed = o.evidence.family === "write" && o.evidence.askedBeside !== undefined;
  if (o.family !== "fix" && comparisonWithoutAsking(o, ctx)) return "no_intent";
  if (o.type === "keyword_page" && !keywordGate(o, query, observed, ctx)) return "no_intent";
  if (o.type === "format_page" && !FORMAT_WORDS.test(query)) return "no_intent";
  // Before the prompt check, so a row too big for the site is always said to be.
  if (o.family !== "fix" && !qualifiesForADay(o.fitBand)) return "outsized";
  const prompts = ctx.prompts ?? [];
  if (o.family !== "fix" && !observed && query.trim() !== "" && prompts.length > 0 && !hasGoal(intentFor({ query, volume: o.volume }, prompts))) {
    return "no_intent";
  }
  return null;
}

/** A keyword page's own gate: commercial volume in the winnable band, or a
 *  fit-3 or asked search (issues 1134, 1549); never one an owned URL ranks
 *  for, which is Improve's. */
function keywordGate(o: Opportunity, query: string, observed: boolean, ctx: ReadinessContext): boolean {
  const fit = o.businessFit ?? null;
  const atTopFit = fit !== null && fit >= TOPIC_FIT.writeAt;
  const intent = ctx.profile === null ? null : classifyIntent(query, ctx.profile, placedBusiness(ctx.business));
  const commercial = volumeOf(o) >= KEYWORD_PAGE_MIN_VOLUME && o.fitBand === "winnable" && intent !== null && COMMERCIAL_INTENTS.has(intent);
  return (atTopFit || observed || commercial) && !ctx.ownRanks(query);
}

/** The evidence a new page carries once its fresh stored results page
 *  is read: `shape: "offering"` where that page asks for a provider's own
 *  page, none where it does not. With no fresh read the row is left as it
 *  is. Pure. */
export function shapedEvidence(o: Opportunity, read: TopTenRead | null, business: KindOfBusiness | null): Evidence {
  const evidence = o.evidence;
  if (read === null || !SHAPED.has(o.type) || (evidence.family !== "write" && evidence.family !== "earn")) return evidence;
  const rest = { ...evidence };
  delete rest.shape;
  return offeringTopTen(read, business, o.targetQuery ?? "") ? { ...rest, shape: "offering" } : rest;
}

const shapeOf = (evidence: Evidence): string | undefined => ("shape" in evidence ? evidence.shape : undefined);

/** An owned URL ranks for a search where the report's own SERP for it holds
 *  an organic row on the customer's domain. A search the report did not
 *  measure has no such row. */
export function ownRanksFrom(report: StoredReport | null): (query: string) => boolean {
  if (report === null || report.questions.kind === "unmeasured") return () => false;
  const own = registrableDomain(report.domain) ?? report.domain;
  const ranked = new Set<string>();
  report.questions.value.forEach((question, index) => {
    const serp = report.serps[index];
    if (serp === undefined || serp.kind === "unmeasured") return;
    if (serp.value.organic.some((row) => isOwnDomain(registrableDomain(row.domain) ?? row.domain, own))) {
      ranked.add(question.search.keyword.trim().toLowerCase());
    }
  });
  return (query) => ranked.has(query.trim().toLowerCase());
}

/** Which pages the site's destination can update. `null` (not a hosted
 *  destination) leaves the update to that destination, which answers for
 *  itself; a hosted one updates only its own live publications. */
export function canUpdateFrom(own: HostedOwnPages | null): (url: string) => boolean {
  if (own === null) return () => true;
  return (url) => addressesOwnPage(url, own);
}

/**
 * The band a row would be given **today**, from the evidence stored on it
 * (issue 884's stale-band half).
 *
 * A row keeps the band it was given when it was derived, and a policy
 * change moves the bars under it: the dogfood site's six were banded before
 * right-sizing shipped (issue 862) and were still on file claiming to be
 * ordinary targets. This re-applies the two halves of the law that **can**
 * be recomputed from what the row already carries, against the site's
 * footprint as the current report measures it:
 *
 *   - demand — the search's own volume against `qualifyingDemand(own)`;
 *   - difficulty — the vendor's keyword difficulty, where the row carries
 *     one (issue 867), against `difficultyCeiling(own)`.
 *
 * The competition half is **not** recomputed: it reads the target's whole
 * top ten, and a row stores one rival, not ten. So this is a floor and
 * never a promotion — it can only find a row outsized, never restore one.
 * A row whose stored band already says `not-yet` stays where it is.
 *
 * No vendor call: every input is a stored number.
 */
export function rebandFor(o: Opportunity, ownRanked: number): Winnability | null {
  if (o.family === "fix" || o.fitBand === null) return null;
  if (!qualifiesForADay(o.fitBand)) return o.fitBand;

  const volume = o.volume;
  if (volume !== null && volume.kind !== "unmeasured" && demandBand({ volume: volume.value, ownRanked }) === "not-yet") {
    return OUTSIZED;
  }
  const difficulty = "target" in o.evidence ? o.evidence.target?.difficulty : undefined;
  if (
    difficulty !== undefined &&
    difficulty.kind !== "unmeasured" &&
    difficulty.value > difficultyCeiling(ownRanked)
  ) {
    return OUTSIZED;
  }
  return o.fitBand;
}

/**
 * The site's own ranked count as the current report measured it, or `null`
 * where this site has no readable one.
 *
 * `null` is not zero here, and the difference matters: derivation reads an
 * unmeasured footprint as the cold-start 0 because it is banding against
 * the pass it just ran, while this re-bands rows that were banded against
 * some earlier pass. With no measurement in hand the honest move is to
 * leave every stored band alone rather than to re-band the whole site as
 * though it ranked for nothing.
 */
function ownRankedOf(report: StoredReport | null): number | null {
  const own = report?.ownRanked;
  if (own === undefined || own.kind === "unmeasured") return null;
  return own.value;
}

/**
 * The page this site already has on each row's topic, by row id (#928).
 *
 * One narrowed read per row that could be covered — an Improve row is
 * exempt, so none is made for it — and the scoring is
 * `known-content/match.ts`'s. A read that fails answers "not covered" for
 * that row — the store's own arm, which returns no rows rather than
 * throwing: an index that could not be reached must not refuse a topic, for
 * the same reason a WordPress that did not answer must not empty the index.
 */
async function coveredTopics(
  siteId: string,
  rows: readonly Opportunity[]
): Promise<Map<string, KnownMatch>> {
  const out = new Map<string, KnownMatch>();
  const { alreadyCovered } = await import("@/lib/known-content/match");
  const store = opportunityStore();
  for (const row of rows) {
    if (row.family === "improve" || row.family === "fix") continue;
    const query = row.targetQuery ?? "";
    if (query.trim() === "") continue;
    const near = await store.knownContentNear({ siteId, query });
    const match = alreadyCovered({ query, title: row.title }, near);
    if (match !== null) out.set(row.id, match);
  }
  return out;
}

/**
 * Records readiness on every open Write, Improve and Earn row of one site,
 * or on the ones `only` names.
 *
 * Reads, once each: the open rows, the site's `not_working` verdicts, its
 * current report (for the profile and what it ranks for) and whether its own
 * pages ground a fact. Writes only the rows whose answer changed.
 */
export async function assessReadiness(
  siteId: string,
  a: {
    at: Date;
    /** The clock a topic's rest is read against. `at` is the report's own
     *  moment on the evening run, which can be a week old. */
    now?: Date;
    /** Issue 1559: only these rows — a pass's new ones, or the evening's
     *  committed week. Absent: every open row. */
    only?: ReadonlySet<string>;
  }
): Promise<{ ready: number; unready: number }> {
  const now = a.now ?? new Date();
  const store = opportunityStore();
  const open = await store.openRankable(siteId);
  const rows = a.only === undefined ? open : open.filter((row) => a.only!.has(row.id));
  if (rows.length === 0) return { ready: 0, unready: 0 };

  const [verdicts, report, profile, grounded, prompts, market, topTens, asked] = await Promise.all([
    store.notWorkingVerdicts(siteId),
    store.currentReport(siteId),
    store.profileForSite(siteId),
    store.hasGroundingFact(siteId),
    store.trackedPrompts === undefined ? [] : store.trackedPrompts(siteId),
    store.marketFor(siteId).then((read) => read.market).catch(() => null),
    store.topTenRows === undefined
      ? new Map<string, TopTenRead>()
      : store.topTenRows([...new Set(rows.map((row) => row.scan_id))]),
    store.askedBeside === undefined ? [] : store.askedBeside(siteId, OTHER_KIND_TOP_TEN.maxAgeDays).catch(() => []),
  ]);
  // Read only where there is an Earn row to answer: it re-reads the site's
  // measured pages and its profile, which nothing else here needs.
  const earnGrounding = rows.some((row) => row.family === "earn")
    ? await store.earnGrounding(siteId)
    : NO_EARN_GROUNDING;
  // Read only where there is an update to deliver.
  const ownPages = rows.some((row) => row.family === "improve") ? await store.hostedOwnPages(siteId) : null;
  // One narrowed read per row whose topic could be covered, before the loop,
  // so `eligible` stays pure and synchronous.
  const covered = await coveredTopics(siteId, rows.map(readOpportunity));
  const readOf = (o: Opportunity) => (o.targetQuery === null ? null : (topTens.get(queryKey(o.targetQuery)) ?? null));
  const ctx: ReadinessContext = {
    now,
    grounded,
    earnGrounding,
    suppression: suppressionOf(verdicts, a.at),
    profile,
    ownRanks: ownRanksFrom(report),
    canUpdate: canUpdateFrom(ownPages),
    coveredBy: (o) => covered.get(o.id) ?? null,
    prompts,
    brands: comparisonBrands({ report, market }),
    asked,
    answers: report?.prompts?.answers ?? [],
    composed: (query) => composedSearch(query, market),
    topTen: (o) => freshTopTen(readOf(o), now),
    business:
      market === null
        ? null
        : { kind: market.kind ?? null, serves: market.serves ?? null, words: [market.category, ...market.synonyms].join(" ") },
  };

  const fresh = (o: Opportunity) => freshRead(readOf(o), now);

  // Issue 884: the row's band is brought up to today's law before its
  // readiness is decided, so a row banded under an older one is corrected
  // by the next pass rather than competing as if it still qualified.
  const ownRanked = ownRankedOf(report);

  let ready = 0;
  for (const row of rows) {
    const read = readOpportunity(row);
    // A row committed to a date is reshaped only by the week's full pass,
    // so the evening check never makes more of a chosen week offering pages.
    const evidence = a.only === undefined || row.planned_for == null ? shapedEvidence(read, fresh(read), ctx.business ?? null) : read.evidence;
    const reshaped = shapeOf(evidence) !== shapeOf(read.evidence) && store.setEvidence !== undefined;
    if (reshaped) await store.setEvidence!(read.id, evidence);
    const stored = reshaped ? { ...read, evidence } : read;
    const band = ownRanked === null ? null : rebandFor(stored, ownRanked);
    if (band !== null && band !== stored.fitBand) await store.setFitBand(stored.id, band);
    const opportunity = band === null ? stored : { ...stored, fitBand: band };
    const reason = eligible(opportunity, ctx);
    if (reason === null) ready += 1;
    if (stored.ready !== (reason === null) || stored.unreadyReason !== reason) {
      await store.setReadiness(opportunity.id, reason);
    }
  }
  return { ready, unready: rows.length - ready };
}
