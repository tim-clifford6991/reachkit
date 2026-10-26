// src/lib/account/billing/portal.ts — BUILD §13
//
// **The portal is the only surface for five things, and ReachKit offers a
// control to it and nothing else.**
//
// REQ-097 criterion 1: the card, the invoices, the billing address, the VAT
// number and cancelling are all done on Stripe's own billing surface, and
// "given a customer anywhere else in ReachKit, when they look for any of
// the five, then the only thing ReachKit offers for it is a control to that
// same one destination: ReachKit offers no separate control per item and
// presents no field, form, stepper, cancellation control, confirmation step
// or consequence screen for any of them."
//
// `PORTAL_FEATURES` is exported so a test can assert that against the
// object rather than against a screenshot of Stripe's dashboard, and the
// configuration is **created from it** rather than left to whoever last
// clicked in that dashboard. A capability the requirement promises the
// customer is a capability this repository declares.
//
// `subscription_update` is `false` because there is one plan (REQ-022 c3,
// REQ-076's non-goal: "no upgrades, downgrades, annual billing, seats or
// add-ons"). It is stated rather than omitted so that a reader meets the
// decision instead of an absence.
//
// **`returnTo` is parsed, never prefix-matched.** `checkReturnTo` is
// checkout's, and it is imported rather than re-written for the reason it
// records: a prefix match on our own address admits a lookalike host, and
// the consequence here is a customer sent to somebody else's page from a
// link that came out of their billing settings.
//
// Not `safeFetch()` and not the cost seam, for the reasons
// `src/lib/account/stripe/client.ts` records at the one place the vendor
// SDK is named: BP-006's guard is for URLs a customer or a dataset
// supplied, and the cost seam ledgers what a scan spends. A portal session
// is neither.
import { checkReturnTo } from "../checkout/return-to";
import { stripe } from "../stripe/client";
import { billingStore } from "./store";

/** The portal configuration, declared here and applied to the vendor.
 *  Every one of REQ-076 criterion 2's four customer-owned changes is
 *  enabled, and cancelling (REQ-097 c1's fifth) is `at_period_end` —
 *  REQ-076 criterion 3's "measurement, generation and publishing continue
 *  unchanged until that date" is that mode, not a rule applied afterwards. */
export const PORTAL_FEATURES = Object.freeze({
  payment_method_update: { enabled: true },
  customer_update: {
    enabled: true,
    allowed_updates: ["address", "tax_id", "email"],
  },
  invoice_history: { enabled: true },
  subscription_cancel: { enabled: true, mode: "at_period_end" },
  subscription_update: { enabled: false },
} as const);

export type PortalLinkResult =
  | { ok: true; url: string }
  | { ok: false; reason: "no_customer" | "return_to_not_ours" | "vendor" };

/** The portal configuration id, made once per process. Stripe's
 *  configurations are durable objects; creating one per request would leave
 *  a trail of identical configurations and add a round trip to every press
 *  of a billing control. */
let configurationId: string | null = null;

/** What every customer's portal shows (#1122). Declared here because this
 *  module owns the configuration; a dashboard edit would be overwritten. */
export const PORTAL_BUSINESS_PROFILE = Object.freeze({
  headline: "ReachKit — up to 7 pages a week for your site",
  privacy_policy_url: "https://reachkit.app/privacy",
  terms_of_service_url: "https://reachkit.app/terms",
} as const);

export const PORTAL_DEFAULT_RETURN_URL = "https://reachkit.app/app/settings/billing";

/** Marks the one configuration this repository owns, so a cold start finds
 *  and updates it instead of creating another. */
const PORTAL_METADATA_KEY = "reachkit_portal";

function portalParams() {
  return {
    business_profile: { ...PORTAL_BUSINESS_PROFILE },
    default_return_url: PORTAL_DEFAULT_RETURN_URL,
    // The vendor's parameter type wants a mutable array where
    // `PORTAL_FEATURES` declares a frozen tuple; the copy is made here.
    features: {
      ...PORTAL_FEATURES,
      customer_update: {
        ...PORTAL_FEATURES.customer_update,
        allowed_updates: [...PORTAL_FEATURES.customer_update.allowed_updates],
      },
    },
    metadata: { [PORTAL_METADATA_KEY]: "1" },
  };
}

async function portalConfiguration(): Promise<string> {
  if (configurationId !== null) return configurationId;
  const params = portalParams();
  // Reuse: find the active configuration this code created earlier and bring
  // it up to the declaration, rather than leaving a new one per cold start.
  const list = await stripe().billingPortal.configurations.list({ active: true, limit: 100 });
  const ours = list.data.find((c) => c.metadata?.[PORTAL_METADATA_KEY] === "1");
  const config = ours
    ? await stripe().billingPortal.configurations.update(ours.id, params)
    : await stripe().billingPortal.configurations.create(params);
  configurationId = config.id;
  return configurationId;
}

/** Discards the memoised configuration. The suites' door in, and the one
 *  thing a process needs to do after `setStripe()`. */
export function resetPortalConfiguration(): void {
  configurationId = null;
}

/** REQ-076 criterion 2 / REQ-097 criterion 1 — one portal session.
 *
 *  The customer comes back to `returnTo` still signed in: the session is a
 *  cookie this module never touches, so there is nothing here that could
 *  drop it.
 *
 *  `no_customer` is its own answer and not a vendor failure: an account
 *  with no Stripe customer has nothing to show on a billing surface, and
 *  the screen says so rather than reporting that Stripe is down. */
export async function portalLink(userId: string, returnTo: string): Promise<PortalLinkResult> {
  const checked = checkReturnTo(returnTo);
  if (!checked.ok) return { ok: false, reason: "return_to_not_ours" };

  const read = await billingStore().account(userId);
  if (!read.ok) return { ok: false, reason: "vendor" };
  const customerId = read.account?.stripe_customer_id ?? null;
  if (customerId === null) return { ok: false, reason: "no_customer" };

  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: checked.url.toString(),
      configuration: await portalConfiguration(),
    });
    return { ok: true, url: session.url };
  } catch {
    // No vendor string, no session URL, no customer id. REQ-097 c6's
    // answer to an unreachable billing surface is written on the screen the
    // customer was on, and nothing about their plan or account changes.
    console.warn(JSON.stringify({ event: "billing_portal", outcome: "vendor" }));
    return { ok: false, reason: "vendor" };
  }
}
