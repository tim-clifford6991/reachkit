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

/**
 * §6.6's sizing, over the rivals the customer chose.
 *
 * It runs in the presence stage because that is the stage about presence:
 * stage one already bought the customer's own ranked rows, and this buys
 * the rivals' — §6.3's paid list, "`ranked_keywords`@100 ×rivals". It runs
 * at the tiers whose parameters say so and at no other, which is how
 * §6.4's "never per-rival `ranked_keywords` on the free path" is kept: the
 * free tier's `sizesRivals` is `false` and there is no other door.
 *
 * **Three inputs, and each is read rather than invented.** The rivals are
 * the site's own, in the order the customer chose them. `ownRanked` is the
 * count stage one measured — its `unmeasured` arm reads as the cold-start
 * 0, which `sizeRivals` documents as an ordinary input and which bands
 * every rival against the floors. `previous` is the last stored report's
 * sizing, so a rival this pass could not measure is carried forward with
 * its **earlier** date and `current: false` rather than falling back to
 * "we have never measured this" (REQ-096 c4) — and its absence, where no
 * pass has ever sized, is what makes a rival `awaiting_deep_pass`.
 *
 * Every failure is a leave-alone: a site whose rivals cannot be read, a
 * report that cannot be re-read, a sizing that raised — each leaves
 * `sections.rivalSizes` on the arm that says the pass did not get to it,
 * and the pass carries on. Nothing here throws.
 */
export async function sizeTrackedRivals(a: StageArgs): Promise<void> {
  const siteId = a.siteId;
  if (!a.parameters.sizesRivals || siteId === undefined) return;
  // A thin market sized the rivals already, inside `reading_your_market`
  // (SPEC §6 thin markets): the same rows are never bought twice.
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
  // D64: a weekly pass sizes one due rival again; the rest keep their size.
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

/**
 * **The rivals of the questions this pass actually asked** (issue 901).
 *
 * `sizeTrackedRivals` above sizes the set the customer chose, and nothing
 * fed it the pass's own market: a pass that selected twelve right-sized
 * questions banded every one of them against domains that never appeared
 * in their SERPs. Winnability reads a top-ten domain's ranked count
 * (`rankedCountsFromSizes` → `rankedCountsFor`), so a domain nobody sized
 * is `undeterminable` and cannot satisfy a bar; and the report's rivals
 * are ordered and filtered by the bands this pass holds (issue 858), so
 * an unsized giant outranked the reachable competitor in the site's own
 * top ten. Both read `sections.rivalSizes`, so both are fixed by putting
 * the right domains in it.
 *
 * **The candidates are the pass's own twelve top tens**, ranked and
 * selected by `serpRivalCandidates`. Nothing stale reaches them: no
 * `previous` is supplied, so a domain this call could not measure says
 * `budget_reached` rather than borrowing a sizing from a pass whose
 * questions these are not.
 *
 * **Reusing what is already bought.** A domain this pass has already
 * sized as a tracked rival is skipped outright, and a domain sized by an
 * earlier pass inside §6.4's 30-day rival window is served from the
 * cache, which is free and does not touch the cap. The rows are not
 * pooled: SPEC §6's thin-market pool is what *selection* chose over, and
 * selection is two stages behind by the time this runs.
 *
 * **Inside the existing budgets, and it says when it ran out.** The pass's
 * own cap and ceilings are unchanged and no cap is raised: the sizing
 * spends from a purse of its own (`withPurse`), bounded by
 * `SERP_RIVAL_SIZING` and by what the pass has left, which is already net
 * of the reserve the opportunity typing still needs. A candidate the purse could not reach is
 * stored `unsized` with `budget_reached` — said in the report, never
 * silently replaced by an unrelated set.
 *
 * Every failure is a leave-alone, exactly as the tracked sizing's are:
 * nothing here throws and nothing downstream is synthesised.
 */
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

  // Already measured **in this pass**: a tracked rival sized a moment ago
  // is not bought twice. One carried forward from an earlier pass is not
  // in this set, and is re-measured rather than left to band a question
  // this pass introduced.
  const current = new Set<string>();
  if (sections.rivalSizes.kind !== "unmeasured") {
    for (const size of sections.rivalSizes.value) {
      if (size.state === "sized" && size.current) current.add(size.domain);
    }
  }

  // SPEC §6 (owner D64, issue 1301): of the top tens' domains, only the ones
  // this market holds as on-market are sized — never a publisher, an
  // aggregator or a domain a conclusion left out. The market is the one this
  // pass concluded, else the one the site holds.
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

/** The two halves of `rivalSizes`, as one entry per domain.
 *
 *  A domain the held value already carries keeps its place. It is replaced
 *  only by a **measurement this pass took** — never by an `unsized` entry,
 *  which would demote a rival carried forward with its earlier date into
 *  "we have never measured this" (REQ-096 c4). */
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

/** Issue 901's observability line: how many of its own SERPs' domains a
 *  pass took as candidates and how many it already held a fresh size for.
 *  Counts only — no domain reaches a log line from here, the same
 *  discipline `size.ts` and `derive.ts` keep. */
function logSerpCandidates(candidates: number, alreadySized: number, inTopTens: number): void {
  console.log(JSON.stringify({ event: "serp_rival_candidates", candidates, alreadySized, inTopTens }));
}

/** The market a site holds, or `null` where it holds none or it could not
 *  be read: a pass that knows no market sizes no top-ten domain (D64). */
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
