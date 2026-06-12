import { expect, test, vi } from "vitest";

// Shared mock factory — keeps tests DRY
function mockSdk() {
  vi.doMock("@anthropic-ai/sdk", () => ({
    default: class {
      messages = {
        create: async () => ({
          content: [{ type: "text", text: "hello" }],
          usage: { input_tokens: 1000, output_tokens: 200 },
        }),
      };
    },
  }));
}

function mockEnv() {
  vi.doMock("@/lib/config/env", () => ({
    env: { anthropicApiKey: "test-key" },
  }));
}

test("callModel returns text and records a pipeline_runs row with model+tokens", async () => {
  vi.resetModules();
  vi.doMock("@anthropic-ai/sdk", () => ({
    default: class {
      messages = {
        create: async () => ({
          content: [{ type: "text", text: "hello" }],
          usage: { input_tokens: 1000, output_tokens: 200 },
        }),
      };
    },
  }));
  mockEnv();
  const recorded: Array<Record<string, unknown>> = [];
  vi.doMock("@/lib/telemetry/pipeline-runs", async (orig) => ({
    ...(await orig() as object),
    recordPipelineRun: async (r: Record<string, unknown>) => {
      recorded.push(r);
    },
  }));
  const { callModel } = await import("./anthropic");
  const out = await callModel({
    model: "claude-haiku-4-5-20251001",
    system: "s",
    prompt: "p",
    scanId: "s1",
    stage: "extract",
  });
  expect(out.text).toBe("hello");
  expect(out.usage.inputTokens).toBe(1000);
  expect(out.usage.outputTokens).toBe(200);
  expect(recorded[0]?.model).toBe("claude-haiku-4-5-20251001");
  expect(recorded[0]?.tokensIn).toBe(1000);
  expect(recorded[0]?.tokensOut).toBe(200);
  expect(recorded[0]?.stage).toBe("extract");
  expect(recorded[0]?.scanId).toBe("s1");
  expect(typeof recorded[0]?.costCents).toBe("number");
  expect(typeof recorded[0]?.durationMs).toBe("number");
});

test("callModel passes through scanId=null and custom stage", async () => {
  vi.resetModules();
  vi.doMock("@anthropic-ai/sdk", () => ({
    default: class {
      messages = {
        create: async () => ({
          content: [{ type: "text", text: "synth result" }],
          usage: { input_tokens: 500, output_tokens: 100 },
        }),
      };
    },
  }));
  mockEnv();
  const recorded: Array<Record<string, unknown>> = [];
  vi.doMock("@/lib/telemetry/pipeline-runs", async (orig) => ({
    ...(await orig() as object),
    recordPipelineRun: async (r: Record<string, unknown>) => {
      recorded.push(r);
    },
  }));
  const { callModel } = await import("./anthropic");
  const out = await callModel({
    model: "claude-sonnet-4-6",
    system: "sys",
    prompt: "user prompt",
    scanId: null,
    stage: "synth",
  });
  expect(out.text).toBe("synth result");
  expect(recorded[0]?.scanId).toBeNull();
  expect(recorded[0]?.stage).toBe("synth");
  expect(recorded[0]?.model).toBe("claude-sonnet-4-6");
});

test("callModel handles non-text content blocks gracefully", async () => {
  vi.resetModules();
  vi.doMock("@anthropic-ai/sdk", () => ({
    default: class {
      messages = {
        create: async () => ({
          content: [
            { type: "thinking", thinking: "let me think" },
            { type: "text", text: "final answer" },
          ],
          usage: { input_tokens: 300, output_tokens: 50 },
        }),
      };
    },
  }));
  mockEnv();
  vi.doMock("@/lib/telemetry/pipeline-runs", async (orig) => ({
    ...(await orig() as object),
    recordPipelineRun: async () => {},
  }));
  const { callModel } = await import("./anthropic");
  const out = await callModel({
    model: "claude-haiku-4-5-20251001",
    system: "s",
    prompt: "p",
    scanId: null,
    stage: "format",
  });
  // Only text blocks should be joined
  expect(out.text).toBe("final answer");
});
