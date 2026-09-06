// src/lib/account/lifecycle/index.ts — BUILD §4.7, §13, §14
//
// The lifecycle leaf's one door: the closed offer of two irreversible
// actions, the export handover that must complete before either runs, the
// one function that runs them, and the purge that is the only deleter in
// this schema.
//
// `confirmDangerAction` is the only exported way to reach either action —
// `unpublishEverything` and `deleteAccount` are not re-exported here, so a
// caller that wanted to skip the ticket guard would have to import a file
// this door does not name.
export { DANGER_ZONE, isDangerAction, type DangerAction } from "./danger-zone";
export {
  beginDangerAction,
  markExportTaken,
  DANGER_EXPORT_FAILED,
  type BeginDangerAction,
} from "./handover";
export {
  confirmDangerAction,
  confirmationFor,
  type ConfirmDangerAction,
  type DangerRefusal,
} from "./confirm";
export { accountsDueForPurge, purgeAccount, PurgeIncomplete, PURGE_ORDER } from "./purge";
export type { UnpublishAllResult, StillLiveDestination } from "./unpublish-all";
export type { DeleteAccountResult } from "./delete-account";
export {
  setStampCapability,
  type LeftInWordPress,
  type StampCapability,
  type WordPressListPlace,
} from "./left-in-wordpress";
export {
  setLifecycleStore,
  type DangerTicketRow,
  type DestinationIdRow,
  type LifecycleAccountRow,
  type LifecycleSiteRow,
  type LifecycleStore,
  type LivePublicationRow,
} from "./store";
