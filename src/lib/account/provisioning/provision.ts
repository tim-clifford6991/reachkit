// src/lib/account/provisioning/provision.ts — BUILD §13
//
// One verified completed payment becomes exactly one account, one site and
// one running subscription.
//
// §13, in order: "upsert user, create site (domain null if scanless — asked
// at setup), stamp lead converted, queue deep pass, send magic link →
// /setup." The order here is that order with one thing moved: the link is
// issued and the mail sent *before* the deep pass is queued, because
// REQ-024 criterion 1 gives the link 60 seconds from the charge and a deep
// pass is minutes of vendor work. The pass is queued and never awaited.
//
// **Two idempotency keys, and they mean different things.**
//   · `users.checkout_session_id` — this payment, seen before. A replay.
//     Nothing was bought twice, so nothing happens.
//   · `lower(users.email)` — this person, seen before. A second purchase.
//     Money left their bank, so the second subscription is cancelled and
//     they are told. `duplicates.ts` holds that branch.
// Both are database constraints, so a race between two deliveries is
// decided by the database rather than by whichever handler read first.
//
// **Nothing here fabricates a domain.** The site's domain is the one the
// report behind the purchase measured, read from the scan row that
// `resolveOrigin` already checked. A scanless purchase makes a site with a
// null domain (§13's own words) and queues no deep pass — there is nothing
// to run it against until setup asks for an address (REQ-021 c7), and the
// payer's email domain is never read as one.
//
// **`plan_status` is set at the insert; `paid_through` immediately after
// it.** ADR-050 makes `users.paid_through` the whole of the access gate,
// and issue #34 made provisioning its first writer, through
// `openSubscription` at step 2b. It is a second write and not a column on
// the insert on purpose: the value comes from the *subscription*, which is
// a second vendor object, and a retrieve that failed must still leave an
// account open rather than refusing a paid customer their account over a
// date a webhook will supply seconds later. The column's own default keeps
// the row legal in that window.
import { recordCheckoutFacts } from "../checkout/record";
import { accountStore } from "../store";
import { queueDeepPass } from "./deep-pass";
import { handleSecondPurchase } from "./duplicates";
import { convertLead } from "./lead-conversion";
import { sendSignInLink, type SignInMailOutcome } from "./sign-in-mail";

export interface ProvisionResult {
  readonly userId: string | null;
  readonly siteId: string | null;
  readonly created: boolean;
  readonly duplicate?: "replay" | "second_purchase";
  /** Why nothing was created, where nothing was. Never a vendor string. */
  readonly refused?: "session_not_complete" | "vendor" | "store";
  readonly signIn?: SignInMailOutcome;
}

export async function provisionFromPayment(sessionId: string): Promise<ProvisionResult> {
  // 1. The facts the session collected, recorded before anything is
  //    created. A session that did not complete stops here and opens
  //    nothing (REQ-024 c2).
  const recorded = await recordCheckoutFacts(sessionId);
  if (!recorded.ok) {
    const refused = recorded.reason === "session_incomplete_facts" ? "vendor" : recorded.reason;
    logProvision({ sessionId, outcome: refused });
    return { userId: null, siteId: null, created: false, refused };
  }
  const facts = recorded.facts;

  // 2. The account. The insert is the idempotency check: two deliveries
  //    racing each other both attempt it and the database decides.
  const store = accountStore();
  const inserted = await store.insertAccount({
    email: facts.email,
    checkoutSessionId: sessionId,
    facts: {
      stripe_customer_id: facts.stripeCustomerId,
      billing_country: facts.billingCountry,
      vat_number: facts.vatNumber,
    },
  });

  if (!inserted.ok && inserted.conflict === "checkout_session_id") {
    // This payment, again. Nothing was bought twice: no mail, no link, no
    // deep pass, no write.
    const existing = await store.accountByCheckoutSession(sessionId);
    const account = existing.ok ? existing.account : null;
    const site = account === null ? null : await store.siteForAccount(account.id);
    logProvision({ sessionId, outcome: "replay" });
    return {
      userId: account?.id ?? null,
      siteId: site?.ok === true ? site.siteId : null,
      created: false,
      duplicate: "replay",
    };
  }

  if (!inserted.ok && inserted.conflict === "email") {
    // This person, again, on a different payment. `duplicates.ts` cancels
    // the second subscription and tells them.
    await handleSecondPurchase({ sessionId, email: facts.email });
    const existing = await store.accountByEmail(facts.email);
    const account = existing.ok ? existing.account : null;
    const site = account === null ? null : await store.siteForAccount(account.id);
    logProvision({ sessionId, outcome: "second_purchase" });
    return {
      userId: account?.id ?? null,
      siteId: site?.ok === true ? site.siteId : null,
      created: false,
      duplicate: "second_purchase",
    };
  }

  if (!inserted.ok) {
    logProvision({ sessionId, outcome: "store" });
    return { userId: null, siteId: null, created: false, refused: "store" };
  }

  const userId = inserted.id;

  // 2b. The gate. `users.paid_through` is the whole of REQ-076 c8's access
  //     gate (ADR-050), and this is where it stops being the column's
  //     default and becomes the subscription's own period end. It is done
  //     here rather than left to `customer.subscription.created` because
  //     the two deliveries are not ordered: an account opened after that
  //     event had already been dropped for having no account would sit on
  //     the default until its first renewal.
  if (facts.subscriptionId !== null) {
    const { openSubscription } = await import("@/lib/account/billing");
    await openSubscription({ userId, subscriptionId: facts.subscriptionId });
  }

  // 3. The site. Its domain is the report's, or null where there was no
  //    report — never anything derived from how the buyer paid.
  const domain = await domainOfPurchase(facts.origin);
  const site = await store.insertSite({
    userId,
    domain,
    provisionedFromScanId: facts.origin.kind === "report" ? facts.origin.scanId : null,
  });
  const siteId = site.ok ? site.id : null;

  // 4. The lead converted, and the nurture sequence stopped.
  await convertLead(facts.email, new Date());

  // 5. The sign-in link, before the deep pass, inside REQ-024 c1's minute.
  const signIn = await sendSignInLink({ userId, email: facts.email });

  // 6. The deep pass, queued and never awaited. A scanless purchase has
  //    nothing to run one against yet.
  if (siteId !== null && domain !== null) {
    void queueDeepPass({ siteId, domain });
  }

  logProvision({ sessionId, outcome: "created" });
  return { userId, siteId, created: true, signIn };
}

/** The domain the purchase carries in. Reads the scan the checkout metadata
 *  named, and nothing else — no Stripe email, address or customer field is
 *  reachable from here (REQ-021 c7). */
async function domainOfPurchase(origin: { kind: "report"; scanId: string } | { kind: "pricing" }): Promise<string | null> {
  if (origin.kind === "pricing") return null;
  const read = await accountStore().scan(origin.scanId);
  return read.ok ? (read.scan?.domain ?? null) : null;
}

function logProvision(fields: { sessionId: string; outcome: string }): void {
  // The session id and the outcome. No address, no country, no VAT number,
  // no link.
  console.log(JSON.stringify({ event: "provision", ...fields }));
}
