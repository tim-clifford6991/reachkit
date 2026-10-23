// BUILD §4.2 — the feature's public entry points.
//
// One import for everything outside `src/lib/mail/leads/**`: the report's
// free-page card reads the offer, the capture route writes the lead, the
// nurture job advances the sequences, the giveaway job delivers the page,
// the opt-out page applies the token, and the Stripe webhook (§13) calls
// `suppressAddress(email, 'subscribed')` from the same transition that
// stamps `leads.converted_at`, so criterion 10 does not depend on the
// webhook remembering to.
//
// Importing this module wires the address-wide suppression store into
// §12's send seam. Nothing else here has a side effect.
import { wireSuppressionReader } from "./wire";

wireSuppressionReader();

export { firstPageOffer, readFirstPageOffer, type FirstPageOffer, type OfferRead } from "./offer";
export { captureLead, type CaptureResult } from "./capture";
export {
  deliverFirstPage,
  dueFirstPageDeliveries,
  nextAttemptAt,
  FIRST_PAGE_UNAVAILABLE_COPY,
  type DeliveryOutcome,
  type FirstPageFailure,
} from "./giveaway";
export { scheduleSequence, advanceSequences } from "./sequence";
export {
  suppressAddress,
  suppressionState,
  normaliseAddress,
  followUpsSentTo,
  type SuppressionAnswer,
} from "./suppress";
export { applyOptOutToken, optOutTokenFor, readOptOutToken } from "./optout";
export {
  registerDraftWriter,
  registerOfferReader,
  type DraftWriter,
  type OfferReader,
  type OfferedPage,
} from "./ports";
export { wireSuppressionReader, unwireSuppressionReader } from "./wire";
export type { FirstPageState, LeadRow, SequenceState, SuppressionCause } from "./store";
