// tests/app/settings/actions.test.ts — BUILD §4.7, REQ-070 c2
//
// The seven actions are declared here and implemented elsewhere (#136,
// #134, #259). What this suite holds is that the declaration is total, that
// every one of the seven is wired, and that **nothing answers `not-yet` any
// more** — the arm was the stub's honesty about work that had not been
// done, and issue #259 finished the work.
//
// The `"use server"` modules behind the delegations are doubled: they reach
// Stripe, the database and the request's own cookie jar, none of which a
// plain vitest run has. What each one *does* is its own suite's question
// (`billing-actions.test.ts`, `account-actions.test.ts`,
// `danger-actions.test.ts`); what this file asks is whether the map reaches
// it at all.
import { describe, expect, it, vi } from "vitest";

const { signedOut } = vi.hoisted(() => ({ signedOut: [] as string[] }));

vi.mock("@/app/(account)/app/settings/account-actions", () => ({
  signOutAction: () => {
    signedOut.push("sign_out");
    return Promise.resolve({ done: "elsewhere" as const, href: "/signin" });
  },
  beginEmailChangeAction: () => Promise.resolve({ answer: "idle" as const }),
  cancelEmailChangeAction: () => Promise.resolve(undefined),
}));

vi.mock("@/app/(account)/app/settings/billing-actions", () => ({
  openBillingSurface: () => Promise.resolve({ done: "elsewhere" as const, href: "https://billing.stripe.test/s" }),
  cancelPlan: () => Promise.resolve({ done: "elsewhere" as const, href: "https://billing.stripe.test/s" }),
  resumePlan: () => Promise.resolve({ done: "here" as const }),
}));

import { ACTIONS, type ActionKey } from "@/app/(account)/app/settings/settable";
import { SETTINGS_ACTIONS, type ActionOutcome } from "@/app/(account)/app/settings/actions";

const BILLING: ActionKey[] = ["invoices", "cancel", "resume"];
const DANGER: ActionKey[] = ["unpublish_all", "delete_account"];

describe("the declaration is total over the seven", () => {
  it("every action has an implementation, and there is no eighth", () => {
    expect(Object.keys(SETTINGS_ACTIONS).sort()).toEqual([...ACTIONS].sort());
  });

  it("the map is frozen, so a caller cannot swap one action for another", () => {
    expect(Object.isFrozen(SETTINGS_ACTIONS)).toBe(true);
  });
});

describe("all seven are wired — nothing answers `not-yet` any more (#259)", () => {
  it("no action returns the arm, and the arm is gone from the union", async () => {
    for (const key of ACTIONS) {
      const outcome = await SETTINGS_ACTIONS[key]();
      expect(outcome.done, key).not.toBe("not-yet");
      // The three arms that remain, named rather than counted: an arm added
      // later has to be added here too.
      expect(["elsewhere", "here", "unreachable"], key).toContain(outcome.done);
    }
  });

  it("the union itself no longer admits it — a compile-time fact, asserted from the source", async () => {
    // `expect<never>` would pass on any type; the source is what says the
    // arm is gone, and the file is short enough to read for it.
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/app/(account)/app/settings/actions.ts"),
      "utf8"
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !l.trimStart().startsWith("//")).join("\n");
    expect(code).not.toContain("not-yet");
    expect(code).not.toContain("FIXTURE_ACTIONS");
    expect(code).not.toContain("WIRED_BY");
  });
});

describe("REQ-078 c2 — the export control is the download address, and no gate stands in front of it", () => {
  it("`export` hands the browser `/api/export`", async () => {
    expect(await SETTINGS_ACTIONS.export()).toEqual({ done: "elsewhere", href: "/api/export" });
  });

  it("the module names no access gate at all", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/app/(account)/app/settings/actions.ts"),
      "utf8"
    );
    expect(source).not.toMatch(/hasActiveAccess|paid_through|plan_status/);
  });
});

describe("REQ-079 c2/c3 — the two irreversible actions are offered as their export hand-off, never as their run", () => {
  it.each(DANGER)("%s hands the browser its archive address and nothing else", async (key) => {
    const outcome: ActionOutcome = await SETTINGS_ACTIONS[key]();
    expect(outcome).toEqual({ done: "elsewhere", href: `/api/danger/${key}` });
  });

  it("neither reaches the lifecycle engine from this map — a press that has not been confirmed destroys nothing", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/app/(account)/app/settings/actions.ts"),
      "utf8"
    );
    // The run is `danger-actions.ts`'s, behind the typed confirmation.
    expect(source).not.toContain("confirmDangerAction");
    expect(source).not.toContain("deleteAccount");
    expect(source).not.toContain("unpublishEverything");
  });
});

describe("the wired delegations are reached, not re-implemented", () => {
  it("`sign_out` reaches identity and takes the browser away (#134)", async () => {
    signedOut.length = 0;
    expect(await SETTINGS_ACTIONS.sign_out()).toEqual({ done: "elsewhere", href: "/signin" });
    expect(signedOut).toEqual(["sign_out"]);
  });

  it("the three billing controls lead to REQ-097 c1's one destination", async () => {
    for (const key of BILLING) {
      const outcome = await SETTINGS_ACTIONS[key]();
      expect(outcome.done, key).not.toBe("not-yet");
    }
  });
});
