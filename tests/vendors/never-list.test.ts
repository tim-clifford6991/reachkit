// tests/vendors/never-list.test.ts — WO-023 `## Test plan`, all 5 rows.
//
// Risk: high (money, data leaving the system — the only place the vendor
// credential is read, and the never-list is enforced by a function's
// *absence*). Mutation-tested (doctrine 0.13.2): every row below is
// written so that deleting or inverting the behaviour it names breaks it,
// and the never-list row in particular is written so that *adding* a
// forbidden export breaks it too — see this file's own header note on the
// probe the implementer ran (WO-023 return).
//
// Signature note (see `src/lib/vendors/dataforseo/index.ts`'s header,
// rule 4.2): this file is written to *current* BP-008 (amended by
// ADR-094), not to WO-023's own stale `## Interfaces`/`## Test plan` text.
// `serpOrganic`'s `loadAsyncAiOverview` is the never-list's one admitted
// exception — required, boolean, on that one function only — and rows 1
// and 5 below assert that shape rather than treating the flag as wholly
// forbidden.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// A complete, validly-shaped set of the bindings `env.ts` requires
// (BP-005, moved onto decision 6) — the same fixture shape
// `tests/db/clients.test.ts` and `tests/scan/free/admission-check.test.ts`
// use. None of these tests reach a real vendor (`tests/setup.ts` fails any
// test that tries); the fixture only needs to satisfy `env.ts`'s schema.
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

let dataforseo: typeof import("../../src/lib/vendors/dataforseo/index.ts");
let transport: typeof import("../../src/lib/vendors/dataforseo/transport.ts");
let constants: typeof import("../../src/lib/config/constants.ts");

beforeAll(async () => {
  for (const [key, value] of Object.entries(ENV_FIXTURE)) process.env[key] = value;
  dataforseo = await import("../../src/lib/vendors/dataforseo/index.ts");
  transport = await import("../../src/lib/vendors/dataforseo/transport.ts");
  constants = await import("../../src/lib/config/constants.ts");
});

const SIX_EXPORTS = [
  "aiMode",
  "competitorsDomain",
  "keywordSuggestions",
  "llmScraper",
  "rankedKeywords",
  "serpOrganic",
] as const;

describe('BP-008 error behaviour — "The never-list is enforced by absence" (WO-023 test-plan row 1)', () => {
  it("the module's exported (runtime) function set is exactly the six named — nothing more, nothing fewer", () => {
    const keys = Object.keys(dataforseo).sort();
    expect(keys).toEqual([...SIX_EXPORTS].sort());
  });

  it("every export is a function", () => {
    for (const name of SIX_EXPORTS) {
      expect(typeof dataforseo[name]).toBe("function");
    }
  });
});

describe('BP-008 decision 1 — "a generic dataforseo(endpoint, params) with a runtime allow-list — rejected" (WO-023 test-plan row 2)', () => {
  it('no export is named "dataforseo", "call", "request" or "fetch" — the shape a runtime allow-list would take', () => {
    const keys = Object.keys(dataforseo);
    for (const forbidden of ["dataforseo", "call", "request", "fetch", "invoke", "run"]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  // Type-level (checked by `npm run typecheck`, never executed — the same
  // convention `tests/config/env.test.ts`'s `_nanoApiKeyRejectsUndefined`
  // uses). None of the six functions takes an endpoint-name argument, so
  // none can be called with one.
  function _noExportTakesAnEndpointName(): void {
    // @ts-expect-error — rankedKeywords's second argument has no `endpoint`
    // field; a generic-allow-list shape would compile here instead.
    void dataforseo.rankedKeywords(null as never, { endpoint: "labs/ranked_keywords", domain: "x", rows: 50 });
  }
  void _noExportTakesAnEndpointName;
});

// BP-008 error behaviour — never-list signatures (WO-023 test-plan row 1,
// mode-required row 5). Type-level witnesses only, checked by
// `npm run typecheck`, never executed — same convention
// `tests/config/env.test.ts`'s `_nanoApiKeyRejectsUndefined` uses, and kept
// at file scope (not inside a `describe`) for the same reason that file
// keeps them there: a `describe` housing only uncalled functions and no
// `it` is an empty suite and fails the run on its own.
{
  // Type-level witnesses: every forbidden shape below must be a compile
  // error (`@ts-expect-error`), which `npm run typecheck` enforces. A
  // signature that *did* admit one of these would make the directive
  // "unused" and fail typecheck on its own — see this file's header note.
  function _noSignatureAdmitsForbiddenArguments(): void {
    // depth — SERP depth is fixed to 10 inside transport.ts, never a
    // caller argument, on every one of the six functions.
    // @ts-expect-error — rankedKeywords admits no `depth`.
    void dataforseo.rankedKeywords(null as never, { domain: "x", rows: 50, depth: 20 });
    // @ts-expect-error — serpOrganic admits no `depth`.
    void dataforseo.serpOrganic(null as never, { query: "x", mode: "std", loadAsyncAiOverview: false, depth: 20 });

    // search operators — a raw query-operator string (site:, intitle:, etc.)
    // has no dedicated parameter anywhere on the six functions; the only
    // string arguments are `domain`, `seed` and `query`, and none accepts
    // an `operators` field.
    // @ts-expect-error — serpOrganic admits no `operators`.
    void dataforseo.serpOrganic(null as never, { query: "x", mode: "std", loadAsyncAiOverview: false, operators: "site:" });

    // clickstream flags — no function admits one.
    // @ts-expect-error — rankedKeywords admits no clickstream flag.
    void dataforseo.rankedKeywords(null as never, { domain: "x", rows: 50, clickstream: true });

    // load_async_ai_overview — admitted **only** on serpOrganic, as
    // `loadAsyncAiOverview` (camelCase, this module's own product-typed
    // argument, never the vendor's snake_case field name), and required.
    // Every other function still admits nothing of the kind.
    // @ts-expect-error — aiMode admits no loadAsyncAiOverview.
    void dataforseo.aiMode(null as never, { query: "x", mode: "std", loadAsyncAiOverview: false });
    // @ts-expect-error — keywordSuggestions admits no loadAsyncAiOverview.
    void dataforseo.keywordSuggestions(null as never, { seed: "x", rows: 50, loadAsyncAiOverview: false });
    // @ts-expect-error — competitorsDomain admits no loadAsyncAiOverview.
    void dataforseo.competitorsDomain(null as never, { domain: "x", loadAsyncAiOverview: false });
  }
  void _noSignatureAdmitsForbiddenArguments;

  // The positive half of the same row: serpOrganic's admitted exception is
  // required, not optional — omitting it is a compile error, same pattern
  // as `mode` (BP-008 decision 2, WO-023 test-plan row 5).
  function _loadAsyncAiOverviewIsRequiredOnServeOrganic(): void {
    // @ts-expect-error — loadAsyncAiOverview omitted.
    void dataforseo.serpOrganic(null as never, { query: "x", mode: "std" });
  }
  void _loadAsyncAiOverviewIsRequiredOnServeOrganic;
}

// BP-008 decision 2 — "mode is required, never defaulted" (WO-023 test-plan
// row 5). Type-level witnesses only; see the comment above this file's
// first such block for why these sit outside a `describe`.
{
  function _serpOrganicRequiresMode(): void {
    // @ts-expect-error — mode omitted.
    void dataforseo.serpOrganic(null as never, { query: "x", loadAsyncAiOverview: false });
  }
  void _serpOrganicRequiresMode;

  function _aiModeRequiresMode(): void {
    // @ts-expect-error — mode omitted.
    void dataforseo.aiMode(null as never, { query: "x" });
  }
  void _aiModeRequiresMode;

  function _llmScraperRequiresMode(): void {
    // @ts-expect-error — mode omitted.
    void dataforseo.llmScraper(null as never, { query: "x" });
  }
  void _llmScraperRequiresMode;
}

describe('BP-008 public interface — "Every call is fixed to SERP_LOCATION … and depth 10" (WO-023 test-plan row 3)', () => {
  it("buildRequest sets location_name and language_code from SERP_LOCATION and depth to 10 on a request with no such fields", () => {
    const req = transport.buildRequest({ path: "/v3/serp/google/organic/live/advanced", mode: "live", fields: { keyword: "x" } });
    const task = JSON.parse(req.body)[0];
    expect(task.location_name).toBe(constants.SERP_LOCATION.location);
    expect(task.language_code).toBe(constants.SERP_LOCATION.language);
    expect(task.depth).toBe(10);
  });

  it("a caller-supplied location_name, language_code or depth is overridden, not merged — no way to override", () => {
    const req = transport.buildRequest({
      path: "/v3/serp/google/organic/live/advanced",
      mode: "live",
      fields: { location_name: "Nowhere", language_code: "zz", depth: 999 },
    });
    const task = JSON.parse(req.body)[0];
    expect(task.location_name).toBe(constants.SERP_LOCATION.location);
    expect(task.language_code).toBe(constants.SERP_LOCATION.language);
    expect(task.depth).toBe(10);
  });
});

describe('BP-008 error behaviour — "Credentials come from BP-005\'s env and never appear in a log, a payload or an error message" (WO-023 test-plan row 4)', () => {
  // The raw plaintext strings, **and** the Basic-auth token the transport
  // derives from them — a log that stringifies the finished `Authorization`
  // header leaks the credential just as surely as one that stringifies the
  // raw fields, and a check for only the plaintext strings is vacuous
  // against exactly that mistake (the base64 form contains neither
  // substring verbatim). Caught by mutation probe during implementation:
  // logging `request.headers` on a failure path passed the plaintext-only
  // version of this check and failed once the encoded form was added.
  const BASIC_TOKEN = Buffer.from(`${ENV_FIXTURE.DATAFORSEO_LOGIN}:${ENV_FIXTURE.DATAFORSEO_PASSWORD}`).toString("base64");
  const SECRETS = [ENV_FIXTURE.DATAFORSEO_LOGIN, ENV_FIXTURE.DATAFORSEO_PASSWORD, BASIC_TOKEN, `Basic ${BASIC_TOKEN}`];

  function assertNoSecretIn(value: unknown): void {
    const text = value === undefined ? "undefined" : typeof value === "string" ? value : JSON.stringify(value);
    for (const secret of SECRETS) {
      expect(text).not.toContain(secret);
    }
  }

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("the request's own Authorization header does carry the credential (sanity: the transport is not silently unauthenticated)", () => {
    const req = transport.buildRequest({ path: "/v3/serp/google/organic/live/advanced", mode: "live" });
    const expected = `Basic ${Buffer.from(`${ENV_FIXTURE.DATAFORSEO_LOGIN}:${ENV_FIXTURE.DATAFORSEO_PASSWORD}`).toString("base64")}`;
    expect(req.headers.Authorization).toBe(expected);
  });

  it("a rejected fetch produces an outcome, a console record, and (if anything is thrown) a thrown value that never contain the credential", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 203.0.113.9:443")));

    let thrown: unknown;
    let outcome: Awaited<ReturnType<typeof transport.sendRequest>> | undefined;
    try {
      outcome = await transport.sendRequest({ path: "/v3/serp/google/organic/live/advanced", mode: "live", fields: { keyword: "x" } });
    } catch (error) {
      thrown = error;
    }

    assertNoSecretIn(outcome);
    assertNoSecretIn(thrown instanceof Error ? thrown.message : thrown);

    const logCalls = [...vi.mocked(console.log).mock.calls, ...vi.mocked(console.warn).mock.calls, ...vi.mocked(console.error).mock.calls];
    for (const call of logCalls) assertNoSecretIn(call);

    // And the failure is legible as a failure — never silently swallowed.
    expect(outcome).toEqual({ ok: false, failure: "transport", reason: expect.stringContaining("dataforseo") });
  });

  it("a non-2xx vendor response produces an outcome and console record that never contain the credential", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({}),
      })
    );

    const outcome = await transport.sendRequest({ path: "/v3/serp/google/organic/live/advanced", mode: "live" });
    assertNoSecretIn(outcome);
    expect(outcome.ok).toBe(false);

    const logCalls = [...vi.mocked(console.log).mock.calls, ...vi.mocked(console.warn).mock.calls, ...vi.mocked(console.error).mock.calls];
    for (const call of logCalls) assertNoSecretIn(call);
  });

  it("a successful response's outcome payload carries only the parsed body — no header, no request echo", async () => {
    const body = { tasks: [{ result: [{ keyword: "x" }] }] };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => body,
      })
    );

    const outcome = await transport.sendRequest<typeof body>({ path: "/v3/serp/google/organic/live/advanced", mode: "live" });
    expect(outcome).toEqual({ ok: true, payload: body });
    assertNoSecretIn(outcome);
  });
});
