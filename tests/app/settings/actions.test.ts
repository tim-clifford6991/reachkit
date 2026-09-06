// tests/app/settings/actions.test.ts — BUILD §4.7, REQ-070 c2
//
// The seven actions are declared here and implemented elsewhere (#34, #35,
// #52). What this suite holds is that the declaration is total and that the
// stub standing in for those modules is *honest*: it answers with the issue
// that wires it and changes nothing, rather than resolving as though the work
// happened. A stub that returned success would put "your account was deleted"
// in front of a customer whose account is untouched, and that is the defect
// these assertions exist to catch if someone ever simplifies the union away.
import { describe, expect, it } from "vitest";
import { ACTIONS, type ActionKey } from "@/app/(account)/app/settings/settable";
import { FIXTURE_ACTIONS, WIRED_BY } from "@/app/(account)/app/settings/actions";

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
    const billing: ActionKey[] = ["invoices", "cancel", "resume"];
    const owners = new Set(billing.map((key) => WIRED_BY[key]));
    expect(owners.size).toBe(1);
  });
});
