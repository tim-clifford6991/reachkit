// SPEC §7 (2026-09-29, *What every page carries*; issue 1137) — the byline
// and the page's dates, as one line both destinations print.
//
// "A byline: the founder's name and line from setup, else the business's
// name. The published date, and an updated date once a page is refreshed."
// The name is `drafts.attribution`, recorded when the page was written; the
// dates are what publishing did. No model writes any of the three.
//
// The hosted page draws the line in its own header. A WordPress post has no
// template of ours, so the line is the first paragraph of the content this
// product sends — escaped like every other character of it.
import type { Say } from "./markdown";
import { copy } from "@/lib/presentation/copy";
import { escapeHtml } from "./markdown";

/** DECISIONS 2026-08-28 — "MVP is US-English only". */
export const PAGE_LOCALE = "en-US";

/**
 * A date a published page states, in the zone the customer publishes in —
 * UTC where they have stated none, never a zone this product picked. Day,
 * month, year: a page stays live for years, and a bare day and month on it
 * is ambiguous.
 */
export function writePageDate(at: Date, timeZone: string | null, tag: string = PAGE_LOCALE): string {
  // A page in another language writes its date as that language does
  // (D66): "4. Sept. 2026".
  if (tag !== PAGE_LOCALE) {
    return new Intl.DateTimeFormat(tag, { timeZone: timeZone ?? "UTC", day: "numeric", month: "short", year: "numeric" }).format(at);
  }
  const parts = new Intl.DateTimeFormat(PAGE_LOCALE, {
    timeZone: timeZone ?? "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  // Composed from parts, not from the locale's own pattern: `en-US` orders
  // a short date month-first, and the page writes "4 Sep 2026".
  return `${part("day")} ${part("month")} ${part("year")}`;
}

/** The line: who, published when, and — once refreshed — updated when. An
 *  update dated the day the page was published is not stated as one. */
export function bylineLine(a: {
  byline: string;
  published: Date;
  updated: Date | null;
  timeZone: string | null;
  /** The page's own language and how it writes a date (D66); absent is
   *  English. */
  say?: Say;
  tag?: string;
}): string {
  const say = a.say ?? copy;
  const { date, updated } = datesOf(a);
  return updated === null
    ? say("hosted.published", { date, publisher: a.byline })
    : say("hosted.updated", { date, updated, publisher: a.byline });
}

/** The two dates as the page writes them; `updated` is `null` where the
 *  update falls on the day the page was published. */
function datesOf(a: { published: Date; updated: Date | null; timeZone: string | null; tag?: string }): {
  date: string;
  updated: string | null;
} {
  const date = writePageDate(a.published, a.timeZone, a.tag);
  const updated = a.updated === null ? null : writePageDate(a.updated, a.timeZone, a.tag);
  return { date, updated: updated === date ? null : updated };
}

/** The same dates with no byline: an offering page is the business's own
 *  (owner R1, 2026-10-22). */
export function datedLine(a: Omit<Parameters<typeof bylineLine>[0], "byline">): string {
  const say = a.say ?? copy;
  const { date, updated } = datesOf(a);
  return updated === null
    ? say("hosted.dated", { date })
    : say("hosted.dated.updated", { date, updated });
}

/** The line as the first paragraph of a post's content; `""` for a page
 *  with no recorded name, which prints none rather than an invented one. */
export function bylineHtml(a: {
  byline: string | null;
  published: Date;
  updated: Date | null;
  timeZone: string | null;
  say?: Say;
  tag?: string;
}): string {
  if (a.byline === null || a.byline.trim() === "") return "";
  return `<p>${escapeHtml(bylineLine({ ...a, byline: a.byline }))}</p>\n`;
}
