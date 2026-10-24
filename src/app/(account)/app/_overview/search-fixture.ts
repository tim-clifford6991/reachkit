// SPEC §4 (2026-09-20, #908) — the Search tab's facts, as a fixture.
//
// **This is the reserved fixture account's Search tab, and nobody else's.**
// `search-provider.ts` answers `isReservedFixtureAccount` from here and
// reads every other account's facts live, so what this file holds is one
// account's data rather than a placeholder for a missing read. It is what
// keeps the layout and visual sweeps deterministic.
//
// **It agrees with the fixtures beside it, and that is deliberate.** The
// market is `calendar/fixture.ts`'s — the same three specimen searches and
// the same rivals — and the counts are `fixture.ts`'s: seventeen live
// pages, and eighty-one searches the site appears for, which is the latest
// weekly point the Overview's own growth series carries. Two fixtures that
// disagreed about how many pages a customer has published would be worse
// than no fixture at all.
//
// **The ceiling is not written down.** It is `difficultyCeiling(81)` — the
// engine's own arithmetic over the ranked count above — so the mark on
// every bar stands where `readiness.ts` would put it and a change to the
// rule moves the fixture with it.
//
// The frame it shows is the dense one, on purpose: every status, a search
// long enough to be clamped, a volume and a difficulty the vendor never
// gave, a page in its first judged week, a page that moved backwards, and
// more rows than the table's first page holds — so the sweeps measure the
// screen at its widest rather than at its emptiest.
import { difficultyCeiling } from "@/lib/opportunities/winnability/bars";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import type { Winnability } from "@/lib/opportunities/types";
import type { PositionChange, SearchFacts, SearchStatus, SearchTargetFacts } from "./search-model";

/** The pass these numbers were taken by — the Monday the Overview's own
 *  fixture takes its latest reading on. */
const MEASURED_AT = new Date(Date.UTC(2026, 7, 31, 6, 0, 0));

/** The site's own ranked count, and so the ceiling every bar is marked
 *  against. The same 81 the Overview's growth series ends on. */
const OWN_RANKED = 81;

const MOVED = (places: number, better: boolean): PositionChange => ({ kind: "moved", places, better });
const FIRST: PositionChange = { kind: "first" };
const NO_CHANGE: PositionChange = { kind: "none" };

/**
 * One row, as this fixture writes it: the search, its demand, its
 * difficulty, its band, its status, the rival that holds the answer today
 * and where that rival stands, the site's own place, and the week's move.
 * `null` in a numeric slot is the unmeasured arm — never a zero.
 */
type Spec = readonly [
  search: string,
  volume: number | null,
  difficulty: number | null,
  band: Winnability,
  status: SearchStatus,
  rival: string | null,
  rivalPosition: number | null,
  position: number | null,
  change: PositionChange,
];

const SPECS: readonly Spec[] = [
  // Live, and ranking — the rows the two position tiles count over.
  ["best crm for small teams", 210, 12, "winnable", "live", "hubspot.com", 3, 8, MOVED(6, true)],
  ["crm pricing comparison", 90, 28, "reach", "live", "capterra.com", 2, 14, FIRST],
  ["spreadsheet to crm migration", 40, null, "winnable", "live", "salesforce.com", 5, 19, MOVED(8, false)],
  ["crm for a two person business", 70, 9, "winnable", "live", "zoho.com", 4, 23, MOVED(2, true)],
  ["how much does a crm cost per user", 140, 17, "winnable", "live", "capterra.com", 6, 31, NO_CHANGE],
  ["free crm with unlimited contacts", 320, 34, "reach", "live", "hubspot.com", 1, 44, MOVED(5, true)],
  ["crm that works with gmail", 260, 22, "winnable", "live", "zoho.com", 7, 52, FIRST],
  ["what is a sales pipeline", 480, 19, "reach", "live", "salesforce.com", 2, 61, MOVED(3, false)],
  ["crm onboarding checklist", 50, 8, "winnable", "live", "pipedrive.com", 9, 12, MOVED(4, true)],
  ["crm vs spreadsheet", 110, 14, "winnable", "live", "hubspot.com", 5, 27, NO_CHANGE],
  ["best crm for consultants", 190, 26, "reach", "live", "zoho.com", 3, 38, FIRST],
  ["crm data import mistakes", 30, 7, "winnable", "live", "salesforce.com", 8, 16, MOVED(9, true)],
  ["simple crm for tradespeople", 60, 11, "winnable", "live", "pipedrive.com", 6, 41, MOVED(1, false)],
  ["crm contact deduplication", 20, null, "winnable", "live", "hubspot.com", 4, null, NO_CHANGE],
  ["how to move customers off a spreadsheet", 80, 13, "winnable", "live", "reddit.com", 2, 73, FIRST],
  ["crm for a small accountancy practice", 40, 10, "winnable", "live", "zoho.com", 5, 88, MOVED(2, true)],
  ["do i really need a crm", 150, 24, "reach", "live", "capterra.com", 3, null, NO_CHANGE],

  // Written and waiting for the customer.
  ["crm email templates for follow ups", 170, 16, "winnable", "your_review", "hubspot.com", 4, null, NO_CHANGE],

  // Planned — the queue the first tile counts.
  ["crm with quoting built in", 210, 20, "winnable", "up_next", "pipedrive.com", 6, null, NO_CHANGE],
  ["crm for field service teams", 130, 18, "winnable", "up_next", "zoho.com", 5, null, NO_CHANGE],
  ["how to keep a customer list up to date without a spreadsheet", 90, 15, "winnable", "up_next", "reddit.com", 3, null, NO_CHANGE],
  ["crm reporting for owners", 60, 21, "reach", "up_next", "salesforce.com", 7, null, NO_CHANGE],
  ["crm that does not need training", 240, 29, "reach", "up_next", "hubspot.com", 2, null, NO_CHANGE],
  ["crm integration with xero", 110, 23, "winnable", "up_next", "capterra.com", 8, null, NO_CHANGE],
  ["moving from outlook contacts to a crm", 45, null, "winnable", "up_next", "salesforce.com", 4, null, NO_CHANGE],
  ["crm for a cleaning company", 70, 12, "winnable", "up_next", "zoho.com", 9, null, NO_CHANGE],
  ["what does crm stand for", 2900, 31, "reach", "up_next", "salesforce.com", 1, null, NO_CHANGE],
  ["crm checklist before you buy", 55, 26, "reach", "up_next", "capterra.com", 5, null, NO_CHANGE],

  // On file, and outsized for this site today (SPEC §6's right-sizing law).
  ["best crm software", 14800, 74, "not-yet", "too_big", "salesforce.com", 1, null, NO_CHANGE],
  ["crm software", 22000, 81, "not-yet", "too_big", "hubspot.com", 1, null, NO_CHANGE],
  ["customer relationship management", 9900, 66, "not-yet", "too_big", "salesforce.com", 2, null, NO_CHANGE],
];

const CEILING = difficultyCeiling(OWN_RANKED);

function targetOf(spec: Spec, index: number): SearchTargetFacts {
  const [search, volume, difficulty, band, status, rival, rivalPosition] = spec;
  return {
    id: `fixture-search-${index}`,
    target: {
      search,
      volume:
        volume === null ? unmeasured<number>("undeterminable", MEASURED_AT) : measured(volume, MEASURED_AT),
      difficulty:
        difficulty === null
          ? unmeasured<number>("undeterminable", MEASURED_AT)
          : measured(difficulty, MEASURED_AT),
      ceiling: CEILING,
      winnability: band,
    },
    status,
    rival:
      rival === null
        ? null
        : {
            domain: rival,
            position:
              rivalPosition === null
                ? unmeasured<number>("not_attempted", MEASURED_AT)
                : measured(rivalPosition, MEASURED_AT),
          },
    change: spec[8],
  };
}

const TARGETS: readonly SearchTargetFacts[] = Object.freeze(SPECS.map(targetOf));

const POSITIONS: ReadonlyMap<string, Measured<number>> = new Map(
  SPECS.flatMap(([search, , , , , , , position]) =>
    position === null ? [] : [[search, measured(position, MEASURED_AT)] as const]
  )
);

export const FIXTURE_SEARCH_FACTS: SearchFacts = Object.freeze({
  targets: TARGETS,
  positions: POSITIONS,
  // Your market: the twelve, three of them with a first-page place.
  market: { top10: 3, measured: 12 },
  measuredAt: MEASURED_AT,
});
