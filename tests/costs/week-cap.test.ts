// The week's one sum (SPEC §6 *Weekly cap*, CAPS.WEEK_C): the real cost seam, with only the network answered here.
import "../generate/env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CAPS, WEEK_AFTER_C } from "@/lib/config/constants";
import { DEFAULT_LOCALE } from "@/lib/locale/locales";
import type { Profile } from "@/lib/market/questions/profile-types";

const WEEK = "33333333-3333-4333-8333-333333333333";
const RERUN = "55555555-5555-4555-8555-555555555555";
const rows = new Map<string, { cost_cents: number; tier: string }>();
const calls = { vendor: [] as string[], rows: [] as Record<string, unknown>[], model: 0, claims: [] as string[] };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  // A stored week with one twice-reported release, already claimed by an earlier run.
  if (url.pathname.endsWith("/market_changes")) return json([{ site_id: "s", week_start: "2026-11-16", changes: [{ title: "Acme 5 ships", names: "Acme 5", words: ["acme", "5"], lastSeen: "2026-11-16", claims: ["a.com", "b.com"].map((host) => ({ url: `https://${host}/x`, publisher: host, publishedAt: "2026-11-18", quote: "Acme 5 ships today." })) }] }]);
  if (url.pathname.endsWith("/ops_events") && (init?.method ?? "GET") === "GET") return calls.claims.push(url.searchParams.get("kind") ?? ""), json([{ id: 1 }]);
  if (url.pathname.endsWith("/opportunities") && init?.method !== undefined && init.method !== "GET") calls.vendor.push(`write ${url.pathname}`);
  if (url.host === "api.dataforseo.com") {
    calls.vendor.push(url.pathname);
    return json({ status_code: 20000, tasks: [{ status_code: 20000, cost: 0.018, result: [{ items: [{ keyword: "plumber near me", keyword_info: { search_volume: 90 } }] }] }] });
  }
  if (url.host === "api.anthropic.com") {
    calls.model++;
    return json({ id: "m", type: "message", role: "assistant", model: "m", content: [{ type: "text", text: '{"claims":[]}' }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } });
  }
  if (url.pathname.endsWith("/scans") && (init?.method ?? "GET") === "GET") return json([{ ...rows.get((url.searchParams.get("id") ?? "").slice(3)), site_id: "44444444-4444-4444-8444-444444444444" }]);
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
  calls.model = 0;
  calls.claims.length = 0;
  rows.clear();
});

describe("a site's week spends from one sum", () => {
  it("the pass and its top-up share the week's sum and stop short of the steps after them, which still buy; a re-run's row reads its own", async () => {
    const { withStoredPassSpend } = await import("@/lib/scan/ceilings");
    const { TIER_PARAMETERS } = await import("@/lib/scan/pass/tier");
    const passLine = CAPS.WEEK_C - WEEK_AFTER_C;
    rows.set(WEEK, { cost_cents: passLine - 3, tier: "weekly" });
    rows.set(RERUN, { cost_cents: 0, tier: "weekly" });
    await withCostContext({ scanId: WEEK, cap: "WEEK", policyVersion: 1, rollUp: "add" }, async (pass) => {
      expect((await topUpSpend(WEEK, 1)(buy)).seeds).toEqual(["plumber"]);
      expect(pass.spentCents()).toBeCloseTo(passLine - 1.2, 6);
      expect((await topUpSpend(WEEK, 1)(buy)).degraded).toBe("topup_cap");
    });
    rows.set(WEEK, { cost_cents: passLine, tier: "weekly" });
    await withStoredPassSpend({ scanId: WEEK, cap: "WEEK", holdBackCents: TIER_PARAMETERS.weekly.afterC }, async (pass) => {
      expect(pass.capHit()).toBe(true);
      expect((await topUpSpend(WEEK, 1)(buy)).degraded).toBe("topup_cap");
    });
    expect(calls.rows.map((row) => row.activity)).toEqual(["topup"]);
    const titles = await withCostContext({ scanId: WEEK, cap: "WEEK", policyVersion: 1, rollUp: "none", activity: "weekly" }, (c) =>
      c.recordFetch({ source: "llm.topic-title", cacheKey: "titles", freshnessDays: 0, costCents: 3, run: async () => ({}) })
    );
    expect(titles).not.toEqual({ skipped: "cap" });
    expect((await topUpSpend(RERUN, 1)(buy)).seeds).toEqual(["plumber"]);
  });

  it("the Monday commit's research is refused once the week is spent and asks the vendor nothing, so its row stays queued", async () => {
    const { serpOrganic } = await import("@/lib/vendors/dataforseo/serp");
    const read = { query: "plumber near me", mode: "std", loadAsyncAiOverview: false, locale: DEFAULT_LOCALE, scope: { site: "s" }, freshnessDays: 30 } as const;
    const serp = await withCostContext({ scanId: WEEK, cap: "WEEK", policyVersion: 1, rollUp: "none", activity: "weekly", priorCents: CAPS.WEEK_C }, (c) => serpOrganic(c, read));
    expect(serp.kind).toBe("unmeasured");
    expect(calls.vendor).toEqual([]);
  });

  it("the week's market changes are refused once the week is spent: no news search is bought, and the pass goes on", async () => {
    const { buyMarketChanges } = await import("@/lib/scan/weekly/market-changes");
    const market = { category: "plumbing", from: "site", synonyms: ["plumber"], unsearched: [], concluded: [], market: null } as const;
    const changes = await withCostContext({ scanId: WEEK, cap: "WEEK", policyVersion: 1, rollUp: "none", activity: "weekly", priorCents: CAPS.WEEK_C }, (c) =>
      buyMarketChanges(c, { siteId: "s", locale: DEFAULT_LOCALE, terms: ["plumbing", "plumber"], notOurs: new Set(), market, today: new Date() })
    );
    expect(changes).toEqual({ changes: [], stories: [] });
    expect(calls.vendor).toEqual([]);
  });

  it("a hot page's angle is refused once the day's page cap is spent: no model is asked, so no page is placed", async () => {
    const { angleFor } = await import("@/lib/hot/angle");
    const event = { key: "news:k", signal: "news", event: "Acme 5", date: "2026-11-18", a: "a.com", b: "b.com", title: "Acme 5 ships", claims: [] } as const;
    const profile = { category: "crm", job: "track deals", audienceTerms: [] } as unknown as Profile;
    const angle = await withCostContext({ scanId: WEEK, cap: "DRAFT", policyVersion: 1, rollUp: "none", priorCents: CAPS.DRAFT_C }, (c) =>
      angleFor(c, { event: { ...event, claims: [] }, locale: DEFAULT_LOCALE, market: null, profile, domain: "example.com", knowledge: null })
    );
    expect(angle).toMatchObject({ miss: "unmeasured" });
    expect(calls.model).toBe(0);
  });

  it("a second run of Monday's judge finds the week's event claimed: it judges nothing and adds no topic", async () => {
    const { offerHotTopics } = await import("@/lib/hot/offer");
    expect(await offerHotTopics({ siteId: "s", scanId: WEEK, now: new Date("2026-11-20T08:00:00Z") })).toBe(0);
    expect(calls.claims).toEqual(["eq.hot_topic", "eq.hot_topic", "eq.market_changes_pass"]);
    expect(calls.model).toBe(0);
    expect(calls.vendor).toEqual([]);
  });
});
