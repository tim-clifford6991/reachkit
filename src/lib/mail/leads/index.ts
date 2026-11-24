// BUILD §4.2 — the feature's one import for everything outside `src/lib/mail/leads/**`.

export { type FirstPageOffer, type OfferRead } from "./offer";
export { captureLead, type CaptureResult } from "./capture";
export { deliverFirstPage, dueFirstPageDeliveries, type DeliveryOutcome, type FirstPageFailure } from "./giveaway";
export { type SuppressionAnswer } from "./suppress";
export { applyOptOutToken } from "./optout";
export { handleMailWebhook } from "./bounce";
export { type DraftWriter, type OfferReader, type OfferedPage } from "./ports";
export type { FirstPageState, LeadRow, SequenceState } from "./store";
