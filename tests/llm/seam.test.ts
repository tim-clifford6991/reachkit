// tests/llm/seam.test.ts — WO-026 `## Test plan`, criteria quoted verbatim
// from BP-009 (`satisfies: []` — cited, not inherited; see the work
// order's own test-plan header note).
//
// **Mutation-tested, doctrine 0.13.2 (WO-026 `## Goal`: "risk: high —
// seams: money, and data leaving the system").** Three seams, each with a
// dedicated, independent probe below (not just a happy-path assertion
// that would pass whether or not the seam actually did its job):
//   1. **Spend** — "spend accounting seam" below: every call is ledgered
//      through `CostContext.recordFetch` exactly once, and the settled
//      cost is computed from the vendor's own reported token counts, not
//      a caller-supplied figure. Deleting or bypassing the
//      `c.recordFetch(...)` call in `src/lib/llm/index.ts`, or its
//      `settleCents` closure, kills this suite: `calls` would stay empty,
//      or the settled figure would stop tracking real usage.
//   2. **Tier selection** — "tier -> model id" below has *two*
//      independent tests, deliberately not one: a literal-value test
//      (catches a *swap* inside `tiers.ts`'s own model-id map — the
//      "shadow" test below reads through `tierBinding()` too, so on its
//      own a swap would pass it vacuously) and a shadow test (catches a
//      caller argument substituting for the pinned mapping — a bug the
//      literal-value test alone cannot see, since it never calls `llm()`
//      at all). Together they discriminate both named mutations.
//   3. **The customer's page text and the credential** — "credential and
//      payload never leave this seam via a log" below searches every
//      `console.log`/`warn`/`error` call, across a success, a parse
//      failure and an unavailability, for the fixture credential in
//      *both* plaintext and base64 form (WO-023's sibling order shipped a
//      test that searched only the plaintext form and missed its own
//      header's encoding — learned from, not repeated) and for a marker
//      planted in both the customer's input and the model's own response
//      text. A second, dedicated test proves the first isn't vacuously
//      passing because the credential was never used at all — it asserts
//      the vendor client actually received the real, tier-correct key.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { CostContext } from "../../src/lib/costs";
import type { Tier } from "../../src/lib/llm/tiers.ts";
import { INFERENCE_MAX_OUTPUT_TOKENS } from "../../src/lib/config/constants.ts";
import { rawTextMessage, textMessage, toolUseMessage } from "./fixtures";

// `tiers.ts` reads `@/lib/config/env` at module load (BP-005) — the
// module under test is therefore imported dynamically in `beforeAll`,
// after this fixture populates `process.env`, the same pattern
// `tests/config/env.test.ts` and `tests/scan/free/admission-check.test.ts`
// both use for the same reason.
const ANTHROPIC_API_KEY = "sk-ant-haiku-secret-fixture";
const NANO_API_KEY = "sk-ant-nano-secret-fixture";

const ENV_FIXTURE: Record<string, string> = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon-key-fixture",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-fixture",
  STRIPE_SECRET_KEY: "sk_test_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture",
  STRIPE_PRICE_ID: "price_fixture",
  RESEND_API_KEY: "re_fixture",
  MAIL_FROM: "hello@reachkit.example",
  DATAFORSEO_LOGIN: "dfs-login-fixture",
  DATAFORSEO_PASSWORD: "dfs-password-fixture",
  ANTHROPIC_API_KEY,
  NANO_API_KEY,
  IP_HASH_SALT: "salt-fixture",
  KILL_SWITCH: "false",
  OWNER_EMAILS: "owner@example.com",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
  HOSTED_EDGE_CNAME_TARGET: "content.example.com",
};

// The "encoded form" the sibling order's own credential test missed —
// both fixture keys, base64-encoded, searched for below alongside the
// plaintext.
const ANTHROPIC_API_KEY_B64 = Buffer.from(ANTHROPIC_API_KEY).toString("base64");
const NANO_API_KEY_B64 = Buffer.from(NANO_API_KEY).toString("base64");

// Shared mutable state the `@anthropic-ai/sdk` mock factory and the test
// bodies both need to reach — `vi.hoisted` is required because `vi.mock`
// factories are hoisted above every other statement in this file,
// including a plain `const` declared above them.
const { createMock, constructedWith } = vi.hoisted(() => ({
  createMock: vi.fn(),
  constructedWith: [] as { apiKey: string; timeout: number; maxRetries: number }[],
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    constructor(opts: { apiKey: string; timeout: number; maxRetries: number }) {
      constructedWith.push(opts);
    }
    messages = { create: createMock };
  },
}));

/** The vendor SDK's own error shapes, rebuilt here rather than imported.
 *  `index.ts` classifies a failed call by shape — a numeric `status`, a
 *  timeout-shaped name — precisely so that it does not depend on a named
 *  export nine mocking suites would each have to re-provide (issue #452),
 *  and a test that imported the real classes would be asserting something
 *  weaker than what ships. */
class ApiConnectionTimeout extends Error {
  constructor() {
    super("Request timed out.");
    // The real class reports the base `Error` here; the constructor name
    // is the signal.
    this.name = "Error";
  }
}
Object.defineProperty(ApiConnectionTimeout, "name", { value: "APIConnectionTimeoutError" });

function apiError(status: number): Error {
  return Object.assign(new Error("vendor said no"), { status });
}

let llm: typeof import("../../src/lib/llm/index.ts").llm;
let tierBinding: typeof import("../../src/lib/llm/tiers.ts").tierBinding;

beforeAll(async () => {
  for (const [key, value] of Object.entries(ENV_FIXTURE)) process.env[key] = value;
  const seam = await import("../../src/lib/llm/index.ts");
  const tiers = await import("../../src/lib/llm/tiers.ts");
  llm = seam.llm;
  tierBinding = tiers.tierBinding;
});

beforeEach(() => {
  createMock.mockReset();
  constructedWith.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** The exact shape `CostContext.recordFetch` declares (`src/lib/costs/
 *  index.ts`, BP-007's `## Public interface`), reproduced here rather than
 *  imported — this suite is `llm()`'s own, exercised against a fake
 *  `CostContext` it controls, never the real `withCostContext` (BP-007's
 *  own DB-backed suite is `tests/costs/context.test.ts`'s). */
interface RecordedCall {
  source: string;
  cacheKey: string;
  freshnessDays: number;
  costCents: number;
  settleCents?: (payload: unknown) => number;
  run: () => Promise<unknown>;
}

function fakeCostContext(): { ctx: CostContext; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const ctx: CostContext = {
    cap: "DEEP",
    async recordFetch<P>(call: {
      source: string;
      cacheKey: string;
      freshnessDays: number;
      costCents: number;
      settleCents?: (payload: P) => number;
      run: () => Promise<P>;
    }) {
      calls.push(call as unknown as RecordedCall);
      const payload = await call.run();
      const costCents = call.settleCents ? call.settleCents(payload) : call.costCents;
      return { payload, fresh: true, costCents };
    },
    capHit: () => false,
    spentCents: () => 0,
    degraded: () => false,
  };
  return { ctx, calls };
}

/** A `CostContext` whose cap is already spent — `recordFetch` never calls
 *  `run()`, exactly `withCostContext`'s own `{ skipped: "cap" }` path. */
function cappedCostContext(): { ctx: CostContext; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const ctx: CostContext = {
    cap: "DEEP",
    async recordFetch<P>(call: {
      source: string;
      cacheKey: string;
      freshnessDays: number;
      costCents: number;
      settleCents?: (payload: P) => number;
      run: () => Promise<P>;
    }) {
      calls.push(call as unknown as RecordedCall);
      return { skipped: "cap" as const };
    },
    capHit: () => true,
    spentCents: () => 9999,
    degraded: () => true,
  };
  return { ctx, calls };
}

const SCHEMA = z.object({ headline: z.string() });

function assertNever(x: never): never {
  throw new Error(`unreachable tier: ${String(x)}`);
}

describe("llm() — schema parse (BP-009 `## Error & edge behavior`)", () => {
  it(
    'a non-conforming response yields unmeasured after exactly two attempts — the reason is ' +
      '`undeterminable`, `UnmeasuredReason`\'s own "unreadable" arm (BP-024); BP-009\'s prose ' +
      "names `unparseable`, a reason that does not exist on the shipped type (see `index.ts`'s " +
      "file header) — and a coercing fallback (returning the raw text as the value) fails this test",
    async () => {
      createMock.mockResolvedValueOnce(textMessage({ not: "the schema" }));
      createMock.mockResolvedValueOnce(textMessage({ still: "not the schema" }));
      const { ctx } = fakeCostContext();

      const result = await llm(ctx, {
        site: "profile",
        input: { homepage: "hello" },
        schema: SCHEMA,
        tier: "nano",
      });

      expect(createMock).toHaveBeenCalledTimes(2); // "retried at most once"
      expect(result.kind).toBe("unmeasured");
      if (result.kind === "unmeasured") expect(result.reason).toBe("undeterminable");
    }
  );

  it("a conforming response on the retry (the first attempt failed) is still measured — the retry is real, not decorative", async () => {
    createMock.mockResolvedValueOnce(textMessage({ not: "the schema" }));
    createMock.mockResolvedValueOnce(textMessage({ headline: "Widgets, Inc." }));
    const { ctx } = fakeCostContext();

    const result = await llm(ctx, { site: "profile", input: {}, schema: SCHEMA, tier: "nano" });

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ kind: "measured", value: { headline: "Widgets, Inc." } });
  });
});

describe("llm() — model unavailability (BP-009 `## Error & edge behavior`)", () => {
  it("a transport failure resolves to unmeasured, never rejects, and is not retried the way a parse failure is", async () => {
    createMock.mockRejectedValueOnce(new Error("connection refused"));
    const { ctx } = fakeCostContext();

    await expect(
      llm(ctx, { site: "profile", input: {}, schema: SCHEMA, tier: "haiku" })
    ).resolves.toMatchObject({ kind: "unmeasured", reason: "undeterminable" });
    expect(createMock).toHaveBeenCalledTimes(1);
  });
});

describe("llm() — the caller's cost ceiling (BP-024's `not_attempted`)", () => {
  it("a CostContext whose cap is already hit yields unmeasured/not_attempted and never calls the vendor at all", async () => {
    const { ctx, calls } = cappedCostContext();

    const result = await llm(ctx, { site: "profile", input: {}, schema: SCHEMA, tier: "nano" });

    expect(result).toMatchObject({ kind: "unmeasured", reason: "not_attempted" });
    expect(calls).toHaveLength(1);
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe("llm() — ledgered through BP-007 (BP-009 `## Data model delta`)", () => {
  it.each([
    ["a success", () => createMock.mockResolvedValueOnce(textMessage({ headline: "ok" }))],
    [
      "a parse failure",
      () => {
        createMock.mockResolvedValueOnce(textMessage({ wrong: "shape" }));
        createMock.mockResolvedValueOnce(textMessage({ wrong: "shape" }));
      },
    ],
    ["an unavailability", () => createMock.mockRejectedValueOnce(new Error("down"))],
  ])("the fetches row's source equals the call site, for %s", async (_label, arrange) => {
    arrange();
    const { ctx, calls } = fakeCostContext();

    await llm(ctx, { site: "generate.claim_check", input: {}, schema: SCHEMA, tier: "nano" });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.source).toBe("generate.claim_check");
  });
});

describe("llm() — spend accounting seam (mutation probe 1)", () => {
  it("every call reserves and settles cost through `recordFetch`, and the settled figure tracks the vendor's own reported tokens — not a guess", async () => {
    createMock.mockResolvedValueOnce(textMessage({ headline: "ok" }, 1000, 200));
    const { ctx, calls } = fakeCostContext();

    const result = await llm(ctx, { site: "generate.brief", input: {}, schema: SCHEMA, tier: "nano" });

    expect(result.kind).toBe("measured");
    expect(calls).toHaveLength(1);
    expect(typeof calls[0]!.settleCents).toBe("function");
    // BP-005's own formula, transcribed at `tiers.ts`'s `costCentsFor` —
    // recomputed here independently rather than importing that function,
    // so a bug in the formula itself cannot cancel out against this
    // assertion. The rates are Haiku's: the nano tier is priced at
    // Haiku's row since the owner's ruling of issue #517.
    const expectedCents = (1000 / 1_000_000) * 100 + (200 / 1_000_000) * 500;
    expect(calls[0]!.settleCents!({ tokensIn: 1000, tokensOut: 200 })).toBeCloseTo(expectedCents, 6);
    expect(calls[0]!.costCents).toBeGreaterThan(0); // the up-front reservation is never zero
  });
});

// A bypass of the spend seam — `llm()` calling the vendor without going
// through `c.recordFetch(...)` — has no scenario in this file it could
// pass silently: every `it` above and below asserts `calls`/`createMock`
// call counts and `calls[0].source`/`.settleCents`, none of which exist
// unless `recordFetch` was actually invoked. No separate probe is added
// for that mutation; it is already discriminated by the suite as a
// whole.

describe("llm() — tier -> model id (mutation probe 2)", () => {
  it("the Tier union is exactly {'nano', 'haiku'} — compile-time exhaustiveness, never a third member added silently", () => {
    const check = (tier: Tier): "ok" => {
      switch (tier) {
        case "nano":
          return "ok";
        case "haiku":
          return "ok";
        default:
          return assertNever(tier);
      }
    };
    expect(check("nano")).toBe("ok");
    expect(check("haiku")).toBe("ok");
  });

  it(
    "each tier binds to a catalogue-real, literal model id, independent of any call site — " +
      "so a mutation inside `tiers.ts`'s own map fails here even though a call site reading " +
      "through `tierBinding()` could not see it. `nano` and `haiku` deliberately share one id " +
      "today (2026-09-04 coordinator finding: `claude-fable-5` was real but Anthropic's most " +
      "expensive tier, wired into the cheapest lane — a 50×/40× spend-ledger under-count that " +
      "no test could see because the price book and the id agreed with each other and were " +
      "both wrong together; `INFERENCE_PRICE_BOOK` now prices the two tiers identically by " +
      "owner ruling (#517) and `INFERENCE_TIMEOUT_MS` still times them differently — see the next test)",
    () => {
      const nano = tierBinding("nano");
      const haiku = tierBinding("haiku");
      expect(nano.modelId).toBe("claude-haiku-4-5");
      expect(haiku.modelId).toBe("claude-haiku-4-5");
      // Regression guard for the money defect itself: never again the
      // vendor's most expensive tier wired into the cheapest lane.
      expect(nano.modelId).not.toBe("claude-fable-5");
    }
  );

  it("nano and haiku share a model id and so share a price (owner ruling, #517: nano is priced at Haiku's row) — while their timeouts stay apart, so a swap of `INFERENCE_TIMEOUT_MS`'s two tiers still fails here", () => {
    const nano = tierBinding("nano");
    const haiku = tierBinding("haiku");
    // Independent literals — Haiku 4.5's $1.00 · $5.00 per MTok in cents —
    // so a nano row that drifted back to the old 20 / 125 fails here even
    // though a comparison of the two bindings to each other could not see
    // a haiku row that drifted with it.
    expect(nano.inCentsPerM).toBe(100);
    expect(nano.outCentsPerM).toBe(500);
    expect(haiku.inCentsPerM).toBe(100);
    expect(haiku.outCentsPerM).toBe(500);
    expect(nano.timeoutMs).not.toBe(haiku.timeoutMs);
  });

  it("a caller's own extra 'model' field can never shadow the tier's pinned model id — `llm()` reads only `call.tier`, never spreads `call`", async () => {
    createMock.mockResolvedValueOnce(textMessage({ headline: "ok" }));
    const { ctx } = fakeCostContext();

    const shadowingCall = {
      site: "profile" as const,
      input: {},
      schema: SCHEMA,
      tier: "haiku" as Tier,
      model: "evil-model-nobody-pinned", // not part of `llm()`'s declared parameter type
    };
    await llm(ctx, shadowingCall);

    expect(createMock).toHaveBeenCalledTimes(1);
    const sentParams = createMock.mock.calls[0]![0] as { model: string };
    // Independent literal, not derived from `tierBinding()` — closes the
    // gap the previous test's own comparison-to-`tierBinding()` would
    // leave open against this specific mutation.
    expect(sentParams.model).toBe("claude-haiku-4-5");
    expect(sentParams.model).not.toBe("evil-model-nobody-pinned");
  });

  it("the same holds for the nano lane specifically — the one the money defect was in", async () => {
    createMock.mockResolvedValueOnce(textMessage({ headline: "ok" }));
    const { ctx } = fakeCostContext();

    const shadowingCall = {
      site: "profile" as const,
      input: {},
      schema: SCHEMA,
      tier: "nano" as Tier,
      model: "claude-fable-5", // the exact wrong id this suite once shipped
    };
    await llm(ctx, shadowingCall);

    expect(createMock).toHaveBeenCalledTimes(1);
    const sentParams = createMock.mock.calls[0]![0] as { model: string };
    expect(sentParams.model).toBe("claude-haiku-4-5");
    expect(sentParams.model).not.toBe("claude-fable-5");
  });
});

describe("llm() — the credential and the customer's page text never leave this seam via a log (mutation probe 3)", () => {
  it("neither api key (plaintext or base64), nor the customer's input, nor the model's own completion, ever appears in a console.log/warn/error call — across a success, a parse failure and an unavailability", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const promptMarker = "CUSTOMER-PAGE-TEXT-MARKER-f3b9";
    const completionMarker = "MODEL-COMPLETION-MARKER-7ac1";

    // success
    createMock.mockResolvedValueOnce(textMessage({ headline: completionMarker }));
    await llm(fakeCostContext().ctx, {
      site: "profile",
      input: { page: promptMarker },
      schema: SCHEMA,
      tier: "haiku",
    });

    // parse failure — two attempts, both echo the markers
    createMock.mockResolvedValueOnce(textMessage({ wrong: completionMarker }));
    createMock.mockResolvedValueOnce(textMessage({ wrong: completionMarker }));
    await llm(fakeCostContext().ctx, {
      site: "profile",
      input: { page: promptMarker },
      schema: SCHEMA,
      tier: "haiku",
    });

    // unavailability — the thrown error itself carries the credential in
    // both forms, the way a vendor SDK's own request-echoing error object
    // sometimes does; a caller-side bug that stringified the whole error
    // would leak it here, exactly what this probe exists to catch.
    createMock.mockRejectedValueOnce(
      Object.assign(new Error("boom"), {
        headers: { "x-api-key": ANTHROPIC_API_KEY, "x-api-key-b64": ANTHROPIC_API_KEY_B64 },
      })
    );
    await llm(fakeCostContext().ctx, {
      site: "profile",
      input: { page: promptMarker },
      schema: SCHEMA,
      tier: "haiku",
    });

    const everyLoggedArg = [...logSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls]
      .flat()
      .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
      .join("\n");

    expect(everyLoggedArg).not.toContain(ANTHROPIC_API_KEY);
    expect(everyLoggedArg).not.toContain(ANTHROPIC_API_KEY_B64);
    expect(everyLoggedArg).not.toContain(NANO_API_KEY);
    expect(everyLoggedArg).not.toContain(NANO_API_KEY_B64);
    expect(everyLoggedArg).not.toContain(promptMarker);
    expect(everyLoggedArg).not.toContain(completionMarker);
  });

  it("is not vacuously passing: the vendor client actually receives the tier's real, distinct credential", async () => {
    createMock.mockResolvedValueOnce(textMessage({ headline: "ok" }));
    await llm(fakeCostContext().ctx, { site: "profile", input: {}, schema: SCHEMA, tier: "haiku" });
    expect(constructedWith[0]!.apiKey).toBe(ANTHROPIC_API_KEY);

    createMock.mockResolvedValueOnce(textMessage({ headline: "ok" }));
    await llm(fakeCostContext().ctx, { site: "profile", input: {}, schema: SCHEMA, tier: "nano" });
    expect(constructedWith[1]!.apiKey).toBe(NANO_API_KEY);
  });
});

describe("llm() — observability record (BP-009 `## NFR budget`)", () => {
  it("logs exactly the six named fields (site, tier, tokens in and out, cost, duration, parse outcome) — no more, no less — and never the prompt or the completion", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const promptMarker = "PROMPT-MARKER-9d21";
    const completionMarker = "COMPLETION-MARKER-4e77";

    createMock.mockResolvedValueOnce(textMessage({ headline: completionMarker }, 42, 17));
    await llm(fakeCostContext().ctx, {
      site: "generate.answerability",
      input: { text: promptMarker },
      schema: SCHEMA,
      tier: "haiku",
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(Object.keys(logged).sort()).toEqual(
      ["costCents", "durationMs", "parseOutcome", "site", "tier", "tokensIn", "tokensOut"].sort()
    );
    expect(logged.site).toBe("generate.answerability");
    expect(logged.tier).toBe("haiku");
    expect(logged.tokensIn).toBe(42);
    expect(logged.tokensOut).toBe(17);
    expect(logged.parseOutcome).toBe("success");

    const loggedString = JSON.stringify(logged);
    expect(loggedString).not.toContain(promptMarker);
    expect(loggedString).not.toContain(completionMarker);
  });
});

describe("llm() — the call's time budget (BP-009 `## NFR budget`, as issue #452 moved it)", () => {
  it("each tier's configured budget is its pin — nano 15 s (raised from BP-009's 3 s, #452), haiku 20 s", () => {
    expect(tierBinding("nano").timeoutMs).toBe(15_000);
    expect(tierBinding("haiku").timeoutMs).toBe(20_000);
    // The defect itself, guarded: 3 s is below the latency a structured
    // call to `claude-haiku-4-5` has from a cold function, and every
    // production profile call made under it was cut off.
    expect(tierBinding("nano").timeoutMs).toBeGreaterThan(3000);
  });

  it("the configured budget reaches the vendor client construction", async () => {
    createMock.mockResolvedValueOnce(textMessage({ headline: "ok" }));
    await llm(fakeCostContext().ctx, { site: "profile", input: {}, schema: SCHEMA, tier: "haiku" });
    expect(constructedWith[0]!.timeout).toBe(20_000);

    createMock.mockResolvedValueOnce(textMessage({ headline: "ok" }));
    await llm(fakeCostContext().ctx, { site: "profile", input: {}, schema: SCHEMA, tier: "nano" });
    expect(constructedWith[1]!.timeout).toBe(15_000);
  });

  it(
    "the vendor SDK's own retry layer is off, stated on every client this seam builds — its default of " +
      "2 is what turned one attempt into three requests and the tier's budget into three times the wall " +
      "clock it reads as (#452)",
    async () => {
      createMock.mockResolvedValueOnce(textMessage({ headline: "ok" }));
      await llm(fakeCostContext().ctx, { site: "profile", input: {}, schema: SCHEMA, tier: "nano" });
      expect(constructedWith[0]!.maxRetries).toBe(0);
      expect(constructedWith[0]!.maxRetries).not.toBe(2); // the default, never inherited
    }
  );

  it(
    "the budget bounds the call, not the attempt: the parse retry is issued with what is left of it, " +
      "never a second full one — so `MAX_ATTEMPTS` cannot double the pass's arithmetic",
    async () => {
      createMock.mockResolvedValueOnce(textMessage({ wrong: "shape" }));
      createMock.mockResolvedValueOnce(textMessage({ headline: "ok" }));

      await llm(fakeCostContext().ctx, { site: "profile", input: {}, schema: SCHEMA, tier: "nano" });

      expect(createMock).toHaveBeenCalledTimes(2);
      // Every attempt carries what is left of the one budget as its own
      // request bound: the first has all of it, the retry no more than the
      // first had.
      const first = createMock.mock.calls[0]![1] as { timeout: number };
      const retry = createMock.mock.calls[1]![1] as { timeout: number };
      expect(first.timeout).toBeLessThanOrEqual(15_000);
      expect(first.timeout).toBeGreaterThan(14_000);
      expect(retry.timeout).toBeGreaterThan(0);
      expect(retry.timeout).toBeLessThanOrEqual(first.timeout);
      // Each attempt builds its client from the same pin — the budget is
      // the tier's, not the attempt's — and it is the request bound above,
      // never the constructor's, that shrinks across the two.
      expect(constructedWith.map((c) => c.timeout)).toEqual([15_000, 15_000]);
    }
  );
});

describe("llm() — the failure class the log names (issue #452)", () => {
  async function failWith(error: unknown): Promise<Record<string, unknown>> {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    createMock.mockRejectedValueOnce(error);
    await llm(fakeCostContext().ctx, { site: "profile", input: {}, schema: SCHEMA, tier: "nano" });
    return JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
  }

  it("a timeout is logged as `timeout`, not as the bare `unavailable` a live run cannot act on", async () => {
    const logged = await failWith(new ApiConnectionTimeout());
    expect(logged.parseOutcome).toBe("unavailable");
    expect(logged.failure).toBe("timeout");
  });

  it.each([429, 500, 529])("an HTTP %s is logged with the vendor's own status", async (status) => {
    const logged = await failWith(apiError(status));
    expect(logged.failure).toBe(`http_${status}`);
  });

  it("a transport failure of no other shape is logged as `vendor` — never as a message", async () => {
    const logged = await failWith(new Error("connection refused to 10.0.0.1"));
    expect(logged.failure).toBe("vendor");
    expect(JSON.stringify(logged)).not.toContain("10.0.0.1");
    expect(JSON.stringify(logged)).not.toContain("connection refused");
  });

  it("responses that never conform to the schema are logged as `parse`", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    createMock.mockResolvedValueOnce(textMessage({ wrong: "shape" }));
    createMock.mockResolvedValueOnce(textMessage({ wrong: "shape" }));

    await llm(fakeCostContext().ctx, { site: "profile", input: {}, schema: SCHEMA, tier: "nano" });

    const logged = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(logged.parseOutcome).toBe("unparseable");
    expect(logged.failure).toBe("parse");
  });

  it("a successful call carries no `failure` key at all — BP-009's six fields, unchanged", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    createMock.mockResolvedValueOnce(textMessage({ headline: "ok" }));

    await llm(fakeCostContext().ctx, { site: "profile", input: {}, schema: SCHEMA, tier: "nano" });

    const logged = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(Object.keys(logged)).not.toContain("failure");
  });

  it("the cap's own `not_attempted` is not a failure — nothing reached the vendor, so nothing is classified", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await llm(cappedCostContext().ctx, { site: "profile", input: {}, schema: SCHEMA, tier: "nano" });

    const logged = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(logged.parseOutcome).toBe("not_attempted");
    expect(Object.keys(logged)).not.toContain("failure");
  });
});

describe("llm() — the output budget is the call site's own (issue #462)", () => {
  it("every call site's pinned budget is what the request carries as `max_tokens`", async () => {
    for (const site of Object.keys(INFERENCE_MAX_OUTPUT_TOKENS) as (keyof typeof INFERENCE_MAX_OUTPUT_TOKENS)[]) {
      createMock.mockReset();
      createMock.mockResolvedValueOnce(textMessage({ headline: "ok" }));
      await llm(fakeCostContext().ctx, { site, input: {}, schema: SCHEMA, tier: "nano" });
      const sent = createMock.mock.calls[0]![0] as { max_tokens: number };
      expect(sent.max_tokens).toBe(INFERENCE_MAX_OUTPUT_TOKENS[site]);
    }
  });

  it("the profile's budget is far below the seam's old 4 096 — a seven-field answer cannot spend the whole call", () => {
    expect(INFERENCE_MAX_OUTPUT_TOKENS.profile).toBeLessThanOrEqual(700);
    expect(INFERENCE_MAX_OUTPUT_TOKENS.profile).toBeLessThan(4096);
    for (const budget of Object.values(INFERENCE_MAX_OUTPUT_TOKENS)) {
      expect(budget).toBeGreaterThan(0);
      expect(budget).toBeLessThanOrEqual(4096);
    }
  });

  it("the up-front reservation is sized from the site's budget, not a seam-wide ceiling", async () => {
    createMock.mockResolvedValueOnce(textMessage({ headline: "ok" }));
    const { ctx, calls } = fakeCostContext();

    await llm(ctx, { site: "profile", input: {}, schema: SCHEMA, tier: "nano" });

    // `{}` is two characters: one estimated input token, per attempt, two
    // attempts; the output side is the site's pin, per attempt. BP-005's
    // formula recomputed here rather than imported, at Haiku's rates — the
    // nano tier is priced at Haiku's row since the owner's ruling (#517).
    const expected = ((1 * 2) / 1_000_000) * 100 + ((INFERENCE_MAX_OUTPUT_TOKENS.profile * 2) / 1_000_000) * 500;
    expect(calls[0]!.costCents).toBeCloseTo(expected, 9);
    expect(calls[0]!.costCents).toBeLessThan(((4096 * 2) / 1_000_000) * 500);
  });
});

describe("llm() — an answer that came back and missed is a `parse` failure, never a `timeout` (issue #462)", () => {
  const PROFILE_LIKE = z.strictObject({
    category: z.string(),
    vocabulary: z.array(z.string()).max(2),
  });

  function loggedLine(logSpy: { mock: { calls: unknown[][] } }): Record<string, unknown> {
    return JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
  }

  it(
    "M3 run 4b: attempt 1 returns after the whole budget, does not parse, and no retry is possible — " +
      "logged `unparseable` / `parse` with `retryExhausted: \"budget\"`, the schema paths, and no value",
    async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      let now = 1_000_000;
      vi.spyOn(Date, "now").mockImplementation(() => now);
      const valueMarker = "VOCABULARY-VALUE-MARKER-2b7e";
      createMock.mockImplementationOnce(async () => {
        now += 15_004; // the answer arrives as the 15 s budget runs out
        return textMessage(
          { category: "c", vocabulary: [valueMarker, "b", "c"], [valueMarker]: "extra field" },
          3191,
          888
        );
      });

      const result = await llm(fakeCostContext().ctx, {
        site: "profile",
        input: {},
        schema: PROFILE_LIKE,
        tier: "nano",
      });

      expect(createMock).toHaveBeenCalledTimes(1); // no time for the retry
      expect(result).toMatchObject({ kind: "unmeasured", reason: "undeterminable" });
      const logged = loggedLine(logSpy);
      expect(logged.parseOutcome).toBe("unparseable");
      expect(logged.failure).toBe("parse");
      expect(logged.failure).not.toBe("timeout");
      expect(logged.retryExhausted).toBe("budget");
      expect(logged.parseFailure).toBe("schema");
      expect(logged.schemaIssues).toEqual(
        expect.arrayContaining(["vocabulary:too_big", "(root):unrecognized_keys"])
      );
      expect(logged.tokensOut).toBe(888);
      // Field names and Zod's codes only — never a value, and never the
      // name of a key the model itself invented.
      expect(JSON.stringify(logged)).not.toContain(valueMarker);
      expect(JSON.stringify(logged)).not.toContain("extra field");
    }
  );

  it("a call that never got an answer and ran out of budget is still a `timeout`", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    createMock.mockRejectedValueOnce(new ApiConnectionTimeout());

    await llm(fakeCostContext().ctx, { site: "profile", input: {}, schema: PROFILE_LIKE, tier: "nano" });

    const logged = loggedLine(logSpy);
    expect(logged.failure).toBe("timeout");
    expect(Object.keys(logged)).not.toContain("retryExhausted");
    expect(Object.keys(logged)).not.toContain("parseFailure");
  });

  it("two answers that both miss read `retryExhausted: \"attempts\"` — the retry was possible and was spent", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    createMock.mockResolvedValueOnce(textMessage({ category: "c", vocabulary: ["a", "b", "c"] }));
    createMock.mockResolvedValueOnce(textMessage({ category: 7, vocabulary: [1, "b"] }));

    await llm(fakeCostContext().ctx, { site: "profile", input: {}, schema: PROFILE_LIKE, tier: "nano" });

    expect(createMock).toHaveBeenCalledTimes(2);
    const logged = loggedLine(logSpy);
    expect(logged.failure).toBe("parse");
    expect(logged.retryExhausted).toBe("attempts");
    expect(logged.parseFailure).toBe("schema");
    // The last miss is the one reported; array positions collapse to `[]`.
    expect([...(logged.schemaIssues as string[])].sort()).toEqual(
      ["category:invalid_type", "vocabulary[]:invalid_type"].sort()
    );
  });

  it("an answer that is not JSON at all — a code fence, prose, a cut-off answer — reads `parseFailure: \"json\"`, with no schema paths", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fenced = {
      content: [{ type: "text", text: "```json\n{\"category\": \"c\"" }],
      usage: { input_tokens: 10, output_tokens: 700 },
    };
    createMock.mockResolvedValueOnce(fenced);
    createMock.mockResolvedValueOnce(fenced);

    await llm(fakeCostContext().ctx, { site: "profile", input: {}, schema: PROFILE_LIKE, tier: "nano" });

    const logged = loggedLine(logSpy);
    expect(logged.failure).toBe("parse");
    expect(logged.parseFailure).toBe("json");
    expect(Object.keys(logged)).not.toContain("schemaIssues");
    // Its shape, never its text (issue #512).
    expect(logged.textStart).toBe("fence");
    expect(logged.textLength).toBe(fenced.content[0]!.text.length);
  });

  it("a miss followed by a conforming retry is a success, and its line carries none of the failure fields", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    createMock.mockResolvedValueOnce(textMessage({ category: 7, vocabulary: [] }));
    createMock.mockResolvedValueOnce(textMessage({ category: "c", vocabulary: [] }));

    await llm(fakeCostContext().ctx, { site: "profile", input: {}, schema: PROFILE_LIKE, tier: "nano" });

    const logged = loggedLine(logSpy);
    expect(logged.parseOutcome).toBe("success");
    expect(Object.keys(logged).sort()).toEqual(
      ["costCents", "durationMs", "parseOutcome", "site", "tier", "tokensIn", "tokensOut"].sort()
    );
  });
});

describe("llm() — structured output: the call site's schema as one forced tool (issue #512)", () => {
  /** What the vendor's `tool_use.name` may carry. */
  const TOOL_NAME = /^[a-zA-Z0-9_-]{1,128}$/;

  function sentRequest(index = 0): Record<string, unknown> {
    return createMock.mock.calls[index]![0] as Record<string, unknown>;
  }

  it("every call site's request carries exactly one tool — its schema as JSON Schema — and forces it", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    for (const site of Object.keys(INFERENCE_MAX_OUTPUT_TOKENS) as (keyof typeof INFERENCE_MAX_OUTPUT_TOKENS)[]) {
      createMock.mockReset();
      createMock.mockResolvedValueOnce(toolUseMessage({ headline: "ok" }));
      await llm(fakeCostContext().ctx, { site, input: {}, schema: SCHEMA, tier: "nano" });

      const sent = sentRequest();
      const name = site.replace(/[^a-zA-Z0-9_-]/g, "_");
      expect(name).toMatch(TOOL_NAME);
      expect(sent.tools).toEqual([
        {
          name,
          input_schema: {
            type: "object",
            properties: { headline: { type: "string" } },
            required: ["headline"],
            additionalProperties: false,
          },
        },
      ]);
      expect(sent.tool_choice).toEqual({ type: "tool", name });
    }
  });

  it("a dotted call site is named with `_` — `generate.brief` is not a tool name the vendor accepts", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    createMock.mockResolvedValueOnce(toolUseMessage({ headline: "ok" }));
    await llm(fakeCostContext().ctx, { site: "generate.brief", input: {}, schema: SCHEMA, tier: "nano" });
    expect((sentRequest().tool_choice as { name: string }).name).toBe("generate_brief");
  });

  it("the `tool_use` block's input is the value — measured on the first attempt, with no text parsed", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const message = toolUseMessage({ headline: "from the tool" });
    // A preamble the model may still write beside the call is not read.
    message.content.unshift({ type: "text", text: "Sure, here it is:" } as never);
    createMock.mockResolvedValueOnce(message);

    const result = await llm(fakeCostContext().ctx, { site: "profile", input: {}, schema: SCHEMA, tier: "nano" });

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ kind: "measured", value: { headline: "from the tool" } });
  });

  it("the Zod schema stays the gate on the tool path — a non-conforming input is a `schema` miss, retried once, never returned", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    createMock.mockResolvedValueOnce(toolUseMessage({ wrong: "shape" }));
    createMock.mockResolvedValueOnce(toolUseMessage({ headline: 7 }));

    const result = await llm(fakeCostContext().ctx, { site: "profile", input: {}, schema: SCHEMA, tier: "nano" });

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ kind: "unmeasured", reason: "undeterminable" });
    const logged = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(logged.parseFailure).toBe("schema");
    expect(logged.schemaIssues).toEqual(["headline:invalid_type"]);
    expect(Object.keys(logged)).not.toContain("textStart");
  });

  it("`question-phrasing` rides the same path: its list wrapped in `questions`, sent as a forced tool, unwrapped after parsing", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { phraseQuestions } = await import("../../src/lib/market/questions/phrase.ts");
    createMock.mockResolvedValueOnce(
      toolUseMessage({ questions: [{ id: "q1", text: "Which onboarding tool is best?" }] }, 100, 50, "question-phrasing")
    );

    const result = await phraseQuestions(fakeCostContext().ctx, {
      selected: [
        { keyword: "best user onboarding software", volume: 2400, intent: "decision", score: 10.1, rank: 1 },
      ] as never,
    });

    const sent = sentRequest();
    expect(sent.tool_choice).toEqual({ type: "tool", name: "question-phrasing" });
    const tool = (sent.tools as { input_schema: { type: string; properties: Record<string, unknown> } }[])[0]!;
    expect(tool.input_schema.type).toBe("object");
    expect(Object.keys(tool.input_schema.properties)).toEqual(["questions"]);
    expect(JSON.stringify(result)).toContain("Which onboarding tool is best?");
  });

  it("a schema whose JSON Schema is not an object goes out as plain text, with no tool, and the text is read", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    createMock.mockResolvedValueOnce(textMessage(["a", "b"]));

    const result = await llm(fakeCostContext().ctx, {
      site: "profile",
      input: {},
      schema: z.array(z.string()),
      tier: "nano",
    });

    expect(Object.keys(sentRequest())).not.toContain("tools");
    expect(Object.keys(sentRequest())).not.toContain("tool_choice");
    expect(result).toMatchObject({ kind: "measured", value: ["a", "b"] });
  });
});

describe("llm() — the text path tolerates a fence and prose around the object (issue #512)", () => {
  async function readText(text: string) {
    vi.spyOn(console, "log").mockImplementation(() => {});
    createMock.mockResolvedValueOnce(rawTextMessage(text));
    createMock.mockResolvedValueOnce(rawTextMessage(text));
    return llm(fakeCostContext().ctx, { site: "profile", input: {}, schema: SCHEMA, tier: "nano" });
  }

  it("a fenced answer parses — the fence is stripped, on the first attempt", async () => {
    const result = await readText('```json\n{"headline": "fenced"}\n```');
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ kind: "measured", value: { headline: "fenced" } });
  });

  it("a fence with no language tag parses too", async () => {
    const result = await readText('```\n{"headline": "bare fence"}\n```\n');
    expect(result).toMatchObject({ kind: "measured", value: { headline: "bare fence" } });
  });

  it("a sentence before the object parses — the first balanced object is read", async () => {
    const result = await readText('Here is the JSON you asked for: {"headline": "after a sentence"}');
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ kind: "measured", value: { headline: "after a sentence" } });
  });

  it("trailing prose after the object parses", async () => {
    const result = await readText('{"headline": "before prose"}\n\nLet me know if you need anything else.');
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ kind: "measured", value: { headline: "before prose" } });
  });

  it("a bracketed aside before the object, and a brace inside a string, do not throw the count", async () => {
    const result = await readText('The answer [draft]: {"headline": "a } inside \\"quotes\\""} — that\'s all.');
    expect(result).toMatchObject({ kind: "measured", value: { headline: 'a } inside "quotes"' } });
  });

  it("nothing is coerced: a balanced object the schema refuses is still a `schema` miss", async () => {
    const result = await readText('Sure: {"wrong": "shape"} and that is it.');
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ kind: "unmeasured", reason: "undeterminable" });
  });
});

describe("llm() — a `json` miss logs the text's shape, never the text (issue #512)", () => {
  it.each([
    ["", "empty"],
    ["   \n ", "empty"],
    ['```json\n{"headline": "cut', "fence"],
    ['{"headline": "cut off at max_tok', "brace"],
    ['[{"headline": ', "bracket"],
    ["I could not read that page, sorry.", "letter"],
    ["  Écrit en prose.", "letter"],
    ["42 is not an object", "other"],
  ])("%j reads textStart %s and its length", async (text, textStart) => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    createMock.mockResolvedValueOnce(rawTextMessage(text));
    createMock.mockResolvedValueOnce(rawTextMessage(text));

    await llm(fakeCostContext().ctx, { site: "profile", input: {}, schema: SCHEMA, tier: "nano" });

    const logged = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(logged.failure).toBe("parse");
    expect(logged.parseFailure).toBe("json");
    expect(logged.textStart).toBe(textStart);
    expect(logged.textLength).toBe(text.length);
  });

  it("no character of the text reaches the log", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const marker = "COMPLETION-TEXT-MARKER-9c1d";
    createMock.mockResolvedValueOnce(rawTextMessage(`${marker} is what I found.`));
    createMock.mockResolvedValueOnce(rawTextMessage(`${marker} is what I found.`));

    await llm(fakeCostContext().ctx, { site: "profile", input: {}, schema: SCHEMA, tier: "nano" });

    for (const call of logSpy.mock.calls) expect(JSON.stringify(call)).not.toContain(marker);
    const logged = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(Object.keys(logged).sort()).toEqual(
      [
        "costCents",
        "durationMs",
        "failure",
        "parseFailure",
        "parseOutcome",
        "retryExhausted",
        "site",
        "textLength",
        "textStart",
        "tier",
        "tokensIn",
        "tokensOut",
      ].sort()
    );
  });
});
