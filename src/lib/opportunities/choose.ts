// SPEC §7 (owner, 2026-10-19, issue 1559) — the week a weekly pass commits,
// chosen from what the store holds and nothing else. Pure: the same rows
// choose the same week, which is what the golden plans hold it to.
import { PLAN_DEPTH, WEEK_PLAN } from "@/lib/config/constants";
import { placeFixPages, rankingOf, type RankLoad, type Rejection } from "./rank/open";
import type { PlanEntry } from "./store";
import type { PlaceRule } from "./types";

const DAY_MS = 86_400_000;

export interface ChooseInput extends RankLoad {
  at: Date;
  /** The first date the week writes, `YYYY-MM-DD`. */
  from: string;
}

export interface Choice {
  /** The next `WEEK_PLAN.days` pages, one a day from `from`, then
   *  `WEEK_PLAN.spares` spares, each with the rule that placed it. */
  committed: (PlanEntry & { rule: PlaceRule | null })[];
  /** Every other open row, with why it is not in the week. */
  rejected: { opportunityId: string; reason: Rejection | "after_the_week" }[];
}

export function choose(input: ChooseInput): Choice {
  const { scored, fixes, rotation, rejected } = rankingOf(input, input.at);
  const ranked = placeFixPages(scored, fixes, rotation);
  const first = Math.floor(Date.parse(`${input.from}T00:00:00Z`) / DAY_MS);
  return {
    committed: ranked.slice(0, PLAN_DEPTH).map((entry, place) => ({
      opportunityId: entry.opportunityId,
      place,
      plannedFor: place < WEEK_PLAN.days ? new Date((first + place) * DAY_MS).toISOString().slice(0, 10) : null,
      writeAs: entry.writeAs ?? null,
      rule: entry.rule ?? null,
    })),
    rejected: [...rejected, ...ranked.slice(PLAN_DEPTH).map((entry) => ({ opportunityId: entry.opportunityId, reason: "after_the_week" as const }))],
  };
}
