// SPEC §6 — "A day is filled only by an opportunity that passes readiness.
// Never pad the calendar."
//
// `eligible()` is the one check, and its answer is stored on the row
// (`ready`, `unready_reason`), so supply and next-work read the column and
// never re-derive it. Readiness holds a row only for harm (owner, #2511), in
// this order:
//
//   - `resting` — the topic's draft was skipped, or stopped since the week's
//     commit; or its URL retired (`suppression.ts`);
//   - `destination_cannot_address` — an Improve the destination cannot
//     deliver (issue 781), or a topic a page of the site already covers
//     (#928);
//   - `low_fit` — a stored business fit below the gate (§6, 2026-09-29).
//
// Demand, kind of business and size never hold a row: they order it
// (`rank/points.ts`). Nor does a site whose own pages ground no fact: its
// page stands on research alone.
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
import { TOPIC_FIT } from "@/lib/config/constants";
import type { StoredReport } from "@/lib/scan/report";
import { addressesOwnPage, type HostedOwnPages } from "@/lib/publish/destinations/hosted/own-page";
import { opportunityStore, readOpportunity } from "./store";
import { isResting, OUTSIZED, qualifiesForADay, type Winnability } from "./types";
import { demandBand } from "./winnability/band";
import { difficultyCeiling } from "./winnability/bars";
import { heldByVerdict, suppressionOf, type Suppression } from "./suppression";
import type { IntentPrompt } from "./intent";
import type { KnownMatch } from "@/lib/known-content/types";
import { queryKey } from "./cluster";
import { SHAPED } from "./content-type";
import { comparisonUnasked, type AskedBeside, type ComparisonBrands, type MeasuredAnswer } from "./derive/topics";
import { freshRead, offeringTopTen, type KindOfBusiness, type TopTenRead } from "./derive/top-ten-kind";
import type { Evidence, Opportunity, UnreadyReason } from "./types";

export interface ReadinessContext {
  /** The clock a topic's rest is read against. */
  now: Date;
  /** What this site's Monday verdicts hold back. */
  suppression: Suppression;
  /** Whether the site's destination can deliver an update of the page at
   *  this address (issue 781). */
  canUpdate: (url: string) => boolean;
  /** SPEC §7 (2026-09-20, #928): the page this site already has on the
   *  row's topic, where it has one, resolved before the loop so this stays
   *  pure. A row whose topic is covered and which is **not** itself the
   *  update of the covering page never fills a day. */
  coveredBy: (o: Opportunity) => KnownMatch | null;
}

/** What `comparisonWithoutAsking` reads beside the row. Absent members read none. */
export interface AskingContext {
  /** Issue 1506: the names a "vs" search is read by. Absent reads no search
   *  as one between products. */
  brands?: ComparisonBrands;
  /** The prompts the site tracks today. */
  prompts?: readonly IntentPrompt[];
  /** Issue 1506: what buyers were seen asking beside the market's searches. */
  asked?: readonly AskedBeside[];
  /** Issue 1520: the newest measured answers to the tracked prompts. */
  answers?: readonly MeasuredAnswer[];
  /** Issue 1520: whether a search is one ReachKit composed from the market. */
  composed?: (query: string) => boolean;
}

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
  ctx: AskingContext
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
        ? (o.evidence.rival?.domain ?? null)
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
  return null;
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

  const [verdicts, report, market, topTens] = await Promise.all([
    store.notWorkingVerdicts(siteId),
    store.currentReport(siteId),
    store.marketFor(siteId).then((read) => read.market).catch(() => null),
    store.topTenRows([...new Set(rows.map((row) => row.scan_id))]),
  ]);
  // Read only where there is an update to deliver.
  const ownPages = rows.some((row) => row.family === "improve") ? await store.hostedOwnPages(siteId) : null;
  // One narrowed read per row whose topic could be covered, before the loop,
  // so `eligible` stays pure and synchronous.
  const covered = await coveredTopics(siteId, rows.map(readOpportunity));
  const readOf = (o: Opportunity) => (o.targetQuery === null ? null : (topTens.get(queryKey(o.targetQuery)) ?? null));
  const ctx: ReadinessContext = {
    now,
    suppression: suppressionOf(verdicts),
    canUpdate: canUpdateFrom(ownPages),
    coveredBy: (o) => covered.get(o.id) ?? null,
  };
  const business: KindOfBusiness | null =
    market === null ? null : { kind: market.kind ?? null, serves: market.serves ?? null, words: [market.category, ...market.synonyms].join(" ") };

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
    const evidence = a.only === undefined || row.planned_for == null ? shapedEvidence(read, fresh(read), business) : read.evidence;
    const reshaped = shapeOf(evidence) !== shapeOf(read.evidence);
    if (reshaped) await store.setEvidence(read.id, evidence);
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
