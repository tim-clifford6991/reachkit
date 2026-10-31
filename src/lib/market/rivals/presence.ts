// src/lib/market/rivals/presence.ts — BUILD §6.6, the Google-presence card
//
// One denominator: the searches this report actually measured. The
// customer's occupancy and every rival's are counted over exactly that
// subset, so a card whose customer is at zero still says something true
// against the same number every rival is read against — §6.6's cold-start
// rule for this surface: "0 is shown as a measurement, never an error",
// and never a ratio.
//
// **The honesty bound of this card is the absence of a place to put a
// violation, not a review.** `PresenceCard` has no field for a rival's
// ranked count, size, band, revenue, traffic value, funding, headcount or
// projected return, and no field a severity, warning or problem level
// could be written into. §6.4's never-pull list forbids the measurement
// that would make such a claim true on the free path, and this module
// buys nothing at all: it resolves no import into `src/lib/vendors/`,
// `src/lib/costs/` or `src/lib/llm/`, takes no cost context and takes no
// locale — every figure on it comes from calls the pass made in the
// site's own locale (D66).
//
// No sentence is written here. `framing` is a state; the words that state
// picks are the copy registry's and the report surface's.
import { ABSENT_FROM_MAX } from "@/lib/config/constants";
import type { Measured } from "@/lib/measure/measured";
import type { MarketSerp, SelectedSearchView } from "../views";
import { isOwnDomain, isSourceRow, registrableDomain, type SourceReading } from "./domains";
import type { RivalCandidate } from "./derive";

export interface PresenceCard {
  /** The one denominator — how many of the market's biggest searches this
   *  report measured. Every other figure on the card is counted over
   *  exactly that subset. */
  measuredSearches: number;
  /** The customer's presence, on the card exactly once. There is no second,
   *  differently measured figure for it, no share, no percentage, no ratio
   *  — and no card-level total monthly volume for the searches, which the
   *  owner removed on 2026-09-03, both halves. */
  you: { domain: string; top10Count: number };
  /** At most `BATTERY.COMPETITORS_MAX`, in the score order `deriveRivals`
   *  returned. Each entry carries a name and a count and nothing else. */
  rivals: readonly { domain: string; top10Count: number }[];
  /** Up to `ABSENT_FROM_MAX` of the biggest searches the customer does not
   *  hold a top-ten place on, biggest volume first. */
  absentFrom: readonly { keyword: string; volume: number; topHolder: string | null }[];
  /** The biggest measured search and who holds its first place. Absent where
   *  nothing was measured, and on every card stored before it. */
  mostSearched?: { keyword: string; volume: number; topHolder: string | null };
  framing: "shown" | "suppressed_no_rivals";
}

/** The measured SERPs, paired with the search each was bought for.
 *  `serps[i]` is the SERP for `selected[i]`: the two arrays are the scan's
 *  own parallel record of one battery, and the pairing is positional
 *  because a bought SERP carries no keyword of its own. An index with no
 *  search beside it is dropped — it cannot be labelled, so it can be
 *  neither an absence nor a presence. */
interface MeasuredPair {
  serp: MarketSerp;
  search: SelectedSearchView;
}

function measuredPairs(
  serps: readonly Measured<MarketSerp>[],
  selected: readonly SelectedSearchView[]
): MeasuredPair[] {
  const pairs: MeasuredPair[] = [];
  for (let i = 0; i < serps.length; i += 1) {
    const measured = serps[i];
    const search = selected[i];
    if (measured === undefined || measured.kind === "unmeasured") continue;
    if (search === undefined) continue;
    pairs.push({ serp: measured.value, search });
  }
  return pairs;
}

/** The registrable domains of one SERP's top ten and its local pack, which
 *  counts as the top ten does (D67, issue 1441). A row whose host does not
 *  parse is dropped, not counted as somebody. */
function topTenDomains(serp: MarketSerp): Set<string> {
  const domains = new Set<string>();
  for (const row of [...serp.organic, ...(serp.localPack ?? [])]) {
    const domain = registrableDomain(row.domain);
    if (domain !== null) domains.add(domain);
  }
  return domains;
}

/** The domain at position 1, or `null` where that position is held by a
 *  source rather than a business (`isSourceRow`: a platform, a public body,
 *  a job page or an article), or where no row carries position 1 at all. */
function topHolderOf(serp: MarketSerp, reading: SourceReading): string | null {
  const first = serp.organic.find((row) => row.position === 1);
  return first === undefined || isSourceRow(first, reading) ? null : registrableDomain(first.domain);
}

function ownPresenceOf(topTens: readonly { pair: MeasuredPair; domains: Set<string> }[], ownDomain: string) {
  return topTens.map(({ pair, domains }) => ({ pair, present: [...domains].some((domain) => isOwnDomain(domain, ownDomain)) }));
}

/** Per measured search, in battery order, whether the site holds a top-ten
 *  place: the count the card's `you.top10Count` is made of. */
export function ownPresenceBySearch(a: {
  serps: readonly Measured<MarketSerp>[];
  selected: readonly SelectedSearchView[];
  ownDomain: string;
}): { keyword: string; present: boolean }[] {
  const topTens = measuredPairs(a.serps, a.selected).map((pair) => ({ pair, domains: topTenDomains(pair.serp) }));
  return ownPresenceOf(topTens, a.ownDomain).map(({ pair, present }) => ({ keyword: pair.search.keyword, present }));
}

/**
 * REQ-008's card, assembled from SERPs the scan already bought.
 *
 * `serps` arrives as `Measured<MarketSerp>[]` and not as bare SERPs
 * deliberately: the card has to know which of the battery's searches were
 * *not* measured, because that is exactly what its denominator excludes.
 * An unmeasured search is neither an absence nor a presence and appears
 * nowhere on the card.
 *
 * Deterministic: the same inputs produce a byte-identical card. The
 * absent-from list is ordered by volume descending and, at equal volume,
 * by keyword ascending — the second key is what makes that order total.
 */
export function buildPresenceCard(a: {
  serps: readonly Measured<MarketSerp>[];
  selected: readonly SelectedSearchView[];
  ownDomain: string;
  rivals: readonly RivalCandidate[];
  /** Where the market is local and what it set aside as sources, as the
   *  rivals were derived. Absent: national, and no stored sources. */
  local?: boolean;
  sources?: readonly string[];
}): PresenceCard {
  const pairs = measuredPairs(a.serps, a.selected);
  const topTens = pairs.map((pair) => ({ pair, domains: topTenDomains(pair.serp) }));
  const ownPresence = ownPresenceOf(topTens, a.ownDomain);
  const reading = { local: a.local === true, sources: a.sources ?? [], rivals: a.rivals.map((rival) => rival.domain) };

  const countFor = (rivalDomain: string): number => {
    const domain = registrableDomain(rivalDomain);
    if (domain === null) return 0;
    return topTens.filter(({ domains }) => domains.has(domain)).length;
  };

  const absentFrom = ownPresence
    .filter(({ present }) => !present)
    .map(({ pair }) => ({
      keyword: pair.search.keyword,
      volume: pair.search.volume,
      topHolder: topHolderOf(pair.serp, reading),
    }))
    .sort((x, y) => y.volume - x.volume || (x.keyword < y.keyword ? -1 : x.keyword > y.keyword ? 1 : 0))
    .slice(0, ABSENT_FROM_MAX);

  let biggest: MeasuredPair | null = null;
  for (const pair of pairs) {
    const { volume, keyword } = pair.search;
    if (biggest === null || volume > biggest.search.volume || (volume === biggest.search.volume && keyword < biggest.search.keyword)) biggest = pair;
  }

  const card: PresenceCard = {
    measuredSearches: pairs.length,
    you: {
      domain: registrableDomain(a.ownDomain) ?? a.ownDomain,
      top10Count: ownPresence.filter(({ present }) => present).length,
    },
    rivals: a.rivals.map((rival) => ({ domain: rival.domain, top10Count: countFor(rival.domain) })),
    absentFrom,
    ...(biggest === null
      ? {}
      : { mostSearched: { keyword: biggest.search.keyword, volume: biggest.search.volume, topHolder: topHolderOf(biggest.serp, reading) } }),
    framing: a.rivals.length === 0 ? "suppressed_no_rivals" : "shown",
  };

  logFraming(card.framing);
  return card;
}

/** BP-026 `## NFR budget`: the framing state, and nothing else — no
 *  domain, no keyword and no count reaches a log line from here. */
function logFraming(framing: PresenceCard["framing"]): void {
  console.log(JSON.stringify({ event: "presence_card", framing }));
}
