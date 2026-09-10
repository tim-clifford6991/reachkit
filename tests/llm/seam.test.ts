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
  constructedWith: [] as { apiKey: string; timeout: number }[],
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    constructor(opts: { apiKey: string; timeout: number }) {
      constructedWith.push(opts);
    }
    messages = { create: createMock };
  },
}));

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

function textMessage(value: unknown, tokensIn = 100, tokensOut = 50) {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    usage: { input_tokens: tokensIn, output_tokens: tokensOut },
  };
}

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

    await llm(ctx, { site: "claim-check", input: {}, schema: SCHEMA, tier: "nano" });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.source).toBe("claim-check");
  });
});

describe("llm() — spend accounting seam (mutation probe 1)", () => {
  it("every call reserves and settles cost through `recordFetch`, and the settled figure tracks the vendor's own reported tokens — not a guess", async () => {
    createMock.mockResolvedValueOnce(textMessage({ headline: "ok" }, 1000, 200));
    const { ctx, calls } = fakeCostContext();

    const result = await llm(ctx, { site: "brief", input: {}, schema: SCHEMA, tier: "nano" });

    expect(result.kind).toBe("measured");
    expect(calls).toHaveLength(1);
    expect(typeof calls[0]!.settleCents).toBe("function");
    // BP-005's own formula, transcribed at `tiers.ts`'s `costCentsFor` —
    // recomputed here independently rather than importing that function,
    // so a bug in the formula itself cannot cancel out against this
    // assertion.
    const expectedCents = (1000 / 1_000_000) * 20 + (200 / 1_000_000) * 125;
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
      "both wrong together; `INFERENCE_PRICE_BOOK`, untouched, still prices and times the two " +
      "tiers differently, so a swap between *those* two still fails — see the next test)",
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

  it("nano and haiku stay priced and timed differently even while they share a model id — a swap of `INFERENCE_PRICE_BOOK`'s two tiers (BP-005's own pin, untouched by this file) still fails here", () => {
    const nano = tierBinding("nano");
    const haiku = tierBinding("haiku");
    expect(nano.inCentsPerM).toBe(20);
    expect(nano.outCentsPerM).toBe(125);
    expect(haiku.inCentsPerM).toBe(100);
    expect(haiku.outCentsPerM).toBe(500);
    expect(nano.inCentsPerM).not.toBe(haiku.inCentsPerM);
    expect(nano.timeoutMs).not.toBe(haiku.timeoutMs);
  });

  it("a caller's own extra 'model' field can never shadow the tier's pinned model id — `llm()` reads only `call.tier`, never spreads `call`", async () => {
    createMock.mockResolvedValueOnce(textMessage({ headline: "ok" }));
    const { ctx } = fakeCostContext();

    const shadowingCall = {
      site: "profile",
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
      site: "profile",
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
      site: "answerability",
      input: { text: promptMarker },
      schema: SCHEMA,
      tier: "haiku",
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(Object.keys(logged).sort()).toEqual(
      ["costCents", "durationMs", "parseOutcome", "site", "tier", "tokensIn", "tokensOut"].sort()
    );
    expect(logged.site).toBe("answerability");
    expect(logged.tier).toBe("haiku");
    expect(logged.tokensIn).toBe(42);
    expect(logged.tokensOut).toBe(17);
    expect(logged.parseOutcome).toBe("success");

    const loggedString = JSON.stringify(logged);
    expect(loggedString).not.toContain(promptMarker);
    expect(loggedString).not.toContain(completionMarker);
  });
});

describe("llm() — p95 latency budget (BP-009 `## NFR budget`)", () => {
  it("each tier's configured timeout matches its stated budget: nano ≤ 3 s, haiku ≤ 20 s", () => {
    expect(tierBinding("nano").timeoutMs).toBe(3000);
    expect(tierBinding("haiku").timeoutMs).toBe(20000);
  });

  it("the configured timeout reaches the vendor client construction", async () => {
    createMock.mockResolvedValueOnce(textMessage({ headline: "ok" }));
    await llm(fakeCostContext().ctx, { site: "profile", input: {}, schema: SCHEMA, tier: "haiku" });
    expect(constructedWith[0]!.timeout).toBe(20000);

    createMock.mockResolvedValueOnce(textMessage({ headline: "ok" }));
    await llm(fakeCostContext().ctx, { site: "profile", input: {}, schema: SCHEMA, tier: "nano" });
    expect(constructedWith[1]!.timeout).toBe(3000);
  });
});
