// tests/jobs/run-incident.test.ts — a failing job mails the owner once per
// job, error class and Berlin day, and our own claim decides it. Through the
// real runner, the real incident mail and the real Resend request; the
// transport double sends every request it gets, so the vendor's key cannot
// be what holds the line.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";
import type { ErrorMailKey, HeartbeatStore } from "@/jobs/heartbeat";

applyEnvFixture();

const { runJob } = await import("@/jobs/run");
const { setHeartbeatStore } = await import("@/jobs/heartbeat");
const { __setVendorTransportForTesting } = await import("@/lib/mail/vendor/resend");
type JobDefinition = import("@/jobs/types").JobDefinition;

class TimeoutError extends Error {
  override name = "TimeoutError";
}

let keys: string[] = [];
let refuseNext = 0;
let claims: Set<string>;

const id = (key: ErrorMailKey) => `${key.jobId}|${key.errorName}|${key.day}`;

function store(claimThrows = false): HeartbeatStore {
  return {
    async record() {},
    async readAll() {
      return [];
    },
    async claimAlert() {
      return false;
    },
    // Check and set in one turn, as the primary key makes the insert.
    async claimErrorMail(key) {
      if (claimThrows) throw new Error("database down");
      if (claims.has(id(key))) return false;
      claims.add(id(key));
      return true;
    },
    async releaseErrorMail(key) {
      claims.delete(id(key));
    },
  };
}

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

async function tick(definition: JobDefinition, at: string): Promise<void> {
  vi.setSystemTime(new Date(at));
  await expect(runJob(definition, { data: {}, now: new Date(at), attempt: 0 })).rejects.toThrow();
}

beforeEach(() => {
  keys = [];
  refuseNext = 0;
  claims = new Set();
  setHeartbeatStore(store());
  __setVendorTransportForTesting(async (_payload, key) => {
    if (refuseNext > 0) {
      refuseNext -= 1;
      return { status: 422, headers: {}, body: "{}" };
    }
    keys.push(key);
    return { status: 200, headers: {}, body: JSON.stringify({ id: `vendor-${keys.length}` }) };
  });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  setHeartbeatStore(null);
  __setVendorTransportForTesting(null);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("one owner mail per job, error class and Berlin day", () => {
  it("8 failing ticks with one class send 1 mail", async () => {
    for (let hour = 6; hour < 14; hour += 1) {
      await tick(failing(TypeError), `2026-10-19T${String(hour).padStart(2, "0")}:00:00Z`);
    }
    expect(keys).toHaveLength(1);
  });

  it("a second class the same day is 1 more; A, B, A is 2; the next Berlin day is 1 more", async () => {
    await tick(failing(TypeError), "2026-10-19T06:00:00Z");
    await tick(failing(TimeoutError), "2026-10-19T07:00:00Z");
    await tick(failing(TypeError), "2026-10-19T08:00:00Z");
    expect(keys).toHaveLength(2);
    await tick(failing(TypeError), "2026-10-20T06:00:00Z");
    expect(keys).toHaveLength(3);
  });

  it.each([
    ["summer, across Berlin midnight", "2026-07-14T21:30:00Z", "2026-07-14T22:30:00Z", 2],
    ["summer, one Berlin day over two UTC days", "2026-07-14T22:30:00Z", "2026-07-15T21:30:00Z", 1],
    ["winter, across Berlin midnight", "2026-01-14T22:30:00Z", "2026-01-14T23:30:00Z", 2],
    ["winter, one Berlin day over two UTC days", "2026-01-14T23:30:00Z", "2026-01-15T22:30:00Z", 1],
  ])("%s", async (_case, first, second, mails) => {
    await tick(failing(TypeError), first);
    await tick(failing(TypeError), second);
    expect(keys).toHaveLength(mails);
    // The vendor key carries the same Berlin day, so it never drops the new day's mail.
    expect(new Set(keys).size).toBe(mails);
  });

  it("two ticks racing on the same job, class and day send 1 mail", async () => {
    vi.setSystemTime(new Date("2026-10-19T06:00:00Z"));
    const now = new Date("2026-10-19T06:00:00Z");
    const runs = [0, 1].map(() => runJob(failing(TypeError), { data: {}, now, attempt: 0 }).catch(() => "failed"));
    await expect(Promise.all(runs)).resolves.toEqual(["failed", "failed"]);
    expect(keys).toHaveLength(1);
  });
});

describe("a mail not sent does not use up the day, and a broken store never silences the owner", () => {
  it("a send the vendor refused is tried again on the next tick", async () => {
    refuseNext = 1;
    await tick(failing(TypeError), "2026-10-19T06:00:00Z");
    expect(keys).toHaveLength(0);
    await tick(failing(TypeError), "2026-10-19T07:00:00Z");
    expect(keys).toHaveLength(1);
  });

  it("a claim that throws still mails, logs claim_unavailable, and the job rethrows its own error", async () => {
    setHeartbeatStore(store(true));
    const original = new TimeoutError();
    const definition: JobDefinition = { ...failing(TimeoutError), run: async () => Promise.reject(original) };
    vi.setSystemTime(new Date("2026-10-19T06:00:00Z"));
    await expect(runJob(definition, { data: {}, now: new Date("2026-10-19T06:00:00Z"), attempt: 0 })).rejects.toBe(original);
    expect(keys).toHaveLength(1);
    expect(vi.mocked(console.warn).mock.calls.map(([line]) => JSON.parse(String(line)))).toContainEqual({
      event: "ops_incident_alert",
      outcome: "claim_unavailable",
    });
  });
});
