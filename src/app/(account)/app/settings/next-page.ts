// The page in flight, as Publishing's timeline, Mail's preview and Billing's
// first-week line state it: read off the shell, never a second drafts read.
import { SHELL_LOCALE } from "../_shell/format";
import type { ShellModel } from "../_shell/model";

/** Written moments in the site's zone; `null` where nothing is scheduled. */
export interface NextPage {
  title: string | null;
  written: string | null;
  live: string | null;
}

/** No page in flight: the timeline and the previews state no times. */
export const NO_NEXT_PAGE: NextPage = Object.freeze({ title: null, written: null, live: null });

/** A moment as the boards write it: "Sun, Oct 18, 4:00 PM". */
export function formatMoment(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
}

/** The page waiting on the customer, else the next scheduled publish. It is
 *  written and mailed one stop window before it goes live. */
export function nextPageOf(
  shell: Pick<ShellModel, "review" | "publishing" | "timeZone">,
  vetoHours: number
): NextPage {
  const liveAt = shell.review === null ? shell.publishing.next : shell.review.goesLiveAt;
  if (liveAt === null) return { title: shell.review?.title ?? null, written: null, live: null };
  return {
    title: shell.review?.title ?? null,
    written: formatMoment(new Date(liveAt.getTime() - vetoHours * 3_600_000), shell.timeZone),
    live: formatMoment(liveAt, shell.timeZone),
  };
}
