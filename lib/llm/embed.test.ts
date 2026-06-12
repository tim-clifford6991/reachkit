import { beforeEach, describe, expect, test, vi } from "vitest";
import { fixtureEmbed } from "@/lib/dev/fixtures";

// ---------------------------------------------------------------------------
// fixtureEmbed — determinism and shape
// ---------------------------------------------------------------------------
describe("fixtureEmbed", () => {
  test("returns 1024-dim vectors", () => {
    const vecs = fixtureEmbed(["hello"]);
    expect(vecs).toHaveLength(1);
    expect(vecs[0]).toHaveLength(1024);
  });

  test("is deterministic: same text → identical vector", () => {
    const a = fixtureEmbed(["hello world"]);
    const b = fixtureEmbed(["hello world"]);
    expect(a[0]).toEqual(b[0]);
  });

  test("different texts produce different vectors", () => {
    const [va, vb] = fixtureEmbed(["apple", "banana"]);
    expect(va).not.toEqual(vb);
  });

  test("vectors are approximately unit-norm (|v| ≈ 1)", () => {
    const [v] = fixtureEmbed(["test text for norm check"]);
    const norm = Math.sqrt((v ?? []).reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  test("handles empty string as a degenerate input without throwing", () => {
    expect(() => fixtureEmbed([""])).not.toThrow();
  });

  test("handles multiple texts in one call", () => {
    const texts = ["alpha", "beta", "gamma"];
    const vecs = fixtureEmbed(texts);
    expect(vecs).toHaveLength(3);
    for (const v of vecs) {
      expect(v).toHaveLength(1024);
    }
    // All distinct
    expect(vecs[0]).not.toEqual(vecs[1]);
    expect(vecs[1]).not.toEqual(vecs[2]);
  });
});

// ---------------------------------------------------------------------------
// callEmbed — fixtures mode delegates to fixtureEmbed, no network
// ---------------------------------------------------------------------------
describe("callEmbed in fixtures mode", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("returns fixtureEmbed output without any fetch call", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({
      fixturesEnabled: () => true,
      fixtureEmbed: (texts: string[]) => texts.map(() => Array(1024).fill(0.1)),
    }));

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { callEmbed } = await import("./embed");
    const result = await callEmbed(["hello"]);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(1024);

    fetchSpy.mockRestore();
  });

  test("in fixtures mode result matches fixtureEmbed directly", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({
      fixturesEnabled: () => true,
      fixtureEmbed,
    }));

    const { callEmbed } = await import("./embed");
    const direct = fixtureEmbed(["near text", "far text"]);
    const via = await callEmbed(["near text", "far text"]);
    expect(via).toEqual(direct);
  });
});

// ---------------------------------------------------------------------------
// callEmbed — live mode uses fetch (mocked)
// ---------------------------------------------------------------------------
describe("callEmbed in live mode", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("POSTs to Voyage and maps data[].embedding", async () => {
    const mockEmbedding = Array.from({ length: 1024 }, (_, i) => i / 1024);

    vi.doMock("@/lib/dev/fixtures", () => ({
      fixturesEnabled: () => false,
      fixtureEmbed,
    }));
    vi.doMock("@/lib/config/env", () => ({
      env: { voyageApiKey: "test-key", useFixtures: false },
    }));

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: [{ embedding: mockEmbedding }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { callEmbed } = await import("./embed");
    const result = await callEmbed(["hello voyage"]);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.voyageai.com/v1/embeddings");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer test-key");

    const body = JSON.parse(init.body as string) as { input: string[]; model: string };
    expect(body.model).toBe("voyage-3");
    expect(body.input).toEqual(["hello voyage"]);

    expect(result).toEqual([mockEmbedding]);

    fetchSpy.mockRestore();
  });

  test("throws when Voyage returns non-ok status", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({
      fixturesEnabled: () => false,
      fixtureEmbed,
    }));
    vi.doMock("@/lib/config/env", () => ({
      env: { voyageApiKey: "bad-key", useFixtures: false },
    }));

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401, statusText: "Unauthorized" }),
    );

    const { callEmbed } = await import("./embed");
    await expect(callEmbed(["oops"])).rejects.toThrow(/401/);
  });
});
