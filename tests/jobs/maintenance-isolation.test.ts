// tests/jobs/maintenance-isolation.test.ts — issue #797
//
// The real `account/maintenance` tick, driven end to end: the job, the
// engine seam, the payment due-work queries, the backstop, provisioning's
// second-purchase branch and the setup reminders all run as shipped. What
// is stood in is only what a suite may not reach — Stripe (the double),
// the account and billing stores (in memory), the database (`fakeDb`), the
// mail seam, and the sign-in-link port's token half (Supabase Auth).
//
// Three promises:
//   · a check that degrades or throws does not starve the checks behind it;
//   · a second purchase is backstopped once, not every tick for a day;
//   · a founder who paid and did not finish setup is actually reminded.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";
import { fakeDb, type FakeDb } from "../scan/deep/fake-db";
import { sendCalls, sendMock, sendOutcome } from "../account/send-mock";

applyEnvFixture();

let db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/mail/send", () => sendMock());

// Two obligations read their own tables through modules this issue does not
// touch; they are stood in so one of them can be made to fail.
const dueStuckScans = vi.fn();
vi.mock("@/lib/scan/stuck", () => ({
  scansLeftRunning: () => dueStuckScans(),
  finishScanLeftRunning: async () => ({ finished: true }),
}));
// Issue #782's re-enqueue check reads `sites` and `scans` through its own
// module; stood in with nothing due.
vi.mock("@/lib/scan/deep/backstop", () => ({
  sitesWithoutDeepPass: async () => [],
  deepPassDomain: async () => null,
}));
const dueInactive = vi.fn();
const nudged = vi.fn();
vi.mock("@/lib/mail/retention", () => ({
  accountsDueInactivity: () => dueInactive(),
  draftsDueVetoReminder: async () => [],
  accountsDuePaymentFailed: async () => [],
  accountsDueCancellation: async () => [],
  accountsDueWinback: async () => [],
  sendInactivityNudge: async (id: string) => nudged(id),
  sendVetoReminder: async () => ({ sent: false, reason: "not-due" }),
  sendPaymentFailed: async () => ({ sent: false, reason: "not-due" }),
  sendCancellation: async () => ({ sent: false, reason: "not-due" }),
  sendWinback: async () => ({ sent: false, reason: "not-due" }),
}));

// Issue #791's hosted-health refresh reads `destinations`; stood in with
// nothing due, and driven in `hosted-health-tick.test.ts`.
vi.mock("@/lib/publish/destinations/health", () => ({
  hostedDestinationsDueHealth: async () => [],
  checkHealth: async () => ({ health: "ok", reason: null, checkedAt: new Date() }),
}));

// Issue #796's Monday market digest reads `scans`; stood in with no week due,
// and driven in `tests/scan/weekly/market-digest.test.ts`.
vi.mock("@/lib/scan/weekly/market-digest", () => ({
  marketDigestsDue: async () => [],
  sendMarketDigest: async () => true,
}));

const { accountMaintenance } = await import("../../src/jobs/account-maintenance");
const { registerSignInLinkIssuer } = await import("@/lib/account/provisioning/sign-in-link");
const { setStripe } = await import("@/lib/account/stripe/client");
const { setAccountStore } = await import("@/lib/account/store");
const { setBillingStore } = await import("@/lib/account/billing");
const { setLifecycleStore } = await import("@/lib/account/lifecycle");
const { memoryAccountStore, newMemoryAccounts } = await import("../account/memory-store");
const { memoryBillingStore, newMemoryBilling } = await import("../account/billing/memory-store");
const { memoryLifecycleStore, newMemoryLifecycle } = await import("../account/lifecycle/memory-store");
const { setLeadStore } = await import("@/lib/mail/leads/store");
const { memoryStore, newMemoryState } = await import("../mail/leads/memory-store");
const { registerDeepPassQueue } = await import("@/lib/account/provisioning/deep-pass");
const { newStripeDouble, stripeDouble, subscriptionDouble } = await import("../account/stripe-double");

const EMAIL = "founder@acme.example";
const NOW = new Date();
const HOUR = 3_600_000;

let accounts = newMemoryAccounts();
let vendor = newStripeDouble();

/** The double, told two things the live vendor does: a cancelled
 *  subscription reads back as `canceled`, and `expand: ["data.subscription"]`
 *  puts the subscription object on each listed session. */
function vendorThatRemembers() {
  const inner = stripeDouble(vendor);
  return {
    ...inner,
    subscriptions: {
      ...inner.subscriptions,
      cancel: async (id: string) => {
        const cancelled = await inner.subscriptions.cancel(id);
        vendor.subscriptions.set(id, { id, status: "canceled" });
        return cancelled;
      },
    },
    checkout: {
      sessions: {
        ...inner.checkout.sessions,
        list: async (params: { expand?: string[] }) => ({
          data: vendor.listed.map((session) =>
            params.expand?.includes("data.subscription") && typeof session.subscription === "string"
              ? { ...session, subscription: vendor.subscriptions.get(session.subscription) ?? session.subscription }
              : session
          ),
        }),
      },
    },
  } as unknown as typeof inner;
}

/** A founder with an open, signed-in account and a second, later payment
 *  from the same address that opened nothing. */
function secondPurchase() {
  accounts.users.push({
    id: "user-1",
    email: EMAIL,
    checkout_session_id: "cs_one",
    first_signed_in_at: new Date(NOW.getTime() - 40 * HOUR).toISOString(),
    sign_in_chased_at: null,
    stripe_customer_id: "cus_one",
    billing_country: "IE",
    vat_number: null,
    created_at: new Date(NOW.getTime() - 48 * HOUR).toISOString(),
  });
  const session = {
    id: "cs_two",
    status: "complete",
    customer: "cus_two",
    subscription: "sub_two",
    customer_details: { email: EMAIL, address: { country: "IE" }, tax_ids: [] },
    metadata: { originKind: "report", scanId: "scan-done" },
  };
  vendor.sessions.set("cs_two", session);
  vendor.subscriptions.set("sub_two", { id: "sub_two", status: "active" });
  vendor.listed = [session];
}

/** A founder who paid 25 hours ago and has not answered setup. */
function unfinishedSetup() {
  db = fakeDb({
    sites: [
      {
        id: "site-9",
        user_id: "user-9",
        created_at: new Date(NOW.getTime() - 25 * HOUR).toISOString(),
        setup_completed_at: null,
        setup_reminders_sent: 0,
      },
    ],
    users: [{ id: "user-9", email: "late@acme.example" }],
  });
}

const reminders = () => sendCalls.filter((m) => m.kind === "setup-reminder");
const accountMails = () => sendCalls.filter((m) => m.kind === "account");

beforeEach(() => {
  db = fakeDb({ sites: [], users: [] });
  accounts = newMemoryAccounts();
  accounts.scans.set("scan-done", { status: "done", domain: "acme.example" });
  setAccountStore(memoryAccountStore(accounts));
  setBillingStore(memoryBillingStore(newMemoryBilling()));
  setLifecycleStore(memoryLifecycleStore(newMemoryLifecycle()));
  setLeadStore(memoryStore(newMemoryState()));
  registerDeepPassQueue(async () => {});
  vendor = newStripeDouble();
  setStripe(vendorThatRemembers());
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };
  registerSignInLinkIssuer(async () => ({
    issued: true,
    url: "https://reachkit.example/auth/confirm?token_hash=t",
    expiresAt: new Date(),
  }));
  dueStuckScans.mockReset().mockResolvedValue([]);
  dueInactive.mockReset().mockResolvedValue([]);
  nudged.mockReset().mockResolvedValue({ sent: true });
});

afterEach(() => {
  registerSignInLinkIssuer(null);
  registerDeepPassQueue(null);
  setLeadStore(null);
  setStripe(null);
  setAccountStore(null);
});

describe("every check runs, whatever the one before it did", () => {
  it("a degraded backstop no longer holds the setup reminder or the retention mail behind it", async () => {
    secondPurchase();
    unfinishedSetup();
    dueInactive.mockResolvedValue(["user-5"]);

    const outcome = await accountMaintenance.run({ data: {}, now: NOW });

    // The backstop's subject is a second purchase, not an account it could
    // open, so the tick is degraded and says where…
    expect(outcome).toEqual({ outcome: "degraded", subjectId: null, step: "backstop:second_purchase" });
    // …and the obligations after it in the list still ran.
    expect(reminders()).toHaveLength(1);
    expect(nudged).toHaveBeenCalledWith("user-5");
  });

  it("a check that throws fails the run only after every other check has had its turn", async () => {
    unfinishedSetup();
    dueStuckScans.mockRejectedValue(new Error("scans is unreachable"));
    dueInactive.mockResolvedValue(["user-5"]);

    await expect(accountMaintenance.run({ data: {}, now: NOW })).rejects.toThrow(/unreachable/);
    // Before the throw: the setup reminder. After it: retention.
    expect(reminders()).toHaveLength(1);
    expect(nudged).toHaveBeenCalledWith("user-5");
  });

  it("two checks that throw are both reported", async () => {
    dueStuckScans.mockRejectedValue(new Error("scans is unreachable"));
    dueInactive.mockRejectedValue(new Error("users is unreachable"));

    const failure = await accountMaintenance.run({ data: {}, now: NOW }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors.map((e: Error) => e.message)).toEqual([
      "scans is unreachable",
      "users is unreachable",
    ]);
  });
});

describe("a second purchase is backstopped once", () => {
  it("the first tick cancels and tells the founder; the ticks after it leave the payment alone", async () => {
    secondPurchase();

    await accountMaintenance.run({ data: {}, now: NOW });
    expect(vendor.cancelled).toEqual(["sub_two"]);
    expect(accountMails()).toHaveLength(1);

    for (let tick = 0; tick < 3; tick++) {
      expect(await accountMaintenance.run({ data: {}, now: NOW })).toEqual({
        outcome: "skipped",
        subjectId: null,
        reason: "no-subject",
      });
    }
    expect(vendor.cancelled).toEqual(["sub_two"]);
    expect(accountMails()).toHaveLength(1);
    expect(accounts.users).toHaveLength(1);
  });

  it("a second purchase the webhook already settled is never backstopped at all", async () => {
    secondPurchase();
    vendor.subscriptions.set("sub_two", { id: "sub_two", status: "canceled" });

    await accountMaintenance.run({ data: {}, now: NOW });
    expect(vendor.cancelled).toEqual([]);
    expect(accountMails()).toEqual([]);
  });

  it("a first payment whose subscription was cancelled still gets its account — the stamp needs an existing holder", async () => {
    secondPurchase();
    accounts.users.length = 0;
    vendor.subscriptions.set(
      "sub_two",
      subscriptionDouble({ id: "sub_two", customer: "cus_two", periodEnd: NOW, status: "canceled" })
    );

    await accountMaintenance.run({ data: {}, now: NOW });
    expect(accounts.users).toHaveLength(1);
    expect(accounts.users[0]).toMatchObject({ checkout_session_id: "cs_two" });
  });
});

describe("a founder who paid and did not finish setup is reminded", () => {
  it("the tick sends the reminder with a sign-in link issued through the identity port", async () => {
    unfinishedSetup();

    expect(await accountMaintenance.run({ data: {}, now: NOW })).toEqual({ outcome: "ran", subjectId: null });

    const [mail] = reminders();
    expect(mail?.to).toBe("late@acme.example");
    expect(JSON.stringify(mail?.blocks)).toContain("https://reachkit.example/auth/confirm?token_hash=t");
    expect(db.tables.sites![0]!.setup_reminders_sent).toBe(1);
  });
});
