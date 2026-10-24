// src/lib/config/constants.ts — grouped, frozen, exhaustively asserted
//
// WO-006, cut from BP-005's `## Public interface`. One named group per
// source section; every group is `Object.freeze`d (and `as const` for its
// literal types) so nothing mutates a pin at runtime (BP-005 error
// behaviour). Every other module imports this one (`structure.md` rule 5,
// BP-005 module boundary); the groups live in `constants/<stage>.ts`, which
// import nothing, and this file only re-exports them.
//
// Two values BP-005 names in this file are deliberately absent, not
// guessed (rule 1.2):
//   - the removal address REQ-002 criterion 1 requires the free report to
//     name (BP-005 decision 3, `rests-on` — a customer-visible string, the
//     owner's under the decision-rights table, still outstanding).
//   - `WORDPRESS_STAMP_SLUG`, `PRICE_EUR_CENTS`, `PRICE_CURRENCY` and
//     `PRICE_INTERVAL` are declared in BP-005's current `## Public
//     interface` but are not part of WO-006's own enumerated file-plan
//     list or WO-007's consuming test plan; flagged to the planner rather
//     than added outside the listed file plan (rule 4.2 — see the
//     WO-006 return for the full note).
//
// The nine band/severity words BP-005 decision 2 and decision 3's
// discharge route to BP-019 (`BAND_LABELS`, `SCORE_BANDS`, `SEVERITY`) are
// not here and never will be: this file holds counts and boundaries, never
// the customer-visible word.

export * from "./constants/costs";
export * from "./constants/scan";
export * from "./constants/market";
export * from "./constants/opportunities";
export * from "./constants/generate";
export * from "./constants/publish";
export * from "./constants/mail";
export * from "./constants/ui";
