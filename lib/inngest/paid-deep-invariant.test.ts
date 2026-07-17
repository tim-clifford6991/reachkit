/**
 * INVARIANT: a paid user's tracked app is never left on a non-deep scan.
 *
 * The deepen used to be reachable ONLY from a checkout event
 * (lib/billing/provision.ts). That made every failure permanent: an existing
 * subscriber never sees another checkout, so any path that stranded a paying
 * user on free data stranded them FOREVER. It shipped — nudgi.ai sat
 * tier='free', deepened_at=null on a paying growth account for 6 days,
 * rendering free data under a paid dashboard, and nothing in the system would
 * ever have repaired it.
 *
 * Two mechanisms enforce the invariant, and BOTH are required:
 *   1. `deepenOwnedScans` (lib/billing/provision.ts) — at checkout, for users
 *      upgrading from now on. Behaviourally guarded in lib/billing/provision.test.ts.
 *   2. the weekly-refresh self-heal (below) — for the users the class ALREADY
 *      broke, and for any future drift. Its fan-out IS the active-paid set, so
 *      reaching refreshOneApp means the invariant applies; ensureDeepScan is
 *      idempotent, so the healthy fleet costs nothing.
 *
 * Source tripwire (same idiom as costed-routes.test.ts / add-product-policy.test.ts):
 * the behavioural path needs the integration harness + a live Inngest fan-out, so
 * this pins the call site. It goes through `expectCallsSymbol`, which blanks
 * comments/strings, brace-matches refreshOneApp's OWN body, and requires a real
 * call — an import or a mention in prose cannot satisfy it.
 */
import { describe, it, expect } from "vitest";
import { expectCallsSymbol } from "@/lib/testing/tripwire";

const WEEKLY_REFRESH = "lib/inngest/functions/weekly-refresh.ts";
const PROVISION = "lib/billing/provision.ts";

describe("paid apps are never stranded on a non-deep scan (ratchet)", () => {
  it(`${WEEKLY_REFRESH}: refreshOneApp's body calls ensureDeepScan(...) — the self-heal`, () => {
    expect(() => expectCallsSymbol(WEEKLY_REFRESH, "ensureDeepScan", { within: "refreshOneApp" })).not.toThrow();
  });

  it(`${PROVISION}: provisionCheckoutUser's body calls deepenOwnedScans(...) — the checkout half`, () => {
    expect(() =>
      expectCallsSymbol(PROVISION, "deepenOwnedScans", { within: "provisionCheckoutUser" }),
    ).not.toThrow();
  });
});
