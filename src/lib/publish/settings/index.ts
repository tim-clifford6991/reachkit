// BUILD §9 · §4.7 — the publishing settings leaf's public face.
//
// A barrel and nothing else: no logic lives here, and every module inside
// the leaf imports its siblings by file so the import graph stays readable
// at file granularity (ADR-092).
export {
  SETTINGS_FIELDS,
  adoptBrowserTimezone,
  explainPair,
  invalidFields,
  isResolvableZone,
  readPublishingSettings,
  toPublishingSettings,
  vetoDaysFromHours,
  vetoHoursFromDays,
  type AdoptResult,
  type Mode,
  type PairCopyKey,
  type PublishingSettings,
  type SettingsField,
} from "./settings";
export { pairOf, samePair, settingsOf } from "./pair";
export { nextPublishTimeAtOrAfter } from "./clock";
export { NOT_YET_PUBLISHED, isNotYetPublished, newVetoDeadline, type ReDeadlineInput } from "./apply";
export {
  enteredReviewAt,
  savePublishingSettings,
  type SaveApplied,
  type SaveResult,
} from "./save";
