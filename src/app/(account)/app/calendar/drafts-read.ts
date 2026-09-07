// BUILD §4.6 — the pages §9 has actually put on this month's dates, and
// the set it is holding.
//
// `store.ts` used to name four facts it "leaves honestly empty" pending
// #45: the draft on a date, its state, the held set and the day panel's
// page. #45 has landed, so this module is the read that fills three of
// them, and `store.ts` joins what comes back with §7's own supply.
//
// **It asks §9's questions through §9's own answers.** The held set is
// `heldPages` (`src/lib/publish/switch`) — cause-agnostic by design, so a
// page the customer's switch is holding and one a ReachKit stop is holding
// are the same page in the same set. The switch is `isPublishingOn`, the
// destination is `destinationWorking`, the publish moment is
// `nextPublishTimeAtOrAfter` over the site's own stored settings, and the
// rows are `scheduledPagesFor`. Nothing here re-derives a state, a
// liveness or a due-ness from a column.
//
// **A held page vacates a date it has already missed, and only then.**
// REQ-092 c5's date is "the date whose planned page did not go live on it
// because it was held" — so a page in the held set whose own date is
// already past is not drawn on it, and that date is handed to
// `accountFor`, which says `page_held` (DECISIONS 2026-09-06: fifth in the
// precedence, above `supply_exhausted` and below the three attributed
// causes). A held page whose date is today or still to come has missed
// nothing and is drawn on its date as what it is.
//
// **The title stays the search, for every page.** A draft's own title is
// model-written and reaches a customer only through `GeneratedText`
// (ADR-012), and this screen still has no gate for one — `store.ts`'s own
// note says so. Handing the column through here would put unlabelled model
// text on the grid, so the page carries the search it targets exactly as a
// planned date does, and the written title waits for the gate.
//
// **`publishAt` is the site clock's, for the pages that have one.** It is
// the first publish time at or after the page became publishable, computed
// from `sites`' own stored settings — never a second clock, and never for
// a page whose publish moment does not exist yet: a page in review under
// autopilot is told the veto deadline instead (the panel's own line), and
// under copilot it has no moment at all until it is approved.
import { destinationWorking } from "@/lib/publish/destinations";
import { scheduledPagesFor, type ScheduledPage } from "@/lib/publish/record";
import { nextPublishTimeAtOrAfter, readPublishingSettings } from "@/lib/publish/settings";
import { heldPages, isPublishingOn } from "@/lib/publish/switch";
import type { State } from "@/lib/publish/types";
import { daysOfMonth, type DayKey, type MonthKey } from "./dates";

export type { ScheduledPage };

/** The states whose page is on its way out and so has a publish moment to
 *  name. Written as a set over §9's own union, so a tenth state is a
 *  decision here rather than a page that silently loses its date. */
const HAS_A_PUBLISH_MOMENT: readonly State[] = Object.freeze([
  "approved",
  "publishing",
  "failed",
] as const);

export interface PublishingFacts {
  /**
   * Whether §9's answers were readable at all.
   *
   * `false` is **not** "no pages on any date". A read that could not answer
   * and a month with nothing scheduled look identical in every other
   * field, and treating the first as the second draws planned dates over
   * pages that are in review or already live — a calendar that states work
   * nobody planned and hides work that is under way. So the caller plans
   * nothing on a `false`, and every date resolves `unattributed`, which is
   * ADR-061 point 2's own arm: "a date the product cannot explain is a
   * date on which something of the product's failed".
   */
  readable: boolean;
  /** The page §9 put on each date of the month, by that date. A date a
   *  held page has already missed carries none. */
  pagesByDay: ReadonlyMap<DayKey, ScheduledPage>;
  /** The moment each page that has one is due to go out, by draft id. */
  publishAt: ReadonlyMap<string, Date>;
  /** REQ-092 c5's dates: the ones a held page did not go live on. */
  heldDays: readonly DayKey[];
  /** REQ-043 c4's saved change, where one is holding pages back. The
   *  switch is asked first: it is the customer's own act, and a
   *  disconnected destination on a site whose publishing is off is not the
   *  fact they need. */
  customerChangeHoldsPages: "publishing_off" | "destination_disconnected" | null;
}

/**
 * Everything §9 has to say about one site's month.
 *
 * `today` is the site-local date the caller already resolved — never read
 * from a clock in here, for the reason `month.ts` gives about the UTC+13
 * case.
 */
/** The one value a month whose §9 facts could not be read comes back as.
 *  Frozen, so no caller can turn it into a half-answer. */
const UNREADABLE: PublishingFacts = Object.freeze({
  readable: false,
  pagesByDay: new Map<DayKey, ScheduledPage>(),
  publishAt: new Map<string, Date>(),
  heldDays: Object.freeze([]),
  customerChangeHoldsPages: null,
});

export async function readPublishingFacts(a: {
  siteId: string;
  month: MonthKey;
  today: DayKey;
}): Promise<PublishingFacts> {
  const days = daysOfMonth(a.month);
  const from = days[0];
  const to = days[days.length - 1];
  if (from === undefined || to === undefined) return UNREADABLE;

  let pages: readonly ScheduledPage[];
  let held: { draftIds: string[] };
  let publishingOn: boolean;
  let destinationOk: boolean;
  let settings: Awaited<ReturnType<typeof readPublishingSettings>>;
  try {
    [pages, held, publishingOn, destinationOk, settings] = await Promise.all([
      scheduledPagesFor({ siteId: a.siteId, from, to }),
      heldPages(a.siteId),
      isPublishingOn(a.siteId),
      destinationWorking(a.siteId),
      readPublishingSettings(a.siteId),
    ]);
  } catch (error) {
    console.warn(
      JSON.stringify({ event: "calendar_publishing_unreadable", siteId: a.siteId, month: a.month, detail: String(error) })
    );
    return UNREADABLE;
  }

  const heldIds = new Set(held.draftIds);
  const pagesByDay = new Map<DayKey, ScheduledPage>();
  const heldDays: DayKey[] = [];

  for (const page of pages) {
    const day = page.scheduledFor as DayKey;
    // The one page a date may carry (REQ-043 c1). Two rows on one date is
    // `month.ts`'s own error to raise, from the list it assembles; this
    // read hands the first through and leaves that check where it is.
    if (heldIds.has(page.draftId) && day < a.today) {
      heldDays.push(day);
      continue;
    }
    if (!pagesByDay.has(day)) pagesByDay.set(day, page);
  }

  const publishAt = new Map<string, Date>();
  for (const page of pagesByDay.values()) {
    if (!HAS_A_PUBLISH_MOMENT.includes(page.state)) continue;
    const became = page.approvedAt ?? page.vetoDeadline;
    if (became === null) continue;
    publishAt.set(page.draftId, nextPublishTimeAtOrAfter(became, settings));
  }

  return {
    readable: true,
    pagesByDay,
    publishAt,
    heldDays,
    customerChangeHoldsPages: !publishingOn
      ? "publishing_off"
      : !destinationOk
        ? "destination_disconnected"
        : null,
  };
}
