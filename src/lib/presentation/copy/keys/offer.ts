// BUILD §2.5 — the offer's sentences.
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
// BP-031's offer.* keys. Seeded as empty values, owner-owed — no string
// was written here (constitution §1). The four offer.cadence.*/offer.veto.*
// keys carry a `value` slot: the values are BP-005 pins supplied by BP-031's
// offerTerms(), never written into the sentence here.
//
// 2026-09-04: the owner ruled on seven of the nine (WO-041 `## Log`, this
// date's ruling) — `price.amount`, `price.interval`, `offer.start` and the
// four `offer.cadence.*`/`offer.veto.*` slotted lines — filled verbatim,
// byte for byte, and no longer owner-owed. `price.vat_included` and
// `offer.cancel_self_service` were not part of this ruling.
//
// 2026-09-10, issue #459: the owner approved the master's drafted copy for
// every key this partition still owed ("copy proposal approved"; proposal
// sheet artifact 546f45a0-a996-4d25-b85e-fb03fda7b102), and the 6 approved
// strings — `price.vat_included`, `plan.single` and the four `*.value`
// lines — are applied here byte for byte. No key in this partition is
// owner-owed or `TODO(copy)` any more.
import type { CopyPartition } from "../registry.ts";

export const OFFER_COPY = Object.freeze({
  "price.amount": ["€49", { slots: {}, fixedBy: "REQ-022 c1" }],
  "price.vat_included": ["VAT included", { slots: {}, fixedBy: "REQ-022 c1" }],
  "price.interval": ["per month, VAT included", { slots: {}, fixedBy: "REQ-022 c1" }],
  "offer.cadence.page": ["One new page written for your site {value}", { slots: { value: "text" }, fixedBy: "REQ-021 c2" }],
  "offer.cadence.measure": ["Your findability re-measured {value}", { slots: { value: "text" }, fixedBy: "REQ-021 c2" }],
  "offer.cadence.movement": ["What moved, in your inbox {value}", { slots: { value: "text" }, fixedBy: "REQ-021 c2" }],
  "offer.veto.window": ["Every page waits {value} for you to stop it before it goes live — and you can cancel any time, yourself", { slots: { value: "text" }, fixedBy: "REQ-021 c2" }],
  // 2026-09-05, issue #13: value moved from "" to `TODO(copy)` per
  // `CLAUDE.md`'s standing rule. `BUILD.md` §4.1 module 6 requires the
  // pricing card to carry "Cancel in one click"; left empty, `copy()`
  // throws and the report screen goes down rather than showing the owner
  // an unwritten line. `price.vat_included` was left untouched then: no
  // module rendered it — `price.interval`'s own ruled string already says
  // "per month, VAT included".
  // The approved screen set draws this line under the Start control on
  // both surfaces that carry the offer, unbracketed — approved copy as
  // written (ruling 11a, 2026-09-08; issue #352).
  "offer.cancel_self_service": ["Cancel in one click.", { slots: {}, fixedBy: "REQ-021 c2" }],
  "offer.start": ["Start ReachKit", { slots: {}, fixedBy: "REQ-021 c4" }],
  /** The **control's** own label, and the one the approved set draws on it:
   *  "Start ReachKit €49" (11a). `offer.start` stays exactly as the owner
   *  ruled it on 2026-09-04 and is what the pricing page's eyebrow says;
   *  this is the button, which carries the price because the set puts it
   *  there — the amount is REQ-022 c1's €49, written into the words rather
   *  than composed beside them, so the control cannot say one price while
   *  the card above it says another. */
  "offer.start.priced": ["Start ReachKit €49", { slots: {}, fixedBy: "S4 · REQ-022 c1" }],

  // ── The same four terms, in S4's own words (issue #369) ──────────────
  //
  // The owner ruled the four `offer.cadence.*`/`offer.veto.*` lines above
  // on 2026-09-04, and the approved screen set draws **four different
  // sentences** for the same four facts on S4 — unbracketed, and so
  // approved copy as written (ruling 11a). Two wordings of one offer, one
  // per surface: the report's card keeps the ruling it was written for,
  // the pricing page states the set's.
  //
  // Split rather than overwritten, on the master's own instruction: a
  // ruling is not re-opened by a later drawing, and neither sentence is
  // the other's draft. Nothing about *what is offered* differs — the four
  // facts are the same four, which is what keeps REQ-021 c4's "on the same
  // terms" true across the two screens.
  //
  // The veto line carries the pin through its slot exactly as the ruled one
  // does: `VETO.defaultHours` renders "24" and the sentence reads as the
  // set draws it, so the window is written down once, in
  // `src/lib/config/constants.ts`, and never twice.
  "offer.pricing.page": [
    "1 page a day, written and published for you",
    { slots: {}, fixedBy: "S4 · REQ-021 c2" },
  ],
  "offer.pricing.measure": [
    "Weekly re-measure of your whole market",
    { slots: {}, fixedBy: "S4 · REQ-021 c2" },
  ],
  "offer.pricing.movement": [
    "Weekly movement email",
    { slots: {}, fixedBy: "S4 · REQ-021 c2" },
  ],
  "offer.pricing.veto": [
    "{hours}-hour veto window on every page",
    { slots: { hours: "text" }, fixedBy: "S4 · REQ-021 c2" },
  ],

  // 2026-09-06, issue #34: the plan's own name, which §4.7's Billing card
  // states beside the price. One key, because there is one plan and no
  // upgrade, downgrade, annual billing, seat or add-on to name a second
  // (REQ-022 c3, REQ-076's non-goal). It sits in this partition rather than
  // in `settings.*` because it is the same public product fact the price
  // surfaces state, not a sentence about one customer's account —
  // REQ-097's own non-goal draws that line.
  "plan.single": ["One page a day", { slots: {}, fixedBy: "REQ-022 c1" }],

  // 2026-09-05, issue #13: the four values the four slotted lines above
  // take. BP-031's `offerTerms()` was to supply them and does not exist;
  // the free report's pricing card (`BUILD.md` §4.1 module 6) needs them
  // now. Three are pure owner words with no number in them. The fourth
  // carries the number from its pin — `VETO.defaultHours`
  // (`src/lib/config/constants.ts`) — through an `{hours}` slot, so the
  // veto window is written down once, in the pin, and the owner supplies
  // only the unit around it.
  "offer.cadence.page.value": ["every day", { slots: {}, fixedBy: "REQ-021 c2" }],
  "offer.cadence.measure.value": ["every week", { slots: {}, fixedBy: "REQ-021 c2" }],
  "offer.cadence.movement.value": ["every Monday", { slots: {}, fixedBy: "REQ-021 c2" }],
  "offer.veto.window.value": ["{hours} hours", { slots: { hours: "text" }, fixedBy: "REQ-021 c2" }],
}) satisfies CopyPartition;
