// BUILD §4.7 — the change engine's one public entry.
//
// Three answers, read two ways (`declared.ts`), their difference computed
// rather than recorded (`pending.ts`), and the dates every series breaks at
// derived from the scans themselves (`markers.ts`). ADR-030 is the decision
// all three rest on: there is no pending-change record, and adding one is
// the mistake this module is shaped to prevent.
export type {
  ChangeKind,
  DeclaredAnswers,
  MeasuredAnswers,
  SaveDomainResult,
  SaveOk,
} from "./declared";
export {
  NoSuchSiteError,
  declaredAnswers,
  declaredTimezone,
  measuredAnswers,
  saveCategory,
  saveDomain,
  saveRivals,
} from "./declared";
export type { GenerationHold, PendingChange } from "./pending";
export { effectiveOn, generationHold, pendingChanges } from "./pending";
export type { ChangeMarker } from "./markers";
export { changeMarkers, domainHistory, weeksMeasured } from "./markers";
