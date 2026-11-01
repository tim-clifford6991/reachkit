// SPEC §2 · §6 (issue 787) — the free report's one first page.
//
// The report offers the page the paid engine would write first, chosen from
// what the scan already measured. It spends nothing and calls no model: the
// candidates are `writeCandidates`' — the same Write derivation, with the
// same right-sizing (a search outsized for the site's own footprint is
// refused there) — and nothing here adds one.
//
// **The order.** The owner's Write type order first (`comparePrecedence`,
// 2026-09-15), then the search's right-sized band, then §7's points. The free
// path sizes no rival (§6.4), so a free report's competition band is
// unmeasured; its band here is the demand band — the search against the
// site's own footprint, which is the half of right-sizing a free scan can
// read. A paid report's band is the full one the derivation recorded.
//
// **One candidate per search, and the count is of those.** "Page 1 of N" is
// N searches with a page worth writing, never N rows for the same search.
import { isSourceRow } from "@/lib/market/rivals/domains";
import { fromStored } from "@/lib/presentation/generated";
import type { FreePageSection, StoredReport } from "@/lib/scan/report";
import { comparePrecedence } from "./cluster";
import type { Candidate } from "./derive/candidate";
import { holderOf, sourceReadingOf, writeCandidates } from "./derive/write";
import type { Opportunity, Winnability } from "./types";
import { pointsOf, volumeOrder } from "./rank/points";
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

/** The right-sized Write targets the report measured, best first. Pure. */
export function rankedFreePages(report: Omit<StoredReport, "freePage">): Candidate[] {
  if (report.questions.kind === "unmeasured" || report.market.kind === "unmeasured") return [];
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
      const { points } = pointsOf(candidate, { cited: new Set(), prompts: [] });
      return { candidate, band, points };
    })
    .filter((entry) => entry.band !== "not-yet")
    .sort(
      (a, b) =>
        comparePrecedence(a.candidate, b.candidate) ||
        BAND_ORDER[a.band] - BAND_ORDER[b.band] ||
        b.points - a.points ||
        volumeOrder(b.candidate) - volumeOrder(a.candidate)
    );

  return ranked.map((entry) => entry.candidate);
}

function pickOf(report: Omit<StoredReport, "freePage">, candidate: Candidate | undefined, total: number): FreePagePick | null {
  if (candidate === undefined || report.questions.kind === "unmeasured") return null;
  const question = report.questions.value.find((q) => q.search.keyword === candidate.targetQuery);
  return question === undefined ? null : { candidate, question, total };
}

/** The best right-sized Write target the report measured, or `null` where it
 *  measured none. Pure. */
export function bestFreePage(report: Omit<StoredReport, "freePage">): FreePagePick | null {
  const ranked = rankedFreePages(report);
  return pickOf(report, ranked[0], ranked.length);
}

/** The page the stored report proposed, so the lead gets the card it was
 *  shown even after the order changes; recomputed only where none is stored. */
export function proposedFreePage(report: StoredReport): FreePagePick | null {
  const ranked = rankedFreePages(report);
  const stored = report.freePage?.opportunityId;
  const pick = pickOf(report, ranked.find((candidate) => freePageId(report.scanId, candidate.targetRef) === stored), ranked.length);
  if (pick !== null) return pick;
  console.log(JSON.stringify({ event: "free_page_pick", scanId: report.scanId, pick: "recomputed" }));
  return bestFreePage(report);
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
    beats: evidence.family === "write" ? (evidence.rival?.domain ?? null) : null,
    format: candidate.type,
    totalPages: pick.total,
  };
}

/** The business holding a stored free page's search, read off its stored
 *  top ten by `holderOf`, as the missing pages read it; a stored holder with
 *  no stored top ten stands only where it is no source. */
export function beatsOf(report: StoredReport): string | null {
  const page = report.freePage;
  if (page === null || page.beats === null || report.questions.kind === "unmeasured") return null;
  const serp = report.serps[report.questions.value.findIndex((question) => question.search.keyword === page.target.keyword)];
  const reading = sourceReadingOf(report, report.rivals.kind === "unmeasured" ? [] : report.rivals.value.map((rival) => rival.domain));
  if (serp === undefined || serp.kind === "unmeasured") return isSourceRow({ domain: page.beats }, reading) ? null : page.beats;
  return holderOf(serp.value, report.domain, reading, report.verdict.measuredAt)?.domain ?? null;
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
