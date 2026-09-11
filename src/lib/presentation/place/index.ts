// BUILD §6.6 — the place module's public entry point.
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-08-31: One arbiter (`account()`) decides a place's single empty-state line
//   over a closed cause union with fixed precedence; ReachKit's own stop outranks every other
//   cause that is also true. — ADR-011

export { PLACES, isPlaceKey, type PlaceKey, type PlaceSpec } from "./places.ts";
export { account, CAUSE_PRECEDENCE, type Cause, type CauseTag } from "./account.ts";
export { renderPlace, emptyStateLine, type Place } from "./render.ts";
