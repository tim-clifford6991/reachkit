// SPEC §7 — why the week chose a page, as Plan, the stop page and the Monday mail say it.
import type { CopyKey } from "@/lib/presentation/copy";
import type { PlanReason, PointPart } from "./types";

/** The parts a page's why can state, most specific first: the short label
 *  and the sentence Plan's day rows carry. */
export const WHY_LINE: readonly { part: PointPart; n?: number; key: CopyKey; sentence: CopyKey }[] = [
  { part: "near_page_one", key: "calendar.week.why.near-page-one", sentence: "calendar.reason.near-page-one" },
  { part: "not_moving", key: "calendar.week.why.not-moving", sentence: "calendar.reason.not-moving" },
  { part: "shown_no_visits", key: "calendar.week.why.shown-no-visits", sentence: "calendar.reason.shown-no-visits" },
  { part: "ai_gap", key: "calendar.week.why.ai-gap", sentence: "calendar.reason.ai-gap" },
  { part: "linked_by_ai", key: "calendar.week.why.linked-by-ai", sentence: "calendar.reason.linked-by-ai" },
  { part: "demand", n: 2, key: "calendar.week.why.searched", sentence: "calendar.reason.searched" },
  { part: "demand", n: 1, key: "calendar.week.why.asked", sentence: "calendar.reason.asked" },
  { part: "fit", n: 3, key: "calendar.week.why.fit", sentence: "calendar.reason.fit" },
];

// Counts read as the app's own figures do (`formatCount`), in the app and the mail alike.
const COUNT = new Intl.NumberFormat("en-US");

/** A stored `YYYY-MM-DD` as the reason lines write it: "19 Nov", or with its year "19 Nov 2026". */
export function writtenDay(iso: string, year = false): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) }).format(new Date(`${iso}T00:00:00Z`));
}

/** The stored reason's one why and its slot values, or `undefined` where none is stored. A dated event comes first and
 *  is stated only with every slot it stored. */
export function whyOf(reason: PlanReason | null | undefined): { key: CopyKey; sentence: CopyKey; values?: Record<string, string> } | undefined {
  const hot = reason?.hot;
  if (hot?.signal === "news" && [hot.event, hot.date, hot.a, hot.b].every((slot) => typeof slot === "string" && slot !== "")) {
    return { key: "calendar.week.why.news", sentence: "calendar.reason.news", values: { event: hot.event, day: writtenDay(hot.date), date: writtenDay(hot.date, true), a: hot.a, b: hot.b } };
  }
  const parts = reason?.parts ?? [];
  for (const line of WHY_LINE) {
    const part = parts.find((each) => each.part === line.part && (line.n === undefined || each.n === line.n));
    if (part !== undefined) return { key: line.key, sentence: line.sentence, values: { n: COUNT.format(part.shown ?? part.n) } };
  }
  return undefined;
}
