// SPEC §4 (2026-09-20, #908) — the Rivals tab's facts, as a fixture.
//
// **This is the reserved fixture account's Rivals tab, and nobody else's.**
// `rivals-provider.ts` answers `isReservedFixtureAccount` from here and
// reads every other account's facts live, so what this file holds is one
// account's data rather than a placeholder for a missing read. It is what
// keeps the layout and visual sweeps deterministic.
//
// **It agrees with the fixtures beside it.** The tracked rivals are
// `fixture.ts`'s two confirmed ones — the same two the gap card on this
// very screen draws from `readOverview().rivals`, one of them banded `far`
// and so standing on the market-leaders line — and the searches are
// `search-fixture.ts`'s CRM market. Two fixtures that disagreed about who
// this customer is measured against would be worse than no fixture at all.
//
// **The frame it shows is the dense one, on purpose**: both counting cards
// full, a "when you started" line, all four status words, both rivals
// across the chips, a search long enough to wrap at 390, and more rows than
// the table's first page holds — so the sweeps measure the screen at its
// widest rather than at its emptiest.
import { measured, unmeasured } from "@/lib/measure/measured";
import type { RivalPoolFacts, RivalSearchStatus, RivalsFacts } from "./rivals-model";

/** The pass these numbers were taken by — the Monday the Overview's own
 *  fixture takes its latest reading on. */
const MEASURED_AT = new Date(Date.UTC(2026, 7, 31, 6, 0, 0));

/** `fixture.ts`'s two **confirmed** rivals, in the customer's own order.
 *  The unconfirmed candidate beside them there is not tracked and so is not
 *  here either (REQ-041 c8). */
const BIG = "bigcompetitor.com";
const SECOND = "secondplace.io";
const OWN = "example.com";

const RIVALS: readonly string[] = Object.freeze([BIG, SECOND]);

/** The twelve the pass reads. */
const FIRST_PAGE_OF = 12;

/**
 * One row: the search, its demand, which rival holds it, where that rival
 * stands where the pass bought a top ten for it, and what ReachKit is doing.
 * `null` in the position slot is the unmeasured arm — the pool carries no
 * place, and most rows honestly have none.
 */
type Spec = readonly [
  search: string,
  volume: number,
  rival: string,
  position: number | null,
  status: RivalSearchStatus,
];

const SPECS: readonly Spec[] = [
  ["crm for a small accountancy practice", 1900, BIG, 4, "in_review"],
  ["best crm for estate agents", 2400, SECOND, 3, "up_next"],
  ["crm with a client portal", 1200, SECOND, 8, "up_next"],
  ["crm that sends invoices", 3600, BIG, 2, "needs_page"],
  ["best crm software", 14800, BIG, null, "too_big"],
  [
    "what is the best customer relationship management software for a business with fewer than ten people",
    320,
    SECOND,
    null,
    "up_next",
  ],
  ["crm for tradespeople uk", 880, SECOND, null, "needs_page"],
  ["crm integration with xero", 720, BIG, null, "up_next"],
  ["crm pipeline stages template", 590, BIG, null, "in_review"],
  ["free crm for nonprofits", 1600, SECOND, null, "too_big"],
  ["crm data migration checklist", 480, BIG, null, "needs_page"],
  ["crm for recruitment agencies", 2900, SECOND, null, "up_next"],
  ["simple crm no contract", 390, BIG, null, "needs_page"],
  ["crm vs marketing automation", 1100, SECOND, null, "up_next"],
];

function rowOf(spec: Spec): RivalPoolFacts {
  const [search, volume, rival, position, status] = spec;
  return {
    search,
    volume: measured(volume, MEASURED_AT),
    rival,
    position:
      position === null
        ? unmeasured<number>("not_attempted", MEASURED_AT)
        : measured(position, MEASURED_AT),
    status,
  };
}

/** Who is on the first page of the twelve. The customer's own row is a
 *  measured `2` — small, real, and the reason the screen exists. */
const FIRST_PAGE: ReadonlyMap<string, number> = new Map([
  [BIG, 9],
  [SECOND, 7],
  [OWN, 2],
]);

/** Who holds place 1 on each of the twelve: two rivals, three other sites
 *  (the fifth is drawn as "others"), and the customer once. */
const TOP: ReadonlyMap<string, number> = new Map([
  [BIG, 4],
  [SECOND, 3],
  ["crmreviews.example", 2],
  ["softwaredirectory.example", 1],
  ["comparisons.example", 1],
  [OWN, 1],
]);

/** The twelve, as Plan's fixture week names its searches. */
const TWELVE: readonly string[] = Object.freeze([
  "best crm for small teams",
  "crm pricing comparison",
  "spreadsheet to crm migration",
  "crm for a two person business",
  "how much does a crm cost per user",
  "free crm with unlimited contacts",
  "crm that works with gmail",
  "what is a sales pipeline",
  "crm onboarding checklist",
  "crm vs spreadsheet",
  "best crm for consultants",
  "crm data import mistakes",
]);

export const FIXTURE_RIVALS_FACTS: RivalsFacts = Object.freeze({
  rivals: RIVALS,
  ownDomain: OWN,
  firstPage: FIRST_PAGE,
  firstPageOf: FIRST_PAGE_OF,
  top: { holders: TOP, of: FIRST_PAGE_OF, searches: TWELVE },
  // Where the customer stood in the first week this window measured.
  firstPageAtStart: 1,
  firstPageHolders: Object.freeze([]),
  pool: Object.freeze(SPECS.map(rowOf)),
  measuredAt: MEASURED_AT,
});
