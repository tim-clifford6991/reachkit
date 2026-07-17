/**
 * The cap error tells a capped user to "remove one in Settings". That exit must
 * actually exist and actually unlink — the whole reason WS6 shipped is that it
 * did NOT (the only path shrinking `users.app_ids` was account deletion).
 *
 * Source tripwire via `expectCallsSymbol` (never a hand-rolled substring match,
 * which would be satisfied by the import alone — the add-product-policy
 * false-negative that shipped). `within: "removeProduct"` brace-matches that one
 * action's body, so an import/comment cannot satisfy it and a definition
 * elsewhere is excluded.
 */
import { describe, it, expect } from "vitest";
import { expectCallsSymbol } from "@/lib/testing/tripwire";

describe("Settings' removeProduct is a REAL unlink (ratchet)", () => {
  it("removeProduct's body calls removeTrackedProduct(...)", () => {
    expect(() =>
      expectCallsSymbol("app/(app)/app/settings/actions.ts", "removeTrackedProduct", {
        within: "removeProduct",
      }),
    ).not.toThrow();
  });
});
