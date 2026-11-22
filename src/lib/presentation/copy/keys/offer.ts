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
// byte for byte, and no longer owner-owed. `offer.cancel_self_service` was
// not part of this ruling.
//
// 2026-09-10, issue #459: the owner approved the drafted copy for
// every key this partition still owed ("copy proposal approved"; proposal
// sheet artifact 546f45a0-a996-4d25-b85e-fb03fda7b102), and the 6 approved
// strings — `plan.single` and the four `*.value`
// lines — are applied here byte for byte.
import type { CopyPartition } from "../registry.ts";

export const OFFER_COPY = Object.freeze({
  "price.amount": "€49",
  "price.interval": "a month",
  "offer.cadence.page": "Up to {weekPages} pages a week, new or updated",
  "offer.cadence.movement": "A Monday email shows what went live and how your pages are doing.",
  "offer.veto.window": "Stop or edit any page before it goes live.",
  // Issue 1068, board R12-2: the price close's heading on the report.
  // Drafted; the owner corrects the wording.
  "offer.close.heading": "Gain Ground Every Week",
  // Board PubReport (issue 1724, drafted): the offer where the report found pages to write.
  "offer.found.heading": "We Write These Pages for You",
  "offer.found.line": "Written from facts on your own site. All on autopilot.",
  /** The **control's** own label, and the one the approved set draws on it:
   *  "Start ReachKit €49" (11a). The button carries the price because the
   *  set puts it there — the amount is REQ-022 c1's €49, written into the words rather
   *  than composed beside them, so the control cannot say one price while
   *  the card above it says another. */
  "offer.start.priced": "Start ReachKit €49",
  "offer.cadence.visits": "See the visits your new pages bring, every Monday.",

  // ── The same four terms, in S4's own words (issue #369) ──────────────
  //
  // The owner ruled the four `offer.cadence.*`/`offer.veto.*` lines above
  // on 2026-09-04, and the approved screen set draws **four different
  // sentences** for the same four facts on S4 — unbracketed, and so
  // approved copy as written (ruling 11a). Two wordings of one offer, one
  // per surface: the report's card keeps the ruling it was written for,
  // the pricing page states the set's.
  //
  // Split rather than overwritten: a
  // ruling is not re-opened by a later drawing, and neither sentence is
  // the other's draft. Nothing about *what is offered* differs — the four
  // facts are the same four, which is what keeps REQ-021 c4's "on the same
  // terms" true across the two screens.
  //
  // The veto line carries the pin through its slot exactly as the ruled one
  // does: `VETO.defaultHours` renders "24" and the sentence reads as the
  // set draws it, so the window is written down once, in
  // `src/lib/config/constants.ts`, and never twice.
  "offer.pricing.veto": "{hours} hours to stop any page before it goes live",

  // 2026-09-06, issue #34: the plan's own name, which §4.7's Billing card
  // states beside the price. One key, because there is one plan and no
  // upgrade, downgrade, annual billing, seat or add-on to name a second
  // (REQ-022 c3, REQ-076's non-goal). It sits in this partition rather than
  // in `settings.*` because it is the same public product fact the price
  // surfaces state, not a sentence about one customer's account —
  // REQ-097's own non-goal draws that line.
  "plan.single": "Up to {weekPages} pages a week",

  // 2026-09-13, issue #624: what the offer says when the vendor refuses to
  // open checkout. The approved set draws no refused state on S4.
  "offer.checkout.refused": "We couldn’t start checkout. Try again in a moment.",
  // The visitor's network is past the checkout limit, which is counted per clock hour.
  "offer.checkout.refused.limit": "Your network has started too many checkouts this hour. Checkout works again within the hour, or now on another connection, like mobile data.",

  // The first-50 offer: figures are slots ({of} OFFER_SPOTS, {minutes} SETUP_MINUTES, {price} price.amount); {endsOn} is the UTC day, so no zone prints 1 Feb.
  "offer.banner.pace": "Up to {weekPages} pages a week, {price} a month",
  "offer.banner.promise": "Set up in about {minutes} minutes, or we do it with you",
  "offer.spots.before": "Open to the first {of} customers until {endsOn}",
  "offer.spots.left": "{left} of {of} spots left until {endsOn}",
  "offer.spots.taken": "All {of} spots are taken. ReachKit is {price} a month, cancel any time.",
  "offer.spots.ended": "Our offer for the first {of} customers has ended. ReachKit is {price} a month, cancel any time.",
  "offer.banner.see": "See the Offer",
  "offer.banner.label": "Offer",
  "offer.card.title": "First {of} Customers",
  "offer.card.until": "Until {endsOn}",
  "offer.card.setup": "The founder sets you up personally, on a 15-minute call if you want one",
  "offer.card.video": "A short video of your report, explained by the founder",
  "offer.card.checkins": "We check in with you after two weeks and after a month",
  "offer.card.email": "Email the founder directly, any time",
  "offer.card.left": "{left} of {of} spots left",
  "offer.promise.call": "Set up in about {minutes} minutes, or we do it with you on a call",
  "offer.before.title": "Before You Pay",
  "offer.before.read": "Read your report and first page before you pay",
  "offer.before.export": "Download all your pages any time",
  // A spot holder's Settings › Billing rows and setup's help line; the line's help half is for every buyer.
  "offer.billing.spot": "One of our first {of} customers",
  "offer.billing.since": "Customer since",
  "offer.billing.checkin": "Next check-in",
  "offer.founder": "Email the Founder",
  "offer.setup.holder": "You’re one of our first {of} customers.",
  "offer.setup.help": "Stuck? We’ll do it with you on a call, at no cost.",
  "offer.setup.book": "Book 15 Minutes",
}) satisfies CopyPartition;
