// What a paid pass does with what it measured: one derivation for both tiers, under the pass's own cap.
// The two winnability inputs are projected from the report here, so `derive/` never knows where a report comes from.
import { SUPPLY_SHORT_BELOW } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { siteLocale } from "@/lib/locale/site";
import { recordOpsEvent } from "@/lib/ops/events";
import { FREE_SCAN_POLICY_VERSION } from "@/lib/scan/ceilings";
import type { TopUpSpend } from "@/lib/market/questions/top-up-buy";
import { storedRivalRows } from "@/lib/vendors/dataforseo/labs";
import type { StoredReport } from "@/lib/scan/report";
import type { InventoryRow } from "@/lib/site-profile/types";
import { assessFixPages } from "./fix-page";
import type { KnownPage } from "@/lib/known-content/types";
import { contentTypeOf } from "./content-type";
import type { Candidate } from "./derive/candidate";
import { deriveOpportunities, type DeriveInput } from "./derive";
import { afterReadiness, shortfallOf } from "./derive/ledger";
import { liveTwinIds } from "./plan";
import { assessReadiness, canUpdateFrom } from "./readiness";
import { opportunityStore, readOpportunity } from "./store";
import { rankedCountsFromSizes, type RankedCounts } from "./winnability/counts";

/** Which pass is asking; a free scan has no site to hold supply for. */
export type PassTier = "deep" | "weekly";

export type PassOutcome = { tier: PassTier; added: number };

/** Rival sizing as winnability reads it; unsized is an empty lookup, so every domain reads `undeterminable`, never 0. */
export const rankedCountsOf = (report: StoredReport): RankedCounts => rankedCountsFromSizes(report.rivalSizes.kind === "unmeasured" ? [] : report.rivalSizes.value, report.verdict.measuredAt);

function inputFor(a: { siteId: string; report: StoredReport; hostedHost: string | null; inventory: readonly InventoryRow[]; known: DeriveInput["known"]; market: DeriveInput["market"]; knowledge: DeriveInput["knowledge"]; competitors: readonly string[]; prompts: readonly string[] }): DeriveInput {
  const { siteId, report, hostedHost, inventory, competitors, prompts } = a;
  return { siteId, scanId: report.scanId, report, ownRanked: report.ownRanked, rankedCounts: rankedCountsOf(report), hostedHost, inventory, market: a.market ?? null, knowledge: a.knowledge ?? null, competitors, prompts, ...(a.known === undefined ? {} : { known: a.known }) };
}

/** SPEC §6 *A competitor wins, the site is absent*: each competitor's ranked rows its sizing cached, 0¢; a miss reads as nothing read. */
export const cachedRivalRows = (siteId: string) => async (domains: readonly string[]): Promise<NonNullable<DeriveInput["rivalRows"]>> => {
  const locale = await siteLocale(siteId);
  const read = await Promise.all([...new Set(domains)].map(async (domain) => [domain, await storedRivalRows({ domain, locale, policyVersion: FREE_SCAN_POLICY_VERSION })] as const));
  return new Map(read.flatMap(([domain, rows]) => (rows === null ? [] : [[domain, rows] as const])));
};

/** The net-new gate: the page the site already has on a topic, and whether its destination can update it.
 *  `undefined` where the index cannot be read, so nothing is converted or refused. */
async function knownGateFor(a: { siteId: string; report: StoredReport; market: DeriveInput["market"] }): Promise<DeriveInput["known"]> {
  const { alreadyCovered, productsOf } = await import("@/lib/known-content/match");
  const store = opportunityStore();
  const canUpdate = canUpdateFrom(await store.hostedOwnPages(a.siteId));
  // One read per search, resolved first so the gate the candidates pass through is pure.
  const near = new Map<string, readonly KnownPage[]>();
  const queries = a.report.questions.kind === "unmeasured" ? [] : a.report.questions.value.map((question) => question.search.keyword);
  for (const query of new Set(queries)) if (query.trim() !== "") near.set(query.trim().toLowerCase(), await store.knownContentNear({ siteId: a.siteId, query }));
  const names = productsOf(a.report.domain, a.market ?? null);
  // A list or comparison is also matched on the products its page compares, which its search's words may not share.
  const products = { names, pages: await store.knownContentNear({ siteId: a.siteId, query: names.join(" or ") }) };
  const match = (c: Candidate, pages: readonly KnownPage[] | undefined, title?: string | null) => (pages === undefined ? null : alreadyCovered({ query: c.targetQuery ?? "", title, ...(contentTypeOf(c) === "listicle" ? { products } : {}) }, pages, a.market));
  return {
    covered: (candidate) => match(candidate, near.get((candidate.targetQuery ?? "").trim().toLowerCase())),
    read: async (candidate) => (candidate.targetQuery === null ? null : match(candidate, await store.knownContentNear({ siteId: a.siteId, query: candidate.targetQuery }), candidate.title)),
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
    /** The weekly job's top-up spend (`topUpSpend`); absent, a short week tops up from stored rows at 0¢. */
    topUp?: TopUpSpend;
    /** The competitors' cached ranked rows (`cachedRivalRows`); absent, none are read. */
    rivalRows?: ReturnType<typeof cachedRivalRows>;
  }
): Promise<PassOutcome> {
  const store = opportunityStore();
  const [hostedHost, inventory] = await Promise.all([store.hostedHostFor(a.siteId), store.inventoryFor(a.report.domain)]);

  // Before the derivation, so the net-new rule reads this pass's index of the site and not last week's. Never throws.
  await store.refreshKnownContent({ siteId: a.siteId, domain: a.report.domain, inventory });

  // A market that cannot be read leaves fit judged against the profile, never a pass that derives nothing.
  const { market, competitors, prompts, knowledge, area } = await store
    .marketFor(a.siteId, { quoted: true })
    .catch(() => ({ market: null, competitors: [] as readonly string[], prompts: [] as readonly string[], knowledge: null, area: null }));
  const known = await knownGateFor({ siteId: a.siteId, report: a.report, market });
  const searchRivals = a.report.rivals.kind === "measured" ? a.report.rivals.value.map((rival) => rival.domain) : [];
  const rivalRows = await a.rivalRows?.([...(market?.rivals.map((rival) => rival.domain) ?? []), ...competitors, ...searchRivals]).catch(() => undefined);
  const input = { ...inputFor({ siteId: a.siteId, report: a.report, hostedHost, inventory, known, market, knowledge, competitors, prompts: prompts ?? [] }), area: area ?? null, ...(a.tier === "weekly" ? { topUp: a.topUp === undefined ? {} : { spend: a.topUp }, liveTwins: await liveTwinIds(a.siteId, a.report.verdict.measuredAt) } : {}), ...(rivalRows === undefined ? {} : { rivalRows }) };

  // Fixes this scan shows cleared retire first, so a fixed page is not re-derived beside its closed row.
  await assessFixPages(a.siteId, { report: a.report });
  if (a.tier === "weekly" && !a.hasActiveAccess) return { tier: a.tier, added: 0 };

  // Readiness first, so the top-up and the offers are sized on what is still writable once live pages hold their twins.
  if (!c.capHit()) await assessReadiness(a.siteId, { at: a.report.verdict.measuredAt });
  // One derivation over fixed measurements; a pass with no money left spends none.
  const derived = c.capHit() ? null : await deriveOpportunities(c, input);
  // A deep pass changed what the site holds, so its next evening commits the week again.
  if (a.tier === "deep") await store.commitPlan(a.siteId, []);
  const added = derived?.created.length ?? 0;
  // Supply is what can fill a day: readiness decides it before it is counted, so a row a live page covers is not supply.
  if (derived !== null) await assessReadiness(a.siteId, { at: a.report.verdict.measuredAt });
  // Supply counts what the commit can place: a live page's twin it refuses is no place.
  const open = derived === null ? [] : await store.openRankable(a.siteId), twins = derived === null ? new Set<string>() : await liveTwinIds(a.siteId, a.report.verdict.measuredAt, false, open), rows = open.map(readOpportunity);
  const supply = derived === null ? null : afterReadiness(derived.supply, rows.filter((row) => !twins.has(row.id)));
  // `spentCents` tells a spent reserve (at the cap) from a day or site ceiling (below it), which `capHit()` lumps.
  const derivation = supply === null ? { derived: "not_run" as const, because: "spend_ceiling" as const, spentCents: c.spentCents() } : { derived: added, ...supply };
  // Rows, not log lines: the runtime log drops a long request's tail, and the daily check tells a thin pass from a dry source.
  await recordOpsEvent("supply_pass", JSON.stringify({ tier: a.tier, added, ...derivation }), a.report.scanId, a.siteId);
  if (supply !== null && supply.have < SUPPLY_SHORT_BELOW) await recordOpsEvent("supply_short", shortfallOf(supply.sources, rows, twins), String(SUPPLY_SHORT_BELOW - supply.have), a.siteId);
  return { tier: a.tier, added };
}
