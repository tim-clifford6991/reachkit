// tests/measure/domain/measure-domain.test.ts — BUILD §5
//
// `measureDomain`'s orchestration, its mapping of every outcome onto the
// trichotomy, its tier-parameter contract and its determinism. Every seam
// the module crosses — egress, the robots reader, the vendor client — is
// doubled through the `MeasurePorts` record, and the cost seam is doubled
// as a `CostContext`; nothing here reaches a network, a database or a
// vendor (`tests/setup.ts` would refuse it anyway).
// The module under test imports the vendor client for its default
// `rankedKeywords` port, and `src/lib/config/env.ts` validates every
// binding at module load — so a valid-shaped fixture has to be in place
// *before* the static imports below run, which is what `vi.hoisted` is
// for (same use as `tests/market/questions/profile.test.ts`). It buys
// nothing else: every port this suite exercises is doubled, `fetch` is
// refused by `tests/setup.ts`, and no credential here is real.
vi.hoisted(() => {
  const ENV_FIXTURE: Record<string, string> = {
    DATABASE_URL: "postgresql://reachkit:reachkit@127.0.0.1:5432/reachkit_scratch",
    SUPABASE_URL: "http://127.0.0.1:3001",
    SUPABASE_ANON_KEY: "anon-key-fixture",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key-fixture",
    STRIPE_SECRET_KEY: "sk_test_fixture",
    STRIPE_WEBHOOK_SECRET: "whsec_fixture",
    STRIPE_PRICE_ID: "price_fixture",
    RESEND_API_KEY: "re_fixture",
    DATAFORSEO_LOGIN: "dfs-login-fixture-do-not-leak",
    DATAFORSEO_PASSWORD: "dfs-password-fixture-do-not-leak",
    ANTHROPIC_API_KEY: "sk-ant-fixture",
    NANO_API_KEY: "nano-fixture",
    IP_HASH_SALT: "salt-fixture",
    KILL_SWITCH: "false",
    OWNER_EMAILS: "owner@example.com",
    NEXT_PUBLIC_APP_URL: "https://app.example.com",
    HOSTED_EDGE_CNAME_TARGET: "content.example.com",
  };
  for (const [key, value] of Object.entries(ENV_FIXTURE)) process.env[key] = value;
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BATTERY, PRICE_BOOK } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import type { FetchOutcome, RobotsPolicy } from "@/lib/egress/types";
import type { RankedRow } from "@/lib/vendors/dataforseo/types";
import {
  detectPricingUrl,
  measureDomain,
  type DomainMeasurement,
  type MeasurePorts,
  type Tier,
} from "../../../src/lib/measure/index.ts";
import { measured, type Measured } from "../../../src/lib/measure/measured.ts";
import { OWN_FETCH_SOURCE } from "../../../src/lib/measure/own-fetch.ts";

const DOMAIN = "reachkit.app";
const HOME = "https://reachkit.app/";
const READ_AT = new Date("2026-09-05T09:30:00.000Z");

const SOURCE_PATH = path.resolve(import.meta.dirname, "../../../src/lib/measure/index.ts");
const SOURCE = readFileSync(SOURCE_PATH, "utf8");
// Comment-stripped: the header explains in prose that this module reads no
// clock and branches on nothing but two lookup tables — only the code must
// be free of those tokens.
const CODE_ONLY = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const RICH_HTML = `
  <html><head>
    <meta property="og:title" content="ReachKit">
    <script type="application/ld+json">{"@type":"Organization"}</script>
  </head><body>
    <a href="/pricing">Pricing</a>
    <h2>How does ReachKit measure a site?</h2>
    <p>${"It reads the page and counts what is there. ".repeat(4)}</p>
    <p>Since 2026-01-02 we have run 4 checks, cited by <a href="https://other.example/x">others</a>.</p>
  </body></html>
`;
const PRICING_HTML = `<html><body><h2>What does it cost?</h2><p>${"Twelve pounds a month. ".repeat(3)}</p></body></html>`;

function okOutcome(url: string, html: string, readAt: Date = READ_AT): FetchOutcome {
  return { ok: true, status: 200, url, html, bytes: html.length, readAt, headers: {} };
}

function failOutcome(url: string, reason: Extract<FetchOutcome, { ok: false }>["reason"]): FetchOutcome {
  return { ok: false, reason, url, readAt: READ_AT };
}

function policy(over: Partial<RobotsPolicy> = {}): RobotsPolicy {
  return {
    ok: true,
    origin: "https://reachkit.app",
    readAt: READ_AT,
    disallowsAll: false,
    disallowedAgents: {},
    sitemaps: [],
    absent: false,
    ...over,
  };
}

interface LedgeredCall {
  source: string;
  cacheKey: string;
  costCents: number;
  payload: unknown;
}

/** A `CostContext` double that records every call, runs each `run()` once
 *  and never touches a database. `capped` makes `capHit()` true without
 *  changing anything else, which is how the ceiling case is exercised. */
function fakeCost(opts: { capped?: boolean } = {}): CostContext & { calls: LedgeredCall[] } {
  const calls: LedgeredCall[] = [];
  const context = {
    calls,
    async recordFetch<P>(call: {
      source: string;
      cacheKey: string;
      freshnessDays: number;
      costCents: number;
      settleCents?: (payload: P) => number;
      run: () => Promise<P>;
    }) {
      const payload = await call.run();
      calls.push({ source: call.source, cacheKey: call.cacheKey, costCents: call.costCents, payload });
      return { payload, fresh: true, costCents: call.costCents };
    },
    capHit: () => opts.capped === true,
    spentCents: () => 0,
    degraded: () => false,
  };
  return context as CostContext & { calls: LedgeredCall[] };
}

interface PortLog {
  fetched: string[];
  ranked: { domain: string; rows: number }[];
  robots: string[];
}

function fakePorts(
  documents: Readonly<Record<string, FetchOutcome>>,
  over: { robots?: RobotsPolicy | { ok: false; reason: string }; ranked?: Measured<RankedRow[]> } = {}
): MeasurePorts & { log: PortLog } {
  const log: PortLog = { fetched: [], ranked: [], robots: [] };
  return {
    log,
    async fetchDocument(url: string) {
      log.fetched.push(url);
      return documents[url] ?? failOutcome(url, "status");
    },
    async readRobots(origin: string) {
      log.robots.push(origin);
      return over.robots ?? policy({ absent: true });
    },
    async rankedKeywords(_c: CostContext, a: { domain: string; rows: 50 | 100 | 300 }) {
      log.ranked.push({ domain: a.domain, rows: a.rows });
      return over.ranked ?? measured<RankedRow[]>([{ keyword: "k", position: 3, searchVolume: 90, url: HOME }], READ_AT);
    },
  };
}

const FULL_SITE: Readonly<Record<string, FetchOutcome>> = {
  [HOME]: okOutcome(HOME, RICH_HTML),
  "https://reachkit.app/pricing": okOutcome("https://reachkit.app/pricing", PRICING_HTML),
};

async function measure(
  documents: Readonly<Record<string, FetchOutcome>>,
  a: { tier?: Tier; pages?: readonly string[] } = {},
  portOver: Parameters<typeof fakePorts>[1] = {},
  costOpts: { capped?: boolean } = {}
): Promise<{ result: DomainMeasurement; cost: ReturnType<typeof fakeCost>; ports: ReturnType<typeof fakePorts> }> {
  const cost = fakeCost(costOpts);
  const ports = fakePorts(documents, portOver);
  const result = await measureDomain(cost, { domain: DOMAIN, tier: a.tier ?? "free", pages: a.pages }, ports);
  return { result, cost, ports };
}

let logSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  logSpy.mockRestore();
});

describe('BP-010 `## Responsibility` — "classify every result as measured, measured-zero or unmeasured at the point it is produced, so no downstream surface has to guess which it was"', () => {
  const REASONS = ["dns", "refused", "timeout", "too_large", "blocked_by_policy", "robots_disallowed", "status"] as const;

  it.each(REASONS)("a home document that failed with `%s` is unmeasured/undeterminable, never a 0", async (reason) => {
    const { result } = await measure({ [HOME]: failOutcome(HOME, reason) });
    expect(result.onPage).toEqual({ kind: "unmeasured", reason: "undeterminable", at: READ_AT });
    expect(result.drivers.foundations.kind).toBe("unmeasured");
    expect(result.drivers.answerability).toEqual({ kind: "unmeasured", reason: "undeterminable", at: READ_AT });
  });

  it("a home document read that contained none of what we count is a measured zero", async () => {
    const { result } = await measure({ [HOME]: okOutcome(HOME, "<html><head></head><body></body></html>") });
    expect(result.onPage.kind).toBe("zero");
    expect(result.drivers.answerability.kind).toBe("zero");
  });

  it("a home document read and full is measured, and the pricing page it links to is read too", async () => {
    const { result, ports } = await measure(FULL_SITE);
    expect(result.onPage.kind).toBe("measured");
    expect(result.pricing?.url).toBe("https://reachkit.app/pricing");
    expect(result.pricing?.facts.kind).toBe("measured");
    expect(ports.log.fetched).toEqual([HOME, "https://reachkit.app/pricing"]);
  });

  it("a home document that links to no pricing page reports `null` — a fact about the document, not a failed read", async () => {
    const { result, ports } = await measure({ [HOME]: okOutcome(HOME, "<html><body><h1>Hi</h1></body></html>") });
    expect(result.pricing).toBeNull();
    expect(ports.log.fetched).toEqual([HOME]);
  });

  it("a robots reader that cannot determine a policy nulls the policy rather than fabricating an open one", async () => {
    const { result } = await measure(FULL_SITE, {}, { robots: { ok: false, reason: "not wired" } });
    expect(result.robots).toEqual({ kind: "unmeasured", reason: "undeterminable", at: READ_AT });
    expect(result.drivers.foundations.kind).toBe("unmeasured");
  });

  it("an absent robots.txt is a read with nothing in it — the zero arm, not undeterminable", async () => {
    const { result } = await measure(FULL_SITE, {}, { robots: policy({ absent: true }) });
    expect(result.robots.kind).toBe("zero");
  });

  it("`aiPresence` is always not_attempted here — the twelve SERPs are §6.7's, not this call's", async () => {
    for (const tier of ["free", "deep", "weekly"] as const) {
      const { result } = await measure(FULL_SITE, { tier });
      expect(result.drivers.aiPresence).toEqual({ kind: "unmeasured", reason: "not_attempted", at: READ_AT });
    }
  });
});

describe('BP-010 `## Error & edge behavior` — "Determinism is a test, not an aspiration: the same HTML measured twice produces byte-identical output"', () => {
  it("two runs over the same doubled bytes are byte-identical", async () => {
    const first = await measure(FULL_SITE);
    const second = await measure(FULL_SITE);
    expect(JSON.stringify(second.result)).toBe(JSON.stringify(first.result));
  });

  it("the module reads no clock — every `at` comes from an outcome's `readAt`", async () => {
    expect(CODE_ONLY).not.toMatch(/Date\.now\s*\(/);
    expect(CODE_ONLY).not.toMatch(/new Date\s*\(\s*\)/);

    const { result } = await measure(FULL_SITE, { tier: "deep", pages: ["https://reachkit.app/docs"] });
    const everyMeasured: Measured<unknown>[] = [
      result.onPage,
      result.robots,
      ...Object.values(result.drivers),
      ...(result.pricing === null ? [] : [result.pricing.facts]),
    ];
    for (const m of everyMeasured) expect(m.at.toISOString()).toBe(READ_AT.toISOString());
  });

  it("every own-document read is ledgered under one source, keyed by its own URL", async () => {
    const { cost } = await measure(FULL_SITE);
    const ownReads = cost.calls.filter((call) => call.source === OWN_FETCH_SOURCE);
    expect(ownReads.map((call) => call.cacheKey)).toEqual([HOME, "https://reachkit.app/pricing"]);
  });
});

describe('BP-012 `## Error & edge behavior`, governing its callee — "The pipeline never branches on tier; only its parameters change"', () => {
  it("tier changes parameters, never arithmetic", async () => {
    const free = await measure(FULL_SITE, { tier: "free" });
    const deep = await measure(FULL_SITE, { tier: "deep" });
    const weekly = await measure(FULL_SITE, { tier: "weekly" });

    for (const other of [deep, weekly]) {
      expect(other.result.drivers.foundations).toEqual(free.result.drivers.foundations);
      expect(other.result.drivers.answerability).toEqual(free.result.drivers.answerability);
      expect(JSON.stringify(other.result.onPage)).toBe(JSON.stringify(free.result.onPage));
    }

    expect(free.ports.log.ranked).toEqual([{ domain: DOMAIN, rows: PRICE_BOOK.RANKED_FREE_ROWS }]);
    expect(deep.ports.log.ranked).toEqual([{ domain: DOMAIN, rows: PRICE_BOOK.RANKED_PAID_ROWS }]);
    expect(weekly.ports.log.ranked).toEqual([{ domain: DOMAIN, rows: PRICE_BOOK.RANKED_PAID_ROWS }]);
  });

  it("no `tier` comparison appears outside the two lookup tables", () => {
    expect(CODE_ONLY).not.toMatch(/tier\s*===/);
    expect(CODE_ONLY).not.toMatch(/===\s*"(free|deep|weekly)"/);
    // The only two reads of `tier` are the two table lookups.
    expect([...CODE_ONLY.matchAll(/a\.tier/g)]).toHaveLength(2);
  });
});

describe('BP-010 `## NFR budget` — the spend, the page cap and the ceiling', () => {
  it("parsing and scoring spend nothing — the only priced call is the ranked rows", async () => {
    const { cost, ports } = await measure(FULL_SITE);
    expect(ports.log.ranked).toHaveLength(1);
    // Every call this module makes through the seam is an own-document read
    // at zero cents; the vendor client prices its own call inside itself.
    expect(cost.calls.every((call) => call.source === OWN_FETCH_SOURCE && call.costCents === 0)).toBe(true);
  });

  it("the page set is capped at the pin, and the cap is not a literal here", async () => {
    const forty = Array.from({ length: 40 }, (_, i) => `https://reachkit.app/p${i}`);
    const documents: Record<string, FetchOutcome> = { ...FULL_SITE };
    for (const url of forty) documents[url] = okOutcome(url, "<html><body><h2>What?</h2></body></html>");

    const { ports } = await measure(documents, { tier: "deep", pages: forty });
    // Home + pricing + the pin's worth of the forty offered.
    expect(ports.log.fetched).toHaveLength(2 + BATTERY.MEASURED_PAGES_MAX);
    expect(CODE_ONLY).not.toMatch(/\b25\b/);
  });

  it("the free tier carries no extra pages at all", async () => {
    const extra = "https://reachkit.app/docs";
    const { ports } = await measure({ ...FULL_SITE, [extra]: okOutcome(extra, RICH_HTML) }, {
      tier: "free",
      pages: [extra],
    });
    expect(ports.log.fetched).toEqual([HOME, "https://reachkit.app/pricing"]);
  });

  it("a page already read is never read twice", async () => {
    const { ports } = await measure(FULL_SITE, { tier: "deep", pages: [HOME, "https://reachkit.app/pricing"] });
    expect(ports.log.fetched).toEqual([HOME, "https://reachkit.app/pricing"]);
  });

  it("a not_attempted driver names its ceiling, and the priced call is not made", async () => {
    const { result, ports } = await measure(FULL_SITE, {}, {}, { capped: true });
    expect(result.drivers.searchPresence).toEqual({ kind: "unmeasured", reason: "not_attempted", at: READ_AT });
    expect(ports.log.ranked).toEqual([]);

    const lines = (logSpy.mock.calls as unknown[][]).map((call) => String(call[0]));
    const ceiling = lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((entry) => entry.ceiling !== undefined);
    expect(ceiling).toMatchObject({ event: "driver_not_attempted", driver: "searchPresence", ceiling: "spend_cap" });
  });

  it("a vendor call that throws is undeterminable, never a zero", async () => {
    const cost = fakeCost();
    const ports = fakePorts(FULL_SITE);
    ports.rankedKeywords = async () => {
      throw new Error("rankedKeywords is not yet implemented");
    };
    const result = await measureDomain(cost, { domain: DOMAIN, tier: "free" }, ports);
    expect(result.drivers.searchPresence).toEqual({ kind: "unmeasured", reason: "undeterminable", at: READ_AT });
  });

  it("zero ranked rows is a measured zero, not a withheld driver", async () => {
    const { result } = await measure(FULL_SITE, {}, { ranked: { kind: "zero", value: [], at: READ_AT } });
    expect(result.drivers.searchPresence.kind).toBe("zero");
  });
});

describe("BUILD §6.4 — the pricing page is found on the home document, never crawled for", () => {
  it("takes the first same-host pricing link in document order", () => {
    const html = `<a href="https://elsewhere.example/pricing">no</a><a href="/plans">yes</a><a href="/pricing">later</a>`;
    expect(detectPricingUrl(html, HOME)).toBe("https://reachkit.app/plans");
  });

  it("ignores another host, a non-http scheme and the home document itself", () => {
    expect(detectPricingUrl(`<a href="mailto:sales@reachkit.app/pricing">x</a>`, HOME)).toBeNull();
    expect(detectPricingUrl(`<a href="https://other.example/pricing">x</a>`, HOME)).toBeNull();
    expect(detectPricingUrl(`<a href="/about">x</a>`, HOME)).toBeNull();
  });

  it("is deterministic — the same document yields the same URL twice", () => {
    expect(detectPricingUrl(RICH_HTML, HOME)).toBe(detectPricingUrl(RICH_HTML, HOME));
  });
});
