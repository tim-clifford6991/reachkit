// BUILD §4.6 — the one read the calendar makes.
//
// The typed seam WO-164 calls `readMonth`. The screen calls it and nothing
// else; what it reads behind the type is now §7's own rows for a real site
// (`store.ts`) and this issue's fixture (`fixture.ts`) for the reserved
// fixture account and nothing else — one request-cached read, no second
// caller, no second shape.
//
// **Which account, and why the fixture still answers.** Which site a
// request belongs to is the session's, through `_session/account.ts`
// (issue #169) — and a request with no session never reaches this file at
// all, because `requireAppAccount()` answers §4.3's refusal first. What is
// left for the fixture is the reserved fixture account, `example.com`,
// IANA-reserved, the same name the shell and the report fixtures are hung
// on (DECISIONS 2026-09-06: "`*.example.com` fixtures answer only for
// reserved names").
//
// A real site never reaches the fixture and the fixture never pads a real
// site's month: the two are different branches of one `if`, and §4.6's
// "the calendar is never padded" is held on the live branch by `store.ts`,
// which creates nothing.
//
// **A site with no stated zone is not drawn in one nobody chose**
// (REQ-073 c1). `timeZone` is nullable on the account and the calendar
// needs a zone for every date it draws, so such a site takes the same
// branch a missing site takes: it goes to setup, where the zone is stated.
//
// **`./store` is reached through `await import`, and that is not style.**
// It resolves `@/lib/opportunities`, which resolves `@/lib/db`, which parses
// the deployment's own bindings at module load. The reserved fixture
// account's calendar reaches no database at all, and a static import would
// make rendering it depend on bindings it never uses — the same reason
// `src/jobs/engine.ts` reaches its provisioning modules this way.
//
// `React.cache` is what makes it one read per request even though the page
// and, later, its sibling reads each ask.
//
// The month is a **parameter**: §4.6's head carries a month switcher, and a
// switcher that could only ever be handed the current month is not one. A
// month with no supply left to fill it is not an error — every one of its
// dates resolves through `accountFor`, which is exactly what the calendar
// does for a real site whose supply has run out.
import { cache } from "react";
import { now as clock } from "@/lib/config/now";
import { redirect } from "next/navigation";
import type { SupplyNotice } from "@/lib/opportunities";
import { isReservedFixtureAccount, requireAppAccount } from "../_session/account";
import { assembleMonth, type MonthModel } from "./month";
import { dayKeyOf, monthOf, type MonthKey } from "./dates";
import { FIXTURE_CALENDAR_FACTS } from "./fixture";
import { FIXTURE_DOMAIN } from "../_shell/fixture";
import type { CalendarSite } from "./store";

/** The reserved fixture account: the one site whose calendar is drawn from
 *  `fixture.ts`. `example.com` is IANA-reserved and can never be a
 *  customer's domain, which is what makes "fixtures only for the reserved
 *  fixture account" a fact about the name rather than a flag someone has
 *  to remember to unset. */
export const RESERVED_FIXTURE_DOMAIN = FIXTURE_DOMAIN;

/** Answers which site a request's calendar belongs to. `null` is the
 *  reserved fixture account. */
export type CalendarSiteReader = () => Promise<CalendarSite | null>;

/** The signed-in account's site, or `null` for the reserved fixture
 *  account. A request with no session does not reach here: it is refused
 *  at `requireAppAccount()`, which redirects to `/signin`. */
const fromSession: CalendarSiteReader = async () => {
  const account = await requireAppAccount();
  if (isReservedFixtureAccount(account)) return null;
  // REQ-073 c1: a site with no stated zone is never drawn in the server's.
  if (account.timeZone === null) redirect("/setup");
  return { siteId: account.siteId, timeZone: account.timeZone };
};

let siteReader: CalendarSiteReader = fromSession;

/** The one door in, for suites. `null` restores the session-backed reader,
 *  which is what makes a suite that registers a real site unable to leak
 *  one into the next. */
export function setCalendarSiteReader(next: CalendarSiteReader | null): void {
  siteReader = next ?? fromSession;
}

/** The site this request's calendar belongs to, or `null` for the reserved
 *  fixture account. Request-cached, so the month read and the supply read
 *  resolve the same account without asking twice. */
export const currentCalendarSite = cache(
  async function currentCalendarSite(): Promise<CalendarSite | null> {
    return siteReader();
  }
);

/**
 * The site-local month the calendar opens on when no other is asked for —
 * the month today falls in, **in the customer's own zone** (issue #113).
 *
 * It reads the zone through the same seam every other `/app` surface reads
 * it through (`_session/account.ts`), not from the fixture clock it used to
 * take. That clock was the last fixture behind a real session, and it was a
 * wrong answer rather than a missing one: a customer opening the calendar
 * was shown whichever month the fixture was frozen in.
 *
 * The reserved fixture account keeps the fixture's own month, because that
 * is the month its fixture facts are drawn for and a live month over frozen
 * facts would be a calendar of empty dates.
 */
export async function currentMonth(): Promise<MonthKey> {
  const site = await currentCalendarSite();
  if (site === null) {
    return monthOf(dayKeyOf(FIXTURE_CALENDAR_FACTS.now, FIXTURE_CALENDAR_FACTS.timeZone));
  }
  return monthOf(dayKeyOf(clock(), site.timeZone));
}

/** `YYYY-MM` or nothing. A query string is customer-supplied input and is
 *  never trusted into a date parser: anything that is not exactly a month
 *  falls back to the current one rather than rendering a month named by
 *  whatever was typed. */
export async function parseMonth(raw: string | undefined): Promise<MonthKey> {
  return raw !== undefined && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : currentMonth();
}

export const readMonth = cache(async function readMonth(month: MonthKey): Promise<MonthModel> {
  const site = await currentCalendarSite();
  if (site === null) return assembleMonth(FIXTURE_CALENDAR_FACTS, month);
  const { readCalendarFacts } = await import("./store");
  return assembleMonth(await readCalendarFacts({ site, month, now: clock() }), month);
});

/**
 * §7's one statement of supply, for the footnote that carries it.
 *
 * At most one, and the precedence between the three arms is the engine's
 * (`supplyNotice`): "the customer reads one statement of supply, not two".
 * The reserved fixture account has no rows to count, so it reads the arm
 * its own `unusedSupply` fixes — zero, exhausted — without a database.
 */
export const readSupplyNotice = cache(async function readSupplyNotice(): Promise<SupplyNotice | null> {
  const site = await currentCalendarSite();
  if (site === null) {
    const unused = FIXTURE_CALENDAR_FACTS.unusedSupply;
    return unused === 0 ? { kind: "exhausted", days: 0, since: null } : null;
  }
  const { supplyNotice } = await import("@/lib/opportunities");
  return supplyNotice({ siteId: site.siteId });
});
