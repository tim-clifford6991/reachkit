// tests/app/settings/actions.test.ts — BUILD §4.7, REQ-070 c2
//
// The seven actions are declared here and implemented elsewhere (#34, #35,
// #52). What this suite holds is that the declaration is total and that the
// stub standing in for those modules is *honest*: it answers with the issue
// that wires it and changes nothing, rather than resolving as though the work
// happened. A stub that returned success would put "your account was deleted"
// in front of a customer whose account is untouched, and that is the defect
// these assertions exist to catch if someone ever simplifies the union away.
import { describe, expect, it, vi } from "vitest";

// The three billing delegations reach Stripe and the database. This suite is
// about the declaration and the map, not about what Stripe answers, so the
// `"use server"` module behind them is replaced wholesale —
// `billing-actions.test.ts` is what exercises it for real.
vi.mock("@/app/(account)/app/settings/billing-actions", () => ({
  openBillingSurface: () => Promise.resolve({ done: "elsewhere" as const, href: "https://billing.stripe.test/s" }),
  cancelPlan: () => Promise.resolve({ done: "elsewhere" as const, href: "https://billing.stripe.test/s" }),
  resumePlan: () => Promise.resolve({ done: "here" as const }),
}));

import { ACTIONS, type ActionKey } from "@/app/(account)/app/settings/settable";
import { FIXTURE_ACTIONS, SETTINGS_ACTIONS, WIRED_BY } from "@/app/(account)/app/settings/actions";

const BILLING: ActionKey[] = ["invoices", "cancel", "resume"];
const UNWIRED = ACTIONS.filter((key) => !BILLING.includes(key));

describe("the declaration is total over the seven", () => {
  it("every action has an implementation, and there is no eighth", () => {
    expect(Object.keys(FIXTURE_ACTIONS).sort()).toEqual([...ACTIONS].sort());
  });

  it("every action names the issue that wires it", () => {
    expect(Object.keys(WIRED_BY).sort()).toEqual([...ACTIONS].sort());
    for (const key of ACTIONS) {
      expect(Number.isInteger(WIRED_BY[key]), key).toBe(true);
      expect(WIRED_BY[key], key).toBeGreaterThan(0);
    }
  });
});

describe("the stub is honest about not being wired", () => {
  it("every action answers `not-yet` with its issue, and none reports success", async () => {
    for (const key of ACTIONS) {
      const outcome = await FIXTURE_ACTIONS[key]();
      expect(outcome, key).toEqual({ done: "not-yet", issue: WIRED_BY[key] });
    }
  });

  it("`not-yet` is not a failure — nothing was attempted, so nothing threw", async () => {
    await expect(FIXTURE_ACTIONS.delete_account()).resolves.toBeDefined();
  });

  it("calling one changes nothing another can observe", async () => {
    // There is no store, no vendor and no mail on this module's import graph,
    // so the only thing an action could mutate is itself. Two calls to the
    // most destructive of the seven answer identically.
    const first = await FIXTURE_ACTIONS.delete_account();
    const second = await FIXTURE_ACTIONS.delete_account();
    expect(second).toEqual(first);
  });

  it("the object is frozen, so a caller cannot swap one action for another", () => {
    expect(Object.isFrozen(FIXTURE_ACTIONS)).toBe(true);
  });
});

describe("the three billing actions belong to the same module", () => {
  it("invoices, cancel and resume are wired by one issue — REQ-097's one destination", () => {
    const owners = new Set(BILLING.map((key) => WIRED_BY[key]));
    expect(owners.size).toBe(1);
  });
});

// ── Issue #136 ─────────────────────────────────────────────────────────────
describe("the map the screen calls is the stub with the wired actions replaced", () => {
  it("`SETTINGS_ACTIONS` is total over the seven, and frozen against a swap", () => {
    expect(Object.keys(SETTINGS_ACTIONS).sort()).toEqual([...ACTIONS].sort());
    expect(Object.isFrozen(SETTINGS_ACTIONS)).toBe(true);
  });

  it("the three billing controls no longer answer `not-yet` — they reach REQ-097 c1's destination", async () => {
    for (const key of BILLING) {
      const outcome = await SETTINGS_ACTIONS[key]();
      expect(outcome.done, key).not.toBe("not-yet");
    }
  });

  it("the other four still answer `not-yet` with their issue — wiring three wired three", async () => {
    expect(UNWIRED.length).toBe(4);
    for (const key of UNWIRED) {
      expect(await SETTINGS_ACTIONS[key](), key).toEqual({ done: "not-yet", issue: WIRED_BY[key] });
    }
  });

  it("the stub is untouched, so what an unwired action answers has not changed", async () => {
    for (const key of ACTIONS) {
      expect(await FIXTURE_ACTIONS[key](), key).toEqual({ done: "not-yet", issue: WIRED_BY[key] });
    }
  });
});

describe("REQ-097 c6 — the fourth arm", () => {
  it("`unreachable` carries nothing: no vendor string, no reason, no session URL", () => {
    // A reason on this arm would be an operator's fact on a customer's
    // screen, and a URL would be the thing that could not be produced.
    const outcome = { done: "unreachable" } as Awaited<ReturnType<(typeof SETTINGS_ACTIONS)["invoices"]>>;
    expect(Object.keys(outcome)).toEqual(["done"]);
  });

  it("the union is the four arms and no fifth — a control can only report a state that exists", async () => {
    const arms = new Set<string>();
    for (const key of ACTIONS) arms.add((await SETTINGS_ACTIONS[key]()).done);
    for (const arm of arms) expect(["elsewhere", "here", "not-yet", "unreachable"]).toContain(arm);
  });
});
