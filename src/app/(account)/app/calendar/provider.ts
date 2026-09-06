// BUILD §4.6 — the one read the calendar makes.
//
// The typed seam WO-164 calls `readMonth`. The screen calls it and nothing
// else; what it reads behind the type is this issue's fixture
// (`fixture.ts`) and, when §7's opportunities (#40), §9's publishing (#45)
// and §11's weekly measurement (#41) land, the queries WO-164's file plan
// describes — one request-cached read, no second caller, no second shape.
//
// `React.cache` is what makes it one read per request even though the page
// and, later, its sibling reads each ask.
//
// The month is a **parameter**: §4.6's head carries a month switcher, and a
// switcher that could only ever be handed the current month is not one. A
// month the fixture holds no drafts for is not an error — every one of its
// dates resolves through `accountFor`, which is exactly what the calendar
// does for a real site with nothing scheduled that far out.
import { cache } from "react";
import { assembleMonth, type MonthModel } from "./month";
import { dayKeyOf, monthOf, type MonthKey } from "./dates";
import { FIXTURE_CALENDAR_FACTS } from "./fixture";

/** The site-local month the calendar opens on when no other is asked for —
 *  the month today falls in, in the customer's own zone. */
export function currentMonth(): MonthKey {
  return monthOf(dayKeyOf(FIXTURE_CALENDAR_FACTS.now, FIXTURE_CALENDAR_FACTS.timeZone));
}

/** `YYYY-MM` or nothing. A query string is customer-supplied input and is
 *  never trusted into a date parser: anything that is not exactly a month
 *  falls back to the current one rather than rendering a month named by
 *  whatever was typed. */
export function parseMonth(raw: string | undefined): MonthKey {
  return raw !== undefined && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : currentMonth();
}

export const readMonth = cache(async function readMonth(month: MonthKey): Promise<MonthModel> {
  return assembleMonth(FIXTURE_CALENDAR_FACTS, month);
});
