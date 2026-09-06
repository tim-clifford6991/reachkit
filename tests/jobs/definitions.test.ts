// tests/jobs/definitions.test.ts — BUILD §11
//
// The seven definitions as thin adapters: a trigger, a bounded loop and one
// call into the engine.
//
// Every engine function these jobs call is doubled here, because none of
// them is built. The last suite is the honest half of that: with the real
// seam in place, a job does **not** report a quiet success — it throws
// `EngineNotBuilt`, and the runner logs a failed invocation.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubEnv } from "./env-fixture";
import type { JobDefinition, JobId } from "@/jobs/types";
import { JOB_IDS } from "@/jobs/types";
import { MAINTENANCE_TICK_MINUTES, NURTURE_MAX_TOUCHES, PUBLISH_VERIFY_DELAY_H } from "@/lib/config/constants";

type Call = { readonly fn: string; readonly arg: unknown };

const calls: Call[] = [];
const results = new Map<string, unknown>();

function record<T>(fn: string, fallback: T) {
  return async (arg?: unknown) => {
    calls.push({ fn, arg });
    return (results.has(fn) ? results.get(fn) : fallback) as T;
  };
}

function engineDouble(): Record<string, unknown> {
  const done = { done: true as const };
  return {
    EngineNotBuilt: class extends Error {},
    activeSites: record("activeSites", [{ siteId: "site-1", timeZone: "UTC" }]),
    startWeeklyScan: record("startWeeklyScan", done),
    runScan: record("runScan", done),
    generateDraft: record("generateDraft", done),
    publishApproved: record("publishApproved", done),
    verifyLive: record("verifyLive", done),
    advanceSequence: record("advanceSequence", done),
    paymentsAwaitingSignIn: record("paymentsAwaitingSignIn", []),
    chaseSignIn: record("chaseSignIn", done),
    paymentsWithoutAccounts: record("paymentsWithoutAccounts", []),
    backstopProvision: record("backstopProvision", done),
    sitesDueHostingEndNotice: record("sitesDueHostingEndNotice", []),
    noticeHostingEnd: record("noticeHostingEnd", done),
    sitesDueHostingStop: record("sitesDueHostingStop", []),
    stopHosting: record("stopHosting", done),
    accountsDueForPurge: record("accountsDueForPurge", []),
    purgeAccount: record("purgeAccount", done),
  };
}

async function load(): Promise<readonly JobDefinition[]> {
  stubEnv(false);
  vi.doMock("@/jobs/engine", () => engineDouble());
  const { jobs } = await import("@/jobs");
  return jobs;
}

async function definition(id: JobId): Promise<JobDefinition> {
  const found = (await load()).find((j) => j.id === id);
  if (found === undefined) throw new Error(`no definition for ${id}`);
  return found;
}

const MONDAY_0600_UTC = new Date("2026-09-07T06:00:00Z");
const EVENING_UTC = new Date("2026-09-07T18:00:00Z");

beforeEach(() => {
  calls.length = 0;
  results.clear();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.doUnmock("@/jobs/engine");
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("each job is a trigger, a bounded loop and one call into the engine", () => {
  it.each([
    ["scan/run", "event"],
    ["draft/generate", "cron"],
    ["publish/execute", "event"],
    ["publish/verify", "event"],
    ["weekly/refresh", "cron"],
    ["lead/nurture", "event"],
    ["account/maintenance", "cron"],
  ] as const)("%s is triggered by a %s", async (id, kind) => {
    expect((await definition(id)).trigger.kind).toBe(kind);
  });

  it("no job body reaches the database, a vendor or the cost seam directly", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve(import.meta.dirname, "../../src/jobs");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
      const source = readFileSync(path.join(dir, file), "utf8");
      expect(source, file).not.toMatch(/from\s+["']@\/lib\/(db|costs|vendors|egress|llm)/);
    }
  });
});

describe("scan/run — the one pipeline, tier a parameter", () => {
  it("calls runScan once with the scan, the domain and the tier", async () => {
    const job = await definition("scan/run");
    const outcome = await job.run({
      data: { scanId: "scan-1", domain: "example.com", tier: "deep" },
      now: MONDAY_0600_UTC,
    });
    expect(calls).toEqual([
      { fn: "runScan", arg: { scanId: "scan-1", domain: "example.com", tier: "deep" } },
    ]);
    expect(outcome).toEqual({ outcome: "ran", subjectId: "scan-1" });
  });

  it("marks its subject degraded rather than throwing when the engine runs out of budget", async () => {
    results.set("runScan", { degraded: "serp" });
    const job = await definition("scan/run");
    const outcome = await job.run({
      data: { scanId: "scan-1", domain: "example.com", tier: "free" },
      now: MONDAY_0600_UTC,
    });
    expect(outcome).toEqual({ outcome: "degraded", subjectId: "scan-1", step: "serp" });
  });

  it("refuses a delivery whose tier is not one of the three", async () => {
    const job = await definition("scan/run");
    await expect(
      job.run({ data: { scanId: "s", domain: "example.com", tier: "premium" }, now: MONDAY_0600_UTC })
    ).rejects.toThrow(/tier/);
  });

  it("is deduplicated by the scan id", async () => {
    expect((await definition("scan/run")).idempotencyKey).toEqual(["scanId"]);
  });
});

describe("weekly/refresh — an hourly tick, due per site-local Monday (ADR-060)", () => {
  it("is scheduled hourly, on no UTC hour of its own", async () => {
    const job = await definition("weekly/refresh");
    expect(job.trigger).toEqual({ kind: "cron", cron: "0 * * * *" });
  });

  it("starts one weekly scan per due site, keyed (site_id, week_start)", async () => {
    results.set("activeSites", [
      { siteId: "utc-site", timeZone: "UTC" },
      { siteId: "la-site", timeZone: "America/Los_Angeles" },
    ]);
    const job = await definition("weekly/refresh");
    const outcome = await job.run({ data: {}, now: MONDAY_0600_UTC });
    expect(calls.filter((c) => c.fn === "startWeeklyScan")).toEqual([
      { fn: "startWeeklyScan", arg: { siteId: "utc-site", weekStart: "2026-09-07" } },
    ]);
    expect(outcome).toEqual({ outcome: "ran", subjectId: null });
  });

  it("a tick on no site's Monday is a recorded skip, not a run", async () => {
    const job = await definition("weekly/refresh");
    const outcome = await job.run({ data: {}, now: new Date("2026-09-09T06:00:00Z") });
    expect(outcome).toEqual({ outcome: "skipped", subjectId: null, reason: "not-due" });
    expect(calls.filter((c) => c.fn === "startWeeklyScan")).toEqual([]);
  });
});

describe("draft/generate — the site's own evening, the next publish date", () => {
  it("is an hourly tick and generates for tomorrow in the site's zone", async () => {
    const job = await definition("draft/generate");
    expect(job.trigger).toEqual({ kind: "cron", cron: "0 * * * *" });
    const outcome = await job.run({ data: {}, now: EVENING_UTC });
    expect(calls.filter((c) => c.fn === "generateDraft")).toEqual([
      { fn: "generateDraft", arg: { siteId: "site-1", publishDate: "2026-09-08" } },
    ]);
    expect(outcome).toEqual({ outcome: "ran", subjectId: null });
  });

  it("a tick outside every site's evening is a recorded skip", async () => {
    const job = await definition("draft/generate");
    const outcome = await job.run({ data: {}, now: MONDAY_0600_UTC });
    expect(outcome).toEqual({ outcome: "skipped", subjectId: null, reason: "not-due" });
  });
});

describe("publish/execute and publish/verify", () => {
  it("publish/execute is deduplicated by (draft_id, destination_id) — ADR-080's pair", async () => {
    const job = await definition("publish/execute");
    expect(job.idempotencyKey).toEqual(["draftId", "destinationId"]);
    await job.run({ data: { draftId: "d1", destinationId: "dest-1" }, now: MONDAY_0600_UTC });
    expect(calls).toEqual([{ fn: "publishApproved", arg: { draftId: "d1", destinationId: "dest-1" } }]);
  });

  it("publish/verify declares the +24h delay rather than sleeping in its own body", async () => {
    const job = await definition("publish/verify");
    expect(job.trigger).toEqual({
      kind: "event",
      event: "publish/verify",
      afterHours: PUBLISH_VERIFY_DELAY_H,
    });
    expect(PUBLISH_VERIFY_DELAY_H).toBe(24);
  });

  it("publish/verify calls verifyLive once, keyed by the publication", async () => {
    const job = await definition("publish/verify");
    const outcome = await job.run({ data: { publicationId: "pub-1" }, now: MONDAY_0600_UTC });
    expect(calls).toEqual([{ fn: "verifyLive", arg: { publicationId: "pub-1" } }]);
    expect(outcome).toEqual({ outcome: "ran", subjectId: "pub-1" });
  });
});

describe("lead/nurture — per-touch dedupe inside a sequence", () => {
  it("keys on (lead_id, touch_index), never on the sequence key", async () => {
    const job = await definition("lead/nurture");
    expect(job.idempotencyKey).toEqual(["leadId", "touchIndex"]);
    const source = (await import("node:fs")).readFileSync(
      (await import("node:path")).resolve(import.meta.dirname, "../../src/jobs/lead-nurture.ts"),
      "utf8"
    );
    // The sequence key `(lower(email), domain)` stays the engine's one
    // enforcer; this job must not re-derive it. Comments are stripped
    // first — this file names the key in prose, on purpose, to say that it
    // is someone else's.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/lower\(|\bemail\b/);
  });

  it("advances one touch per delivery", async () => {
    const job = await definition("lead/nurture");
    const outcome = await job.run({ data: { leadId: "lead-1", touchIndex: 1 }, now: MONDAY_0600_UTC });
    expect(calls).toEqual([{ fn: "advanceSequence", arg: { leadId: "lead-1", touchIndex: 1 } }]);
    expect(outcome).toEqual({ outcome: "ran", subjectId: "lead-1" });
  });

  it("refuses a touch past the bound rather than handing it on", async () => {
    const job = await definition("lead/nurture");
    const outcome = await job.run({
      data: { leadId: "lead-1", touchIndex: NURTURE_MAX_TOUCHES },
      now: MONDAY_0600_UTC,
    });
    expect(outcome).toEqual({ outcome: "skipped", subjectId: "lead-1", reason: "no-subject" });
    expect(calls).toEqual([]);
  });
});

describe("account/maintenance — five due-work queries, five hand-offs, no domain logic", () => {
  it("ticks every MAINTENANCE_TICK_MINUTES", async () => {
    const job = await definition("account/maintenance");
    expect(job.trigger).toEqual({ kind: "cron", cron: `*/${MAINTENANCE_TICK_MINUTES} * * * *` });
    expect(MAINTENANCE_TICK_MINUTES).toBe(15);
  });

  it("a tick whose five queries return nothing is five reads and no hand-off", async () => {
    const job = await definition("account/maintenance");
    const outcome = await job.run({ data: {}, now: MONDAY_0600_UTC });
    expect(calls.map((c) => c.fn)).toEqual([
      "paymentsAwaitingSignIn",
      "paymentsWithoutAccounts",
      "sitesDueHostingEndNotice",
      "sitesDueHostingStop",
      "accountsDueForPurge",
    ]);
    expect(outcome).toEqual({ outcome: "skipped", subjectId: null, reason: "no-subject" });
  });

  it("hands each returned subject straight back, unchanged, to the module that owns its rule", async () => {
    results.set("accountsDueForPurge", ["acct-1", "acct-2"]);
    results.set("sitesDueHostingStop", ["site-9"]);
    const job = await definition("account/maintenance");
    const outcome = await job.run({ data: {}, now: MONDAY_0600_UTC });
    expect(calls.filter((c) => c.fn === "stopHosting")).toEqual([{ fn: "stopHosting", arg: "site-9" }]);
    expect(calls.filter((c) => c.fn === "purgeAccount")).toEqual([
      { fn: "purgeAccount", arg: "acct-1" },
      { fn: "purgeAccount", arg: "acct-2" },
    ]);
    expect(outcome).toEqual({ outcome: "ran", subjectId: null });
  });
});

describe("the fan-out is bounded and never starves the rest of the tick", () => {
  it("runs at most JOB_FAN_OUT_CONCURRENCY subjects at once, and every subject runs", async () => {
    const { fanOut } = await import("@/jobs/fan-out");
    const { JOB_FAN_OUT_CONCURRENCY } = await import("@/lib/config/constants");
    let inFlight = 0;
    let peak = 0;
    const subjects = [...Array(40).keys()];
    const seen = await fanOut(subjects, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      // The first subject is the slow one; the rest must not wait on it.
      await new Promise((r) => setTimeout(r, n === 0 ? 25 : 0));
      inFlight--;
      return n;
    });
    expect(peak).toBeLessThanOrEqual(JOB_FAN_OUT_CONCURRENCY);
    expect(seen).toHaveLength(subjects.length);
    expect(seen.every((r) => r.ok)).toBe(true);
  });

  it("one subject that throws does not cancel the others, and is not swallowed", async () => {
    const { fanOut, settle } = await import("@/jobs/fan-out");
    const attempted: number[] = [];
    const seen = await fanOut([0, 1, 2], async (n) => {
      attempted.push(n);
      if (n === 1) throw new Error("one site failed");
      return { done: true as const };
    });
    expect(attempted.sort()).toEqual([0, 1, 2]);
    expect(() => settle(seen, null)).toThrow("one site failed");
  });
});

describe("nothing fakes work — an unbuilt engine fails loudly", () => {
  // `account/maintenance` is the one id excluded, and issue #33 is why: its
  // first two obligations — the 15-minute chase and the 24-hour backstop —
  // are built now, so the tick reaches a real engine before it reaches an
  // unbuilt one. Its own case is below, with the two built queries stood
  // in for, so what is asserted is still that the *unbuilt* third
  // obligation throws.
  const UNBUILT_JOB_IDS = JOB_IDS.filter((id) => id !== "account/maintenance");

  it.each(UNBUILT_JOB_IDS)("%s throws EngineNotBuilt against the real seam", async (id) => {
    stubEnv(false);
    const { jobs } = await import("@/jobs");
    const { runJob } = await import("@/jobs/run");
    const { EngineNotBuilt } = await import("@/jobs/engine");
    const job = jobs.find((j) => j.id === id);
    if (job === undefined) throw new Error(`no definition for ${id}`);
    const data: Record<JobId, Record<string, unknown>> = {
      "scan/run": { scanId: "s", domain: "example.com", tier: "free" },
      "publish/execute": { draftId: "d", destinationId: "dest" },
      "publish/verify": { publicationId: "p" },
      "lead/nurture": { leadId: "l", touchIndex: 0 },
      "draft/generate": {},
      "weekly/refresh": {},
      "account/maintenance": {},
    };
    await expect(runJob(job, { data: data[id], now: MONDAY_0600_UTC })).rejects.toBeInstanceOf(
      EngineNotBuilt
    );
  });

  it("account/maintenance still throws once its two built obligations are past", async () => {
    stubEnv(false);
    // The payment half is built (issue #33). Standing the two due-work
    // queries in — with nothing due, which is the ordinary case — lets the
    // tick reach the third obligation, whose engine is not built, which is
    // what this suite is about. Doubling the whole engine instead would
    // assert nothing.
    vi.doMock("@/lib/account/provisioning/due-work", () => ({
      paymentsAwaitingSignIn: async () => [],
      paymentsWithoutAccounts: async () => [],
    }));
    const { jobs } = await import("@/jobs");
    const { runJob } = await import("@/jobs/run");
    const { EngineNotBuilt } = await import("@/jobs/engine");
    const job = jobs.find((j) => j.id === "account/maintenance");
    if (job === undefined) throw new Error("no definition for account/maintenance");
    await expect(runJob(job, { data: {}, now: MONDAY_0600_UTC })).rejects.toBeInstanceOf(
      EngineNotBuilt
    );
    vi.doUnmock("@/lib/account/provisioning/due-work");
  });

  it("a failed invocation is logged as failed, carrying no payload", async () => {
    const logged: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: string) => void logged.push(line));
    stubEnv(false);
    const { jobs } = await import("@/jobs");
    const { runJob } = await import("@/jobs/run");
    const job = jobs.find((j) => j.id === "scan/run") as JobDefinition;
    await expect(
      runJob(job, { data: { scanId: "s", domain: "example.com", tier: "free" }, now: MONDAY_0600_UTC })
    ).rejects.toThrow();
    expect(logged).toHaveLength(1);
    const line = JSON.parse(logged[0] as string);
    expect(line).toMatchObject({ event: "job", jobId: "scan/run", outcome: "failed" });
    expect(JSON.stringify(line)).not.toContain("example.com");
  });
});
