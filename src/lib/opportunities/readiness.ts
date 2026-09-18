// SPEC §6 — "A day is filled only by an opportunity that passes readiness.
// Never pad the calendar."
//
// `opportunityReady()` is the one predicate, and its answer is stored on the
// row (`ready`, `unready_reason`), so supply and next-work read the column and
// never re-derive it. Owner, 2026-09-15:
//
//   - a grounding fact is at least one passage from the site's own measured
//     page text; with none, every Write/Earn/Improve row is
//     `no_grounding_fact` and supply is 0;
//   - a `keyword_page` is ready only when volume ≥ `KEYWORD_PAGE_MIN_VOLUME`,
//     the band is `winnable`, the intent is commercial or transactional, and
//     no owned URL ranks for it (else it is Improve's) — otherwise
//     `keyword_gate`;
//   - a `format_page` is ready only when its query contains comparison / vs /
//     alternative / integration / template — otherwise `format_not_allowed`;
//   - a `listed_page` (Earn) is ready only when the site's own pages hold a
//     passage of the kind its asset needs (`earn-grounding.ts`, issue 478) —
//     otherwise `no_grounding_fact`.
//
// And SPEC §6's Monday verdicts (issue 477): a Write in a cluster judged not
// working is `cluster_suppressed`, anything targeting a retired URL is
// `url_retired` (`suppression.ts`).
//
// And SPEC §7's daily decision (issue 781): an Improve row is an update of an
// existing page, so it is ready only where the site's destination can make
// that update — `destination_cannot_address` otherwise. A hosted destination
// can update only a page ReachKit itself published there (a new version at
// the same address); WordPress updates any page of the site, as before.
//
// The Fix family keeps its own predicate (`fixPageReadiness`): its readiness
// is a question about the destination, not about the market.
import { FORMAT_PAGE_ALLOWED, KEYWORD_PAGE_MIN_VOLUME } from "@/lib/config/constants";
import { classifyIntent } from "@/lib/market/questions/select";
import type { Profile } from "@/lib/market/questions/profile";
import { isOwnDomain, registrableDomain } from "@/lib/market/rivals/domains";
import type { StoredReport } from "@/lib/scan/report";
import { addressesOwnPage, type HostedOwnPages } from "@/lib/publish/destinations/hosted/own-page";
import { opportunityStore, readOpportunity } from "./store";
import { OUTSIZED, qualifiesForADay, type Winnability } from "./types";
import { demandBand } from "./winnability/band";
import { difficultyCeiling } from "./winnability/bars";
import { NO_EARN_GROUNDING, type EarnGrounding } from "./earn-grounding";
import { suppressionOf, verdictReason, type Suppression } from "./suppression";
import type { Opportunity, UnreadyReason } from "./types";

export interface ReadinessContext {
  /** The site's own measured pages yield at least one passage. */
  grounded: boolean;
  /** Which Earn assets the site's own pages hold a passage for. */
  earnGrounding: EarnGrounding;
  /** What this site's Monday verdicts hold back. */
  suppression: Suppression;
  /** The profile §6.7's classifier reads. `null` classifies nothing, so no
   *  keyword page passes its intent gate. */
  profile: Profile | null;
  /** Whether an owned URL ranks for this search, as the newest report
   *  measured it. */
  ownRanks: (query: string) => boolean;
  /** Whether the site's destination can deliver an update of the page at
   *  this address (issue 781). */
  canUpdate: (url: string) => boolean;
}

/** SPEC §6's commercial and transactional searches, in §6.7's classifier's
 *  own arms: a decision search (best / vs / alternative / top) and a
 *  solution search ({category} software / tool / app / platform). */
const COMMERCIAL_INTENTS: ReadonlySet<string> = new Set(["decision", "solution"]);

/** The format words, as whole words, plural or not — the pin's four and
 *  the owner's "vs". */
const FORMAT_WORDS = new RegExp(`\\b(?:${[...FORMAT_PAGE_ALLOWED, "vs", "versus"].join("|")})s?\\b`, "i");

function volumeOf(o: Opportunity): number {
  return o.volume === null || o.volume.kind === "unmeasured" ? 0 : o.volume.value;
}

/**
 * Why this row may not fill a day, or `null` where it may. Pure, and the
 * same for every family: a family's own gate is one more branch after the
 * shared ones.
 */
export function opportunityReady(o: Opportunity, ctx: ReadinessContext): UnreadyReason | null {
  const verdict = verdictReason(o, ctx.suppression);
  if (verdict !== null) return verdict;
  if (o.family === "improve" && !ctx.canUpdate(o.targetRef)) return "destination_cannot_address";
  if (!ctx.grounded) return "no_grounding_fact";
  if (o.evidence.family === "earn" && !ctx.earnGrounding[o.evidence.asset]) return "no_grounding_fact";

  const query = o.targetQuery ?? "";
  if (o.type === "keyword_page") {
    const intent = ctx.profile === null ? null : classifyIntent(query, ctx.profile);
    // The band the keyword gate asks for is `winnable` — tighter than the
    // shared rule above, which admits `reach` too. It stays here because it
    // is this type's own gate (§6, 2026-09-15) and not the right-sizing law.
    const passes =
      volumeOf(o) >= KEYWORD_PAGE_MIN_VOLUME &&
      o.fitBand === "winnable" &&
      intent !== null &&
      COMMERCIAL_INTENTS.has(intent) &&
      !ctx.ownRanks(query);
    if (!passes) return "keyword_gate";
  }
  if (o.type === "format_page" && !FORMAT_WORDS.test(query)) return "format_not_allowed";

  // SPEC §6's right-sizing law, for every type that takes a publishing day
  // (issue 884, owner's ruling 2026-09-18). It was enforced at read time by
  // the ranking (issue 881) while only `keyword_page` carried it here, so a
  // row could be stored `ready: true` and still be incapable of filling a
  // day — the database, the screens and the ranking each holding a
  // different answer. The decision is made once, here, and stored; the
  // ranking and the supply count read the column.
  //
  // It speaks **after** each type's own gate, so a `keyword_page` still
  // reports `keyword_gate` — that gate is the tighter one and names the
  // type's own rule — and the new reason is reached only where nothing more
  // specific applies.
  //
  // The Fix family carries no band and takes no search: `fixPageReadiness`
  // is its own predicate, and `fit_band` is null for exactly that family (a
  // check constraint holds it), so this asks nothing of it.
  if (o.family !== "fix" && !qualifiesForADay(o.fitBand)) return "outsized";
  return null;
}

/** An owned URL ranks for a search where the report's own SERP for it holds
 *  an organic row on the customer's domain. A search the report did not
 *  measure has no such row. */
export function ownRanksFrom(report: StoredReport | null): (query: string) => boolean {
  if (report === null || report.questions.kind === "unmeasured") return () => false;
  const own = registrableDomain(report.domain) ?? report.domain;
  const ranked = new Set<string>();
  report.questions.value.forEach((question, index) => {
    const serp = report.serps[index];
    if (serp === undefined || serp.kind === "unmeasured") return;
    if (serp.value.organic.some((row) => isOwnDomain(registrableDomain(row.domain) ?? row.domain, own))) {
      ranked.add(question.search.keyword.trim().toLowerCase());
    }
  });
  return (query) => ranked.has(query.trim().toLowerCase());
}

/** Which pages the site's destination can update. `null` (not a hosted
 *  destination) leaves the update to that destination, which answers for
 *  itself; a hosted one updates only its own live publications. */
export function canUpdateFrom(own: HostedOwnPages | null): (url: string) => boolean {
  if (own === null) return () => true;
  return (url) => addressesOwnPage(url, own);
}

/**
 * The band a row would be given **today**, from the evidence stored on it
 * (issue 884's stale-band half).
 *
 * A row keeps the band it was given when it was derived, and a policy
 * change moves the bars under it: the dogfood site's six were banded before
 * right-sizing shipped (issue 862) and were still on file claiming to be
 * ordinary targets. This re-applies the two halves of the law that **can**
 * be recomputed from what the row already carries, against the site's
 * footprint as the current report measures it:
 *
 *   - demand — the search's own volume against `qualifyingDemand(own)`;
 *   - difficulty — the vendor's keyword difficulty, where the row carries
 *     one (issue 867), against `difficultyCeiling(own)`.
 *
 * The competition half is **not** recomputed: it reads the target's whole
 * top ten, and a row stores one rival, not ten. So this is a floor and
 * never a promotion — it can only find a row outsized, never restore one.
 * A row whose stored band already says `not-yet` stays where it is.
 *
 * No vendor call: every input is a stored number.
 */
export function rebandFor(o: Opportunity, ownRanked: number): Winnability | null {
  if (o.family === "fix" || o.fitBand === null) return null;
  if (!qualifiesForADay(o.fitBand)) return o.fitBand;

  const volume = o.volume;
  if (volume !== null && volume.kind !== "unmeasured" && demandBand({ volume: volume.value, ownRanked }) === "not-yet") {
    return OUTSIZED;
  }
  const difficulty = "target" in o.evidence ? o.evidence.target?.difficulty : undefined;
  if (
    difficulty !== undefined &&
    difficulty.kind !== "unmeasured" &&
    difficulty.value > difficultyCeiling(ownRanked)
  ) {
    return OUTSIZED;
  }
  return o.fitBand;
}

/**
 * The site's own ranked count as the current report measured it, or `null`
 * where this site has no readable one.
 *
 * `null` is not zero here, and the difference matters: derivation reads an
 * unmeasured footprint as the cold-start 0 because it is banding against
 * the pass it just ran, while this re-bands rows that were banded against
 * some earlier pass. With no measurement in hand the honest move is to
 * leave every stored band alone rather than to re-band the whole site as
 * though it ranked for nothing.
 */
function ownRankedOf(report: StoredReport | null): number | null {
  const own = report?.ownRanked;
  if (own === undefined || own.kind === "unmeasured") return null;
  return own.value;
}

/**
 * Records readiness on every open Write, Improve and Earn row of one site.
 *
 * Reads, once each: the open rows, the site's `not_working` verdicts, its
 * current report (for the profile and what it ranks for) and whether its own
 * pages ground a fact. Writes only the rows whose answer changed.
 */
export async function assessReadiness(
  siteId: string,
  a: { at: Date }
): Promise<{ ready: number; unready: number }> {
  const store = opportunityStore();
  const rows = await store.openRankable(siteId);
  if (rows.length === 0) return { ready: 0, unready: 0 };

  const [verdicts, report, profile, grounded] = await Promise.all([
    store.notWorkingVerdicts(siteId),
    store.currentReport(siteId),
    store.profileForSite(siteId),
    store.hasGroundingFact(siteId),
  ]);
  // Read only where there is an Earn row to answer: it re-reads the site's
  // measured pages and its profile, which nothing else here needs.
  const earnGrounding = rows.some((row) => row.family === "earn")
    ? await store.earnGrounding(siteId)
    : NO_EARN_GROUNDING;
  // Read only where there is an update to deliver.
  const ownPages = rows.some((row) => row.family === "improve") ? await store.hostedOwnPages(siteId) : null;
  const ctx: ReadinessContext = {
    grounded,
    earnGrounding,
    suppression: suppressionOf(verdicts, a.at),
    profile,
    ownRanks: ownRanksFrom(report),
    canUpdate: canUpdateFrom(ownPages),
  };

  // Issue 884: the row's band is brought up to today's law before its
  // readiness is decided, so a row banded under an older one is corrected
  // by the next pass rather than competing as if it still qualified.
  const ownRanked = ownRankedOf(report);

  let ready = 0;
  for (const row of rows) {
    const stored = readOpportunity(row);
    const band = ownRanked === null ? null : rebandFor(stored, ownRanked);
    if (band !== null && band !== stored.fitBand) await store.setFitBand(stored.id, band);
    const opportunity = band === null ? stored : { ...stored, fitBand: band };
    const reason = opportunityReady(opportunity, ctx);
    if (reason === null) ready += 1;
    if (stored.ready !== (reason === null) || stored.unreadyReason !== reason) {
      await store.setReadiness(opportunity.id, reason);
    }
  }
  return { ready, unready: rows.length - ready };
}
