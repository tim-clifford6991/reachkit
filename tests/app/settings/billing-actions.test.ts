// tests/app/settings/billing-actions.test.ts — BUILD §4.7, REQ-097 c1/c6,
// REQ-076 c6 (issue #136)
//
// The press. #34 built `portalLink()` and the Billing card's read; this
// suite is about what happens when a customer puts their finger on one of
// the three controls.
//
// **Mocked at the seam and nowhere else.** `@/lib/account/billing` is the
// module fence (`eslint.config.mjs`'s `no-billing-internal-import`), so a
// double placed there is a double placed exactly where this file's own code
// stops: everything below it — Stripe's SDK, the store, the portal
// configuration — is `tests/account/billing/portal.test.ts`'s, and asserting
// it again here would only assert the double.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { portalLink, billingSummary, resumeSubscription, currentSession } = vi.hoisted(() => ({
  portalLink: vi.fn(),
  billingSummary: vi.fn(),
  resumeSubscription: vi.fn(),
  currentSession: vi.fn(),
}));

vi.mock("@/lib/account/billing", () => ({ portalLink, billingSummary, resumeSubscription }));

// #134: which account is acting is the session's, not the #35 stand-in.
// Identity is doubled at the same seam and for the same reason billing is —
// what `currentSession()` verifies is `tests/account/identity/session.test.ts`'s.
vi.mock("@/lib/account/identity", () => ({ currentSession }));

const { openBillingSurface, cancelPlan, resumePlan } = await import(
  "@/app/(account)/app/settings/billing-actions"
);
const { SIGNIN_PATH } = await import("@/lib/account/identity/addresses");

/** The account the session names. Nothing about it is the fixture id the
 *  three actions used before #134 — a test that kept asserting that value
 *  would pass against a wiring that ignored the session entirely. */
const SIGNED_IN_USER = "user-from-the-session";

/** A `paidThrough` in the future / in the past, which is the only fact
 *  `resumePlan` branches on. */
const AHEAD = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const BEHIND = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

function summaryOf(paidThrough: Date): unknown {
  return {
    ok: true,
    summary: {
      state: "cancelled",
      planKey: "plan.single",
      priceKeys: [],
      paidThrough,
      cancelledAt: new Date(0),
      planStatus: "active",
      invoicesVia: "portal",
    },
  };
}

beforeEach(() => {
  // Re-implemented rather than reset: a `vi.fn` left with no implementation
  // returns `undefined`, and a test that then awaits it fails on a shape
  // rather than on the behaviour it is about.
  currentSession.mockImplementation(() =>
    Promise.resolve({ userId: SIGNED_IN_USER, siteId: "site-1" })
  );
  portalLink.mockImplementation(() => Promise.resolve({ ok: true, url: "https://billing.stripe.test/session/abc" }));
  billingSummary.mockImplementation(() => Promise.resolve(summaryOf(AHEAD)));
  resumeSubscription.mockImplementation(() => Promise.resolve({ ok: true, paidThrough: AHEAD }));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("REQ-097 c1 — the three controls reach the one destination, minted at the press", () => {
  it("`invoices` returns the session Stripe made, as somewhere else to go", async () => {
    await expect(openBillingSurface()).resolves.toEqual({
      done: "elsewhere",
      href: "https://billing.stripe.test/session/abc",
    });
  });

  it("`cancel` reaches the same destination — no ReachKit cancellation control stands in its place", async () => {
    await expect(cancelPlan()).resolves.toEqual({
      done: "elsewhere",
      href: "https://billing.stripe.test/session/abc",
    });
  });

  it("the session is minted at the press, not read off the model", async () => {
    expect(portalLink).not.toHaveBeenCalled();
    await openBillingSurface();
    expect(portalLink).toHaveBeenCalledTimes(1);
    await cancelPlan();
    expect(portalLink).toHaveBeenCalledTimes(2);
    // Two presses, two sessions. One address baked into the render would
    // have expired by the second.
    expect(portalLink.mock.calls[0]).toEqual(portalLink.mock.calls[1]);
  });

  it("the customer comes back to the screen they pressed on, at our own origin", async () => {
    await openBillingSurface();
    const [userId, returnTo] = portalLink.mock.calls[0] as [string, string];
    expect(userId).toBe(SIGNED_IN_USER);
    expect(new URL(returnTo).pathname).toBe("/app/settings");
    expect(new URL(returnTo).origin).toBe(new URL("https://reachkit.example").origin);
  });
});

describe("REQ-097 c6 — a session that cannot be produced", () => {
  it.each(["vendor", "no_customer", "return_to_not_ours"])(
    "`%s` is the same one arm — which refusal it was is an operator's fact",
    async (reason) => {
      portalLink.mockImplementation(() => Promise.resolve({ ok: false, reason }));
      await expect(openBillingSurface()).resolves.toEqual({ done: "unreachable" });
      await expect(cancelPlan()).resolves.toEqual({ done: "unreachable" });
    }
  );

  it("a module that cannot even be constructed is the same arm, not a crash", async () => {
    portalLink.mockImplementation(() => {
      throw new Error("no environment");
    });
    await expect(openBillingSurface()).resolves.toEqual({ done: "unreachable" });
  });

  it("nothing about the plan or the account changes — no write is attempted at all", async () => {
    portalLink.mockImplementation(() => Promise.resolve({ ok: false, reason: "vendor" }));
    await openBillingSurface();
    await cancelPlan();
    expect(resumeSubscription).not.toHaveBeenCalled();
  });

  it("the arm carries no vendor string, no session URL and no reason", async () => {
    portalLink.mockImplementation(() => Promise.resolve({ ok: false, reason: "vendor" }));
    const outcome = await openBillingSurface();
    expect(Object.keys(outcome)).toEqual(["done"]);
  });
});

describe("REQ-076 c6 — resume, before or after the paid-through date", () => {
  it("before the date it is the portal: the subscription is still there to un-cancel", async () => {
    billingSummary.mockImplementation(() => Promise.resolve(summaryOf(AHEAD)));
    await expect(resumePlan()).resolves.toEqual({
      done: "elsewhere",
      href: "https://billing.stripe.test/session/abc",
    });
    expect(resumeSubscription).not.toHaveBeenCalled();
  });

  it("after the date it calls `resumeSubscription()` — the portal has nothing to restart", async () => {
    billingSummary.mockImplementation(() => Promise.resolve(summaryOf(BEHIND)));
    await expect(resumePlan()).resolves.toEqual({ done: "here" });
    expect(resumeSubscription).toHaveBeenCalledWith(SIGNED_IN_USER);
    expect(portalLink).not.toHaveBeenCalled();
  });

  it("the date is read at the press, not taken from what the screen rendered", async () => {
    billingSummary.mockImplementation(() => Promise.resolve(summaryOf(BEHIND)));
    await resumePlan();
    expect(billingSummary).toHaveBeenCalledWith(SIGNED_IN_USER);
  });

  it("a resume that fails is criterion 6's written line, never a reported success", async () => {
    billingSummary.mockImplementation(() => Promise.resolve(summaryOf(BEHIND)));
    resumeSubscription.mockImplementation(() => Promise.resolve({ ok: false, reason: "vendor" }));
    await expect(resumePlan()).resolves.toEqual({ done: "unreachable" });
  });

  it("a summary that cannot be read resumes nothing — the wrong path is not guessed at", async () => {
    billingSummary.mockImplementation(() => Promise.resolve({ ok: false, reason: "store" }));
    await expect(resumePlan()).resolves.toEqual({ done: "unreachable" });
    expect(resumeSubscription).not.toHaveBeenCalled();
    expect(portalLink).not.toHaveBeenCalled();
  });
});

// ── #134 — the account is the session's, and a press without one refuses ──

describe("BUILD §4.3's gate, reached from an action", () => {
  it("every one of the three acts for the account the session names", async () => {
    await openBillingSurface();
    await cancelPlan();
    billingSummary.mockImplementation(() => Promise.resolve(summaryOf(BEHIND)));
    await resumePlan();

    for (const call of portalLink.mock.calls) expect(call[0]).toBe(SIGNED_IN_USER);
    expect(billingSummary).toHaveBeenCalledWith(SIGNED_IN_USER);
    expect(resumeSubscription).toHaveBeenCalledWith(SIGNED_IN_USER);
  });

  it("a press with no session sends the customer to the sign-in screen and mints nothing", async () => {
    currentSession.mockImplementation(() => Promise.resolve(null));

    for (const press of [openBillingSurface, cancelPlan, resumePlan]) {
      await expect(press(), press.name).resolves.toEqual({
        done: "elsewhere",
        href: SIGNIN_PATH,
      });
    }

    // Nothing was attempted for an account nobody could name: no portal
    // session, no read, no resume.
    expect(portalLink).not.toHaveBeenCalled();
    expect(billingSummary).not.toHaveBeenCalled();
    expect(resumeSubscription).not.toHaveBeenCalled();
  });

  it("a session that cannot be resolved at all is the same refusal, never a guess at an account", async () => {
    currentSession.mockImplementation(() => Promise.reject(new Error("no environment")));
    await expect(openBillingSurface()).resolves.toEqual({ done: "elsewhere", href: SIGNIN_PATH });
    expect(portalLink).not.toHaveBeenCalled();
  });

  it("the module names no stand-in account — the id it uses can only come from the session", () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/app/(account)/app/settings/billing-actions.ts"),
      "utf8"
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//"))
      .join("\n");
    expect(source).not.toContain("FIXTURE_USER_ID");
    expect(source).toContain("currentSession");
  });
});
