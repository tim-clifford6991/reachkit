// BUILD §7 — the opportunity engine's public entry point.
//
// Everything a caller outside `src/lib/opportunities/` may use, and
// nothing else. The family derivations, the candidate shape, the store
// port's row type and the winnability bars are internal: a caller that
// reached them could produce an opportunity measured evidence did not.
export type {
  Acceptance,
  AssetKind,
  Barrier,
  Evidence,
  Family,
  Opportunity,
  OpportunityStatus,
  OpportunityType,
  Ranked,
  RejectionCount,
  Shortfall,
  UnreadyReason,
  Winnability,
} from "./types";
export {
  ASSET_KIND_OF,
  BARRIERS,
  FAMILY_OF,
  OPPORTUNITY_TYPES,
  UNREADY_REASONS,
  assetKindOf,
} from "./types";

export { bandWinnability, qualifies } from "./winnability/band";
export { qualifyingBar, winnableBar } from "./winnability/bars";
export {
  rankedCountFrom,
  rankedCountsFromSizes,
  type RankedCounts,
} from "./winnability/counts";

export { rankOpen } from "./rank/open";
export { planLinkBacks, planMovedLinks, planRefreshes } from "./refresh";
export { assessFixPages, fixPageReadiness, type FixDelivery } from "./fix-page";
export { assessReadiness, opportunityReady, ownRanksFrom, type ReadinessContext } from "./readiness";
export { clusterKey, collapse, comparePrecedence } from "./cluster";
export { suppressionOf, verdictReason, type NotWorkingVerdict, type Suppression } from "./suppression";
export {
  committedWeek,
  weekChosenOn,
  pageForDay,
  planFirstWeek,
  planWeek,
  supplyDepth,
  supplyMeasured,
  supplyNotice,
  supplyState,
  type Depth,
  type SupplyNotice,
  type SupplyState,
} from "./plan";
export { contentTypeOf, CONTENT_TYPES, type ContentType } from "./content-type";
export { pageTypeOf, PAGE_TYPES, type PageType } from "./page-type";
export { sitePagesFor, type SitePage } from "./site-pages";
export { claimForDraft, dismissForVeto, giveBackClaim, queueForDraft, restTopic } from "./drafted";
export { updateInstead } from "./update-instead";

export { deriveOpportunities, type DeriveInput, type DeriveOutcome } from "./derive";
export { explainChoice, type Choice } from "./derive/explain";

export { opportunityById, setOpportunityStore, type OpportunityStore } from "./store";

// What a paid pass does with what it measured: derive, then count the
// writable days of a committed week (issue 1559).
export { deriveForPass, rankedCountsOf, type PassOutcome, type PassTier } from "./pass";

// §9's weekly judgement of the pages the engine's opportunities became
// (REQ-063). It lives under `opportunities/` because a verdict is the
// acceptance test an opportunity was created with, decided — not a second
// fact about a page.
export type {
  Movement,
  NotJudgeableCause,
  PageStanding,
  Verdict,
  VerifyNote,
  WeekStanding,
  WeekStart,
} from "./verdicts";
export type { IndexState } from "./verdicts";
export { judgeWeek, readWeek, weeklyDigest, setVerdictStore } from "./verdicts";
