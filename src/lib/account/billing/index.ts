// src/lib/account/billing/index.ts — BUILD §13
//
// **The module's whole public interface.** `eslint.config.mjs`'s
// `no-billing-internal-import` fence makes this file the only way in:
// nothing outside `src/lib/account/billing/**` may import a file under it,
// so every symbol another module is allowed to know about is named here and
// every symbol that is not named here is private by construction.
//
// The fence is ADR-050's lintable half — "nothing outside
// `src/lib/account/billing/**` may import `users.paid_through`'s reader or
// re-derive access from `plan_status`". Its behavioural half, that no other
// module computes an access predicate of its own, is
// `tests/account/billing/single-gate.test.ts`, which the fence does not
// replace: a fence catches an import, and "computes no predicate of their
// own" is not a lexical property. Deleting that test because the lint rule
// exists would leave a check that looks like it holds and does not.
//
// **`billingStore` and `setBillingStore` are exported.** The store is this
// module's internals, but the suites need a door and the fence closes every
// other one. Nothing in `src/` outside the tests imports either —
// `tests/account/billing/single-gate.test.ts` is what holds that true.
export { hasActiveAccess } from "./gate";
export { installActiveAccessGate } from "./access-gate";
export { hostedServingState, type HostedServingState } from "./hosted-serving";
export {
  billingSummary,
  type BillingSummary,
  type BillingSummaryResult,
  type PlanState,
} from "./summary";
export {
  PORTAL_FEATURES,
  portalLink,
  resetPortalConfiguration,
  type PortalLinkResult,
} from "./portal";
export { cancelSubscription, type CancelResult } from "./cancel";
export { endSubscriptionNow, type EndSubscriptionNow } from "./end-now";
export { resumeSubscription, type ResumeResult } from "./resume";
export {
  onSubscriptionEvent,
  openSubscription,
  type SubscriptionEventOutcome,
} from "./events";
export {
  hostingEndNoticesDue,
  hostedServingEndsAt,
  sitesDueHostingEndNotice,
  sitesDueHostingStop,
  type HostingNoticeDue,
} from "./hosting-end";
export { sendHostingEndNotice, type HostingNoticeOutcome } from "./hosting-notices";
export {
  billingStore,
  setBillingStore,
  supabaseBillingStore,
  type BillingStore,
  type BillingRow,
  type HostingRow,
  type HostingNotice,
  type SubscriptionFacts,
} from "./store";
