// tests/costs/cache-scope.test.ts — BUILD §6.4, issue #75
//
// What a vendor payload's cache key is *for*, and how long it stays fresh.
// §6.4 states both — "Cache is keyed source+key+policy-version" and "SERPs
// 30d (except the weekly target re-check)" — and neither was expressible by
// a caller until this issue.
//
// **Every number here is read from `constants.ts`, never written down.**
// The `Done when` line is explicit about it: "tests assert each window and
// key against its pin, not against a literal". A test carrying 30 or 7 of
// its own would keep passing on the day the pin moved and the product
// stopped matching it.
//
// The vendor transport is doubled at the cost seam, which is where these
// modules' own code stops — `tests/vendors/serp-ai.test.ts` owns what the
// endpoints parse.
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fakeCostContext, setEnvFixture, stubVendorFetch, envelope } from "../vendors/harness.ts";

let serp: typeof import("../../src/lib/vendors/dataforseo/serp.ts");
let ai: typeof import("../../src/lib/vendors/dataforseo/ai.ts");
let types: typeof import("../../src/lib/vendors/dataforseo/types.ts");
let pins: typeof import("../../src/lib/config/constants.ts");
let run: typeof import("../../src/lib/scan/run.ts");

beforeAll(async () => {
  setEnvFixture();
  serp = await import("../../src/lib/vendors/dataforseo/serp.ts");
  ai = await import("../../src/lib/vendors/dataforseo/ai.ts");
  types = await import("../../src/lib/vendors/dataforseo/types.ts");
  pins = await import("../../src/lib/config/constants.ts");
  run = await import("../../src/lib/scan/run.ts");
});

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  stubVendorFetch(() => envelope({ items: [{ type: "organic", rank_group: 1, domain: "acme.com", url: "u", title: "t" }] }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const QUERY = "best crm";
const A_SITE = { site: "site-1" } as const;
const ANOTHER_SITE = { site: "site-2" } as const;
const A_DOMAIN = { domain: "acme.com" } as const;

async function serpKey(scope: { site: string } | { domain: string }): Promise<string> {
  const { ctx, calls } = fakeCostContext();
  await serp.serpOrganic(ctx, {
    query: QUERY,
    mode: "live",
    loadAsyncAiOverview: false,
    scope,
    freshnessDays: pins.CACHE_WINDOWS_D.serp,
  });
  return calls[0]?.cacheKey ?? "";
}

// ── The key: one purchase per customer, not one per market ───────────────

describe("DATA-COSTS §5's roll-up is stated per customer, and the key now is too", () => {
  it("two sites in the same market do not share one SERP purchase", async () => {
    expect(await serpKey(A_SITE)).not.toBe(await serpKey(ANOTHER_SITE));
  });

  it("the same site asking the same question twice is one key — the cache still works", async () => {
    expect(await serpKey(A_SITE)).toBe(await serpKey(A_SITE));
  });

  it("a site and a domain are never the same key, whatever they are called", async () => {
    // The free path keys on the domain because a free scan has no account.
    // A site id that happened to read like a domain must still not collect
    // a free scan's purchases, which is what the two prefixes are for.
    expect(await serpKey({ site: "acme.com" })).not.toBe(await serpKey({ domain: "acme.com" }));
  });

  it("the scope is the last segment of the key, and the rest of it is unchanged", async () => {
    const key = await serpKey(A_SITE);
    expect(key.startsWith(`${QUERY}|${pins.SERP_LOCATION.location}|${pins.SERP_LOCATION.language}|`)).toBe(true);
    expect(key.endsWith("|site:site-1")).toBe(true);
  });

  it("`scopeKey` names which of the two it was — a bare id could not", () => {
    expect(types.scopeKey(A_SITE)).toBe("site:site-1");
    expect(types.scopeKey(A_DOMAIN)).toBe("domain:acme.com");
  });
});

describe("the AI battery's two engines carry the scope too", () => {
  it.each(["aiMode", "llmScraper"] as const)("%s keys on the site, so two customers buy their own", async (engine) => {
    const keys: string[] = [];
    for (const scope of [A_SITE, ANOTHER_SITE]) {
      const { ctx, calls } = fakeCostContext();
      stubVendorFetch(() => envelope({ items: [{ type: "ai_overview", markdown: "an answer", references: [] }] }));
      if (engine === "aiMode") await ai.aiMode(ctx, { query: QUERY, mode: "live", scope });
      else await ai.llmScraper(ctx, { query: QUERY, mode: "std", scope });
      keys.push(calls[0]?.cacheKey ?? "");
    }
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys[0]).toContain("site:site-1");
  });
});

// ── The windows: each read from the pin that names it ────────────────────

describe("BUILD §6.4's windows, each passed by the call site that owns it", () => {
  it("a SERP is asked for at whatever window the caller passes, and the caller's own pin is what it passes", async () => {
    for (const window of [pins.CACHE_WINDOWS_D.serp, pins.CACHE_WINDOWS_D.serpWeeklyRecheck]) {
      const { ctx, calls } = fakeCostContext();
      await serp.serpOrganic(ctx, {
        query: QUERY,
        mode: "live",
        loadAsyncAiOverview: false,
        scope: A_SITE,
        freshnessDays: window,
      });
      expect(calls[0]?.freshnessDays).toBe(window);
    }
  });

  it.each(["aiMode", "llmScraper"] as const)("%s asks at the window that names the battery, never the customer's own domain", async (engine) => {
    const { ctx, calls } = fakeCostContext();
    stubVendorFetch(() => envelope({ items: [{ type: "ai_overview", markdown: "an answer", references: [] }] }));
    if (engine === "aiMode") await ai.aiMode(ctx, { query: QUERY, mode: "live", scope: A_SITE });
    else await ai.llmScraper(ctx, { query: QUERY, mode: "std", scope: A_SITE });

    expect(calls[0]?.freshnessDays).toBe(pins.CACHE_WINDOWS_D.aiBattery);
    // The defect this closes: `own` means "the customer's own domain", so
    // it was the wrong citation even where the number was arguable. The
    // two pins differ, so this discriminates.
    expect(calls[0]?.freshnessDays).not.toBe(pins.CACHE_WINDOWS_D.own);
  });
});

// ── Which tier passes which window — §6.4's exception, given a caller ────

describe("the weekly target re-check is the exception, and it is the tier that says so", () => {
  it("the weekly pass asks at serpWeeklyRecheck, so it can get a fresh SERP", () => {
    // The defect: at the 30-day window, three weeks in four the re-check
    // would be served a cached SERP wearing this week's date, and REQ-065's
    // "measured once a week" would be met by a monthly measurement.
    expect(run.TIER_PARAMETERS.weekly.serpWindowDays).toBe(pins.CACHE_WINDOWS_D.serpWeeklyRecheck);
    expect(run.TIER_PARAMETERS.weekly.serpWindowDays).toBeLessThan(pins.CACHE_WINDOWS_D.serp);
  });

  it("the two passes a human waits for ask at the pinned 30 — the exception is one tier's, not a new default", () => {
    expect(run.TIER_PARAMETERS.free.serpWindowDays).toBe(pins.CACHE_WINDOWS_D.serp);
    expect(run.TIER_PARAMETERS.deep.serpWindowDays).toBe(pins.CACHE_WINDOWS_D.serp);
  });

  it("every tier states a window — a tier added later cannot inherit one by omission", () => {
    for (const [tier, parameters] of Object.entries(run.TIER_PARAMETERS)) {
      expect(typeof parameters.serpWindowDays, tier).toBe("number");
      expect(parameters.serpWindowDays, tier).toBeGreaterThan(0);
    }
  });
});
