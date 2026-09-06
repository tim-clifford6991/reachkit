// src/lib/presentation/copy/keys/offer.ts — BP-020 decision 5, WO-041
//
// The price and offer surfaces' sentences, BP-030 and BP-031 — the
// twelfth partition, added by the planner under constitution rule 1.1 (see
// WO-041 "## Decision taken under rule 1.1", second entry): BP-020
// decision 5 named eleven partitions before the seven BP-001-owned
// surfaces existed, and /pricing's sentences have no module in that list.
// Declared here, where the partition list is written once anyway, so
// registry.ts keeps exactly one author.
//
// Nine keys seeded (WO-041 step 4): BP-030's PRICE_COPY_KEYS (price.*) and
// BP-031's offer.* keys. Empty value, owner-owed — no string is written
// here (constitution §1). The four offer.cadence.*/offer.veto.* keys carry
// a `value` slot: the values are BP-005 pins supplied by BP-031's
// offerTerms(), never written into the sentence here.
//
// 2026-09-04: the owner ruled on seven of the nine (WO-041 `## Log`, this
// date's ruling) — `price.amount`, `price.interval`, `offer.start` and the
// four `offer.cadence.*`/`offer.veto.*` slotted lines — filled verbatim,
// byte for byte, and no longer owner-owed. `price.vat_included` and
// `offer.cancel_self_service` were not part of this ruling and remain
// owner-owed, empty.
import type { CopyPartition } from "../registry.ts";

export const OFFER_COPY = Object.freeze({
  "price.amount": ["€49", { slots: {}, fixedBy: "REQ-022 c1" }],
  "price.vat_included": ["", { slots: {}, fixedBy: "REQ-022 c1" }],
  "price.interval": ["per month, VAT included", { slots: {}, fixedBy: "REQ-022 c1" }],
  "offer.cadence.page": ["One new page written for your site {value}", { slots: { value: "text" }, fixedBy: "REQ-021 c2" }],
  "offer.cadence.measure": ["Your findability re-measured {value}", { slots: { value: "text" }, fixedBy: "REQ-021 c2" }],
  "offer.cadence.movement": ["What moved, in your inbox {value}", { slots: { value: "text" }, fixedBy: "REQ-021 c2" }],
  "offer.veto.window": ["Every page waits {value} for you to stop it before it goes live — and you can cancel any time, yourself", { slots: { value: "text" }, fixedBy: "REQ-021 c2" }],
  // 2026-09-05, issue #13: value moved from "" to `TODO(copy)` per
  // `CLAUDE.md`'s standing rule. `BUILD.md` §4.1 module 6 requires the
  // pricing card to carry "Cancel in one click"; left empty, `copy()`
  // throws and the report screen goes down rather than showing the owner
  // an unwritten line. Still the owner's sentence. `price.vat_included`
  // is untouched: no module renders it — `price.interval`'s own ruled
  // string already says "per month, VAT included".
  "offer.cancel_self_service": ["TODO(copy)", { slots: {}, fixedBy: "REQ-021 c2" }],
  "offer.start": ["Start ReachKit", { slots: {}, fixedBy: "REQ-021 c4" }],

  // 2026-09-06, issue #34: the plan's own name, which §4.7's Billing card
  // states beside the price. One key, because there is one plan and no
  // upgrade, downgrade, annual billing, seat or add-on to name a second
  // (REQ-022 c3, REQ-076's non-goal). It sits in this partition rather than
  // in `settings.*` because it is the same public product fact the price
  // surfaces state, not a sentence about one customer's account —
  // REQ-097's own non-goal draws that line. `TODO(copy)` per `CLAUDE.md`:
  // the Billing card must render something for the plan, so the marker
  // rather than the empty value.
  "plan.single": ["TODO(copy)", { slots: {}, fixedBy: "REQ-022 c1" }],

  // 2026-09-05, issue #13: the four values the four slotted lines above
  // take. BP-031's `offerTerms()` was to supply them and does not exist;
  // the free report's pricing card (`BUILD.md` §4.1 module 6) needs them
  // now. Three are pure owner words with no number in them. The fourth
  // carries the number from its pin — `VETO.defaultHours`
  // (`src/lib/config/constants.ts`) — through an `{hours}` slot, so the
  // veto window is written down once, in the pin, and the owner supplies
  // only the unit around it. `TODO(copy)` per `CLAUDE.md`.
  "offer.cadence.page.value": ["TODO(copy)", { slots: {}, fixedBy: "REQ-021 c2" }],
  "offer.cadence.measure.value": ["TODO(copy)", { slots: {}, fixedBy: "REQ-021 c2" }],
  "offer.cadence.movement.value": ["TODO(copy)", { slots: {}, fixedBy: "REQ-021 c2" }],
  "offer.veto.window.value": ["TODO(copy)", { slots: { hours: "text" }, fixedBy: "REQ-021 c2" }],
}) satisfies CopyPartition;
