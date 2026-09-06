// tests/account/checkout/session.test.ts — issue #19
//
// `src/lib/account/checkout/session.ts` is a declared seam with no body:
// §13's Stripe half is issue #33. What is testable today is exactly the two
// promises the file makes — that it never answers, and that the scanless
// arm of `CheckoutOrigin` has no field a scan id could be fabricated into
// (§13: "scanless — no fabricated scan id").
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createCheckoutSession,
  CheckoutNotImplementedError,
  type CheckoutOrigin,
} from "@/lib/account/checkout/session";

const SOURCE = readFileSync(
  path.resolve(import.meta.dirname, "../../../src/lib/account/checkout/session.ts"),
  "utf8"
);

describe("the seam refuses rather than answers, until issue #33 lands", () => {
  it("createCheckoutSession rejects with CheckoutNotImplementedError, naming the issue that owes the body", async () => {
    await expect(
      createCheckoutSession({ origin: { kind: "pricing" }, returnTo: "https://reachkit.example/pricing" })
    ).rejects.toBeInstanceOf(CheckoutNotImplementedError);
    await expect(
      createCheckoutSession({ origin: { kind: "pricing" }, returnTo: "https://reachkit.example/pricing" })
    ).rejects.toThrow("issue #33");
  });

  it("no code path in the file returns a session: it holds no `return` and no URL", () => {
    // The `ok: true` arm exists — in the *type*, which is the interface #33
    // implements against. What must not exist is a `return` producing one.
    expect(SOURCE).not.toMatch(/^\s*return\b/m);
    expect(SOURCE).not.toMatch(/https:\/\/checkout/);
  });
});

describe('§13 — "Stripe Checkout from the report (scan id in metadata) or any price surface (scanless — no fabricated scan id)"', () => {
  it("the pricing arm carries no scanId — a type error, not a convention", () => {
    const scanless: CheckoutOrigin = { kind: "pricing" };
    // @ts-expect-error the `pricing` arm declares no `scanId` member, so a
    // scanless surface cannot fabricate one even by trying.
    const fabricated: CheckoutOrigin = { kind: "pricing", scanId: "made-up" };
    expect(scanless.kind).toBe("pricing");
    expect(fabricated.kind).toBe("pricing");
  });

  it("the report arm requires one", () => {
    const fromReport: CheckoutOrigin = { kind: "report", scanId: "scan-1" };
    expect(fromReport).toEqual({ kind: "report", scanId: "scan-1" });
  });
});
