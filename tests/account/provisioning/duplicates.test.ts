// tests/account/provisioning/duplicates.test.ts — BUILD §13, issue #33
//
// REQ-024 criterion 3, whole: "once that processing ends the address still
// has exactly one account, one site and one running subscription, no
// further sign-in email and no further deep pass result from it, and a
// founder whose second purchase was charged is told that it bought no
// second subscription in an `account` mail to the address that paid …
// naming one way to reach a person."
//
// Two branches, and they are not the same. A replay is a webhook doing its
// job; a second purchase is money that left somebody's bank. This suite is
// written so that collapsing the two fails.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { sendCalls, sendMock, sendOutcome } from "../send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

const { provisionFromPayment } = await import("@/lib/account/provisioning/provision");
const { registerSignInLinkIssuer } = await import("@/lib/account/provisioning/sign-in-link");
const { registerDeepPassQueue } = await import("@/lib/account/provisioning/deep-pass");
const { setStripe } = await import("@/lib/account/stripe/client");
const { setAccountStore } = await import("@/lib/account/store");
const { setLeadStore } = await import("@/lib/mail/leads/store");
const { memoryAccountStore, newMemoryAccounts } = await import("../memory-store");
const { memoryStore, newMemoryState } = await import("../../mail/leads/memory-store");
const { newStripeDouble, stripeDouble } = await import("../stripe-double");

let accounts = newMemoryAccounts();
let vendor = newStripeDouble();
let links = 0;
let deepPasses = 0;

function session(id: string, patch: Record<string, unknown> = {}) {
  return {
    id,
    status: "complete",
    customer: `cus_${id}`,
    subscription: `sub_${id}`,
    customer_details: {
      email: "founder@acme.example",
      address: { country: "IE" },
      tax_ids: [],
    },
    metadata: { originKind: "report", scanId: "scan-done" },
    ...patch,
  };
}

beforeEach(() => {
  links = 0;
  deepPasses = 0;
  accounts = newMemoryAccounts();
  accounts.scans.set("scan-done", { status: "done", domain: "acme.example" });
  setAccountStore(memoryAccountStore(accounts));
  setLeadStore(memoryStore(newMemoryState()));
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };

  vendor = newStripeDouble();
  vendor.sessions.set("cs_one", session("cs_one"));
  vendor.sessions.set("cs_two", session("cs_two"));
  setStripe(stripeDouble(vendor));

  registerSignInLinkIssuer(async () => {
    links += 1;
    return { issued: true, url: "https://reachkit.example/signin?t=tok", expiresAt: new Date() };
  });
  registerDeepPassQueue(async () => {
    deepPasses += 1;
  });
});

afterEach(() => {
  registerSignInLinkIssuer(null);
  registerDeepPassQueue(null);
  setLeadStore(null);
});

describe("replay — the same session delivered twice", () => {
  it("leaves one account, one site, one link and one deep pass", async () => {
    await provisionFromPayment("cs_one");
    const second = await provisionFromPayment("cs_one");
    expect(second).toMatchObject({ created: false, duplicate: "replay" });
    expect(accounts.users).toHaveLength(1);
    expect(accounts.sites).toHaveLength(1);
    expect(links).toBe(1);
    expect(deepPasses).toBe(1);
  });

  it("sends no mail on the second delivery — nothing was bought twice", async () => {
    await provisionFromPayment("cs_one");
    sendCalls.length = 0;
    await provisionFromPayment("cs_one");
    expect(sendCalls).toEqual([]);
  });

  it("cancels nothing — a replay has no second subscription to cancel", async () => {
    await provisionFromPayment("cs_one");
    await provisionFromPayment("cs_one");
    expect(vendor.cancelled).toEqual([]);
  });

  it("still reports the account and site that already exist, so a caller is not left guessing", async () => {
    const first = await provisionFromPayment("cs_one");
    const second = await provisionFromPayment("cs_one");
    expect(second.userId).toBe(first.userId);
    expect(second.siteId).toBe(first.siteId);
  });
});

describe("second purchase — a different session from an address that already has an account", () => {
  it("leaves exactly one running subscription: the second is cancelled", async () => {
    await provisionFromPayment("cs_one");
    const second = await provisionFromPayment("cs_two");
    expect(second).toMatchObject({ created: false, duplicate: "second_purchase" });
    // The mutation this catches: deleting the cancel call leaves the
    // customer billed twice every month from here on.
    expect(vendor.cancelled).toEqual(["sub_cs_two"]);
  });

  it("leaves exactly one account and one site", async () => {
    await provisionFromPayment("cs_one");
    await provisionFromPayment("cs_two");
    expect(accounts.users).toHaveLength(1);
    expect(accounts.sites).toHaveLength(1);
  });

  it("sends exactly one account mail and no sign-in link", async () => {
    await provisionFromPayment("cs_one");
    sendCalls.length = 0;
    const linksBefore = links;
    await provisionFromPayment("cs_two");
    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0]).toMatchObject({ kind: "account", to: "founder@acme.example" });
    expect(links).toBe(linksBefore);
  });

  it("queues no deep pass", async () => {
    await provisionFromPayment("cs_one");
    const before = deepPasses;
    await provisionFromPayment("cs_two");
    expect(deepPasses).toBe(before);
  });

  it("recognises the address whatever its case — the unique index is over lower(email)", async () => {
    await provisionFromPayment("cs_one");
    vendor.sessions.set(
      "cs_three",
      session("cs_three", {
        customer_details: { email: "FOUNDER@Acme.Example", address: { country: "IE" }, tax_ids: [] },
      })
    );
    const second = await provisionFromPayment("cs_three");
    expect(second).toMatchObject({ duplicate: "second_purchase" });
    expect(accounts.users).toHaveLength(1);
  });

  it("cancels before it tells them — a mail saying it bought nothing while a subscription renews is worse than silence", async () => {
    await provisionFromPayment("cs_one");
    const order: string[] = [];
    const inner = stripeDouble(vendor);
    setStripe({
      ...inner,
      subscriptions: {
        cancel: async (id: string) => {
          order.push("cancel");
          return inner.subscriptions.cancel(id);
        },
      },
    } as unknown as typeof inner);
    sendCalls.length = 0;
    const originalPush = sendCalls.push.bind(sendCalls);
    sendCalls.push = ((...items: never[]) => {
      order.push("mail");
      return originalPush(...items);
    }) as typeof sendCalls.push;
    await provisionFromPayment("cs_two");
    sendCalls.push = originalPush;
    expect(order).toEqual(["cancel", "mail"]);
  });

  it("a cancel the vendor refuses still tells them, and the mail still goes", async () => {
    await provisionFromPayment("cs_one");
    vendor.sessionRetrieveError = null;
    const inner = stripeDouble(vendor);
    setStripe({
      ...inner,
      subscriptions: {
        cancel: async () => {
          throw new Error("vendor is down");
        },
      },
    } as unknown as typeof inner);
    sendCalls.length = 0;
    await provisionFromPayment("cs_two");
    expect(sendCalls).toHaveLength(1);
  });
});
