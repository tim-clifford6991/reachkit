// BUILD §11 — the daily tick's own reads.
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-07: The daily engine seams are one call each into a module that owns the
//   rule: activeSites() (src/lib/publish/daily/sites.ts) selects on a zone, publishing_enabled
//   and a live destination that can publish, two statements per tick, the hour staying with
//   isDraftDue in site-clock; publishApproved() (attempt/deliver.ts) reads the destination
//   kind from the row never the payload, lets publish() run the claim and nine guards, retries
//   in the same invocation, and holds (never fails) a page whose destination is gone; the +24h
//   check is enqueued from the engine because src/lib never imports src/jobs. — #199

export { sitesForDailyTick, type DailySelection, type DailySite } from "./sites";
