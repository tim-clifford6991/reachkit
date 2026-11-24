// A model call reserves one attempt at a time against the real cost context, so a day with room for the fix it needs
// is never refused it, and a retry that does not fit is refused and recorded as the budget. The model is the vendor
// SDK doubled; the ledger is the context's own, with its row writes captured.
import "../generate/env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { toolUseMessage } from "../llm/fixtures";

const { readCacheMock, writeFetchRowMock, createMock } = vi.hoisted(() => ({ readCacheMock: vi.fn(), writeFetchRowMock: vi.fn(), createMock: vi.fn() }));

const scanRow = { select: () => ({ eq: () => ({ limit: async () => ({ data: [{ cost_cents: 0, site_id: null }], error: null }) }) }) };
vi.mock("@/lib/db", () => ({ dbAdmin: () => ({ rpc: async () => ({ data: 0, error: null }), from: () => scanRow }) }));
vi.mock("../../src/lib/costs/cache", () => ({ readCache: readCacheMock }));
vi.mock("../../src/lib/costs/ledger", () => ({ writeFetchRow: writeFetchRowMock, nameDraftOnRows: async () => {} }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create: createMock }; } }));

const { withCostContext } = await import("../../src/lib/costs/index");
const { llm } = await import("../../src/lib/llm/index");
const { tryFix } = await import("../../src/lib/generate/pipeline/fix-call");
const { CAPS } = await import("../../src/lib/config/constants");

const DRAFT_C = CAPS.DRAFT_C;
const SCHEMA = z.object({ page: z.string() });
/** A fix call's input the size of 11-04's, about 12,000 tokens. */
const INPUT = { page: "x".repeat(48_000) };
const INPUT_TOKENS = Math.ceil(JSON.stringify(INPUT).length / 4);
const FIX_OUT = 8192;
/** One attempt at the writer's list price, Opus 5.5's 400¢ in and 2000¢ out per million, recomputed here. */
const ONE_ATTEMPT = (INPUT_TOKENS / 1e6) * 400 + (FIX_OUT / 1e6) * 2000;
/** The most a day's research has cost before its write. */
const RESEARCH_C = 14;

const rows = () => writeFetchRowMock.mock.calls.map(([row]) => row as { source: string; reservedCents: number; costCents: number });
const fix = (cost: Parameters<typeof llm>[0]) => llm(cost, { site: "generate.fix", tier: "writer", input: INPUT, schema: SCHEMA });
const draftDay = <T>(priorCents: number, body: (cost: Parameters<typeof llm>[0]) => Promise<T>) =>
  withCostContext({ scanId: "scan-1", cap: "DRAFT", policyVersion: 1, rollUp: "none", priorCents }, body);
/** An answer that misses the schema at the most an attempt may cost, so its settlement equals its reservation. */
const fullMiss = () => toolUseMessage({}, INPUT_TOKENS, FIX_OUT, "generate_fix");

beforeEach(() => {
  readCacheMock.mockReset().mockResolvedValue(null);
  writeFetchRowMock.mockReset().mockResolvedValue(undefined);
  createMock.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a model call reserves one attempt at a time", () => {
  it("a day that paid its research, a write cut off at its ceiling and the retry is still admitted the fix, though not two", async () => {
    const prior = RESEARCH_C + 2 * ONE_ATTEMPT;
    expect(2 * ONE_ATTEMPT).toBeGreaterThan(DRAFT_C - prior);
    createMock.mockResolvedValueOnce(toolUseMessage({ page: "fixed" }, INPUT_TOKENS, 2700, "generate_fix"));

    const result = await draftDay(prior, fix);

    expect(result).toMatchObject({ kind: "measured", value: { page: "fixed" } });
    const [row] = rows();
    expect(row?.reservedCents).toBeCloseTo(ONE_ATTEMPT, 6);
    expect(row?.costCents).toBeCloseTo((INPUT_TOKENS / 1e6) * 400 + (2700 / 1e6) * 2000, 6);
  });

  it("a retry that fits is reserved when it is due, and the one row carries both attempts", async () => {
    createMock.mockResolvedValueOnce(fullMiss()).mockResolvedValueOnce(toolUseMessage({ page: "fixed" }, INPUT_TOKENS, 100, "generate_fix"));

    const result = await draftDay(0, fix);

    expect(result.kind).toBe("measured");
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]?.reservedCents).toBeCloseTo(2 * ONE_ATTEMPT, 6);
  });

  it.each([1, 2, 3])("with room for %i attempts, exactly that many are made and the ledger never passes DRAFT_C", async (n) => {
    createMock.mockImplementation(async () => fullMiss());
    const prior = DRAFT_C - n * ONE_ATTEMPT - 0.01;

    const spent = await draftDay(prior, async (cost) => {
      while ((await fix(cost)).kind === "unmeasured" && !cost.degraded());
      return cost.spentCents();
    });

    expect(createMock).toHaveBeenCalledTimes(n);
    const ledgered = prior + rows().reduce((sum, row) => sum + row.costCents, 0);
    expect(ledgered).toBeCloseTo(spent, 6);
    expect(ledgered).toBeLessThanOrEqual(DRAFT_C);
    expect(prior + rows().reduce((sum, row) => sum + row.reservedCents, 0)).toBeLessThanOrEqual(DRAFT_C);
  });

  it("market inference is sent the sonnet tier's fixed request and ledgered at Sonnet 5's price inside WEEKLY_C", async () => {
    createMock.mockResolvedValueOnce(toolUseMessage({ page: "market" }, INPUT_TOKENS, 600, "market-inference"));
    await withCostContext({ scanId: "scan-1", cap: "WEEKLY", policyVersion: 1, rollUp: "none", priorCents: 0 }, (cost) =>
      llm(cost, { site: "market-inference", tier: "sonnet", input: INPUT, schema: SCHEMA }));

    expect(createMock.mock.calls[0]?.[0]).toMatchObject({ model: "claude-sonnet-5", thinking: { type: "disabled" } });
    expect(createMock.mock.calls[0]?.[0]).not.toHaveProperty("temperature");
    expect(rows()[0]?.costCents).toBeCloseTo((INPUT_TOKENS / 1e6) * 200 + (600 / 1e6) * 1000, 6);
    expect(rows()[0]?.reservedCents).toBeLessThan(40);
  });

  it("a write billed 1.56 times its estimated input, as 11-24's were, settles at the bill and is never clamped", async () => {
    const billed = Math.round(INPUT_TOKENS * 1.56);
    createMock.mockResolvedValueOnce(toolUseMessage({ page: "page" }, billed, 8192, "generate_write"));

    await draftDay(0, (cost) => llm(cost, { site: "generate.write", tier: "writer", input: INPUT, schema: SCHEMA }));

    expect(rows()[0]?.costCents).toBeCloseTo((billed / 1e6) * 400 + (8192 / 1e6) * 2000, 6);
    expect(vi.mocked(console.warn).mock.calls.map(([line]) => String(line))).not.toContainEqual(expect.stringContaining("cost_settlement_clamped"));
  });

  it("a retry that does not fit is refused, its first attempt is ledgered, and the fix records the budget as its stop", async () => {
    createMock.mockResolvedValue(fullMiss());

    const { again, stop, degraded } = await draftDay(DRAFT_C - 1.5 * ONE_ATTEMPT, async (cost) => ({
      ...(await tryFix(cost, { startedAt: Date.now(), call: () => fix(cost) })),
      degraded: cost.degraded(),
    }));

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(again).toMatchObject({ kind: "unmeasured", reason: "not_attempted" });
    expect(stop).toBe("budget");
    expect(degraded).toBe(true);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatchObject({ source: "generate.fix" });
    expect(rows()[0]?.costCents).toBeCloseTo(ONE_ATTEMPT, 6);
    const logged = vi.mocked(console.log).mock.calls.map(([line]) => JSON.parse(String(line)) as Record<string, unknown>);
    expect(logged).toContainEqual(expect.objectContaining({ site: "generate.fix", failure: "parse", retryExhausted: "cap" }));
  });
});
