// The top-up's own cap (SPEC §7 *Pages left*, CAPS.TOPUP_C): the real cost seam, with only the network answered here.
import "../generate/env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CAPS } from "@/lib/config/constants";
import { DEFAULT_LOCALE } from "@/lib/locale/locales";
import type { Profile } from "@/lib/market/questions/profile-types";

const SCAN = "33333333-3333-4333-8333-333333333333";
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
  calls.model = 0;
  calls.claims.length = 0;
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

  it("the Monday commit's research is refused at its own 2¢ and asks the vendor nothing, so its row stays queued", async () => {
    const { serpOrganic } = await import("@/lib/vendors/dataforseo/serp");
    const read = { query: "plumber near me", mode: "std", loadAsyncAiOverview: false, locale: DEFAULT_LOCALE, scope: { site: "s" }, freshnessDays: 30 } as const;
    const serp = await withCostContext({ scanId: SCAN, cap: "WEEK_RESEARCH", policyVersion: 1, rollUp: "none", activity: "weekly", priorCents: CAPS.WEEK_RESEARCH_C }, (c) => serpOrganic(c, read));
    expect(serp.kind).toBe("unmeasured");
    expect(calls.vendor).toEqual([]);
  });

  it("the week's market changes are refused at their own 6¢: no news search is bought, and the pass goes on", async () => {
    const { buyMarketChanges } = await import("@/lib/scan/weekly/market-changes");
    const market = { category: "plumbing", from: "site", synonyms: ["plumber"], unsearched: [], concluded: [], market: null } as const;
    const changes = await withCostContext({ scanId: SCAN, cap: "WEEK_NEWS", policyVersion: 1, rollUp: "none", activity: "weekly", priorCents: CAPS.WEEK_NEWS_C }, (c) =>
      buyMarketChanges(c, { siteId: "s", locale: DEFAULT_LOCALE, terms: ["plumbing", "plumber"], notOurs: new Set(), market, today: new Date() })
    );
    expect(changes).toEqual([]);
    expect(calls.vendor).toEqual([]);
  });

  it("after its three news searches and a judgement, the week's market changes still have room for one full claims call", async () => {
    const { readClaims } = await import("@/lib/generate/pipeline/claims-read");
    const { costCentsFor } = await import("@/lib/llm/tiers");
    const { INFERENCE_MAX_OUTPUT_TOKENS, RESEARCH } = await import("@/lib/config/constants");
    const spent = 3 * 0.2 + costCentsFor("haiku", 4_000, INFERENCE_MAX_OUTPUT_TOKENS["generate.news_fit"]);
    const text = "Boilers ".repeat(RESEARCH.readWords);
    const pages = Array.from({ length: RESEARCH.pagesPerCall - 1 }, (_, at) => ({ url: `https://news${at}.example/story`, title: "Boiler grant changes", text, readAt: "2026-11-20", kind: "recent" as const }));
    await withCostContext({ scanId: SCAN, cap: "WEEK_NEWS", policyVersion: 1, rollUp: "none", activity: "weekly", priorCents: spent }, (c) =>
      readClaims(c, pages, { locale: DEFAULT_LOCALE, search: "plumbing", rivals: [], today: new Date(), calls: 1 })
    );
    expect(calls.model).toBe(1);
  });

  it("a hot page's angle is refused once the day's page cap is spent: no model is asked, so no page is placed", async () => {
    const { angleFor } = await import("@/lib/hot/angle");
    const event = { key: "news:k", signal: "news", event: "Acme 5", date: "2026-11-18", a: "a.com", b: "b.com", title: "Acme 5 ships", claims: [] } as const;
    const profile = { category: "crm", job: "track deals", audienceTerms: [] } as unknown as Profile;
    const angle = await withCostContext({ scanId: SCAN, cap: "DRAFT", policyVersion: 1, rollUp: "none", priorCents: CAPS.DRAFT_C }, (c) =>
      angleFor(c, { event: { ...event, claims: [] }, locale: DEFAULT_LOCALE, market: null, profile, domain: "example.com", knowledge: null })
    );
    expect(angle).toBeNull();
    expect(calls.model).toBe(0);
  });

  it("a second run of Monday's judge finds the week's event claimed: it judges nothing and adds no topic", async () => {
    const { offerHotTopics } = await import("@/lib/hot/offer");
    expect(await offerHotTopics({ siteId: "s", scanId: SCAN, now: new Date("2026-11-20T08:00:00Z") })).toBe(0);
    expect(calls.claims).toEqual(["eq.hot_topic"]);
    expect(calls.model).toBe(0);
    expect(calls.vendor).toEqual([]);
  });
});
