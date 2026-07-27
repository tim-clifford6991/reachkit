/**
 * INVARIANT: a paid user's tracked app is never left on a non-deep scan.
 *
 * History: the deepen was once reachable ONLY from a checkout event, so any path
 * that stranded a paying user on free data stranded them FOREVER — nudgi.ai sat
 * tier='free', deepened_at=null on a paying growth account for 6 days.
 *
 * The deep scan is now DEFERRED to onboarding (2026-07-27, intake
 * `unified-onboarding`): it fires when the user picks their competitors, so it
 * runs on the CHOSEN cohort — not a guessed one at payment time. Two mechanisms
 * enforce the invariant, and BOTH are required:
 *   1. the ONBOARDING pick (app/api/competitors/select/route.ts) → ensureDeepScan —
 *      the primary trigger, on the user's approved cohort. Onboarding is BLOCKING,
 *      so a paid user reaches it.
 *   2. the weekly-refresh self-heal (below) — the backstop for a user who pays and
 *      abandons onboarding, and for any future drift (≤7 days). Its fan-out IS the
 *      active-paid set; ensureDeepScan is idempotent, so the healthy fleet costs nothing.
 *
 * (The old webhook `deepenOwnedScans` was removed — it deep-scanned at payment
 * against a guessed cohort, which the pick then superseded; wasteful + incoherent.)
 *
 * Source tripwire (same idiom as costed-routes.test.ts): the behavioural path needs
 * the integration harness, so this pins the call sites via `expectCallsSymbol`,
 * which blanks comments/strings, brace-matches the named function's OWN body, and
 * requires a real call — an import or a mention in prose cannot satisfy it.
 */
import { describe, it, expect } from "vitest";
import { expectCallsSymbol } from "@/lib/testing/tripwire";

const WEEKLY_REFRESH = "lib/inngest/functions/weekly-refresh.ts";
const SELECT_ROUTE = "app/api/competitors/select/route.ts";

describe("paid apps are never stranded on a non-deep scan (ratchet)", () => {
  it(`${SELECT_ROUTE}: the competitor pick (POST) calls ensureDeepScan(...) — the primary deepen trigger`, () => {
    expect(() => expectCallsSymbol(SELECT_ROUTE, "ensureDeepScan", { within: "POST" })).not.toThrow();
  });

  it(`${WEEKLY_REFRESH}: refreshOneApp's body calls ensureDeepScan(...) — the ≤7-day self-heal backstop`, () => {
    expect(() => expectCallsSymbol(WEEKLY_REFRESH, "ensureDeepScan", { within: "refreshOneApp" })).not.toThrow();
  });
});
