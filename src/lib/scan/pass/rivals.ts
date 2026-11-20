// src/lib/scan/pass/rivals.ts — sizing the tracked rivals and the ones Google shows.
import { PRICE_BOOK, SERP_RIVAL_SIZING } from "@/lib/config/constants";
import type { MarketConclusion } from "@/lib/market/infer/types";
import { serpDomainsToSize } from "@/lib/market/rivals/candidates";
import { sizeRivals, type RivalSize } from "@/lib/market/rivals/size";
import { trackedRivals } from "@/lib/market/rivals/tracked";
import type { MarketSerp } from "@/lib/market/views";
import { measured, measuredZero, type Measured } from "@/lib/measure/measured";
import type { RankedRow } from "@/lib/vendors/dataforseo/types";
import type { CanonicalDomain } from "../domain";
import { readCurrentReport } from "../report";
import { attempt, failed, localeOfPass, ownRankedValue, type StageArgs, withPurse } from "./sections";

/** §6.6's sizing of the rivals the customer chose, buying their `ranked_keywords`@100 (§6.3). Only tiers whose `sizesRivals` says so:
 *  §6.4 never sizes per rival on the free path. `ownRanked`'s `unmeasured` arm reads as the cold-start 0; `previous` carries an unmeasured rival
 *  forward with its earlier date and `current: false`, and its absence makes a rival `awaiting_deep_pass`. Every failure leaves the arm alone; never throws. */
export async function sizeTrackedRivals(a: StageArgs): Promise<void> {
  const siteId = a.siteId;
  if (!a.parameters.sizesRivals || siteId === undefined) return;
  // A thin market sized the rivals already inside `reading_your_market`: the same rows are never bought twice.
  if (a.sections.rivalRows !== null) return;
  const rivalRows = new Map<string, readonly RankedRow[]>();
  a.sections.rivalRows = rivalRows;

  // `null` is a site that is not there, which is not "tracks none": the
  // sizing then stays on the arm that says the pass did not get to it,
  // rather than storing a measured zero about a customer nobody read.
  const rivals = await attempt("checking_your_presence", () => trackedRivals(siteId));
  if (failed(rivals) || rivals === null) return;

  const measurement = a.sections.measurement;
  const at = measurement === null ? a.startedAt : measurement.drivers.foundations.at;
  const ownRanked = measurement === null ? 0 : ownRankedValue(measurement.ownRanked);

  const previous = await attempt("checking_your_presence", () => previousSizes(a.domain));
  // A weekly pass sizes one due rival again; the rest keep their size.
  const purse = a.parameters.rivalResizes === null ? a.cost : withPurse(a.cost, a.parameters.rivalResizes * PRICE_BOOK.RANKED_RIVAL_COST_C);
  const sized = await attempt("checking_your_presence", () =>
    sizeRivals(purse, {
      rivals,
      ownRanked,
      at,
      locale: localeOfPass(a),
      // Absent, never `[]`: an empty array says "the last pass sized these
      // and found none", which would make every rival here
      // `added_since_last_sizing` instead of `awaiting_deep_pass`.
      ...(failed(previous) || previous === undefined ? {} : { previous }),
      onRows: (domain, rows) => {
        rivalRows.set(domain, rows);
      },
    })
  );
  if (!failed(sized) && !a.bounds.abandoned()) a.sections.rivalSizes = sized;
}

/** The rivals of the questions this pass asked: winnability and the report's rival order read `sections.rivalSizes`, so an unsized top-ten domain
 *  is `undeterminable` and an unsized giant would outrank a reachable competitor. Candidates are the pass's own top tens (`serpRivalCandidates`),
 *  with no `previous`: an unmeasurable one says `budget_reached`. Domains sized this pass are skipped; one inside §6.4's 30-day window is served free from cache.
 *  Spends from its own purse (`withPurse`, `SERP_RIVAL_SIZING`), net of the opportunity typing's reserve; never raises a cap or throws. */
export async function sizeSerpRivals(a: StageArgs): Promise<void> {
  const { bounds, cost, sections } = a;
  if (!a.parameters.sizesRivals) return;
  // The one purchase below an `await enter(...)` in this pipeline, so it
  // reads both ceilings itself: a pass the deadline has already ended does
  // not buy, and `score` still runs over what it has.
  if (bounds.stopNow() !== null || bounds.abandoned()) return;

  const serps: MarketSerp[] = [];
  for (const serp of sections.serps as readonly Measured<MarketSerp>[]) {
    if (serp.kind !== "unmeasured") serps.push(serp.value);
  }
  if (serps.length === 0) return;

  // Already measured in this pass is not bought twice; one carried forward from an earlier pass is re-measured for this pass's questions.
  const current = new Set<string>();
  if (sections.rivalSizes.kind !== "unmeasured") {
    for (const size of sections.rivalSizes.value) {
      if (size.state === "sized" && size.current) current.add(size.domain);
    }
  }

  // Of the top tens' domains, only those this market holds as on-market are sized, never a publisher, aggregator or excluded domain.
  // The market is the one this pass concluded, else the one the site holds.
  const market = sections.market ?? (await storedMarketOf(a.siteId));
  if (bounds.abandoned()) return;
  const { inTopTens, domains: candidates } = serpDomainsToSize({
    serps,
    ownDomain: a.domain,
    market,
    answers: sections.marketPrompts,
    alreadySized: current,
    max: SERP_RIVAL_SIZING.candidatesMax,
  });
  logSerpCandidates(candidates.length, current.size, inTopTens);
  if (candidates.length === 0) return;

  const measurement = sections.measurement;
  const at = measurement === null ? a.startedAt : measurement.drivers.foundations.at;
  const ownRanked = measurement === null ? 0 : ownRankedValue(measurement.ownRanked);
  const purse = Math.min(
    SERP_RIVAL_SIZING.candidatesMax * PRICE_BOOK.RANKED_RIVAL_COST_C,
    bounds.remainingCents()
  );

  const sized = await attempt("scoring", () =>
    sizeRivals(withPurse(cost, purse), {
      rivals: candidates,
      ownRanked,
      at,
      locale: localeOfPass(a),
      neverSizedBecause: "budget_reached",
    })
  );
  if (failed(sized) || sized.kind === "unmeasured" || bounds.abandoned()) return;
  sections.rivalSizes = joinSizes(sections.rivalSizes, sized.value, at);
}

/** The two halves of `rivalSizes`, one entry per domain. A held domain is replaced only by a measurement this pass took, never by `unsized`,
 *  which would demote a carried-forward rival to "never measured". */
function joinSizes(
  held: Measured<RivalSize[]>,
  fresh: readonly RivalSize[],
  at: Date
): Measured<RivalSize[]> {
  const entries: RivalSize[] = held.kind === "unmeasured" ? [] : [...held.value];
  for (const entry of fresh) {
    const index = entries.findIndex((existing) => existing.domain === entry.domain);
    if (index === -1) {
      entries.push(entry);
      continue;
    }
    if (entry.state === "sized") entries[index] = entry;
  }
  return entries.length === 0 ? measuredZero<RivalSize[]>(entries, at) : measured(entries, at);
}

/** How many of its own SERPs' domains a pass took as candidates and how many it already held a fresh size for. Counts only, no domain. */
function logSerpCandidates(candidates: number, alreadySized: number, inTopTens: number): void {
  console.log(JSON.stringify({ event: "serp_rival_candidates", candidates, alreadySized, inTopTens }));
}

/** The market a site holds, or `null` where none or unreadable: a pass that knows no market sizes no top-ten domain. */
async function storedMarketOf(siteId: string | undefined): Promise<MarketConclusion | null> {
  if (siteId === undefined) return null;
  try {
    const { readSiteMarket } = await import("@/lib/market/infer/stored");
    return (await readSiteMarket(siteId))?.stored.current ?? null;
  } catch {
    return null;
  }
}

/** The sizing the last stored report carries, or `undefined` where no pass
 *  has sized this domain's rivals yet. */
async function previousSizes(domain: CanonicalDomain): Promise<readonly RivalSize[] | undefined> {
  const stored = await readCurrentReport(domain);
  if (stored === null || stored.rivalSizes.kind === "unmeasured") return undefined;
  return stored.rivalSizes.value;
}
