// BUILD §12 · §2.3 — the one numeral formatter both mail bodies share, so the HTML and the text body cannot write a number two ways.
// It never calls `renderMeasured()`: its unmeasured em dash suits a screen, but BUILD §12 omits the section in a mail, and `omit.ts` already has.
import type { Measured } from "@/lib/measure/measured";
import type { StatFormat } from "./types";

/** §4.1's search-volume unit ("{vol}/mo"): a dimension like a currency symbol, not a sentence. */
const PER_MONTH_SUFFIX = "/mo";

function plain(value: number, format: StatFormat): string {
  switch (format) {
    case "integer":
      return String(value);
    case "delta":
      // A measured zero delta is a result; only a direction gets a sign.
      return value > 0 ? `+${value}` : String(value);
    case "perMonth":
      return `${value}${PER_MONTH_SUFFIX}`;
    case "percent":
      return `${value}%`;
  }
}

/** Formats a value `omit.ts` kept. A measured zero takes the measured path and prints. */
export function formatStat(value: Measured<number>, format: StatFormat): string {
  if (value.kind === "unmeasured") {
    // Unreachable: `omittedIndexes()` drops the block first, and any fallback would be a placeholder.
    throw new Error(
      "formatStat: an unmeasured value reached the formatter — BUILD §12 omits its section instead."
    );
  }
  return plain(value.value, format);
}

/** The product is US-English only; `en-US` is `SERP_LOCATION` as a BCP-47 tag.
 *  `src/app/(account)/app/_shell/format.ts` derives the same for the screen, since `src/lib` never imports `src/app`. */
const MAIL_LOCALE = "en-US";

/** A calendar day in the customer's stated zone; with none stated it is UTC, never a zone picked for them (REQ-073). */
export function formatMailDate(at: Date, timeZone: string | null): string {
  return new Intl.DateTimeFormat(MAIL_LOCALE, {
    timeZone: timeZone ?? "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(at);
}

/** A planned `YYYY-MM-DD` as `Tue, Oct 20`; a date carries no zone, so it is read in UTC. */
export function formatMailDay(date: string): string {
  return new Intl.DateTimeFormat(MAIL_LOCALE, { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(
    new Date(`${date}T00:00:00Z`)
  );
}

/** A stored `YYYY-MM-DD` as its weekday: `Tue`. */
export function formatMailWeekday(date: string): string {
  return new Intl.DateTimeFormat(MAIL_LOCALE, { timeZone: "UTC", weekday: "short" }).format(new Date(`${date}T00:00:00Z`));
}

/** A stored `YYYY-MM-DD` as the stop page writes it: `Tue 20 Oct`. */
export function formatMailDayMonth(date: string): string {
  const at = new Date(`${date}T00:00:00Z`);
  const part = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(MAIL_LOCALE, { timeZone: "UTC", ...o }).format(at);
  return `${formatMailWeekday(date)} ${part({ day: "numeric" })} ${part({ month: "short" })}`;
}

/** A stored `HH:mm` publish time as the app's clock writes it: `4:00 PM`. */
export function formatMailClock(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return new Intl.DateTimeFormat(MAIL_LOCALE, { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(new Date(Date.UTC(2026, 0, 1, h, m)));
}
