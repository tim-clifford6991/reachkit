// BUILD §9 — the veto leaf's public face.
//
// A barrel and nothing else. `machine/guards.ts` imports `./rule` by file
// rather than this barrel: the barrel re-exports `veto.ts`, which imports
// `transition()`, and importing it from the machine would close a cycle
// this leaf exists on the other side of (ADR-092).
export {
  becomesPublishable,
  type NotPublishable,
  type PublishableAnswer,
  type Unresolvable,
} from "./predicate";
export {
  isUnsuppressible,
  kindOf,
  recordTold,
  tellingFor,
  toldCurrentPair,
  type DestinationClause,
  type Telling,
  type TellingInput,
  type TellingKind,
  type ToldAnswer,
} from "./telling";
export {
  hashToken,
  issueVetoLink,
  redeemVeto,
  sameHash,
  type RedeemResult,
  type VetoRefusal,
} from "./veto";
export {
  PUBLISHABLE_RULE,
  customerTold,
  publishableAndDue,
  type PublishableRuleShape,
} from "./rule";
