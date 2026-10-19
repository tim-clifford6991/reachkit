// SPEC §6 — "A day is filled only by an opportunity that passes readiness.
// Never pad the calendar."
//
// `opportunityReady()` is the one predicate, and its answer is stored on the
// row (`ready`, `unready_reason`), so supply and next-work read the column and
// never re-derive it. Owner, 2026-09-15:
//
//   - a grounding fact is at least one passage from the site's own measured
//     page text; with none, every Write/Earn/Improve row is
//     `no_grounding_fact` and supply is 0;
//   - a `keyword_page` is ready only when volume ≥ `KEYWORD_PAGE_MIN_VOLUME`,
//     the band is `winnable`, the intent is commercial or transactional, and
//     no owned URL ranks for it (else it is Improve's) — otherwise
//     `keyword_gate`. At business fit 3 the volume, the band's tighter half
//     and the intent are waived: a fit-3 search is a write target below the
//     floor, a problem or how-to included (owner, 2026-10-03, issue 1134);
//   - a row whose stored business fit is below 2 is `low_fit`, whatever its
//     family (§6, 2026-09-29). A row no pass has judged is read as before;
//   - a `format_page` is ready only when its query contains comparison / vs /
//     alternative / integration / template — otherwise `format_not_allowed`;
//   - a `listed_page` (Earn) is ready only when the site's own pages hold a
//     passage of the kind its asset needs (`earn-grounding.ts`, issue 478) —
//     otherwise `no_grounding_fact`.
//
// And SPEC §6's Monday verdicts (issue 477): a Write in a cluster judged not
// working is `cluster_suppressed`, anything targeting a retired URL is
// `url_retired` (`suppression.ts`).
//
// And SPEC §7's daily decision (issue 781): an Improve row is an update of an
// existing page, so it is ready only where the site's destination can make
// that update — `destination_cannot_address` otherwise. A hosted destination
// can update only a page ReachKit itself published there (a new version at
// the same address); WordPress updates any page of the site, as before.
//
// And SPEC §7's rest (D26, issue 1179): a topic whose draft was stopped for
// the last time, or skipped, is `resting` until its `restUntil` — whatever
// else is true of it (`isResting`, read by both assessments).
//
// And SPEC §6's topics from what buyers were seen asking (issue 1519): a
// "People also ask" question or related search on a stored SERP is observed
// demand, so D60 never holds it as `no_intent`.
//
// And SPEC §6's topics with demand (issue 1506): a "vs" that sets products
// against each other — the business against a rival, or two rivals — is
// `no_intent` unless its search has a measured volume above zero, a
// measured AI answer names one of its rivals — a tracked prompt that names
// one, or the answer the row was found in — or buyers were seen asking it
// beside the market's searches (D62's store). And a row whose stored top
// ten, at most 30 days old, holds six or more results of another kind of
// business than this one is `low_fit` (`derive/top-ten-kind.ts`), as a fit
// below the gate is.
//
// The Fix family keeps its own predicate (`fixPageReadiness`): its readiness
// is a question about the destination, not about the market.
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
import { suppressionOf, verdictReason, type Suppression } from "./suppression";
import { hasGoal, intentFor, type IntentPrompt } from "./intent";
import type { KnownMatch } from "@/lib/known-content/types";
import { queryKey } from "./cluster";
import { comparisonBrands, comparisonUnasked, composedSearch, type AskedBeside, type ComparisonBrands, type MeasuredAnswer } from "./derive/topics";
import { freshTopTen, otherKindTopTen, OTHER_KIND_TOP_TEN, servedPlace, type KindOfBusiness, type TopTenRead, type TopTenRow } from "./derive/top-ten-kind";
import type { Opportunity, UnreadyReason } from "./types";

export interface ReadinessContext {
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

/**
 * Why this row may not fill a day, or `null` where it may. Pure, and the
 * same for every family: a family's own gate is one more branch after the
 * shared ones.
 */
export function opportunityReady(o: Opportunity, ctx: ReadinessContext): UnreadyReason | null {
  const verdict = verdictReason(o, ctx.suppression);
  if (verdict !== null) return verdict;
  if (o.family === "improve" && !ctx.canUpdate(o.targetRef)) return "destination_cannot_address";
  // SPEC §7 (2026-09-20, #928). It speaks here — after the destination's own
  // answer and before everything about the market — because it is a fact
  // about this site's own pages rather than about the search: a topic the
  // site already covers is not a day's work whatever its volume, its band or
  // its grounding says. An Improve row is exempt by construction: it *is*
  // the update of an existing page, and the page it covers is its own.
  if (o.family !== "improve" && ctx.coveredBy(o) !== null) return "already_covered";
  // SPEC §6 (2026-09-29, issue 1134): the fit the pass judged and stored. A
  // target the business is not the answer to is never a day of supply.
  const fit = o.businessFit ?? null;
  if (o.family !== "fix" && fit !== null && fit < TOPIC_FIT.gate) return "low_fit";
  // Issue 1506: the same reason where the stored top ten says it.
  const topTen = o.family === "fix" ? null : (ctx.topTen?.(o) ?? null);
  if (topTen !== null && otherKindTopTen(topTen, ctx.business ?? null, o) !== null) return "low_fit";
  if (!ctx.grounded) return "no_grounding_fact";
  if (o.evidence.family === "earn" && !ctx.earnGrounding[o.evidence.asset]) return "no_grounding_fact";

  const query = o.targetQuery ?? "";
  if (o.family !== "fix" && comparisonWithoutAsking(o, ctx)) return "no_intent";
  if (o.type === "keyword_page") {
    // Issue 1561: a placed business's service asked for in its place is
    // commercial, read by the same classifier.
    const intent = ctx.profile === null ? null : classifyIntent(query, ctx.profile, placedBusiness(ctx.business));
    // The band the keyword gate asks for is `winnable` — tighter than the
    // shared rule above, which admits `reach` too. It stays here because it
    // is this type's own gate (§6, 2026-09-15) and not the right-sizing law.
    const atTopFit = fit !== null && fit >= TOPIC_FIT.writeAt;
    const passes =
      (atTopFit ||
        (volumeOf(o) >= KEYWORD_PAGE_MIN_VOLUME &&
          o.fitBand === "winnable" &&
          intent !== null &&
          COMMERCIAL_INTENTS.has(intent))) &&
      !ctx.ownRanks(query);
    if (!passes) return "keyword_gate";
  }
  if (o.type === "format_page" && !FORMAT_WORDS.test(query)) return "format_not_allowed";

  // SPEC §6's right-sizing law, for every type that takes a publishing day
  // (issue 884, owner's ruling 2026-09-18). It was enforced at read time by
  // the ranking (issue 881) while only `keyword_page` carried it here, so a
  // row could be stored `ready: true` and still be incapable of filling a
  // day — the database, the screens and the ranking each holding a
  // different answer. The decision is made once, here, and stored; the
  // ranking and the supply count read the column.
  //
  // It speaks **after** each type's own gate, so a `keyword_page` still
  // reports `keyword_gate` — that gate is the tighter one and names the
  // type's own rule — and the new reason is reached only where nothing more
  // specific applies.
  //
  // The Fix family carries no band and takes no search: `fixPageReadiness`
  // is its own predicate, and `fit_band` is null for exactly that family (a
  // check constraint holds it), so this asks nothing of it.
  if (o.family !== "fix" && !qualifiesForADay(o.fitBand)) return "outsized";
  // SPEC §6 (D60, issue 1288): a topic with no measured volume and no
  // matching tracked prompt is not written. One buyers were seen asking
  // beside the site's searches is observed demand (issue 1519).
  const prompts = ctx.prompts ?? [];
  const observed = o.evidence.family === "write" && o.evidence.askedBeside !== undefined;
  if (o.family !== "fix" && !observed && query.trim() !== "" && prompts.length > 0 && !hasGoal(intentFor({ query, volume: o.volume }, prompts))) {
    return "no_intent";
  }
  return null;
}

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
 * Records readiness on every open Write, Improve and Earn row of one site.
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
  }
): Promise<{ ready: number; unready: number }> {
  const now = a.now ?? new Date();
  const store = opportunityStore();
  const rows = await store.openRankable(siteId);
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
  // SPEC §7 (2026-09-20, #928): one narrowed read per row whose topic could
  // be covered, before the loop — so the predicate the decision reads is a
  // resolved answer and `opportunityReady` stays pure and synchronous.
  const covered = await coveredTopics(siteId, rows.map(readOpportunity));
  const ctx: ReadinessContext = {
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
    topTen: (o) => (o.targetQuery === null ? null : freshTopTen(topTens.get(queryKey(o.targetQuery)), now)),
    business:
      market === null
        ? null
        : { kind: market.kind ?? null, serves: market.serves ?? null, words: [market.category, ...market.synonyms].join(" ") },
  };

  // Issue 884: the row's band is brought up to today's law before its
  // readiness is decided, so a row banded under an older one is corrected
  // by the next pass rather than competing as if it still qualified.
  const ownRanked = ownRankedOf(report);

  let ready = 0;
  for (const row of rows) {
    const stored = readOpportunity(row);
    const band = ownRanked === null ? null : rebandFor(stored, ownRanked);
    if (band !== null && band !== stored.fitBand) await store.setFitBand(stored.id, band);
    const opportunity = band === null ? stored : { ...stored, fitBand: band };
    const reason = isResting(stored, now) ? "resting" : opportunityReady(opportunity, ctx);
    if (reason === null) ready += 1;
    if (stored.ready !== (reason === null) || stored.unreadyReason !== reason) {
      await store.setReadiness(opportunity.id, reason);
    }
  }
  return { ready, unready: rows.length - ready };
}
