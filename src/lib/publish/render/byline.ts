// SPEC §7, *What every page carries* — the byline and the page's dates, one line both destinations print. The name is
// `drafts.attribution`, the dates are what publishing did, and no model writes any of them.
// Hosted draws it in its header; a WordPress post has no template of ours, so it is the escaped first paragraph.
import type { Say } from "./markdown";
import { copy } from "@/lib/presentation/copy";
import { escapeHtml } from "./markdown";

/** "MVP is US-English only". */
export const PAGE_LOCALE = "en-US";

/** A page's date in the customer's zone, UTC where none is stated, never one we picked. With the year, since a page
 *  stays live for years. */
export function writePageDate(at: Date, timeZone: string | null, tag: string = PAGE_LOCALE): string {
  // Another language writes its date its own way (D66): "4. Sept. 2026".
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
  // From parts, since `en-US` orders a short date month-first and the page writes "4 Sep 2026".
  return `${part("day")} ${part("month")} ${part("year")}`;
}

/** Who, published when, and updated when once refreshed; an update on the publish day is not stated. */
export function bylineLine(a: {
  byline: string;
  published: Date;
  updated: Date | null;
  timeZone: string | null;
  /** The page's own language and how it writes a date (D66); absent is English. */
  say?: Say;
  tag?: string;
}): string {
  const say = a.say ?? copy;
  const { date, updated } = datesOf(a);
  return updated === null
    ? say("hosted.published", { date, publisher: a.byline })
    : say("hosted.updated", { date, updated, publisher: a.byline });
}

/** The two dates as written; `updated` is `null` on the publish day. */
function datesOf(a: { published: Date; updated: Date | null; timeZone: string | null; tag?: string }): {
  date: string;
  updated: string | null;
} {
  const date = writePageDate(a.published, a.timeZone, a.tag);
  const updated = a.updated === null ? null : writePageDate(a.updated, a.timeZone, a.tag);
  return { date, updated: updated === date ? null : updated };
}

/** The same dates with no byline, since an offering page is the business's own. */
export function datedLine(a: Omit<Parameters<typeof bylineLine>[0], "byline">): string {
  const say = a.say ?? copy;
  const { date, updated } = datesOf(a);
  return updated === null
    ? say("hosted.dated", { date })
    : say("hosted.dated.updated", { date, updated });
}

/** The line as a post's first paragraph; `""` with no recorded name, never an invented one. */
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
