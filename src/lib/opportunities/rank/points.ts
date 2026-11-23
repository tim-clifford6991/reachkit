// SPEC §7 — a row's integer points, each part read off what the row and
// the site's stored answers already hold. Pure, and a leaf: the week's
// commit, the supply count and the free report's first page all score here.
import { CLOSE_PAGE_POSITION_BAND, WRITE_VOLUME_FLOOR_PER_MONTH } from "@/lib/config/constants";
import { canonicalUrl } from "@/lib/measure/page-reading";
import { measuredVolume } from "../intent";
import { OUTSIZED, type Opportunity, type PlanReason, type Shortfall } from "../types";

/** The points each part is worth (owner ruling of 2026-10-19, "all as
 *  recommended"). A part that does not apply is not stored. */
export const POINTS = Object.freeze({
  fit: { 3: 3, 2: 1 } as Readonly<Record<number, number>>,
  demand: { measured: 2, asked: 1 },
  aiGap: 2,
  rising: 2,
  nearPageOne: 3,
  linkedByAi: 1,
  notMoving: 0,
  outsized: -2,
});

/** The quarterly change in searches, in percent, from which a search is rising. */
export const RISING_QUARTERLY_PCT = 30;

/** A search up by `RISING_QUARTERLY_PCT` or more on the quarter, or a question first seen this week. Stored jsonb: a
 *  missing field is not rising. */
export function isRising(evidence: Opportunity["evidence"] | null | undefined): boolean {
  if (evidence?.family !== "write" && evidence?.family !== "earn") return false;
  const quarterly = evidence.trend?.quarterly;
  return (typeof quarterly === "number" && quarterly >= RISING_QUARTERLY_PCT) || (evidence.family === "write" && evidence.askedBeside?.newSince != null);
}

/** The fit a row ranks and scores in: one no pass has judged as a judged 2, neither lifted nor dropped. */
export const fitOf = (o: Pick<Opportunity, "businessFit">): number => o.businessFit ?? 2;

/** What the parts read beyond the row: the site's own pages a stored AI answer linked (canonical addresses). */
export interface Seen {
  cited: ReadonlySet<string>;
}

type Scorable = Pick<Opportunity, "businessFit" | "volume" | "source" | "targetQuery"> & {
  evidence?: Opportunity["evidence"] | null;
  fitBand?: Opportunity["fitBand"];
};

function improveOf(o: Scorable): { shortfall: Shortfall | undefined; pageUrl: string | undefined } | null {
  // Stored jsonb: a row missing a field reads as not having it, never throws.
  const evidence = o.evidence as Record<string, unknown> | null | undefined;
  if (evidence?.family !== "improve") return null;
  return { shortfall: evidence.shortfall as Shortfall | undefined, pageUrl: evidence.pageUrl as string | undefined };
}

function demandOf(o: Scorable): number {
  const volume = measuredVolume(o.volume ?? null);
  if (volume !== null && volume >= WRITE_VOLUME_FLOOR_PER_MONTH) return POINTS.demand.measured;
  const askedBeside = o.evidence?.family === "write" && o.evidence.askedBeside !== undefined;
  return volume !== null || askedBeside ? POINTS.demand.asked : 0;
}

function aiGapOf(o: Scorable): boolean {
  return o.source === "ai_gap" || (o.evidence?.family === "earn" && o.evidence.source?.surface === "ai_answer");
}

function nearPageOne(o: Scorable): boolean {
  const improve = improveOf(o);
  const shortfall = improve?.shortfall;
  if (shortfall?.kind === "due") return shortfall.cause === "close";
  if (shortfall?.kind !== "position") return false;
  const position = shortfall.position;
  return position?.kind === "measured" && position.value >= CLOSE_PAGE_POSITION_BAND.min && position.value <= CLOSE_PAGE_POSITION_BAND.max;
}

function linkedByAi(o: Scorable, seen: Seen): boolean {
  const pageUrl = improveOf(o)?.pageUrl;
  return typeof pageUrl === "string" && seen.cited.has(canonicalUrl(pageUrl));
}

function notMoving(o: Scorable): boolean {
  const shortfall = improveOf(o)?.shortfall;
  return shortfall?.kind === "due" && shortfall.cause === "unmet";
}

/** The row's points and the parts they sum from, in a fixed order. */
export function pointsOf(o: Scorable, seen: Seen): Omit<PlanReason, "rule"> {
  const parts: PlanReason["parts"] = [];
  const fit = POINTS.fit[fitOf(o)] ?? 0;
  if (fit > 0) parts.push({ part: "fit", n: fit });
  const demand = demandOf(o);
  if (demand > 0) parts.push({ part: "demand", n: demand });
  if (aiGapOf(o)) parts.push({ part: "ai_gap", n: POINTS.aiGap });
  if (isRising(o.evidence)) parts.push({ part: "rising", n: POINTS.rising });
  if (nearPageOne(o)) parts.push({ part: "near_page_one", n: POINTS.nearPageOne });
  if (linkedByAi(o, seen)) parts.push({ part: "linked_by_ai", n: POINTS.linkedByAi });
  // Stored though it adds nothing: it is why the refresh is in the list.
  if (notMoving(o)) parts.push({ part: "not_moving", n: POINTS.notMoving });
  const due = improveOf(o)?.shortfall;
  if (due?.kind === "due" && due.cause === "snippet" && typeof due.shown === "number") parts.push({ part: "shown_no_visits", n: 0, shown: due.shown });
  // Too big for the site today ranks lower, and is still written when nothing ranks above it.
  if (o.fitBand === OUTSIZED) parts.push({ part: "outsized", n: POINTS.outsized });
  return { points: parts.reduce((sum, part) => sum + part.n, 0), parts };
}

/** A measured volume orders a tie; an unmeasured one ranks below any. */
export function volumeOrder(o: Pick<Opportunity, "volume">): number {
  return measuredVolume(o.volume ?? null) ?? -1;
}
