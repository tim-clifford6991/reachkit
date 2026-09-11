// BUILD §11 — the weekly measurement's one public entry
//
// ARCHITECTURE gives `src/lib/scan/**` "the one scan pipeline … and the
// stored report"; this leaf is the weekly cadence over it. Four things
// leave the module and nothing else does: the site-local week, the hourly
// selection, the measurement, and the one account of a week every surface
// reads (§4.4, §4.5, §4.6 and the Monday mail read this and derive no
// second account of the same week).
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-07: The Monday digest is sent from the weekly tick, once per site-week,
//   keyed on the scans row's digest_sent_at and stamped only where the send seam accepted the
//   mail (a refused send leaves the week open for the next tick); a week not measured sends
//   nothing (ADR-071), a week measured in part sends and names its missed parts; the two
//   opening figures are deltas of two stored weeks and are unmeasured, never zero, when a
//   previous week is absent. — #191

export type { DueSite } from "./due";
export { dueSites } from "./due";
export type { WeeklyOutcome, WeeklyRefusal } from "./run";
export { runWeekly } from "./run";
export type { UnmeasuredPart, WeekAccount } from "./account";
export { accountForWeek, nextDueOn, unmeasuredPartsOf } from "./account";
export type { ActiveAccessGate } from "./access";
export { registerActiveAccessGate } from "./access";
export type { WeekMovement } from "./movement";
export { previousWeekStart, weekMovement } from "./movement";
export type { LocalClock, SiteZone } from "./week";
export { isWeeklyDue, localClock, nextDueAfter, weekKey, weekStartFor } from "./week";
// §4.4's domain block states "Week n", counted over the weeks this module
// has rows for. `weeksAlreadyStamped` is that read — one query for a list
// of `(site_id, week_start)` pairs — and the shell asks it here rather than
// counting weekly rows for itself, so "a week was measured" has one meaning
// and one spelling (`weekKey`) across the tick that writes them and the
// screen that counts them (issue #169).
export { weeksAlreadyStamped } from "./store";
// §4.5's series is a *window* of weeks, not one week: `readWeekScans` is
// the trailing window in one read, so Overview's render path costs one
// round trip rather than twelve (issue #213).
export type { WeekScan } from "./store";
export { readWeekScan, readWeekScans } from "./store";
