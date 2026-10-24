// SPEC §7 — a row's integer points, each part read off what the row and
// the site's stored answers already hold. Pure, and a leaf: the week's
// commit, the supply count and the free report's first page all score here.
import { CLOSE_PAGE_POSITION_BAND, WRITE_VOLUME_FLOOR_PER_MONTH } from "@/lib/config/constants";
import { canonicalUrl } from "@/lib/measure/page-reading";
import { closestPrompt, measuredVolume, type IntentPrompt } from "../intent";
import type { Opportunity, PlanReason, PointPart, Shortfall } from "../types";

/** The points each part is worth (owner ruling of 2026-10-19, "all as
 *  recommended"). A part that does not apply is not stored. */
export const POINTS = Object.freeze({
  fit: { 3: 3, 2: 1 } as Readonly<Record<number, number>>,
  demand: { measured: 2, asked: 1 },
  aiGap: 2,
  nearPageOne: 3,
  linkedByAi: 1,
  notMoving: 0,
});

/** A row no pass has judged scores as a judged 2: neither lifted nor dropped. */
const UNJUDGED_FIT = 2;

/** What the parts read beyond the row: the site's own pages a stored AI
 *  answer linked (canonical addresses) and its tracked prompts. */
export interface Seen {
  cited: ReadonlySet<string>;
  prompts: readonly IntentPrompt[];
}

type Scorable = Pick<Opportunity, "businessFit" | "volume" | "source" | "targetQuery"> & {
  evidence?: Opportunity["evidence"] | null;
};

function improveOf(o: Scorable): { shortfall: Shortfall | undefined; pageUrl: string | undefined } | null {
  // Stored jsonb: a row missing a field reads as not having it, never throws.
  const evidence = o.evidence as Record<string, unknown> | null | undefined;
  if (evidence?.family !== "improve") return null;
  return { shortfall: evidence.shortfall as Shortfall | undefined, pageUrl: evidence.pageUrl as string | undefined };
}

function demandOf(o: Scorable, seen: Seen): number {
  const volume = measuredVolume(o.volume ?? null);
  if (volume !== null && volume >= WRITE_VOLUME_FLOOR_PER_MONTH) return POINTS.demand.measured;
  const askedBeside = o.evidence?.family === "write" && o.evidence.askedBeside !== undefined;
  const prompted = (o.targetQuery ?? "") !== "" && closestPrompt(o.targetQuery!, seen.prompts) !== null;
  return volume !== null || askedBeside || prompted ? POINTS.demand.asked : 0;
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
  const parts: { part: PointPart; n: number }[] = [];
  const fit = POINTS.fit[o.businessFit ?? UNJUDGED_FIT] ?? 0;
  if (fit > 0) parts.push({ part: "fit", n: fit });
  const demand = demandOf(o, seen);
  if (demand > 0) parts.push({ part: "demand", n: demand });
  if (aiGapOf(o)) parts.push({ part: "ai_gap", n: POINTS.aiGap });
  if (nearPageOne(o)) parts.push({ part: "near_page_one", n: POINTS.nearPageOne });
  if (linkedByAi(o, seen)) parts.push({ part: "linked_by_ai", n: POINTS.linkedByAi });
  // Stored though it adds nothing: it is why the refresh is in the list.
  if (notMoving(o)) parts.push({ part: "not_moving", n: POINTS.notMoving });
  return { points: parts.reduce((sum, part) => sum + part.n, 0), parts };
}

/** A measured volume orders a tie; an unmeasured one ranks below any. */
export function volumeOrder(o: Pick<Opportunity, "volume">): number {
  return measuredVolume(o.volume ?? null) ?? -1;
}
