// tests/jobs/ops-mail-once-1573.test.ts — a job that fails on every tick
// tells the owner once a day per error kind, through the real runner, the
// real incident mail and the real Resend request. The transport answers as
// Resend does: a key it has seen returns the first mail's id and sends none.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";

applyEnvFixture();

const { runJob } = await import("@/jobs/run");
const { __setVendorTransportForTesting } = await import("@/lib/mail/vendor/resend");
type JobDefinition = import("@/jobs/types").JobDefinition;

let delivered: string[] = [];

function failing(errorClass: new () => Error): JobDefinition {
  return {
    id: "draft/generate",
    trigger: { kind: "cron", cron: "0 * * * *" },
    idempotencyKey: [],
    run: async () => {
      throw new errorClass();
    },
  };
}

class TimeoutError extends Error {
  override name = "TimeoutError";
}

async function tick(definition: JobDefinition, at: string): Promise<void> {
  vi.setSystemTime(new Date(at));
  await expect(runJob(definition, { data: {}, now: new Date(at), attempt: 0 })).rejects.toThrow();
}

beforeEach(() => {
  delivered = [];
  const seen = new Map<string, string>();
  __setVendorTransportForTesting(async (payload, key?: string) => {
    // A request with no key is always a mail.
    if (key === undefined || !seen.has(key)) {
      if (key === undefined) key = `none-${delivered.length}`;
      seen.set(key, `vendor-${seen.size + 1}`);
      delivered.push(payload);
    }
    return { status: 200, headers: {}, body: JSON.stringify({ id: seen.get(key) }) };
  });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  __setVendorTransportForTesting(null);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("one ops mail per job per error kind per day", () => {
  it("a job failing on 4 consecutive ticks sends 1 ops mail", async () => {
    for (const hour of ["06", "07", "08", "09"]) await tick(failing(TypeError), `2026-10-19T${hour}:00:00Z`);
    expect(delivered).toHaveLength(1);
  });

  it("another error kind is its own mail, and so is the next day", async () => {
    await tick(failing(TypeError), "2026-10-19T06:00:00Z");
    await tick(failing(TimeoutError), "2026-10-19T07:00:00Z");
    await tick(failing(TypeError), "2026-10-19T08:00:00Z");
    await tick(failing(TypeError), "2026-10-20T06:00:00Z");
    expect(delivered).toHaveLength(3);
  });
});
