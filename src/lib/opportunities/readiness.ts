// SPEC §7 *Readiness holds only for harm*: one stored answer per row (`ready`, `unready_reason`) that supply and next-work read.
import { TOPIC_FIT } from "@/lib/config/constants";
import type { StoredReport } from "@/lib/scan/report";
import { addressesOwnPage, type HostedOwnPages } from "@/lib/publish/destinations/hosted/own-page";
import { newestStop, readsAsBefore } from "./drafted";
import { measuredMarketOf, neverMeasured } from "@/lib/market/questions/measured";
import { opportunityStore, readOpportunity } from "./store";
import { isResting, isRetarget, OUTSIZED, qualifiesForADay, type Winnability } from "./types";
import { demandBand } from "./winnability/band";
import { difficultyCeiling } from "./winnability/bars";
import { heldByVerdict, suppressionOf, type Suppression } from "./suppression";
import type { KnownMatch } from "@/lib/known-content/types";
import type { MarketConclusion } from "@/lib/market/infer/types";
import { queryKey } from "./cluster";
import { contentTypeOf, SHAPED } from "./content-type";
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
}

/** Why this row may not fill a day, or `null` where it may. Pure. */
export function eligible(o: Opportunity, ctx: ReadinessContext): UnreadyReason | null {
  if (isResting(o, ctx.now) || heldByVerdict(o, ctx.suppression)) return "resting";
  if (o.family === "improve" && !ctx.canUpdate(o.targetRef)) return "destination_cannot_address";
  // An Improve row is the update of the page that covers its topic.
  if (o.family !== "improve" && ctx.coveredBy(o) !== null) return "destination_cannot_address";
  // Fit ranks a row; only a search the business does not sell is held, and an unscored one ranks as a 2.
  if (o.family !== "fix" && (o.businessFit ?? TOPIC_FIT.gate) < TOPIC_FIT.gate) return "low_fit";
  return null;
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
async function coveredTopics(siteId: string, rows: readonly Opportunity[], market: MarketConclusion | null, domain: string | null): Promise<Map<string, KnownMatch>> {
  const out = new Map<string, KnownMatch>();
  const { alreadyCovered, productsOf } = await import("@/lib/known-content/match");
  const store = opportunityStore();
  const products = domain === null ? [] : productsOf(domain, market);
  // A list or comparison is also matched on the products its page compares, which its search's words may not share.
  const listed = (o: Opportunity) => products.length > 0 && contentTypeOf(o) === "listicle";
  const comparing = rows.some(listed) ? await store.knownContentNear({ siteId, query: products.join(" or ") }) : [];
  for (const row of rows) {
    if (row.family === "improve" || row.family === "fix") continue;
    const query = row.targetQuery ?? "";
    if (query.trim() === "") continue;
    const near = await store.knownContentNear({ siteId, query });
    const match = listed(row) ? alreadyCovered({ query, title: row.title, products }, [...near, ...comparing], market) : alreadyCovered({ query, title: row.title }, near, market);
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
  const covered = await coveredTopics(siteId, rows.map(readOpportunity), market, report?.domain ?? null);
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
    if (reason === null) ready += 1;
    if (stored.ready !== (reason === null) || stored.unreadyReason !== reason) {
      await store.setReadiness(opportunity.id, reason);
    }
  }
  return { ready, unready: rows.length - ready };
}
