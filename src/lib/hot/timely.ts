// SPEC §7 *Ranked by points*, `timely`: a page on a stored event scores by the event's age, and takes the week's earliest
// open dates. Pure.
import type { Scored } from "@/lib/opportunities/rank/open";
import type { Opportunity, PlanReason } from "@/lib/opportunities/types";

/** An event first reported within 7 days, then within 14 (the coordinator's defaults under ruling 97). */
export const TIMELY = Object.freeze({ week: 4, fortnight: 2 });

/** A timely page's points at `at`, by the age of its event, where the event changes what a buyer does; a weak event's at most a fortnight's. Stored jsonb. */
export function timelyOf(o: Pick<Opportunity, "evidence">, at: Date): number {
  const hot = o.evidence?.family === "write" ? o.evidence.hot : undefined;
  if (typeof hot?.reason?.date !== "string" || hot.changes === false) return 0;
  const days = (at.getTime() - Date.parse(`${hot.reason.date}T00:00:00Z`)) / 86_400_000;
  const n = days <= 7 ? TIMELY.week : days <= 14 ? TIMELY.fortnight : 0;
  return hot.weak === undefined ? n : Math.min(n, TIMELY.fortnight);
}

/** Adds each scored row's `timely` part; none where `at` is absent. */
export function addTimely(scored: readonly Scored[], at: Date | undefined): void {
  for (const entry of scored) {
    const n = at === undefined ? 0 : timelyOf(entry.opportunity, at);
    if (n > 0) [entry.parts, entry.points] = [[...entry.parts, { part: "timely", n }], entry.points + n];
  }
}

/** The event a page its timely part ranked states, which its reason line reads. */
export function timelyReason(entry: Scored): Pick<PlanReason, "hot"> {
  const hot = entry.opportunity.evidence?.family === "write" ? entry.opportunity.evidence.hot?.reason : undefined;
  return hot === undefined || !entry.parts.some((part) => part.part === "timely") ? {} : { hot };
}

/** The week's dated rows with the timely ones first, freshest event first, in rank order otherwise. */
export function timelyFirst<T extends { reason: Pick<PlanReason, "parts"> }>(entries: readonly T[]): T[] {
  const n = (entry: T): number => entry.reason.parts.find((part) => part.part === "timely")?.n ?? 0;
  return [...entries].sort((a, b) => n(b) - n(a));
}
