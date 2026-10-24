// SPEC §7 — why the week chose a page, as Plan, the stop page and the Monday mail say it.
import type { CopyKey } from "@/lib/presentation/copy";
import type { PlanReason, PointPart } from "./types";

/** The parts a page's why can state, most specific first: the short label
 *  and the sentence Plan's day rows carry. */
const WHY_LINE: readonly { part: PointPart; n?: number; key: CopyKey; sentence: CopyKey }[] = [
  { part: "near_page_one", key: "calendar.week.why.near-page-one", sentence: "calendar.reason.near-page-one" },
  { part: "not_moving", key: "calendar.week.why.not-moving", sentence: "calendar.reason.not-moving" },
  { part: "ai_gap", key: "calendar.week.why.ai-gap", sentence: "calendar.reason.ai-gap" },
  { part: "linked_by_ai", key: "calendar.week.why.linked-by-ai", sentence: "calendar.reason.linked-by-ai" },
  { part: "demand", n: 2, key: "calendar.week.why.searched", sentence: "calendar.reason.searched" },
  { part: "demand", n: 1, key: "calendar.week.why.asked", sentence: "calendar.reason.asked" },
  { part: "fit", n: 3, key: "calendar.week.why.fit", sentence: "calendar.reason.fit" },
];

/** The stored reason's one why, or `undefined` where none is stored. */
export function whyOf(reason: PlanReason | null | undefined): { key: CopyKey; sentence: CopyKey } | undefined {
  const parts = reason?.parts ?? [];
  return WHY_LINE.find((line) => parts.some((part) => part.part === line.part && (line.n === undefined || part.n === line.n)));
}
