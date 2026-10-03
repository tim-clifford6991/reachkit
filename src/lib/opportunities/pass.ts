// BUILD §7, §6.3 — what a paid pass does with what it measured.
//
// One function, two tiers, and no third caller: the deep pass at
// onboarding pursues a month of depth out of the evidence it just bought
// (`pursueDepth`), and every weekly measurement adds what the week newly
// found (`topUp`). Both run inside the pass's own cost context, under the
// pass's own cap — §6.3 puts "Haiku ×~4 for opportunity typing" in the
// deep and weekly budgets and nowhere else — and both persist through the
// same partial unique index, so a re-derived target adds nothing.
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
// customer has paid: `hasActiveAccess` is the caller's answer, exactly as
// `topUp`'s own header requires.
import type { CostContext } from "@/lib/costs";
import type { StoredReport } from "@/lib/scan/report";
import type { InventoryRow } from "@/lib/site-profile/types";
import type { DeriveInput } from "./derive";
import { assessFixPages } from "./fix-page";
import type { KnownMatch } from "@/lib/known-content/types";
import { canUpdateFrom } from "./readiness";
import { opportunityStore } from "./store";
import { pursueDepth, type DepthStop } from "./supply/pursue";
import { topUp } from "./supply/topup";
import { rankedCountsFromSizes, type RankedCounts } from "./winnability/counts";

/** Which pass is asking. The free tier is absent by construction: §6.6
 *  keeps sizing and typing off the free path, and a free scan has no site
 *  to hold supply for. */
export type PassTier = "deep" | "weekly";

export type PassOutcome =
  | { tier: "deep"; created: number; unused: number; stop: DepthStop }
  | { tier: "weekly"; added: number; unused: number };

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
 * Derives and persists one pass's opportunities.
 *
 * The deep pass pursues depth: one derivation over everything the pass
 * measured, and then it stops — `pursueDepth` buys nothing beyond it, so
 * where the evidence runs out before a month of days does the answer is a
 * shorter calendar and a truthful line (§14's volume-follows-supply
 * guardrail). The weekly pass tops up: additive only, and nothing at all
 * where access has lapsed.
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
  const { market, competitors, prompts } = await store
    .marketFor(a.siteId)
    .catch(() => ({ market: null, competitors: [] as readonly string[], prompts: [] as readonly string[] }));
  // SPEC §6 (2026-09-29, issue 1133): and the knowledge base beside it.
  const { readKnowledgeBase, knowledgeDigest } = await import("@/lib/site-profile/knowledge/read");
  const base = await readKnowledgeBase({ siteId: a.siteId, domain: a.report.domain });
  const knowledge = base === null ? null : knowledgeDigest(base);
  const input = inputFor({ siteId: a.siteId, report: a.report, hostedHost, inventory, known, market, knowledge, competitors, prompts: prompts ?? [] });

  // SPEC §9 (#690): this pass's scan retires the fixes it shows cleared
  // before anything is derived, so a page fixed last week is not re-derived
  // beside its own closed row; and the fixes that stand have their
  // readiness recorded once the derivation has added any new ones.
  await assessFixPages(a.siteId, { report: a.report });

  if (a.tier === "deep") {
    const { created, unused, stop } = await pursueDepth(c, input);
    await assessFixPages(a.siteId, { report: null });
    return { tier: "deep", created, unused, stop };
  }

  const { added, unused } = await topUp(c, { ...input, hasActiveAccess: a.hasActiveAccess });
  await assessFixPages(a.siteId, { report: null });
  return { tier: "weekly", added, unused };
}
