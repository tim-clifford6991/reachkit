import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildCompetitorNamesPrompt, parseCompetitorNames } from "./competitor-names";
import type { ScanContext } from "@/lib/scan/pipeline";

describe("competitor-names", () => {
  it("prompt anchors to the subject category and forbids off-category / same-name products", () => {
    const p = buildCompetitorNamesPrompt({
      subjectName: "Acquire",
      subjectHost: "acquire.com",
      category: "marketplace to buy and sell online businesses",
      content: "Top alternatives: Flippa, Empire Flippers, MicroAcquire. Also Acquire.io live chat.",
    });
    expect(p).toContain("acquire.com");
    expect(p).toContain("marketplace to buy and sell online businesses");
    expect(p.toLowerCase()).toContain("same category");
    expect(p.toLowerCase()).toContain("different product that merely shares");
  });

  it("parses names, drops empties, dedupes case-insensitively, caps at 8", () => {
    const json = JSON.stringify({ competitors: [
      { name: "Flippa" }, { name: "flippa" }, { name: "Empire Flippers" }, { name: "" },
    ] });
    const out = parseCompetitorNames(json);
    expect(out.map((c) => c.name)).toEqual(["Flippa", "Empire Flippers"]);
    expect(out.map((c) => c.rank)).toEqual([1, 2]); // rank starts at 1, sequential
    const first = out[0];
    expect(first?.source).toBe("llm_extracted");
    expect(first?.url).toBe("");
  });

  it("caps at 8 even when more are returned, with ranks 1..8", () => {
    const json = JSON.stringify({
      competitors: Array.from({ length: 12 }, (_v, n) => ({ name: `Rival${n}` })),
    });
    const out = parseCompetitorNames(json);
    expect(out).toHaveLength(8);
    expect(out.map((c) => c.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(out[7]?.name).toBe("Rival7");
  });

  it("returns [] on unparseable model output (never throws)", () => {
    expect(parseCompetitorNames("the competitors are Flippa and ...")).toEqual([]);
  });

  it("returns [] when competitors is valid JSON but not an array (never throws)", () => {
    expect(parseCompetitorNames(JSON.stringify({ competitors: 42 }))).toEqual([]);
    expect(parseCompetitorNames(JSON.stringify({ competitors: { name: "x" } }))).toEqual([]);
    expect(parseCompetitorNames(JSON.stringify({ competitors: null }))).toEqual([]);
    expect(parseCompetitorNames(JSON.stringify({}))).toEqual([]);
  });

  it("skips null/garbage array items without throwing", () => {
    const out = parseCompetitorNames(JSON.stringify({ competitors: [null, 7, { name: "Flippa" }] }));
    expect(out.map((c) => c.name)).toEqual(["Flippa"]);
  });
});

describe("extractCompetitorNames (never-throws contract)", () => {
  const ctx = { scanId: "scan-1" } as unknown as ScanContext;
  const input = {
    subjectName: "Acquire",
    subjectHost: "acquire.com",
    category: "marketplace to buy and sell online businesses",
    content: "Top alternatives: Flippa, Empire Flippers.",
  };

  beforeEach(() => {
    vi.resetModules();
  });

  it("returns [] when content is blank — no callModel call", async () => {
    const callModelMock = vi.fn();
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));
    const { extractCompetitorNames } = await import("./competitor-names");
    expect(await extractCompetitorNames(ctx, { ...input, content: "   " })).toEqual([]);
    expect(callModelMock).not.toHaveBeenCalled();
  });

  it("returns [] under fixtures — no callModel call", async () => {
    const callModelMock = vi.fn();
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));
    const { extractCompetitorNames } = await import("./competitor-names");
    expect(await extractCompetitorNames(ctx, input)).toEqual([]);
    expect(callModelMock).not.toHaveBeenCalled();
  });

  it("returns [] when callModel rejects — degrades, never throws", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: vi.fn().mockRejectedValue(new Error("rate limit")) }));
    const { extractCompetitorNames } = await import("./competitor-names");
    expect(await extractCompetitorNames(ctx, input)).toEqual([]);
  });

  it("parses real names end-to-end on a valid model response", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({ text: '{"competitors":[{"name":"Flippa"},{"name":"Empire Flippers"}]}' }),
    }));
    const { extractCompetitorNames } = await import("./competitor-names");
    const out = await extractCompetitorNames(ctx, input);
    expect(out.map((c) => c.name)).toEqual(["Flippa", "Empire Flippers"]);
    expect(out[0]?.source).toBe("llm_extracted");
  });
});
