// SPEC §2 · §6 (issue 787) — the free report's one first page.
//
// The report offers the page the paid engine would write first, chosen from
// what the scan already measured. It spends nothing and calls no model: the
// candidates are `writeCandidates`' — the same Write derivation, with the
// same right-sizing (a search outsized for the site's own footprint is
// refused there) — and nothing here adds one.
//
// **The order.** The owner's Write type order first (`comparePrecedence`,
// 2026-09-15), then the search's right-sized band, then §7's score. The free
// path sizes no rival (§6.4), so a free report's competition band is
// unmeasured; its band here is the demand band — the search against the
// site's own footprint, which is the half of right-sizing a free scan can
// read. A paid report's band is the full one the derivation recorded.
//
// **One candidate per search, and the count is of those.** "Page 1 of N" is
// N searches with a page worth writing, never N rows for the same search.
import { fromStored } from "@/lib/presentation/generated";
import type { FreePageSection, StoredReport } from "@/lib/scan/report";
import { comparePrecedence } from "./cluster";
import type { Candidate } from "./derive/candidate";
import { writeCandidates } from "./derive/write";
import type { Opportunity, Winnability } from "./types";
import { rankScore } from "./rank/score";
import { demandBand } from "./winnability/band";
import { rankedCountsFromSizes } from "./winnability/counts";

const BAND_ORDER: Readonly<Record<Winnability, number>> = Object.freeze({ winnable: 0, reach: 1, "not-yet": 2 });

export interface FreePagePick {
  readonly candidate: Candidate;
  /** The question the page answers — its wording is the card's title. */
  readonly question: { readonly text: string };
  readonly total: number;
}

function ownRankedOf(report: Omit<StoredReport, "freePage">): number {
  return report.ownRanked.kind === "unmeasured" ? 0 : report.ownRanked.value;
}

function bandOf(candidate: Candidate, ownRanked: number, sized: boolean): Winnability {
  if (sized) return candidate.fitBand ?? "not-yet";
  const volume = candidate.volume === null || candidate.volume.kind === "unmeasured" ? 0 : candidate.volume.value;
  return demandBand({ volume, ownRanked });
}

/** The best right-sized Write target the report measured, or `null` where it
 *  measured none. Pure. */
export function bestFreePage(report: Omit<StoredReport, "freePage">): FreePagePick | null {
  if (report.questions.kind === "unmeasured" || report.market.kind === "unmeasured") return null;
  const profile = report.market.value.profile;
  const ownRanked = ownRankedOf(report);
  const sized = report.rivalSizes.kind !== "unmeasured";
  const rankedCounts = rankedCountsFromSizes(
    report.rivalSizes.kind === "unmeasured" ? [] : report.rivalSizes.value,
    report.verdict.measuredAt
  );
  const { candidates } = writeCandidates({
    siteId: "",
    scanId: report.scanId,
    report: { ...report, freePage: null },
    ownRanked,
    rankedCounts,
  });

  const ranked = candidates
    .map((candidate) => {
      const band = bandOf(candidate, ownRanked, sized);
      const score = rankScore({
        volume: candidate.volume,
        query: candidate.targetQuery ?? "",
        type: candidate.type,
        fit: band,
        profile,
      });
      return { candidate, band, score };
    })
    .filter((entry) => entry.band !== "not-yet")
    .sort(
      (a, b) =>
        comparePrecedence(a.candidate, b.candidate) ||
        BAND_ORDER[a.band] - BAND_ORDER[b.band] ||
        b.score - a.score
    );

  const best = ranked[0];
  if (best === undefined) return null;
  const question = report.questions.value.find((q) => q.search.keyword === best.candidate.targetQuery);
  if (question === undefined) return null;
  return { candidate: best.candidate, question, total: ranked.length };
}

/** The pick as the report's card reads it. The id is the scan's and the
 *  slug's: a free report persists no opportunity row, and the card needs one
 *  identity per proposed page. */
export function freePageOf(report: Omit<StoredReport, "freePage">): FreePageSection | null {
  const pick = bestFreePage(report);
  if (pick === null) return null;
  const { candidate } = pick;
  const evidence = candidate.evidence;
  return {
    opportunityId: freePageId(report.scanId, candidate.targetRef),
    title: fromStored("questions.wording", pick.question.text),
    slug: fromStored("opportunities.proposed_slug", candidate.targetRef),
    target: {
      keyword: candidate.targetQuery ?? "",
      volume: candidate.volume === null || candidate.volume.kind === "unmeasured" ? 0 : candidate.volume.value,
    },
    beats: evidence.family === "write" ? evidence.rival.domain : null,
    format: candidate.type,
    totalPages: pick.total,
  };
}

export function freePageId(scanId: string, slug: string): string {
  return `${scanId}:${slug}`;
}

/** The pick as the draft pipeline's steps read an opportunity: open, ready,
 *  unclustered, dated by the scan that measured it. */
export function freePageOpportunity(report: StoredReport, pick: FreePagePick): Opportunity {
  return {
    ...pick.candidate,
    id: freePageId(report.scanId, pick.candidate.targetRef),
    title: pick.question.text,
    status: "open",
    clusterKey: null,
    absorbedQueries: [],
    ready: true,
    unreadyReason: null,
    createdAt: report.verdict.measuredAt,
  };
}
