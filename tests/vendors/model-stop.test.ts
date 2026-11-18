// A model answer cut off at the length limit, or refused, is bought once and recorded as what it was.
import { expect, it, vi } from "vitest";
import { z } from "zod";
import { fakeCostContext, setEnvFixture } from "./harness";
import { toolUseMessage } from "../llm/fixtures";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create: createMock }; } }));
setEnvFixture();
const { llm } = await import("../../src/lib/llm/index");

it.each([["max_tokens", "cut_off"], ["refusal", "refusal"]])("stop_reason %s: one call, a schema-valid answer refused, logged %s", async (stop, kind) => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  createMock.mockReset().mockResolvedValue({ ...toolUseMessage({ page: "half" }, 100, 8192, "generate_fix"), stop_reason: stop });
  const got = await llm(fakeCostContext().ctx, { site: "generate.fix", tier: "writer", input: { page: "p" }, schema: z.object({ page: z.string() }) });
  expect(createMock).toHaveBeenCalledTimes(1);
  expect(got).toMatchObject({ kind: "unmeasured", reason: "undeterminable" });
  const lines = log.mock.calls.map(([line]) => JSON.parse(String(line)) as Record<string, unknown>);
  expect(lines).toContainEqual(expect.objectContaining({ failure: "parse", parseFailure: kind, retryExhausted: "deterministic" }));
  log.mockRestore();
});
