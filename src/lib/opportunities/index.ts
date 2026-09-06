// BUILD §7 — the opportunity engine's public entry point.
//
// Everything a caller outside `src/lib/opportunities/` may use, and
// nothing else. The family derivations, the candidate shape, the store
// port's row type and the winnability bars are internal: a caller that
// reached them could produce an opportunity measured evidence did not.
export type {
  Acceptance,
  Barrier,
  Evidence,
  Family,
  Opportunity,
  OpportunityStatus,
  OpportunityType,
  Ranked,
  RejectionCount,
  Shortfall,
  Winnability,
} from "./types";
export { BARRIERS, FAMILY_OF, OPPORTUNITY_TYPES } from "./types";

export { bandWinnability, qualifies } from "./winnability/band";
export { qualifyingBar, winnableBar } from "./winnability/bars";
export { rankedCountFrom, type RankedCounts } from "./winnability/counts";

export { rankScore } from "./rank/score";
export { rankOpen } from "./rank/open";
export { nextForDay } from "./next";

export { deriveOpportunities, type DeriveInput, type DeriveOutcome } from "./derive";
export { explainChoice, type Choice } from "./derive/explain";

export { supplyDepth, type Depth } from "./supply/depth";
export { supplyNotice, type SupplyNotice } from "./supply/notice";
export { pursueDepth, type DepthStop } from "./supply/pursue";
export { topUp } from "./supply/topup";

export { setOpportunityStore, type OpportunityStore } from "./store";
