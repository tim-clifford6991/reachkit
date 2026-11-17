// The top-up's own cap (SPEC §7 *Pages left*, CAPS.TOPUP_C): the real cost seam, with only the network answered here.
import "../generate/env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CAPS } from "@/lib/config/constants";
import { DEFAULT_LOCALE } from "@/lib/locale/locales";

const SCAN = "33333333-3333-4333-8333-333333333333";
const calls = { vendor: [] as string[], rows: [] as Record<string, unknown>[] };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.host === "api.dataforseo.com") {
    calls.vendor.push(url.pathname);
    return json({ status_code: 20000, tasks: [{ status_code: 20000, cost: 0.018, result: [{ items: [{ keyword: "plumber near me", keyword_info: { search_volume: 90 } }] }] }] });
  }
  // The weekly pass's row already holds its whole cap.
  if (url.pathname.endsWith("/scans") && (init?.method ?? "GET") === "GET") return json([{ cost_cents: CAPS.WEEKLY_C, site_id: "44444444-4444-4444-8444-444444444444" }]);
  if (url.pathname.endsWith("/fetches") && init?.method === "POST") calls.rows.push(JSON.parse(String(init.body)) as Record<string, unknown>);
  if (url.pathname.includes("/rpc/")) return json(0);
  return json([]);
});

const { withCostContext } = await import("@/lib/costs");
const { buyTopUp, topUpSpend } = await import("@/lib/market/questions/top-up-buy");
const buy = (c: Parameters<typeof buyTopUp>[0]) =>
  buyTopUp(c, { seeds: ["plumber", "emergency plumber"], ownRanked: 0, locale: DEFAULT_LOCALE, enough: (b) => b.seeds.length >= 1, unpriced: () => [] });

beforeEach(() => {
  calls.vendor.length = 0;
  calls.rows.length = 0;
});

describe("the top-up's own cap", () => {
  it("buys a seed when the weekly cap is spent, ledgered as `topup`, and leaves the weekly room as it was", async () => {
    await withCostContext({ scanId: SCAN, cap: "WEEKLY", policyVersion: 1, rollUp: "add" }, async (weekly) => {
      expect(weekly.capHit()).toBe(true);
      const bought = await topUpSpend(SCAN, 1)(buy);
      expect(bought.seeds).toEqual(["plumber"]);
      expect(bought.degraded).toBeUndefined();
      expect(calls.vendor).toEqual(["/v3/dataforseo_labs/google/keyword_suggestions/live"]);
      expect(calls.rows.map((row) => row.activity)).toEqual(["topup"]);
      expect(weekly.spentCents()).toBe(CAPS.WEEKLY_C);
    });
  });

  it("with 1¢ of the top-up's room left, makes no suggestions call and says why", async () => {
    const bought = await withCostContext({ scanId: SCAN, cap: "TOPUP", policyVersion: 1, rollUp: "none", activity: "topup", priorCents: CAPS.TOPUP_C - 1 }, buy);
    expect(calls.vendor).toEqual([]);
    expect(bought.degraded).toBe("topup_cap");
    expect(bought.seeds).toEqual([]);
  });
});
