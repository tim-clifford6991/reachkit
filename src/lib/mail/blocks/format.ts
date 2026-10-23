// BUILD §12 · §2.3 — the one numeral formatter both mail bodies share.
//
// Split out of the two renderers (rule 1.1) for the same reason
// `omit.ts` is: a number written one way in the HTML body and another in
// the plain-text body is a defect no single-renderer test can see. Cost of
// reversing: inline it into each renderer — one edit, two copies.
//
// This module deliberately does **not** call `renderMeasured()`
// (`src/lib/presentation/measured.ts`). That renderer's unmeasured arm
// produces the `unmeasured.dash` em dash, which is right on a screen and
// forbidden in a mail: BUILD §12 says a missing number *omits its
// section*. `omit.ts` has already removed every unmeasured block before a
// value reaches here, so this formatter only ever sees the two arms that
// carry one — and it can reach no dash, because it imports none.
import type { Measured } from "@/lib/measure/measured";
import type { StatFormat } from "./types";

/** The per-month suffix §4.1 writes on a search volume ("{vol}/mo").
 *  A unit, not a sentence — it is not the product speaking, it is the
 *  number's own dimension, on the same footing as a currency symbol. */
const PER_MONTH_SUFFIX = "/mo";

function plain(value: number, format: StatFormat): string {
  switch (format) {
    case "integer":
      return String(value);
    case "delta":
      // A measured zero delta is a result: "no movement", written as the
      // number it is. A sign is added only where there is a direction.
      return value > 0 ? `+${value}` : String(value);
    case "perMonth":
      return `${value}${PER_MONTH_SUFFIX}`;
    case "percent":
      return `${value}%`;
  }
}

/** Formats the value of a block `omit.ts` has already kept. Narrowed by
 *  exclusion, so there is no `zero` branch to delete: a measured zero
 *  takes exactly the same path as any other measured number, which is
 *  what BUILD §12's "never prints 0" rule means in reverse — a zero that
 *  was measured prints. */
export function formatStat(value: Measured<number>, format: StatFormat): string {
  if (value.kind === "unmeasured") {
    // Unreachable through either renderer: `omittedIndexes()` drops this
    // block before it is rendered. Stated as a refusal rather than a
    // fallback, because every fallback here would be a placeholder — the
    // one thing BUILD §12 forbids in place of an omitted section.
    throw new Error(
      "formatStat: an unmeasured value reached the formatter — BUILD §12 omits its section instead."
    );
  }
  return plain(value.value, format);
}

/** The locale every date in a mail is written in. `DECISIONS.md`
 *  2026-08-28: "MVP is US-English only: one `SERP_LOCATION` constant, one
 *  written footer line." `SERP_LOCATION` is the vendor's own vocabulary
 *  (`{ location: 'United States', language: 'en' }`) and `Intl` needs a
 *  BCP-47 tag; `en-US` is that pair spelled the way `Intl` spells it.
 *  `src/app/(account)/app/_shell/format.ts` makes the same derivation for
 *  the screen and cannot be imported here (`src/lib` never imports
 *  `src/app`) — one pinned fact, derived at each of the two boundaries that
 *  needs it, and it moves in one place the day the pin does. */
const MAIL_LOCALE = "en-US";

/** A calendar day a mail states, in the customer's own stated zone
 *  (REQ-073 c3). `null` is a customer who has stated none — REQ-073 c1
 *  forbids inventing one for them, so the day is written in UTC rather
 *  than in a zone this product picked on their behalf. */
export function formatMailDate(at: Date, timeZone: string | null): string {
  return new Intl.DateTimeFormat(MAIL_LOCALE, {
    timeZone: timeZone ?? "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(at);
}

/** A planned day (`YYYY-MM-DD`) as a mail names it: `Tue, Oct 20`. A date
 *  carries no zone, so it is read and written in UTC. */
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
