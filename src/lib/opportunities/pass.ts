// What a paid pass does with what it measured: one derivation for both tiers, under the pass's own cap.
// The two winnability inputs are projected from the report here, so `derive/` never knows where a report comes from.
import type { CostContext } from "@/lib/costs";
import { recordOpsEvent } from "@/lib/ops/events";
import type { StoredReport } from "@/lib/scan/report";
import type { InventoryRow } from "@/lib/site-profile/types";
import { assessFixPages } from "./fix-page";
import type { KnownMatch } from "@/lib/known-content/types";
import { deriveOpportunities, type DeriveInput } from "./derive";
import { canUpdateFrom } from "./readiness";
import { opportunityStore } from "./store";
import { rankedCountsFromSizes, type RankedCounts } from "./winnability/counts";

/** Which pass is asking; a free scan has no site to hold supply for. */
export type PassTier = "deep" | "weekly";

export interface PassOutcome {
  tier: PassTier;
  added: number;
}

/** Rival sizing as winnability reads it; unsized is an empty lookup, so every domain reads `undeterminable`, never 0. */
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

/** The net-new gate: the page the site already has on a topic, and whether its destination can update it.
 *  `undefined` where the index cannot be read, so nothing is converted or refused. */
async function knownGateFor(a: {
  siteId: string;
  report: StoredReport;
}): Promise<DeriveInput["known"]> {
  const { alreadyCovered } = await import("@/lib/known-content/match");
  const store = opportunityStore();
  const canUpdate = canUpdateFrom(await store.hostedOwnPages(a.siteId));
  // One read per search, resolved first so the gate the candidates pass through is pure.
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

/** Derives and persists one pass's opportunities: a shorter week where supply runs out, never a padded one. */
export async function deriveForPass(
  c: CostContext,
  a: {
    tier: PassTier;
    siteId: string;
    report: StoredReport;
    /** Read by the weekly arm alone: the deep pass runs on a payment that has just cleared. */
    hasActiveAccess: boolean;
  }
): Promise<PassOutcome> {
  const store = opportunityStore();
  const [hostedHost, inventory] = await Promise.all([
    store.hostedHostFor(a.siteId),
    store.inventoryFor(a.report.domain),
  ]);

  // Before the derivation, so the net-new rule reads this pass's index of the site and not last week's. Never throws.
  await store.refreshKnownContent({ siteId: a.siteId, domain: a.report.domain, inventory });

  const known = await knownGateFor({ siteId: a.siteId, report: a.report });
  // A market that cannot be read leaves fit judged against the profile, never a pass that derives nothing.
  const { market, competitors, prompts, knowledge } = await store
    .marketFor(a.siteId)
    .catch(() => ({ market: null, competitors: [] as readonly string[], prompts: [] as readonly string[], knowledge: null }));
  const input = inputFor({ siteId: a.siteId, report: a.report, hostedHost, inventory, known, market, knowledge, competitors, prompts: prompts ?? [] });

  // Fixes this scan shows cleared retire first, so a fixed page is not re-derived beside its closed row.
  await assessFixPages(a.siteId, { report: a.report });
  if (a.tier === "weekly" && !a.hasActiveAccess) return { tier: a.tier, added: 0 };

  // One derivation over fixed measurements; a pass with no money left spends none.
  const derived = c.capHit() ? null : await deriveOpportunities(c, input);
  // A deep pass changed what the site holds, so its next evening commits the week again.
  if (a.tier === "deep") await store.commitPlan(a.siteId, []);
  const added = derived?.created.length ?? 0;
  // `spentCents` tells a spent reserve (at the cap) from a day or site ceiling (below it), which `capHit()` lumps.
  const derivation =
    derived === null
      ? { derived: "not_run" as const, because: "spend_ceiling" as const, spentCents: c.spentCents() }
      : { derived: derived.created.length, have: derived.supply.have, short: derived.supply.short, dry: derived.supply.dry };
  console.log(JSON.stringify({ event: "supply_pass", tier: a.tier, siteId: a.siteId, scanId: a.report.scanId, added, ...derivation }));
  // Kept as a row so the daily check can tell a thin pass from a source that ran dry.
  if (derived !== null && derived.supply.short > 0) {
    await recordOpsEvent("supply_short", derived.supply.dry.join(",") || "none", String(derived.supply.short), a.siteId);
  }
  return { tier: a.tier, added };
}
