import { beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeScanCtx() {
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 500 });
  return {
    scanId: "scan-check-link-test-1",
    mode: "web" as const,
    budget,
  };
}

function mockFetch(response: { ok: boolean; body: string } | "throw") {
  const impl =
    response === "throw"
      ? vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))
      : vi.fn().mockResolvedValue({
          ok: response.ok,
          text: async () => response.body,
        });
  vi.stubGlobal("fetch", impl);
  return impl;
}

// ---------------------------------------------------------------------------
// Normal path — entailment parse returns { entails, reason }
// ---------------------------------------------------------------------------
describe("checkLink — normal path (callModel returns valid JSON)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  test("returns { entails: true, reason } when model says entails", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify({ entails: true, reason: "The source text supports the claim." }),
        usage: { inputTokens: 100, outputTokens: 30 },
      }),
    }));
    mockFetch({
      ok: true,
      body: "<html><body><p>This source explicitly supports the claim being made.</p></body></html>",
    });

    const { checkLink } = await import("./check-link");
    const ctx = await makeScanCtx();
    const result = await checkLink.run(
      { url: "https://example.com/article", claim: "This source explicitly supports the claim." },
      ctx,
    );

    expect(result.entails).toBe(true);
    expect(typeof result.reason).toBe("string");
    expect(result.reason.length).toBeGreaterThan(0);
  });

  test("returns { entails: false, reason } when model says does not entail", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify({ entails: false, reason: "The source does not mention the claim." }),
        usage: { inputTokens: 100, outputTokens: 30 },
      }),
    }));
    mockFetch({
      ok: true,
      body: "<html><body><p>Unrelated content about gardening.</p></body></html>",
    });

    const { checkLink } = await import("./check-link");
    const ctx = await makeScanCtx();
    const result = await checkLink.run(
      { url: "https://example.com/gardening", claim: "The sky is blue." },
      ctx,
    );

    expect(result.entails).toBe(false);
    expect(typeof result.reason).toBe("string");
  });

  test("callModel called with model=claude-haiku-4-5-20251001, stage=critic", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    const callModelMock = vi.fn().mockResolvedValue({
      text: JSON.stringify({ entails: true, reason: "Supported." }),
      usage: { inputTokens: 100, outputTokens: 30 },
    });
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));
    mockFetch({ ok: true, body: "<html><body><p>Some content here.</p></body></html>" });

    const { checkLink } = await import("./check-link");
    const ctx = await makeScanCtx();
    await checkLink.run(
      { url: "https://example.com", claim: "Some content here." },
      ctx,
    );

    expect(callModelMock).toHaveBeenCalledOnce();
    const args = callModelMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.model).toBe("claude-haiku-4-5-20251001");
    expect(args.stage).toBe("critic");
    expect(args.scanId).toBe("scan-check-link-test-1");
    expect(args.maxTokens).toBe(256);
  });
});

// ---------------------------------------------------------------------------
// Fail-closed: empty / unreachable source → { entails: false }, no callModel
// ---------------------------------------------------------------------------
describe("checkLink — fail-closed: unreachable source", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  test("fetch throws → entails:false without calling callModel", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    const callModelMock = vi.fn();
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));
    mockFetch("throw");

    const { checkLink } = await import("./check-link");
    const ctx = await makeScanCtx();
    const result = await checkLink.run(
      { url: "https://unreachable.invalid/page", claim: "Some claim." },
      ctx,
    );

    expect(result.entails).toBe(false);
    expect(result.reason).toBe("source unreachable/empty");
    expect(callModelMock).not.toHaveBeenCalled();
  });

  test("fetch returns non-ok response → entails:false without calling callModel", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    const callModelMock = vi.fn();
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));
    mockFetch({ ok: false, body: "" });

    const { checkLink } = await import("./check-link");
    const ctx = await makeScanCtx();
    const result = await checkLink.run(
      { url: "https://example.com/404", claim: "Some claim." },
      ctx,
    );

    expect(result.entails).toBe(false);
    expect(result.reason).toBe("source unreachable/empty");
    expect(callModelMock).not.toHaveBeenCalled();
  });

  test("fetch returns empty body after HTML parsing → entails:false without calling callModel", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    const callModelMock = vi.fn();
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));
    mockFetch({ ok: true, body: "<html><body></body></html>" });

    const { checkLink } = await import("./check-link");
    const ctx = await makeScanCtx();
    const result = await checkLink.run(
      { url: "https://example.com/empty", claim: "Some claim." },
      ctx,
    );

    expect(result.entails).toBe(false);
    expect(result.reason).toBe("source unreachable/empty");
    expect(callModelMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Fail-closed: malformed callModel JSON → { entails: false }
// ---------------------------------------------------------------------------
describe("checkLink — fail-closed: malformed callModel JSON", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  test("callModel returns non-JSON text → entails:false with 'could not verify'", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: "I think this is supported but I am not sure.",
        usage: { inputTokens: 100, outputTokens: 20 },
      }),
    }));
    mockFetch({ ok: true, body: "<html><body><p>Real content about the claim.</p></body></html>" });

    const { checkLink } = await import("./check-link");
    const ctx = await makeScanCtx();
    const result = await checkLink.run(
      { url: "https://example.com/page", claim: "Real content about the claim." },
      ctx,
    );

    expect(result.entails).toBe(false);
    expect(result.reason).toBe("could not verify");
  });

  test("callModel returns JSON missing 'entails' field → entails:false", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify({ answer: "yes", explanation: "looks good" }),
        usage: { inputTokens: 100, outputTokens: 20 },
      }),
    }));
    mockFetch({ ok: true, body: "<html><body><p>Some content.</p></body></html>" });

    const { checkLink } = await import("./check-link");
    const ctx = await makeScanCtx();
    const result = await checkLink.run(
      { url: "https://example.com/page", claim: "Some content." },
      ctx,
    );

    expect(result.entails).toBe(false);
    expect(result.reason).toBe("could not verify");
  });

  test("callModel returns entails not boolean → entails:false", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify({ entails: "true", reason: "yes" }),
        usage: { inputTokens: 100, outputTokens: 20 },
      }),
    }));
    mockFetch({ ok: true, body: "<html><body><p>Some content.</p></body></html>" });

    const { checkLink } = await import("./check-link");
    const ctx = await makeScanCtx();
    const result = await checkLink.run(
      { url: "https://example.com/page", claim: "Some content." },
      ctx,
    );

    expect(result.entails).toBe(false);
    expect(result.reason).toBe("could not verify");
  });

  test("callModel throws → entails:false with 'could not verify'", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockRejectedValue(new Error("API error")),
    }));
    mockFetch({ ok: true, body: "<html><body><p>Some content.</p></body></html>" });

    const { checkLink } = await import("./check-link");
    const ctx = await makeScanCtx();
    const result = await checkLink.run(
      { url: "https://example.com/page", claim: "Some content." },
      ctx,
    );

    expect(result.entails).toBe(false);
    expect(result.reason).toBe("could not verify");
  });
});

// ---------------------------------------------------------------------------
// Fixture mode
// ---------------------------------------------------------------------------
describe("checkLink — fixture mode", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  test("fixture mode returns { entails: true } without callModel or fetch", async () => {
    const callModelMock = vi.fn();
    const fetchMock = vi.fn();

    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));
    vi.stubGlobal("fetch", fetchMock);

    const { checkLink } = await import("./check-link");
    const ctx = await makeScanCtx();
    const result = await checkLink.run(
      { url: "https://example.com/anything", claim: "Any claim at all." },
      ctx,
    );

    expect(result.entails).toBe(true);
    expect(result.reason).toBe("fixtures: assumed entailed");
    expect(callModelMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tool metadata
// ---------------------------------------------------------------------------
describe("checkLink — tool metadata", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  test("has name=check_link and klass=L", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: vi.fn() }));

    const { checkLink } = await import("./check-link");
    expect(checkLink.name).toBe("check_link");
    expect(checkLink.klass).toBe("L");
  });
});
