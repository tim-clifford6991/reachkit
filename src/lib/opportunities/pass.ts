// BUILD §7, §6.3 — what a paid pass does with what it measured.
//
// One function, one path for both tiers (issue 1559): the pass derives what
// its evidence supports, the questions buyers were seen asking folded into
// the topic of the results page they were seen on, gives the new rows their
// readiness, and counts the writable days out of `PLAN_DEPTH` (seven days
// and three spares). It runs inside the pass's own cost context, under the
// pass's own cap — §6.3 puts "Haiku ×~4 for opportunity typing" in the deep
// and weekly budgets and nowhere else — and persists through the partial
// unique index, so a re-derived target adds nothing. The week itself is
// committed after the week's verdicts (`planWeek`, from `weekly/refresh`);
// a deep pass clears the site's week, so its next evening commits one from
// what this pass wrote.
//
// **This module reads the report and decides nothing.** The two inputs
// §7's winnability needs are projections of the blob and are taken here
// rather than in `derive/`, which must not know where a report comes
// from:
//
//   `ownRanked`     the customer's own ranked count, as the pass measured
//                   it (issue #140 put it on the blob; it is not
//                   `drivers.searchPresence`, which is the 0–100
//                   sub-measure). Its `unmeasured` arm is read by
//                   `ownRankedValue` as the cold-start 0 — the
//                   conservative reading and not a convenient one: at 0
//                   the bars are 500 and 100, the tightest they go, so
//                   fewer targets qualify rather than more
//                   (`winnability/bars.ts`).
//   `rankedCounts`  `rankedCountsFromSizes` over `report.rivalSizes` —
//                   #37's sizing, projected. An `unmeasured` arm yields
//                   an empty lookup, and an absent domain is
//                   `undeterminable`, never a zero that would satisfy
//                   every bar. Since issue 901 that member carries the
//                   domains the pass's own twelve top tens hold as well
//                   as the rivals the customer chose, which is what lets
//                   a target be banded against a domain its own SERP
//                   holds.
//
// Nothing here writes a sentence, reads a clock, or decides whether the
// customer has paid: `hasActiveAccess` is the caller's answer. A site whose
// access has lapsed gets no derivation, the same shape re-measurement itself
// takes.
import type { CostContext } from "@/lib/costs";
import type { StoredReport } from "@/lib/scan/report";
import type { InventoryRow } from "@/lib/site-profile/types";
import { assessFixPages } from "./fix-page";
import type { KnownMatch } from "@/lib/known-content/types";
import { deriveOpportunities, type DeriveInput } from "./derive";
import { assessReadiness, canUpdateFrom } from "./readiness";
import { opportunityStore } from "./store";
import { writableDays } from "./rank/open";
import { rankedCountsFromSizes, type RankedCounts } from "./winnability/counts";

/** Which pass is asking. The free tier is absent by construction: §6.6
 *  keeps sizing and typing off the free path, and a free scan has no site
 *  to hold supply for. */
export type PassTier = "deep" | "weekly";

export interface PassOutcome {
  tier: PassTier;
  added: number;
  unused: number;
}

/** #37's sizing as winnability reads it. An `unmeasured` arm is an empty
 *  lookup and not an error: every top-ten domain then reads
 *  `undeterminable`, which is what "we have not sized this market" means
 *  and is counted as a rejection rather than guessed at. */
export function rankedCountsOf(report: StoredReport): RankedCounts {
  const at = report.verdict.measuredAt;
  if (report.rivalSizes.kind === "unmeasured") return rankedCountsFromSizes([], at);
  return rankedCountsFromSizes(report.rivalSizes.value, at);
}

function inputFor(a: {
  siteId: string;
  report: StoredReport;
  hostedHost: string | null;
  inventory: readonly InventoryRow[];
  known: DeriveInput["known"];
  market: DeriveInput["market"];
  knowledge: DeriveInput["knowledge"];
  competitors: readonly string[];
  prompts: readonly string[];
}): DeriveInput {
  return {
    siteId: a.siteId,
    scanId: a.report.scanId,
    report: a.report,
    ownRanked: a.report.ownRanked,
    rankedCounts: rankedCountsOf(a.report),
    hostedHost: a.hostedHost,
    inventory: a.inventory,
    market: a.market ?? null,
    knowledge: a.knowledge ?? null,
    competitors: a.competitors,
    prompts: a.prompts,
    ...(a.known === undefined ? {} : { known: a.known }),
  };
}

/**
 * The net-new gate this pass derives against (#928).
 *
 * Two answers, both read here rather than in `derive/`: which page the site
 * already has on a candidate's topic — narrowed by the database, one topic
 * at a time, and scored by `known-content/match.ts` — and whether this
 * site's destination can publish an update of that page, which is the same
 * predicate readiness applies (`canUpdateFrom`).
 *
 * `undefined` where the index could not be read at all. A pass that cannot
 * ask plans exactly what it planned before #928: nothing is converted and
 * nothing is refused, rather than every topic being called net new by a gate
 * that was never asked — readiness asks again over the stored rows, so a
 * repeat that slipped through here is still refused there.
 */
async function knownGateFor(a: {
  siteId: string;
  report: StoredReport;
}): Promise<DeriveInput["known"]> {
  const { alreadyCovered } = await import("@/lib/known-content/match");
  const store = opportunityStore();
  const canUpdate = canUpdateFrom(await store.hostedOwnPages(a.siteId));
  // One narrowed read per topic, resolved before the derivation so the gate
  // the candidates are mapped through is pure. The reads are the store's, so
  // this asks the database once per search and not once per candidate.
  const topics = new Map<string, KnownMatch | null>();
  const queries =
    a.report.questions.kind === "unmeasured"
      ? []
      : a.report.questions.value.map((question) => question.search.keyword);
  for (const query of new Set(queries)) {
    if (query.trim() === "") continue;
    const near = await store.knownContentNear({ siteId: a.siteId, query });
    topics.set(query.trim().toLowerCase(), alreadyCovered({ query }, near));
  }
  return {
    covered: (candidate) => topics.get((candidate.targetQuery ?? "").trim().toLowerCase()) ?? null,
    canUpdate,
    at: a.report.verdict.measuredAt,
  };
}

/**
 * Derives and persists one pass's opportunities. Where the evidence and the
 * questions run out first, the answer is a shorter week and a truthful line
 * (§14's volume-follows-supply guardrail), never a padded one. A weekly pass
 * does nothing at all where access has lapsed.
 */
export async function deriveForPass(
  c: CostContext,
  a: {
    tier: PassTier;
    siteId: string;
    report: StoredReport;
    /** ADR-050's gate, answered by the caller. Read by the weekly arm
     *  alone: onboarding's deep pass runs on a payment that has just
     *  cleared. */
    hasActiveAccess: boolean;
  }
): Promise<PassOutcome> {
  const store = opportunityStore();
  const [hostedHost, inventory] = await Promise.all([
    store.hostedHostFor(a.siteId),
    store.inventoryFor(a.report.domain),
  ]);

  // SPEC §7 (2026-09-20, #928): "read through the connection when it is made
  // and every Monday". This is the Monday half — and the deep pass's first
  // build of the index, which is the reading its own derivation is measured
  // against. It runs **before** the derivation and after the crawl has
  // written this pass's inventory, so the index the net-new rule reads is
  // this pass's reading of the site and not last week's. It never throws: a
  // source that could not be read leaves its own rows as they were.
  await store.refreshKnownContent({ siteId: a.siteId, domain: a.report.domain, inventory });

  const known = await knownGateFor({ siteId: a.siteId, report: a.report });
  // SPEC §6 (2026-10-03, issue 1134): the market in force, which fit is
  // judged against. A read that fails is a pass with no market to judge
  // against, never a pass that derives nothing.
  const { market, competitors, prompts, knowledge } = await store
    .marketFor(a.siteId)
    .catch(() => ({ market: null, competitors: [] as readonly string[], prompts: [] as readonly string[], knowledge: null }));
  const input = inputFor({ siteId: a.siteId, report: a.report, hostedHost, inventory, known, market, knowledge, competitors, prompts: prompts ?? [] });

  // SPEC §9 (#690): this pass's scan retires the fixes it shows cleared
  // before anything is derived, so a page fixed last week is not re-derived
  // beside its own closed row. The fixes that stand have their readiness
  // recorded with the week's (`planWeek`).
  await assessFixPages(a.siteId, { report: a.report });
  if (a.tier === "weekly" && !a.hasActiveAccess) return { tier: a.tier, added: 0, unused: await writableDays(a.siteId) };

  // One derivation, not a loop: the report is a fixed set of measurements,
  // and a pass with no money left spends none here. Its new rows have their
  // readiness before the writable days are counted.
  const derived = c.capHit() ? null : await deriveOpportunities(c, input);
  if (derived !== null && derived.created.length > 0) {
    await assessReadiness(a.siteId, { at: a.report.verdict.measuredAt, only: new Set(derived.created.map((row) => row.id)) });
  }
  const unused = await writableDays(a.siteId, a.report.verdict.measuredAt);
  // A deep pass (onboarding, or the customer's re-measure) changed what the
  // site holds: its next evening commits the week again.
  if (a.tier === "deep") await store.commitPlan(a.siteId, []);
  const added = derived?.created.length ?? 0;
  // `spentCents` tells a spent reserve (at the cap) from a day or site ceiling (below it), which `capHit()` lumps.
  const derivation =
    derived === null
      ? { derived: "not_run" as const, because: "spend_ceiling" as const, spentCents: c.spentCents() }
      : { derived: derived.created.length };
  console.log(JSON.stringify({ event: "supply_pass", tier: a.tier, siteId: a.siteId, scanId: a.report.scanId, added, unused, ...derivation }));
  return { tier: a.tier, added, unused };
}
