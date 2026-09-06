// tests/account/billing/portal.test.ts — REQ-076 c2, c9; REQ-097 c1, c2, c6
//
// `PORTAL_FEATURES` field by field, because the requirement's promise to the
// customer is exactly that those capabilities are enabled — and the
// exclusivity assertion underneath it, which is the half a configuration
// object cannot make: that the product offers a field for none of the five
// anywhere else.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { PORTAL_FEATURES, portalLink, resetPortalConfiguration, setBillingStore } = await import(
  "@/lib/account/billing"
);
const { setStripe } = await import("@/lib/account/stripe/client");
const { env } = await import("@/lib/config/env");
const { memoryBillingStore, newMemoryBilling, account, storedUser } = await import("./memory-store");
const { newStripeDouble, stripeDouble } = await import("../stripe-double");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "../../../src");

/** Comments are where an invariant is explained; only code is read. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

/** The nth recorded item, or a failure that names the index. An optional
 *  index access would let an assertion be quietly made about nothing. */
function at<T>(items: readonly T[], index = 0): T {
  const item = items[index];
  if (item === undefined) throw new Error(`nothing recorded at [${index}]`);
  return item;
}

let state = newMemoryBilling();
let vendor = newStripeDouble();
const RETURN_TO = `${env.NEXT_PUBLIC_APP_URL}/app/settings`;

beforeEach(() => {
  state = newMemoryBilling();
  vendor = newStripeDouble();
  setBillingStore(memoryBillingStore(state));
  setStripe(stripeDouble(vendor));
  resetPortalConfiguration();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  setBillingStore(null);
  setStripe(null);
  resetPortalConfiguration();
  vi.restoreAllMocks();
});

describe("REQ-076 c2 — all four customer-owned changes are enabled on the portal", () => {
  it("payment_method_update is enabled — the card", () => {
    expect(PORTAL_FEATURES.payment_method_update).toEqual({ enabled: true });
  });

  it("allowed_updates is exactly address, tax_id and email", () => {
    // The billing address invoices go to (c2), and the VAT number (c9).
    expect(PORTAL_FEATURES.customer_update.enabled).toBe(true);
    expect([...PORTAL_FEATURES.customer_update.allowed_updates]).toEqual([
      "address",
      "tax_id",
      "email",
    ]);
  });

  it("invoice_history is enabled — the invoices", () => {
    expect(PORTAL_FEATURES.invoice_history).toEqual({ enabled: true });
  });

  it("cancelling is enabled, at period end", () => {
    // REQ-076 c3's "measurement, generation and publishing continue
    // unchanged until that date" is this mode, not a rule applied after.
    expect(PORTAL_FEATURES.subscription_cancel).toEqual({
      enabled: true,
      mode: "at_period_end",
    });
  });

  it("plan switching is disabled — there is one plan", () => {
    // REQ-022 c3 and REQ-076's non-goal: no upgrades, downgrades, annual
    // billing, seats or add-ons. Stated rather than omitted.
    expect(PORTAL_FEATURES.subscription_update).toEqual({ enabled: false });
  });

  it("the configuration is created from PORTAL_FEATURES, not left to the dashboard", async () => {
    state.users.push(account({ id: "u1" }));
    await portalLink("u1", RETURN_TO);
    expect(vendor.portalConfigurations).toHaveLength(1);
    const features = at(vendor.portalConfigurations).features as Record<string, unknown>;
    expect(features.invoice_history).toEqual({ enabled: true });
    expect(features.subscription_cancel).toEqual({ enabled: true, mode: "at_period_end" });
  });

  it("the configuration is made once, not once per press", async () => {
    state.users.push(account({ id: "u1" }));
    await portalLink("u1", RETURN_TO);
    await portalLink("u1", RETURN_TO);
    expect(vendor.portalConfigurations).toHaveLength(1);
    expect(vendor.portalSessions).toHaveLength(2);
  });
});

describe("REQ-097 c2 — the customer comes back to Settings", () => {
  it("a session is opened against the account's customer, returning to our own address", async () => {
    state.users.push(account({ id: "u1", stripe_customer_id: "cus_real" }));
    const result = await portalLink("u1", RETURN_TO);
    expect(result.ok).toBe(true);
    expect(at(vendor.portalSessions).customer).toBe("cus_real");
    expect(at(vendor.portalSessions).return_url).toBe(RETURN_TO);
  });

  it("a returnTo on another origin is refused, and no session is opened", async () => {
    state.users.push(account({ id: "u1" }));
    // Parsed, never prefix-matched: a lookalike host is the whole attack.
    for (const hostile of [
      "https://app.example.com.attacker.example/app/settings",
      "https://attacker.example/app/settings",
      "not a url",
    ]) {
      expect(await portalLink("u1", hostile), hostile).toEqual({
        ok: false,
        reason: "return_to_not_ours",
      });
    }
    expect(vendor.portalSessions).toHaveLength(0);
  });
});

describe("REQ-097 c6 — the surface cannot be produced", () => {
  it("an account with no Stripe customer is `no_customer`, not a vendor failure", async () => {
    // Two different things to say. Nothing about their plan changes either
    // way, and the screen says which.
    state.users.push(account({ id: "u1", stripe_customer_id: null }));
    expect(await portalLink("u1", RETURN_TO)).toEqual({ ok: false, reason: "no_customer" });
    expect(vendor.portalSessions).toHaveLength(0);
  });

  it("a vendor that refuses is `vendor`, and no vendor text reaches the caller", async () => {
    state.users.push(account({ id: "u1" }));
    vendor.portalError = new Error("stripe says: customer cus_x has no such thing");
    const result = await portalLink("u1", RETURN_TO);
    expect(result).toEqual({ ok: false, reason: "vendor" });
    expect(JSON.stringify(result)).not.toContain("stripe says");
  });

  it("a store that cannot be read reports vendor, and opens nothing", async () => {
    state.failAccountRead = true;
    expect(await portalLink("u1", RETURN_TO)).toEqual({ ok: false, reason: "vendor" });
    expect(vendor.portalSessions).toHaveLength(0);
  });

  it("nothing about the plan changes on any failure path", async () => {
    state.users.push(account({ id: "u1", cancelled_at: null, plan_status: "active" }));
    vendor.portalError = new Error("down");
    await portalLink("u1", RETURN_TO);
    expect(storedUser(state).cancelled_at).toBeNull();
    expect(storedUser(state).plan_status).toBe("active");
  });
});

describe("REQ-097 c1 — the portal is the only surface, and the product offers no field for any of the five", () => {
  it("no function under src/lib/account takes a card, billing address, VAT number or invoice parameter", () => {
    // The half `PORTAL_FEATURES` cannot assert. Checkout *records* the VAT
    // number the vendor's own form collected (REQ-022 c5/c6) and is named
    // here as the one file that may; a second one is a failure.
    const offenders: string[] = [];
    // A card, a billing address or an invoice, as an identifier a caller
    // could pass. Comments are stripped first: a file that *explains* the
    // rule must not fail the test that enforces it.
    const CARD_OR_ADDRESS =
      /\b(cardNumber|card_number|cvc|cvv|expMonth|exp_month|expYear|exp_year|invoiceAddress|invoice_address|billingAddress)\b/;
    const VAT = /\b(vatNumber|vat_number|taxId|tax_id)\b/;

    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) return walk(full);
        return e.isFile() && /\.tsx?$/.test(e.name) ? [full] : [];
      });

    for (const file of walk(path.join(SRC, "lib/account"))) {
      const source = code(fs.readFileSync(file, "utf8"));
      const relative = path.relative(SRC, file);
      if (CARD_OR_ADDRESS.test(source)) offenders.push(`${relative}: card or address field`);
      if (VAT.test(source)) offenders.push(`${relative}: VAT`);
    }

    // Four files name a VAT identifier, and not one of them is a field the
    // product renders. `record.ts` reads back what Stripe's own checkout
    // collected, `provision.ts` carries that value to the insert and
    // `store.ts` writes the column (REQ-022 c5, c6) — a record of what the
    // vendor's form captured, which is what §13's tax ruling requires exist.
    // `portal.ts` names `tax_id` inside `PORTAL_FEATURES`, which is the
    // capability being *delegated* to Stripe and the opposite of a field
    // here. A fifth is a failure.
    expect(offenders.sort()).toEqual([
      "lib/account/billing/portal.ts: VAT",
      "lib/account/checkout/record.ts: VAT",
      "lib/account/provisioning/provision.ts: VAT",
      "lib/account/store.ts: VAT",
    ]);
  });

  it("no ReachKit surface renders a control for any of the five besides the one destination", () => {
    // The Settings billing card is the only surface with a billing control,
    // and its own suite (`tests/app/settings/screen.test.tsx`) asserts that
    // its three affordances lead to one place. Here: nothing under
    // `src/app` mints a portal session of its own or names the vendor SDK.
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) return walk(full);
        return e.isFile() && /\.tsx?$/.test(e.name) ? [full] : [];
      });

    for (const file of walk(path.join(SRC, "app"))) {
      const source = fs.readFileSync(file, "utf8");
      expect(source, path.relative(SRC, file)).not.toContain("billingPortal");
      expect(source, path.relative(SRC, file)).not.toMatch(/from\s+"stripe"/);
    }
  });
});
