// SPEC §4 *Competitors tab* — the reserved fixture account's facts, and nobody else's; it keeps the layout sweeps deterministic.
// Its competitors are `fixture.ts`'s two confirmed ones and its searches Plan's fixture week's twelve.
import type { RivalSearchRow, RivalSearchStatus, RivalsFacts } from "./rivals-model";

/** The pass these numbers were taken by — the Monday the Overview's own
 *  fixture takes its latest reading on. */
const MEASURED_AT = new Date(Date.UTC(2026, 7, 31, 6, 0, 0));

/** `fixture.ts`'s two confirmed rivals, in the customer's own order. */
const BIG = "bigcompetitor.com";
const SECOND = "secondplace.io";
const OWN = "example.com";

const RIVALS: readonly string[] = Object.freeze([BIG, SECOND]);

/** The twelve the pass reads. */
const FIRST_PAGE_OF = 12;

/** One of the twelve: the search, its demand, your place, each competitor's place on page 1, and what ReachKit is doing.
 *  Counted, these agree with `FIRST_PAGE`: bigcompetitor.com on 9, secondplace.io on 7, you on 2. */
type Spec = readonly [search: string, volume: number, you: number | null, big: number | null, second: number | null, status: RivalSearchStatus];

const SPECS: readonly Spec[] = [
  ["best crm for small teams", 2400, 34, 1, 3, "in_review"],
  ["crm pricing comparison", 1900, 4, 2, null, "live"],
  ["spreadsheet to crm migration", 720, null, 5, 8, "up_next"],
  ["crm for a two person business", 590, 18, 3, 1, "up_next"],
  ["how much does a crm cost per user", 1600, 61, 6, 4, "needs_page"],
  ["free crm with unlimited contacts", 8100, null, 1, 2, "too_big"],
  ["crm that works with gmail", 1300, 9, 7, null, "live"],
  ["what is a sales pipeline", 6600, null, 4, null, "too_big"],
  ["crm onboarding checklist", 320, 27, 2, 5, "up_next"],
  ["crm vs spreadsheet", 880, null, null, 9, "needs_page"],
  ["best crm for consultants", 1100, 45, null, null, "in_review"],
  ["crm data import mistakes", 260, null, null, null, "needs_page"],
];

function rowOf(spec: Spec): RivalSearchRow {
  const [search, volume, you, big, second, status] = spec;
  const places: Record<string, number> = {};
  if (big !== null) places[BIG] = big;
  if (second !== null) places[SECOND] = second;
  return { search, volume, you, places, status };
}

/** Who is on the first page of the twelve. The customer's own row is a
 *  measured `2` — small, real, and the reason the screen exists. */
const FIRST_PAGE: ReadonlyMap<string, number> = new Map([
  [BIG, 9],
  [SECOND, 7],
  [OWN, 2],
]);

export const FIXTURE_RIVALS_FACTS: RivalsFacts = Object.freeze({
  rivals: RIVALS,
  ownDomain: OWN,
  firstPage: FIRST_PAGE,
  firstPageOf: FIRST_PAGE_OF,
  // Where the customer stood in the first week this window measured.
  firstPageAtStart: 1,
  firstPageHolders: Object.freeze([]),
  rows: Object.freeze(SPECS.map(rowOf)),
  measuredAt: MEASURED_AT,
});
