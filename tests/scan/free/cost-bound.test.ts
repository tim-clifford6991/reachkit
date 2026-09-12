// tests/scan/free/cost-bound.test.ts — issue #523
//
// **The free pass's worst case, added up from the pins.** Every priced
// call a free pass makes reserves against `CAPS.FREE_C` before it runs;
// the sum of those reservations is the most one pass can be asked to
// spend. #517's arithmetic put that sum at about 11 ¢ — assuming a
// 20 000-character profile prompt that nothing enforced, while an own
// document may be `OWN_DOCUMENT_MAX_BYTES` (#479) and its visible text went
// into the prompt whole. `PROFILE_INPUT_MAX_CHARS` is that assumption made
// a pin; this file is the sum, computed from it and from every other pin,
// and the proof that a large site's text reaches the prompt bounded while
// the measurement still reads all of it.
//
// The measure module imports the vendor client for its default port, and
// `src/lib/config/env.ts` validates every binding at module load — so a
// valid-shaped fixture is set before the static imports run (the same use
// as `tests/measure/domain/measure-domain.test.ts`). No credential here is
// real; every port is doubled and `@/lib/llm` is stubbed.
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
    MAIL_FROM: "hello@reachkit.example",
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

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ASYNC_AIO_SURCHARGE_MULTIPLIER,
  BATTERY,
  CAPS,
  FREE_PASS_INFERENCE_CALLS,
  INFERENCE_MAX_OUTPUT_TOKENS,
  INFERENCE_PRICE_BOOK,
  OWN_DOCUMENT_MAX_BYTES,
  PRICE_BOOK,
  PROFILE_INPUT_MAX_CHARS,
} from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import type { FetchOutcome } from "@/lib/egress/types";
import { deriveProfile, PROFILE_FIELDS, PROFILE_TASK } from "@/lib/market/questions/profile";
import { measureDomain, parseOnPage, visibleText, type MeasurePorts } from "@/lib/measure";
import { measured } from "@/lib/measure/measured";
import type { RankedResult } from "@/lib/vendors/dataforseo/types";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

// ── The seam's own reservation rule, read from its source ────────────────
//
// `llm()` reserves `MAX_ATTEMPTS` × (estimated input + the site's output
// pin), the input estimated at one token per `CHARS_PER_TOKEN` characters
// of the serialised prompt. Neither figure is exported; both are read out
// of `src/lib/llm/index.ts` so this sum moves when the seam does.
const LLM_SOURCE = read("src/lib/llm/index.ts");

function sourceNumber(re: RegExp, what: string): number {
  const match = re.exec(LLM_SOURCE);
  if (match === null) throw new Error(`src/lib/llm/index.ts no longer spells ${what}`);
  return Number(match[1]);
}

const MAX_ATTEMPTS = sourceNumber(/^const MAX_ATTEMPTS = (\d+);$/m, "`const MAX_ATTEMPTS = <n>;`");
const CHARS_PER_TOKEN = sourceNumber(/Math\.ceil\(text\.length \/ (\d+)\)/, "`Math.ceil(text.length / <n>)`");

type Price = { readonly inCentsPerM: number; readonly outCentsPerM: number };

/** One `llm()` call's up-front reservation, the figure the cap is checked
 *  against — `llm()`'s own arithmetic, recomputed here rather than
 *  imported. */
function reservationCents(price: Price, inputChars: number, outputTokens: number): number {
  const tokensIn = Math.max(1, Math.ceil(inputChars / CHARS_PER_TOKEN)) * MAX_ATTEMPTS;
  const tokensOut = outputTokens * MAX_ATTEMPTS;
  return (tokensIn / 1_000_000) * price.inCentsPerM + (tokensOut / 1_000_000) * price.outCentsPerM;
}

/** The tier a call site declares, read from its source. */
function tierOf(rel: string): keyof typeof INFERENCE_PRICE_BOOK {
  const match = /tier:\s*"(nano|haiku)"/.exec(read(rel));
  if (match === null) throw new Error(`${rel} declares no tier`);
  return match[1] as keyof typeof INFERENCE_PRICE_BOOK;
}

// ── The two inputs ───────────────────────────────────────────────────────

/** The profile prompt at its largest: the fixed instruction with both page
 *  keys present, plus the pin — which bounds the pages' serialised length,
 *  so this is exact, not an estimate. */
const PROFILE_PROMPT_MAX_CHARS =
  JSON.stringify({ task: PROFILE_TASK, fields: PROFILE_FIELDS, home: "", pricing: "" }).length +
  PROFILE_INPUT_MAX_CHARS;

/** No pin bounds a search's length (see the PR's *Adjacent*): the phrasing
 *  input is the twelve `{ id, keyword }` pairs, priced here at a stated
 *  200 characters a search — several times a long real query. */
const ASSUMED_SEARCH_CHARS = 200;
const PHRASING_PROMPT_CHARS = JSON.stringify(
  Array.from({ length: BATTERY.QUESTIONS }, (_, i) => ({ id: `q${i + 1}`, keyword: "x".repeat(ASSUMED_SEARCH_CHARS) }))
).length;

/** The free pass's reservations, line by line, at the given inference rows. */
function freePassWorstCase(price: { profile: Price; phrasing: Price }) {
  return {
    rankedKeywords: PRICE_BOOK.RANKED_FREE_COST_C,
    keywordSuggestions: PRICE_BOOK.SUGGESTIONS_COST_C,
    // Twelve live SERPs with the async AI Overview flag, each reserving the
    // surcharge (ADR-094 d3).
    twelveSerps: BATTERY.QUESTIONS * PRICE_BOOK.SERP_LIVE_C * ASYNC_AIO_SURCHARGE_MULTIPLIER,
    profile: reservationCents(price.profile, PROFILE_PROMPT_MAX_CHARS, INFERENCE_MAX_OUTPUT_TOKENS.profile),
    phrasing: reservationCents(
      price.phrasing,
      PHRASING_PROMPT_CHARS,
      INFERENCE_MAX_OUTPUT_TOKENS["question-phrasing"]
    ),
  };
}

const sum = (lines: Record<string, number>) => Object.values(lines).reduce((a, b) => a + b, 0);

const PROFILE_SITE = "src/lib/market/questions/profile.ts";
const PHRASING_SITE = "src/lib/market/questions/phrase.ts";

describe("the free pass's worst case, from the pins, is at most CAPS.FREE_C (issue #523)", () => {
  // Two, not three: the site profile's own `site-profile` call is a paid
  // call (issue #577). SPEC.md §12 ruling 8 puts the profile in the free
  // scan and the crawl is there, but the model half of it would be a third
  // nano call and `tests/llm/budget.test.ts` holds the free pass to
  // leaving half its invocation to everything that is not inference — so
  // the voice, the products and the claims derive on the first paid pass
  // and refresh weekly. Nothing this sum prices runs on the free path
  // without being counted here.
  it("the free pass makes the two inference calls this sum prices, and no third", () => {
    expect(FREE_PASS_INFERENCE_CALLS).toBe(2);
  });

  it("at the tier each call site declares, every reservation added up is at most CAPS.FREE_C", () => {
    const lines = freePassWorstCase({
      profile: INFERENCE_PRICE_BOOK[tierOf(PROFILE_SITE)],
      phrasing: INFERENCE_PRICE_BOOK[tierOf(PHRASING_SITE)],
    });
    expect(sum(lines)).toBeLessThanOrEqual(CAPS.FREE_C);
  });

  it("and at Haiku's row — the model both tiers call (#517) — it is still at most CAPS.FREE_C", () => {
    const haiku = INFERENCE_PRICE_BOOK.haiku;
    const lines = freePassWorstCase({ profile: haiku, phrasing: haiku });
    expect(sum(lines)).toBeLessThanOrEqual(CAPS.FREE_C);
    // #517's own figure: about 11 ¢, the profile input about 1.06 ¢ of it.
    expect(sum(lines)).toBeGreaterThan(10.5);
    expect(lines.profile).toBeLessThan(2);
  });

  it("without the bound it is not: one 6 MB own document's text alone would reserve past the whole cap", () => {
    const unbounded = reservationCents(INFERENCE_PRICE_BOOK.haiku, OWN_DOCUMENT_MAX_BYTES, 0);
    expect(unbounded).toBeGreaterThan(CAPS.FREE_C);
  });
});

// ── A 3 MB home page, end to end through the measurement and the prompt ──

const DOMAIN = "big.example";
const HOME = `https://${DOMAIN}/`;
const PRICING = `https://${DOMAIN}/pricing`;
const READ_AT = new Date("2026-09-11T09:00:00.000Z");

const FILLER = `<p>${"Teams plan their work together in one shared place. ".repeat(20)}</p>\n`;
const TAIL = "<h2>How much does it cost at the very end?</h2><p>The answer sits at the bottom of the page.</p>";
const BIG_HOME = `<html><body><a href="/pricing">Pricing</a>\n${FILLER.repeat(
  Math.ceil(3_000_000 / FILLER.length)
)}${TAIL}</body></html>`;
const PRICING_HTML = `<html><body><h2>What does it cost?</h2><p>${"Twelve pounds a month. ".repeat(50)}</p></body></html>`;

function ok(url: string, html: string): FetchOutcome {
  return { ok: true, status: 200, url, html, bytes: html.length, readAt: READ_AT, headers: {} };
}

function fakeCost(): CostContext {
  const context = {
    async recordFetch<P>(call: { costCents: number; run: () => Promise<P> }) {
      return { payload: await call.run(), fresh: true, costCents: call.costCents };
    },
    capHit: () => false,
    spentCents: () => 0,
    degraded: () => false,
  };
  return context as unknown as CostContext;
}

const PORTS: MeasurePorts = {
  async fetchDocument(url: string) {
    if (url === HOME) return ok(HOME, BIG_HOME);
    if (url === PRICING) return ok(PRICING, PRICING_HTML);
    return { ok: false, reason: "status", url, readAt: READ_AT };
  },
  async readRobots(origin: string) {
    return {
      ok: true,
      origin,
      readAt: READ_AT,
      disallowsAll: false,
      disallowedAgents: {},
      sitemaps: [],
      absent: true,
    };
  },
  async rankedKeywords() {
    return measured<RankedResult>({ rows: [], total: null }, READ_AT);
  },
};

const serialised = (text: string | undefined) => (text === undefined ? 0 : JSON.stringify(text).length - 2);

let logSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  llmMock.mockReset();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  logSpy.mockRestore();
});

describe("a 3 MB home page: the prompt is bounded, the measurement is not (issue #523)", () => {
  it("the fixture is the case: at least 3 MB, inside the own-document cap, its text many times the pin", () => {
    expect(BIG_HOME.length).toBeGreaterThanOrEqual(3_000_000);
    expect(BIG_HOME.length).toBeLessThanOrEqual(OWN_DOCUMENT_MAX_BYTES);
    expect(visibleText(BIG_HOME).length).toBeGreaterThan(PROFILE_INPUT_MAX_CHARS * 100);
  });

  it("the measurement reads the whole document — its facts are the whole document's, the heading at the very end included", async () => {
    const m = await measureDomain(fakeCost(), { domain: DOMAIN, tier: "free" }, PORTS);
    expect(m.onPage.kind).toBe("measured");
    if (m.onPage.kind !== "measured") return;
    expect(m.onPage.value).toEqual(parseOnPage({ url: HOME, html: BIG_HOME }));
    expect(m.onPage.value.visibleChars).toBe(visibleText(BIG_HOME).length);
    expect(m.onPage.value.headings).toBe(1);
    expect(m.text.home).toBe(visibleText(BIG_HOME));
  });

  it("the profile prompt built from it carries home plus pricing text of at most the pin, home first, cut at a word", async () => {
    const m = await measureDomain(fakeCost(), { domain: DOMAIN, tier: "free" }, PORTS);
    const home = m.text.home!;
    llmMock.mockResolvedValueOnce({ kind: "unmeasured", reason: "undeterminable", at: READ_AT });

    await deriveProfile(fakeCost(), { home, ...(m.text.pricing === null ? {} : { pricing: m.text.pricing }) });

    expect(llmMock).toHaveBeenCalledTimes(1);
    const input = llmMock.mock.calls[0]![1].input as { task: string; fields: unknown; home: string; pricing?: string };
    expect(serialised(input.home) + serialised(input.pricing)).toBeLessThanOrEqual(PROFILE_INPUT_MAX_CHARS);
    expect(JSON.stringify(input).length).toBeLessThanOrEqual(PROFILE_PROMPT_MAX_CHARS);
    // Home first: it took nearly all of the bound, and it is the page's own
    // opening text, ending where a word ends.
    expect(input.home.length).toBeGreaterThan(PROFILE_INPUT_MAX_CHARS - 100);
    expect(home.startsWith(input.home)).toBe(true);
    expect(/\s/.test(home.charAt(input.home.length))).toBe(true);
    // The pricing page gets only what the home page left — at most a word
    // or two here, and only ever its own opening words.
    if (input.pricing !== undefined) expect(m.text.pricing!.startsWith(input.pricing)).toBe(true);
    // The measurement's copy is untouched by the bound.
    expect(m.text.home!.length).toBe(visibleText(BIG_HOME).length);
  });
});
