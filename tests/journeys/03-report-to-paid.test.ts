// tests/journeys/03-report-to-paid.test.ts — BUILD §3, §13
//
// Journey: Start ReachKit → Stripe Checkout → the webhook → an account, a
// site and a subscription → the magic-link mail → `/auth/confirm?token_hash=…` (#468) →
// `/setup` (JN-002 steps 1–2).
//
// End to end, at the seams and no further in. Everything the product owns
// is real: the offer card both price surfaces carry, `createCheckoutSession`
// and the one parameter set behind it, the webhook route, the signature
// boundary, `provisionFromPayment`, the subscription that opens the access
// gate, the lead conversion, `issueLink`, the magic-link template through
// the real compose shell and send seam, the redemption route, and the gate
// that decides where a redeemed founder lands. Three things outside the
// process are doubled, each at the last line of our own code:
//
//   · Stripe   → the SDK object `setStripe()` takes
//   · Resend   → `__setVendorTransportForTesting`
//   · Postgres → the four declared stores this path reaches
//
// Four of those need a word.
//
// **The webhook body is really signed.** The vendor double's own
// `constructEvent` takes a boolean; this journey replaces it with Stripe's
// documented scheme — `t=<unix>,v1=HMAC-SHA256(secret, "<t>.<body>")`,
// verified over the raw bytes — so the trust boundary REQ-024 c2 rests on
// is exercised rather than asserted. A body altered after signing is
// refused by arithmetic, not by a flag.
//
// **One `users` row, three readers.** `AccountStore`, `BillingStore` and
// `IdentityStore` are three narrow views of the same two tables. Here they
// are three doubles, so the account store is wrapped and its two inserts
// fan out to the other two — the join Postgres would have made. It is the
// only thing this file arranges that production would not, and
// `tests/account/columns.test.ts` is what keeps the three views honest
// about the real schema.
//
// **The copy registry is a fixture**, for the same reason as journey 02:
// every sentence §13 speaks is owner-owed and empty, and `copy()` refuses
// an owner-owed key — so against the real registry the magic-link mail
// would not compose and the founder could not be observed getting in. The
// debt is asserted where it belongs; here each key resolves to itself.
//
// **The deep pass is queued and not run.** REQ-024 c1 gives the sign-in
// link 60 seconds from the charge and a deep pass is minutes of vendor
// work, so this journey ends where §13 ends — at `/setup`, with the pass
// on the queue. Running it is journey 04's. That is also why this path
// writes no `fetches` row: nothing on it spends, and the one thing that
// will spend has not started.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { fakeDb } from "../scan/run/harness";
import {
  addAuthUser,
  FAKE_AUTH_COOKIE,
  fakeIdentityAuth,
  newFakeAuth,
  type FakeAuthState,
} from "../account/identity/fake-auth";
import { memoryAccountStore, newMemoryAccounts, type MemoryAccounts } from "../account/memory-store";
import {
  addAccount,
  memoryIdentityStore,
  newMemoryIdentity,
  type MemoryIdentity,
} from "../account/identity/memory-store";
import {
  account as billingAccount,
  memoryBillingStore,
  newMemoryBilling,
  site as billingSite,
  type MemoryBilling,
} from "../account/billing/memory-store";
import { newStripeDouble, stripeDouble, subscriptionDouble } from "../account/stripe-double";
import { blankLead, memoryStore, newMemoryState, type MemoryState } from "../mail/leads/memory-store";
import type { AccountStore } from "../../src/lib/account/store";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

// Every key resolves to itself, slots substituted — see the header.
vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  const written = new Proxy(
    {},
    { get: (_t, key: string) => (key in actual.COPY ? key : undefined) }
  ) as typeof actual.COPY;
  return {
    ...actual,
    COPY: written,
    copy: (key: string, vars?: Record<string, string | number>) =>
      vars === undefined ? key : `${key}(${Object.values(vars).join(",")})`,
  };
});

const { env } = await import("../../src/lib/config/env");
const { PricingCard } = await import(
  "../../src/app/(public)/scan/[domain]/_modules/pricing"
);
const { createCheckoutSession } = await import("../../src/lib/account/checkout/session");
const { checkoutParams } = await import("../../src/lib/account/checkout/params");
const { setStripe } = await import("../../src/lib/account/stripe/client");
const { setAccountStore } = await import("../../src/lib/account/store");
const { setBillingStore } = await import("../../src/lib/account/billing/store");
const { hasActiveAccess } = await import("../../src/lib/account/billing");
const { setIdentityStore } = await import("../../src/lib/account/identity/store");
const { setIdentityAuth } = await import("../../src/lib/account/identity/auth");
const { deadLinkPath } = await import("../../src/lib/account/identity/addresses");
const { unwireSignInLinkIssuer } = await import("../../src/lib/account/identity/wire");
const { registerDeepPassQueue } = await import(
  "../../src/lib/account/provisioning/deep-pass"
);
const { setLeadStore } = await import("../../src/lib/mail/leads/store");
const { __setVendorTransportForTesting } = await import("../../src/lib/mail/vendor/resend");
const { MAIL_KINDS } = await import("../../src/lib/mail/kinds");
const { SETUP_PATH, APP_PATH, setupRedirectFor } = await import(
  "../../src/app/(account)/setup/gate"
);
const { POST: webhookRoute } = await import("../../src/app/api/stripe/webhook/route");
const { GET: confirmRoute } = await import("../../src/app/(public)/auth/confirm/route");

const SCAN_ID = "scan-journey-03";
const DOMAIN = "acme.com";
const ADDRESS = "Anna@Acme.com";
const NORMALISED = "anna@acme.com";
const CUSTOMER_ID = "cus_journey_03";
const SUBSCRIPTION_ID = "sub_journey_03";
const PAID_THROUGH = new Date("2026-10-05T12:00:00.000Z");
/** Before the payment, `users.paid_through` is the column's own default and
 *  the gate is shut. The journey is about what opens it. */
const NEVER_PAID = new Date(0).toISOString();

let accounts: MemoryAccounts;
let identity: MemoryIdentity;
/** Supabase Auth, in memory (#468): the user, the one live token, the
 *  session `verifyOtp` writes. */
let auth: FakeAuthState;
let billing: MemoryBilling;
let leads: MemoryState;
let vendor: ReturnType<typeof newStripeDouble>;
let deepPasses: { siteId: string; domain: string }[];

interface SentMail {
  to: string[];
  subject: string;
  html: string;
  text: string;
}
const inbox: SentMail[] = [];

// ── One `users` row, three readers ──────────────────────────────────────

function joinedAccountStore(): AccountStore {
  const inner = memoryAccountStore(accounts);
  return {
    ...inner,
    async insertAccount(a) {
      const result = await inner.insertAccount(a);
      if (result.ok) {
        // #468: the real store creates the `auth.users` row first and
        // inserts `users` under its id; the memory store mints the id, so
        // the Supabase double is told about it here — one id, two tables.
        addAuthUser(auth, { id: result.id, email: a.email });
        addAccount(identity, { id: result.id, email: a.email });
        billing.users.push(
          billingAccount({ id: result.id, email: a.email, paid_through: NEVER_PAID })
        );
      }
      return result;
    },
    async insertSite(a) {
      const result = await inner.insertSite(a);
      if (result.ok) {
        // The site row the other two views carry, under the id the store
        // minted — so the session cookie, the access gate and the account
        // all name one site.
        identity.sites = identity.sites.map((s) =>
          s.user_id === a.userId ? { ...s, id: result.id } : s
        );
        billing.sites.push(billingSite({ id: result.id, user_id: a.userId }));
      }
      return result;
    },
  };
}

// ── Stripe, with a real signature over the body ─────────────────────────

/** Stripe's own scheme, as the SDK computes it. */
function signedHeader(body: string, at: Date, secret = env.STRIPE_WEBHOOK_SECRET): string {
  const t = Math.floor(at.getTime() / 1000);
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

/** The double, with its boolean `constructEvent` replaced by the real
 *  verification. Everything else is the shared double. */
function verifyingStripe(): ReturnType<typeof stripeDouble> {
  const base = stripeDouble(vendor) as unknown as Record<string, unknown>;
  return {
    ...base,
    webhooks: {
      constructEvent: (rawBody: Buffer | string, header: string, secret: string) => {
        const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
        const t = /(?:^|,)t=([^,]+)/.exec(header)?.[1];
        const v1 = /(?:^|,)v1=([^,]+)/.exec(header)?.[1];
        if (t === undefined || v1 === undefined) throw new Error("no signature");
        const expected = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
        if (v1 !== expected) throw new Error("signature mismatch");
        return JSON.parse(body) as unknown;
      },
    },
  } as unknown as ReturnType<typeof stripeDouble>;
}

/** What Stripe's own session looks like once the buyer has paid: the same
 *  session `createCheckoutSession` opened, now complete and carrying the
 *  facts the buyer entered. */
function theBuyerPays(sessionId: string): void {
  const opened = vendor.sessions.get(sessionId) as Record<string, unknown>;
  vendor.sessions.set(sessionId, {
    ...opened,
    status: "complete",
    customer: CUSTOMER_ID,
    subscription: SUBSCRIPTION_ID,
    customer_details: {
      email: ADDRESS,
      address: { country: "IE" },
      tax_ids: [{ type: "eu_vat", value: "IE1234567X" }],
    },
  });
  vendor.subscriptions.set(
    SUBSCRIPTION_ID,
    subscriptionDouble({ id: SUBSCRIPTION_ID, customer: CUSTOMER_ID, periodEnd: PAID_THROUGH })
  );
}

beforeEach(() => {
  db.reset();
  inbox.length = 0;
  deepPasses = [];

  accounts = newMemoryAccounts();
  accounts.scans.set(SCAN_ID, { status: "done", domain: DOMAIN });
  // The `leads` row §13 stamps `converted_at` on, as the account store
  // reads it. Its twin in the leads store below is the same row seen by
  // the feature that owns the sequence.
  accounts.leads.push({ email: NORMALISED, converted_at: null });
  identity = newMemoryIdentity();
  auth = newFakeAuth();
  billing = newMemoryBilling();

  // The founder already traded their address for the free page (journey
  // 02) and is three days into the follow-up. Buying is what stops it.
  leads = newMemoryState();
  leads.scans.set(SCAN_ID, DOMAIN);
  leads.leads.push(
    blankLead({
      id: "lead-1",
      email: NORMALISED,
      domain: DOMAIN,
      scan_id: SCAN_ID,
      sequence_state: "running",
      touch_count: 1,
      page_delivered_at: new Date("2026-09-02T12:00:00.000Z").toISOString(),
    })
  );

  setAccountStore(joinedAccountStore());
  setIdentityStore(memoryIdentityStore(identity));
  setIdentityAuth(fakeIdentityAuth(auth));
  setBillingStore(memoryBillingStore(billing));
  setLeadStore(memoryStore(leads));

  vendor = newStripeDouble();
  setStripe(verifyingStripe());

  registerDeepPassQueue(async (request) => void deepPasses.push({ ...request }));

  __setVendorTransportForTesting(async (payload: string) => {
    inbox.push(JSON.parse(payload) as SentMail);
    return { status: 200, headers: {}, body: JSON.stringify({ id: `resend-${inbox.length}` }) };
  });
});

afterEach(() => {
  setAccountStore(null);
  setIdentityStore(null);
  setIdentityAuth(null);
  setBillingStore(null);
  setLeadStore(null);
  setStripe(null);
  registerDeepPassQueue(null);
  unwireSignInLinkIssuer();
  __setVendorTransportForTesting(null);
});

// ── The journey, in the steps a founder takes ───────────────────────────

/** Step 1 — Start. Both price surfaces reach this one function; only the
 *  origin differs. */
async function startCheckout(origin: { kind: "report"; scanId: string } | { kind: "pricing" }) {
  return createCheckoutSession({
    origin,
    returnTo: new URL(origin.kind === "report" ? `/scan/${DOMAIN}` : "/pricing", env.NEXT_PUBLIC_APP_URL).toString(),
  });
}

/** Step 2 — Stripe tells us the payment completed. The body is signed as
 *  Stripe signs it and arrives at the route, which verifies nothing itself
 *  and hands the bytes on. */
async function stripeSaysItCompleted(
  sessionId: string,
  at = new Date(),
  tamper: ((body: string) => string) | null = null
): Promise<Response> {
  const body = JSON.stringify({
    id: "evt_journey_03",
    type: "checkout.session.completed",
    data: { object: { id: sessionId } },
  });
  const signature = signedHeader(body, at);
  return webhookRoute(
    new Request("https://app.example.com/api/stripe/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": signature },
      body: tamper === null ? body : tamper(body),
    }),
    // The adapter passes a route context through; this route reads none.
    undefined
  );
}

/** Everything up to an open account: Start, pay, and the webhook. */
async function untilTheAccountIsOpen(): Promise<{ sessionId: string }> {
  const started = await startCheckout({ kind: "report", scanId: SCAN_ID });
  if (!started.ok) throw new Error(`checkout refused: ${started.reason}`);
  theBuyerPays(started.sessionId);
  const answered = await stripeSaysItCompleted(started.sessionId);
  expect(answered.status).toBe(200);
  return { sessionId: started.sessionId };
}

/** The token hash the magic-link mail carries (#468): Supabase's own,
 *  on this deployment's `/auth/confirm`, never Supabase's `action_link`. */
function theMagicLink(): string {
  const mail = inbox.find((m) => m.subject === "mail.magicLink.subject");
  if (mail === undefined) throw new Error("no magic-link mail was sent");
  const found =
    /https:\/\/app\.example\.com\/auth\/confirm\?token_hash=([A-Za-z0-9_-]+)&(?:amp;)?type=magiclink/.exec(
      mail.html
    );
  if (found === null) throw new Error("the magic-link mail carried no link");
  return found[1] as string;
}

async function followTheLink(tokenHash: string): ReturnType<typeof confirmRoute> {
  return confirmRoute(
    new NextRequest(`https://app.example.com/auth/confirm?token_hash=${tokenHash}&type=magiclink`)
  );
}

describe("Start → Checkout → webhook → magic link → /setup (JN-002 steps 1–2)", () => {
  it("step 1 — one offer, one control, and nothing asked before payment", async () => {
    const html = renderToStaticMarkup(PricingCard() as never);

    // The price on REQ-022 c1's terms, the four rows, the one control and
    // the cancel line — the same component `/pricing` renders, which is
    // what makes the two surfaces state one set of terms.
    expect(html).toContain("price.amount");
    expect(html).toContain("price.interval");
    expect(html).toContain("offer.cadence.page");
    expect(html).toContain("offer.veto.window");
    expect(html).toContain("offer.start");
    expect(html).toContain("offer.cancel_self_service");

    // No account, no password, no questionnaire before the control
    // (REQ-020 c1) — and beginning checkout writes nothing at all.
    expect(html).not.toContain("password");
    await startCheckout({ kind: "report", scanId: SCAN_ID });
    expect(accounts.users).toEqual([]);
    expect(accounts.sites).toEqual([]);
    expect(auth.generated).toEqual([]);
    expect(inbox).toEqual([]);
  });

  it("step 1 — both surfaces open the same session, and only the report's carries a scan id", async () => {
    const fromReport = await startCheckout({ kind: "report", scanId: SCAN_ID });
    const scanless = await startCheckout({ kind: "pricing" });
    expect(fromReport.ok && scanless.ok).toBe(true);
    if (!fromReport.ok || !scanless.ok) throw new Error("unreachable");

    const [report, pricing] = vendor.created as Record<string, unknown>[];
    const params = checkoutParams();
    for (const created of [report, pricing]) {
      for (const key of Object.keys(params)) {
        expect(created?.[key], key).toEqual(params[key as keyof typeof params]);
      }
    }
    // The one difference between them, and no fabricated scan id.
    expect(report?.metadata).toEqual({ originKind: "report", scanId: SCAN_ID });
    expect(pricing?.metadata).toEqual({ originKind: "pricing" });

    // Both come back where the buyer was reading; the success address is
    // the same address with checkout=complete on it.
    expect(report?.cancel_url).toBe(`https://app.example.com/scan/${DOMAIN}`);
    expect(report?.success_url).toBe(`https://app.example.com/scan/${DOMAIN}?checkout=complete`);
    expect(pricing?.cancel_url).toBe("https://app.example.com/pricing");

    // A report that does not exist yet cannot be bought from, and the
    // refusal never reaches the buyer as vendor text.
    accounts.scans.set("scan-running", { status: "running", domain: DOMAIN });
    await expect(startCheckout({ kind: "report", scanId: "scan-running" })).resolves.toEqual({
      ok: false,
      reason: "origin_scan_incomplete",
    });
  });

  it("step 2 — the signature is the trust boundary: a body altered after signing opens nothing", async () => {
    const started = await startCheckout({ kind: "report", scanId: SCAN_ID });
    if (!started.ok) throw new Error("unreachable");
    theBuyerPays(started.sessionId);

    const tampered = await stripeSaysItCompleted(started.sessionId, new Date(), (body) =>
      body.replace(started.sessionId, "cs_somebody_elses")
    );
    expect(tampered.status).toBe(400);
    expect(accounts.users).toEqual([]);
    expect(accounts.sites).toEqual([]);
    expect(auth.generated).toEqual([]);
    expect(inbox).toEqual([]);
    expect(deepPasses).toEqual([]);

    // The same body, signed, is accepted — so the refusal above was the
    // arithmetic and not the fixture.
    expect((await stripeSaysItCompleted(started.sessionId)).status).toBe(200);
    expect(accounts.users).toHaveLength(1);
  });

  it("step 2 — one payment becomes one account, one site on the report's domain, and one open subscription", async () => {
    await untilTheAccountIsOpen();

    expect(accounts.users).toHaveLength(1);
    const user = accounts.users[0];
    expect(user?.email).toBe(ADDRESS);
    expect(user?.stripe_customer_id).toBe(CUSTOMER_ID);
    // Entered at checkout, recorded verbatim, and checked against no
    // registry (REQ-022 c7).
    expect(user?.billing_country).toBe("IE");
    expect(user?.vat_number).toBe("IE1234567X");

    // The site's domain is the report's, read from the scan the metadata
    // named — never anything derived from how the buyer paid.
    expect(accounts.sites).toHaveLength(1);
    const site = accounts.sites[0];
    expect(site?.domain).toBe(DOMAIN);
    expect(site?.provisioned_from_scan_id).toBe(SCAN_ID);

    // The gate: shut on the column's default, opened by the subscription's
    // own period end and by nothing else (ADR-050).
    expect(await hasActiveAccess(site?.id as string)).toBe(true);
    expect(billing.users[0]?.paid_through).toBe(PAID_THROUGH.toISOString());
    expect(billing.users[0]?.stripe_subscription_id).toBe(SUBSCRIPTION_ID);

    // The lead is converted and the follow-up is stopped, in the one
    // transition that does both (§4.2 c10, ADR-042).
    expect(accounts.leads[0]?.converted_at).not.toBeNull();
    expect(leads.suppressions.get(NORMALISED)).toBe("subscribed");
    expect(leads.leads[0]?.sequence_state).toBe("stopped");

    // The deep pass is queued against the site and its domain, and it has
    // not run: REQ-024 c1's minute belongs to the sign-in link.
    expect(deepPasses).toEqual([{ siteId: site?.id as string, domain: DOMAIN }]);
    expect(db.queries.filter((q) => q.table === "fetches")).toEqual([]);
  });

  it("step 2 — the magic-link mail carries a real link, and is a mail nobody can switch off", async () => {
    await untilTheAccountIsOpen();

    const mails = inbox.filter((m) => m.subject === "mail.magicLink.subject");
    expect(mails).toHaveLength(1);
    const mail = mails[0] as SentMail;
    expect(mail.to).toEqual([ADDRESS]);
    expect(mail.html).toContain("mail.magicLink.body");
    expect(mail.html).toContain("mail.magicLink.action");

    // The link points at this deployment's own sign-in route and at a
    // token that was written down as a hash and nowhere else.
    const token = theMagicLink();
    // One link, minted by Supabase for this account's own address and
    // user; the mail carries its hash, and no table of ours holds it.
    expect(auth.generated).toEqual([{ kind: "sign_in", email: NORMALISED }]);
    expect(auth.tokens).toHaveLength(1);
    expect(auth.tokens[0]?.hash).toBe(token);
    expect(auth.tokens[0]?.userId).toBe(accounts.users[0]?.id);

    // ADR-042's point, as a register row: the mail that is a customer's way
    // in can never be suppressed by the store that stops the follow-up.
    expect(MAIL_KINDS["magic-link"].stoppable).toBe(false);
  });

  it("step 2 — following the link signs them in, once, and lands them on /setup", async () => {
    await untilTheAccountIsOpen();
    const token = theMagicLink();

    const response = await followTheLink(token);
    expect(response.headers.get("location")).toBe(`https://app.example.com${SETUP_PATH}`);

    // The cookie rides on the redirect itself, so there is no version in
    // which the browser follows it and arrives signed out.
    // It is Supabase's session (#468), written by `verifyOtp`, for this
    // account's user.
    const cookie = response.cookies.get(FAKE_AUTH_COOKIE);
    expect(cookie).toBeDefined();
    const session = auth.sessions.find((s) => s.accessToken === cookie?.value);
    expect(session?.userId).toBe(accounts.users[0]?.id);

    // Single use: the second arrival is a dead link, and a dead link says
    // only that it is dead (REQ-098 c7).
    const second = await followTheLink(token);
    expect(second.headers.get("location")).toBe(`https://app.example.com${deadLinkPath()}`);
    expect(second.cookies.get(FAKE_AUTH_COOKIE)).toBeUndefined();
    // A token nobody ever issued lands in exactly the same place.
    const invented = await followTheLink("not-a-token-anyone-issued");
    expect(invented.headers.get("location")).toBe(`https://app.example.com${deadLinkPath()}`);

    // And the founder who has signed in once goes into the product next
    // time, not back to setup (REQ-024 c4/c5).
    expect(identity.users[0]?.first_signed_in_at).not.toBeNull();
  });

  it("step 2 — and where they land is the gate's decision, not the route's", async () => {
    await untilTheAccountIsOpen();
    const siteId = accounts.sites[0]?.id as string;
    const unfinished = { complete: false as const, siteId, paidAt: new Date() };

    // Setup unfinished: everything not on the way out goes to /setup, and
    // setup's own screens and endpoints are let through.
    expect(setupRedirectFor({ setup: unfinished, path: APP_PATH })).toBe(SETUP_PATH);
    expect(setupRedirectFor({ setup: unfinished, path: SETUP_PATH })).toBeNull();
    expect(setupRedirectFor({ setup: unfinished, path: "/api/setup" })).toBeNull();
    // Leaving never requires finishing setup (REQ-070 c2, REQ-076 c3).
    for (const way of ["/app/settings", "/api/export", "/api/stripe/portal"]) {
      expect(setupRedirectFor({ setup: unfinished, path: way }), way).toBeNull();
    }
    // Once it is finished they are never asked again.
    const finished = { complete: true as const, siteId, completedAt: new Date() };
    expect(setupRedirectFor({ setup: finished, path: SETUP_PATH })).toBe(APP_PATH);
  });

  it("a replayed delivery buys nothing twice: no second account, no second mail, no second pass", async () => {
    const { sessionId } = await untilTheAccountIsOpen();
    const mailsAfterFirst = inbox.length;

    const again = await stripeSaysItCompleted(sessionId, new Date(60_000));
    expect(again.status).toBe(200);

    expect(accounts.users).toHaveLength(1);
    expect(accounts.sites).toHaveLength(1);
    expect(auth.generated).toHaveLength(1);
    expect(inbox).toHaveLength(mailsAfterFirst);
    expect(deepPasses).toHaveLength(1);
    // Nothing was charged by anything on this path, either time.
    expect(vendor.chargesCreated).toBe(0);
  });
});
