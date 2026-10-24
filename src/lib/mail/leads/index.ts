// BUILD §4.2 — the feature's one import for everything outside `src/lib/mail/leads/**`.
// The Stripe webhook calls `suppressAddress(email, 'subscribed')` in the transition that stamps `leads.converted_at`, so criterion 10 cannot be forgotten.
// Importing this module wires the address-wide suppression store into §12's send seam; nothing else here has a side effect.
import { wireSuppressionReader } from "./wire";

wireSuppressionReader();

export { type FirstPageOffer, type OfferRead } from "./offer";
export { captureLead, type CaptureResult } from "./capture";
export { deliverFirstPage, dueFirstPageDeliveries, type DeliveryOutcome, type FirstPageFailure } from "./giveaway";
export { suppressAddress, followUpsSentTo, type SuppressionAnswer } from "./suppress";
export { applyOptOutToken } from "./optout";
export { type DraftWriter, type OfferReader, type OfferedPage } from "./ports";
export type { FirstPageState, LeadRow, SequenceState, SuppressionCause } from "./store";
