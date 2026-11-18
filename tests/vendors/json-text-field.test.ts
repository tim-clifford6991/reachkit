// A paid answer whose list field came back as JSON text is decoded once and used, never thrown away or used raw.
import { expect, it, vi } from "vitest";
import { z } from "zod";
import { fakeCostContext, setEnvFixture } from "./harness";
import { toolUseMessage } from "../llm/fixtures";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create: createMock }; } }));
setEnvFixture();
const { llm } = await import("../../src/lib/llm/index");
const schema = z.strictObject({ scores: z.array(z.strictObject({ i: z.number().int(), fit: z.number().int() })), strongest: z.array(z.number().int()) });

it.each([
  [{ scores: '[{"i":0,"fit":3}]', strongest: "[0]" }, { kind: "measured", value: { scores: [{ i: 0, fit: 3 }], strongest: [0] } }],
  [{ scores: "three of them", strongest: "[0]" }, { kind: "unmeasured", reason: "undeterminable" }],
  [{ scores: '[{"i":"zero"}]', strongest: "[0]" }, { kind: "unmeasured", reason: "undeterminable" }],
])("answer %j", async (answer, want) => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  createMock.mockReset().mockResolvedValue(toolUseMessage(answer, 100, 50, "topic-fit"));
  const [fake, rows] = [fakeCostContext(), [] as unknown[]];
  const record = fake.ctx.recordFetch.bind(fake.ctx);
  fake.ctx.recordFetch = async (call) => { const r = await record(call); if ("payload" in r) rows.push(r.payload); return r; };
  expect(await llm(fake.ctx, { site: "topic-fit", tier: "sonnet", input: {}, schema })).toMatchObject(want);
  expect(createMock).toHaveBeenCalledTimes(1);
  if (want.kind === "measured") expect([rows[0], JSON.parse(String(log.mock.calls.at(-1)?.[0]))]).toMatchObject([{ coerced: ["scores", "strongest"] }, { coerced: ["scores", "strongest"] }]);
  else expect(rows[0]).not.toHaveProperty("coerced");
  expect(String(log.mock.calls.at(-1)?.[0])).not.toMatch(/\{"i"|zero|three|\[0\]/);
  log.mockRestore();
});
