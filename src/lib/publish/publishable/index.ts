// BUILD §9 — the veto leaf's public face, a barrel only. `machine/guards.ts` imports `./rule` by file, since this barrel
// re-exports `veto.ts`, which imports `transition()`, and that would close a cycle (ADR-092).
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
  previewVetoLink,
  redeemVeto,
  redeemVetoLink,
  sameHash,
  vetoLinkPath,
  type PreviewResult,
  type RedeemResult,
  type VetoPreview,
  type VetoRefusal,
  type WeekDay,
} from "./veto";
export {
  PUBLISHABLE_RULE,
  customerTold,
  publishableAndDue,
  type PublishableRuleShape,
} from "./rule";
