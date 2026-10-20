// The owner's review of a site's week (`/app/review`): each committed row
// with its points and rule, and each row left out with its reason, in the
// columns the golden plans print. Pure.
import type { PageReading } from "@/lib/measure/page-reading";
import type { OpportunityRow, PlanEntry } from "../store";
import type { PlanReason, PointPart } from "../types";
import type { Label } from "../verdicts/types";
import { verdict } from "../verdicts/verdict";

/** A committed row; a commit stored before reasons were kept has none. */
type Committed = Omit<PlanEntry, "reason"> & { reason: PlanReason | null };

/** A week as `choose` returns it, or as the stored rows hold it. */
export interface WeekChoice {
  committed: readonly Committed[];
  rejected: readonly { opportunityId: string; reason: string }[];
}

export interface CommittedRow {
  place: number;
  /** `YYYY-MM-DD`; `null` for a spare. */
  day: string | null;
  search: string | null;
  type: string;
  fit: number | null;
  volume: number | null;
  /** `null` where the commit kept no reason. */
  points: number | null;
  parts: readonly { part: PointPart; n: number }[];
  rule: string | null;
  writeAs: string | null;
}

export interface NotChosenRow {
  search: string | null;
  type: string;
  fit: number | null;
  volume: number | null;
  reason: string;
}

export interface ReviewWeek {
  committed: CommittedRow[];
  rejected: NotChosenRow[];
}

export function reviewWeek(rows: readonly OpportunityRow[], choice: WeekChoice): ReviewWeek {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const committed = choice.committed.flatMap((entry): CommittedRow[] => {
    const row = byId.get(entry.opportunityId);
    if (row === undefined) return [];
    return [
      {
        place: entry.place,
        day: entry.plannedFor,
        search: row.target_query,
        type: row.type,
        fit: row.business_fit ?? null,
        volume: row.volume,
        points: entry.reason?.points ?? null,
        parts: entry.reason?.parts ?? [],
        rule: entry.reason?.rule ?? null,
        writeAs: entry.writeAs,
      },
    ];
  });
  const rejected = choice.rejected.flatMap((entry): NotChosenRow[] => {
    const row = byId.get(entry.opportunityId);
    if (row === undefined) return [];
    return [{ search: row.target_query, type: row.type, fit: row.business_fit ?? null, volume: row.volume, reason: entry.reason }];
  });
  return { committed, rejected };
}

/** The week the last commit stored: rows with a place, in place order, and
 *  the open rows held back with their stored `unready_reason`. */
export function storedChoice(rows: readonly OpportunityRow[]): WeekChoice {
  const committed = rows
    .filter((row) => row.plan_place != null)
    .sort((a, b) => a.plan_place! - b.plan_place!)
    .map(
      (row): Committed => ({
        opportunityId: row.id,
        place: row.plan_place!,
        plannedFor: row.planned_for ?? null,
        writeAs: row.plan_write_as === "qa" ? "qa" : null,
        reason: row.plan_reason ?? null,
      })
    );
  const rejected = rows
    .filter((row) => row.plan_place == null && row.status === "open" && !row.ready)
    .map((row) => ({ opportunityId: row.id, reason: row.unready_reason ?? "unready" }));
  return { committed, rejected };
}

/** A live page's label from its stored reading; `null` where it was never read. */
export function pageLabel(reading: PageReading | null, now: Date): Label | null {
  return reading === null ? null : verdict(reading, now);
}
