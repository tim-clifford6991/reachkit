// BUILD §9 · §4.7 — the publishing settings leaf's public face.
//
// A barrel and nothing else: no logic lives here, and every module inside
// the leaf imports its siblings by file so the import graph stays readable
// at file granularity (ADR-092).
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-06: `PUBLISH_DELIVER_TIMEOUT_MS = 20000` bounds one whole delivery attempt
//   (distinct from §6.4's per-request bound). REQ-057 c8's "pair" is REQ-073 c4's four values
//   — mode, veto window, publish time, time zone — because the hour and the zone decide when a
//   page publishes. The publishable predicate reads no clock; the veto token is 32 CSPRNG
//   bytes stored only as a SHA-256 hash, single-use, none issued at a zero window; the two DST
//   days resolve to the first instant after the gap / the first occurrence. — #142
//
// DECISIONS 2026-09-10: Supersedes the 2026-09-06 (#142) zero-window arm ('none issued at a
//   zero window'): with `VETO.minDays` 1 the arm is dead; the `*.autopilotZero` copy keys and
//   `explainPair()`'s zero branch are retired by the setup/settings issue. — master, brief
//   §1.8

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
