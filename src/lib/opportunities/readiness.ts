// SPEC §7 *Readiness holds only for harm*: one stored answer per row (`ready`, `unready_reason`) that supply and next-work read.
import { TOPIC_FIT } from "@/lib/config/constants";
import type { StoredReport } from "@/lib/scan/report";
import { addressesOwnPage, type HostedOwnPages } from "@/lib/publish/destinations/hosted/own-page";
import { newestStop, readsAsBefore } from "./drafted";
import { measuredMarketOf, neverMeasured } from "@/lib/market/questions/measured";
import { opportunityStore, readOpportunity, type OpportunityRow } from "./store";
import { isResting, isRetarget, OUTSIZED, qualifiesForADay, type Winnability } from "./types";
import { demandBand } from "./winnability/band";
import { difficultyCeiling } from "./winnability/bars";
import { heldByVerdict, suppressionOf, type Suppression } from "./suppression";
import type { IntentPrompt } from "./intent";
import type { KnownMatch } from "@/lib/known-content/types";
import type { MarketWords } from "@/lib/market/infer/terms";
import { brandTokensOf, queryKey, reachedBy } from "./cluster";
import { contentTypeOf, SHAPED } from "./content-type";
import { firstOpenDay, orderRanked } from "./rank/open";
import { pointsOf } from "./rank/points";
import { footprintOpen } from "@/lib/market/footprint";
import { earnedSearches } from "@/lib/measure/page-reading";
import { weekStartFor } from "@/lib/scan/weekly/week";
import { comparisonUnasked, type AskedBeside, type ComparisonBrands, type MeasuredAnswer } from "./derive/topics";
import { freshRead, offeringTopTen, type KindOfBusiness, type TopTenRead } from "./derive/top-ten-kind";
import type { Evidence, Opportunity, UnreadyReason } from "./types";

export interface ReadinessContext {
  /** The clock a topic's rest is read against. */
  now: Date;
  /** What this site's Monday verdicts hold back. */
  suppression: Suppression;
  /** Whether the site's destination can deliver an update of the page at this address (issue 781). */
  canUpdate: (url: string) => boolean;
  /** The page this site already has on the row's topic, resolved before the loop so `eligible` stays pure. */
  coveredBy: (o: Opportunity) => KnownMatch | null;
  /** The site's market footprint is open (`footprintOpen`); while closed, a new comparison or listicle waits, */
  footprint: boolean;
  /** but for the one row `heldAllowed` lets the week plan, */
  allowed?: string | null;
  /** or a row whose search, or one it absorbed, Search Console measured the site at `EARNING.reach` or better on. */
  reachedBy?: (o: Opportunity) => string | null;
}

/** What `comparisonWithoutAsking` reads beside the row. Absent members read none. */
export interface AskingContext {
  /** Issue 1506: the names a "vs" search is read by. Absent reads no search as one between products. */
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

/** A comparison, alternatives or composed search nothing observed anyone asking; the answer a row came from counts. */
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
  // A new page with no score waits for one, never read as low; an update or a fix is never held for want of one.
  const fit = o.businessFit ?? null;
  if (fit === null ? o.family === "write" || o.family === "earn" : o.family !== "fix" && fit < TOPIC_FIT.gate) return fit === null ? "fit_unscored" : "low_fit";
  // A new topic with no `fitFact` key was judged before the call named one, and keeps its fit until judged again.
  if ((o.evidence.family === "write" || o.evidence.family === "earn") && o.evidence.fitFact === null) return "low_fit";
  if (!ctx.footprint && waitsForFootprint(o) && o.id !== ctx.allowed && (ctx.reachedBy?.(o) ?? null) === null) return "out_of_reach";
  return null;
}

/** The one held-kind row a closed gate lets a week take: none once one is drafted, else its committed one, `ai_gap`, rank. */
async function heldAllowed(siteId: string, open: readonly OpportunityRow[], ctx: ReadinessContext, a: { date?: string; evening: boolean; stopped: (o: Opportunity) => boolean }): Promise<string | null> {
  const store = opportunityStore(), pages = await store.draftedPages(siteId, 14), mondayOf = (date: string) => weekStartFor({ at: new Date(`${date}T00:00:00Z`), zone: "UTC" });
  const week = mondayOf(a.date ?? new Date(firstOpenDay(pages, ctx.now) * 86_400_000).toISOString().slice(0, 10)), inWeek = (date?: string | null) => date != null && mondayOf(date) === week;
  if (pages.some((page) => inWeek(page.date) && waitsForFootprint(readOpportunity(page.row)))) return null;
  const held = open.filter((row) => waitsForFootprint(readOpportunity(row)) && !a.stopped(readOpportunity(row)) && eligible(readOpportunity(row), { ...ctx, footprint: true }) === null);
  const seen = { cited: new Set<string>(), prompts: held.length === 0 ? [] : await store.trackedPrompts(siteId).catch(() => []) };
  const ranked = orderRanked(held.map((row) => ({ opportunity: readOpportunity(row), ...pointsOf(readOpportunity(row), seen) }))).map((entry) => held.find((row) => row.id === entry.opportunityId)!);
  return (ranked.find((row) => inWeek(row.planned_for)) ?? (a.evening ? ranked.find((row) => row.planned_for != null) : undefined) ?? ranked.find((row) => row.source === "ai_gap") ?? ranked[0])?.id ?? null;
}

/** A new page, or a live page retargeted onto a new search, written as a comparison or listicle. */
export function waitsForFootprint(o: Pick<Opportunity, "family" | "type" | "targetQuery"> & { evidence?: Evidence | null }): boolean {
  return (o.family === "write" || o.family === "earn" || isRetarget(o)) && contentTypeOf(o) === "listicle";
}

/** A new page's evidence after its fresh top ten: `shape: "offering"` where it asks for a provider's own page. Pure. */
export function shapedEvidence(o: Opportunity, read: TopTenRead | null, business: KindOfBusiness | null): Evidence {
  const evidence = o.evidence;
  if (read === null || !SHAPED.has(o.type) || (evidence.family !== "write" && evidence.family !== "earn")) return evidence;
  const rest = { ...evidence };
  delete rest.shape;
  return offeringTopTen(read, business, o.targetQuery ?? "") ? { ...rest, shape: "offering" } : rest;
}

const shapeOf = (evidence: Evidence): string | undefined => ("shape" in evidence ? evidence.shape : undefined);

/** Which pages the destination can update: a hosted one only its own live publications, any other answers for itself. */
export function canUpdateFrom(own: HostedOwnPages | null): (url: string) => boolean {
  if (own === null) return () => true;
  return (url) => addressesOwnPage(url, own);
}

/** Today's band from stored numbers, so a row banded under older bars is corrected; a floor, never a promotion. */
export function rebandFor(o: Opportunity, ownRanked: number): Winnability | null {
  if (o.family === "fix" || o.fitBand === null) return null;
  if (!qualifiesForADay(o.fitBand)) return o.fitBand;

  const volume = o.volume;
  if (volume !== null && volume.kind !== "unmeasured" && demandBand({ volume: volume.value, ownRanked }) === "not-yet") {
    return OUTSIZED;
  }
  const difficulty = "target" in o.evidence ? o.evidence.target?.difficulty : undefined;
  if (difficulty !== undefined && difficulty.kind !== "unmeasured" && difficulty.value > difficultyCeiling(ownRanked)) return OUTSIZED;
  return o.fitBand;
}

/** The site's measured ranked count, or `null`, which leaves every stored band alone. */
function ownRankedOf(report: StoredReport | null): number | null {
  const own = report?.ownRanked;
  if (own === undefined || own.kind === "unmeasured") return null;
  return own.value;
}

/** The page the site already has on each row's topic; an unreadable index refuses no topic. */
async function coveredTopics(siteId: string, rows: readonly Opportunity[], market: MarketWords | null): Promise<Map<string, KnownMatch>> {
  const out = new Map<string, KnownMatch>();
  const { alreadyCovered } = await import("@/lib/known-content/match");
  const store = opportunityStore();
  for (const row of rows) {
    if (row.family === "improve" || row.family === "fix") continue;
    const query = row.targetQuery ?? "";
    if (query.trim() === "") continue;
    const near = await store.knownContentNear({ siteId, query });
    const match = alreadyCovered({ query, title: row.title }, near, market);
    if (match !== null) out.set(row.id, match);
  }
  return out;
}

/** Records readiness on a site's open rows, or the ones `only` names, writing only the answers that changed. */
export async function assessReadiness(
  siteId: string,
  a: {
    at: Date;
    /** The clock a topic's rest is read against. `at` is the report's own
     *  moment on the evening run, which can be a week old. */
    now?: Date;
    /** Issue 1559: only these rows — a pass's new ones, or the evening's committed week. Absent: every open row. */
    only?: ReadonlySet<string>;
    /** The Monday pass: an open market footprint is recorded. */
    record?: boolean;
    plannedFrom?: string;
  }
): Promise<{ ready: number; unready: number }> {
  const now = a.now ?? new Date();
  const store = opportunityStore();
  const open = await store.openRankable(siteId);
  const rows = a.only === undefined ? open : open.filter((row) => a.only!.has(row.id));
  if (rows.length === 0) return { ready: 0, unready: 0 };

  const [verdicts, report, sited, topTens, drafts] = await Promise.all([
    store.notWorkingVerdicts(siteId),
    store.currentReport(siteId),
    store.marketFor(siteId).catch(() => null),
    store.topTenRows([...new Set(rows.map((row) => row.scan_id))]),
    // Drafts that cannot be read hold nothing: what cannot be read has changed.
    store.draftsOnTopics?.(siteId).catch(() => []) ?? [],
  ]);
  const market = sited?.market ?? null;
  // Q8: while the newest draft on a topic is one the checks stopped, it waits for what that draft read to change. The
  // newest stored top ten of each search wins; one that cannot be read reads none.
  const scans = [...new Set([...drafts.filter((d) => d.stopped).map((d) => d.row.scanId), ...(report === null ? [] : [report.scanId])])];
  const stopTens = scans.length === 0 ? new Map<string, readonly string[]>() : await store.topTens(scans).catch(() => new Map<string, readonly string[]>());
  const stillStopped = (o: Opportunity) => {
    const stop = newestStop(o, drafts);
    return stop !== null && readsAsBefore(stop.read, stopTens, sited?.competitors ?? null);
  };
  const measured = measuredMarketOf(market);
  const offMarket = (o: Opportunity) => (o.family === "write" || o.family === "earn") && measured !== undefined && o.targetQuery !== null && neverMeasured(o.targetQuery, measured) !== null;
  // Read only where there is an update to deliver.
  const ownPages = rows.some((row) => row.family === "improve") ? await store.hostedOwnPages(siteId) : null;
  // One narrowed read per row whose topic could be covered, before the loop,
  // so `eligible` stays pure and synchronous.
  const covered = await coveredTopics(siteId, rows.map(readOpportunity), market);
  const readOf = (o: Opportunity) => (o.targetQuery === null ? null : (topTens.get(queryKey(o.targetQuery)) ?? null));
  const ctx: ReadinessContext = {
    now,
    suppression: suppressionOf(verdicts),
    canUpdate: canUpdateFrom(ownPages),
    coveredBy: (o) => covered.get(o.id) ?? null,
    // Read only where a row could wait on it.
    footprint: !rows.some((row) => waitsForFootprint(readOpportunity(row))) || (await footprintOpen(store, siteId, { report, market, record: a.record === true })),
  };
  if (!ctx.footprint) {
    ctx.allowed = await heldAllowed(siteId, open, ctx, { date: a.plannedFrom, evening: a.only !== undefined, stopped: stillStopped });
    ctx.reachedBy = reachedBy(earnedSearches(await store.refreshPages(siteId).catch(() => [])), report === null ? [] : brandTokensOf(report), market);
  }
  const business: KindOfBusiness | null =
    market === null ? null : { kind: market.kind ?? null, serves: market.serves ?? null, words: [market.category, ...market.synonyms].join(" ") };

  const fresh = (o: Opportunity) => freshRead(readOf(o), now);

  // Issue 884: the row's band is brought up to today's law before its readiness is decided, so a row banded under an
  // older one is corrected by the next pass rather than competing as if it still qualified.
  const ownRanked = ownRankedOf(report);

  let ready = 0;
  for (const row of rows) {
    const read = readOpportunity(row);
    if (offMarket(read)) {
      await store.markDismissed(read.id);
      continue;
    }
    // A row committed to a date is reshaped only by the week's full pass,
    // so the evening check never makes more of a chosen week offering pages.
    const evidence = a.only === undefined || row.planned_for == null ? shapedEvidence(read, fresh(read), business) : read.evidence;
    const reshaped = shapeOf(evidence) !== shapeOf(read.evidence);
    if (reshaped) await store.setEvidence(read.id, evidence);
    const stored = reshaped ? { ...read, evidence } : read;
    const band = ownRanked === null ? null : rebandFor(stored, ownRanked);
    if (band !== null && band !== stored.fitBand) await store.setFitBand(stored.id, band);
    const opportunity = band === null ? stored : { ...stored, fitBand: band };
    const reason = stillStopped(opportunity) ? "resting" : eligible(opportunity, ctx);
    const by = reason === null && !ctx.footprint && waitsForFootprint(opportunity) && opportunity.id !== ctx.allowed ? (ctx.reachedBy?.(opportunity) ?? null) : null;
    if (by !== null) console.log(JSON.stringify({ event: "reach_from_search_console", siteId, opportunityId: opportunity.id, search: by }));
    if (reason === null) ready += 1;
    if (stored.ready !== (reason === null) || stored.unreadyReason !== reason) {
      await store.setReadiness(opportunity.id, reason);
    }
  }
  return { ready, unready: rows.length - ready };
}
