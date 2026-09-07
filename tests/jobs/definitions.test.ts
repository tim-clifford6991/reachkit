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
import { MAINTENANCE_TICK_MINUTES, NURTURE_H, PUBLISH_VERIFY_DELAY_H } from "@/lib/config/constants";

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
    activeSites: record("activeSites", {
      sites: [{ siteId: "site-1", timeZone: "UTC" }],
      held: null,
    }),
    weeklyDueSites: record("weeklyDueSites", []),
    startWeeklyScan: record("startWeeklyScan", done),
    runScan: record("runScan", done),
    generateDraft: record("generateDraft", done),
    publishApproved: record("publishApproved", done),
    duePublishRetries: record("duePublishRetries", [{ draftId: "d1", destinationId: "dest-1" }]),
    verifyLive: record("verifyLive", done),
    advanceSequence: record("advanceSequence", done),
    advanceDueSequences: record("advanceDueSequences", { dropped: 0, released: 0, sent: 0 }),
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
    sitesDueSetupReminder: record("sitesDueSetupReminder", []),
    remindSetup: record("remindSetup", done),
    noticeBrokenDestination: record("noticeBrokenDestination", done),
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
    ["publish/retry", "cron"],
    ["weekly/refresh", "cron"],
    ["lead/nurture", "cron"],
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
    // The selection is the engine's: three of its four predicates are
    // database questions, and a job body reaches no database. The job asks
    // for the due set and starts exactly what it is handed.
    results.set("weeklyDueSites", [
      { siteId: "utc-site", domain: "utc.example.com", zone: "UTC", weekStart: "2026-09-07" },
    ]);
    const job = await definition("weekly/refresh");
    const outcome = await job.run({ data: {}, now: MONDAY_0600_UTC });
    expect(calls.filter((c) => c.fn === "weeklyDueSites")).toEqual([
      { fn: "weeklyDueSites", arg: MONDAY_0600_UTC },
    ]);
    expect(calls.filter((c) => c.fn === "startWeeklyScan")).toEqual([
      {
        fn: "startWeeklyScan",
        arg: {
          siteId: "utc-site",
          domain: "utc.example.com",
          zone: "UTC",
          weekStart: "2026-09-07",
          now: MONDAY_0600_UTC,
        },
      },
    ]);
    expect(outcome).toEqual({ outcome: "ran", subjectId: null });
  });

  it("a tick on no site's Monday is a recorded skip, not a run", async () => {
    const job = await definition("weekly/refresh");
    const outcome = await job.run({ data: {}, now: new Date("2026-09-09T06:00:00Z") });
    expect(outcome).toEqual({ outcome: "skipped", subjectId: null, reason: "not-due" });
    expect(calls.filter((c) => c.fn === "startWeeklyScan")).toEqual([]);
  });

  it("degrades the tick where a site's week was only partly measured", async () => {
    results.set("weeklyDueSites", [
      { siteId: "utc-site", domain: "utc.example.com", zone: "UTC", weekStart: "2026-09-07" },
    ]);
    results.set("startWeeklyScan", { degraded: "ai_answers" });
    const job = await definition("weekly/refresh");
    expect(await job.run({ data: {}, now: MONDAY_0600_UTC })).toEqual({
      outcome: "degraded",
      subjectId: null,
      step: "ai_answers",
    });
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

  it("a tick that cannot decide who is paying prepares no page and records the hold (#201)", async () => {
    // Not a skip: a quiet hour and an unanswerable one must not look alike
    // in the run record, because one of them needs an operator.
    results.set("activeSites", { sites: [], held: "access-unreadable" });
    const job = await definition("draft/generate");
    const outcome = await job.run({ data: {}, now: EVENING_UTC });
    expect(outcome).toEqual({
      outcome: "degraded",
      subjectId: null,
      step: "held:access-unreadable",
    });
    expect(calls.some((c) => c.fn === "generateDraft")).toBe(false);
    expect(calls.some((c) => c.fn === "noticeBrokenDestination")).toBe(false);
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

  it("publish/retry is an hourly tick that re-enters through the same seam an approval does", async () => {
    // The whole of §9's retry, and the reason it is a tick: a re-sent
    // `publish/execute` event is deduped by `(draftId, destinationId)`
    // rather than delayed, so the retry had nowhere to come from.
    const job = await definition("publish/retry");
    expect(job.trigger).toEqual({ kind: "cron", cron: "0 * * * *" });
    // Idempotency is the row, not the payload: a tick carries no data.
    expect(job.idempotencyKey).toEqual([]);
    const outcome = await job.run({ data: {}, now: MONDAY_0600_UTC });
    expect(calls).toEqual([
      { fn: "duePublishRetries", arg: MONDAY_0600_UTC },
      { fn: "publishApproved", arg: { draftId: "d1", destinationId: "dest-1" } },
    ]);
    expect(outcome).toEqual({ outcome: "ran", subjectId: null });
  });

  it("an hour with no retry due is a recorded skip, never a run", async () => {
    results.set("duePublishRetries", []);
    const job = await definition("publish/retry");
    const outcome = await job.run({ data: {}, now: MONDAY_0600_UTC });
    expect(outcome).toEqual({ outcome: "skipped", subjectId: null, reason: "not-due" });
    expect(calls.some((c) => c.fn === "publishApproved")).toBe(false);
  });

  it("publish/verify calls verifyLive once, keyed by the publication", async () => {
    const job = await definition("publish/verify");
    const outcome = await job.run({ data: { publicationId: "pub-1" }, now: MONDAY_0600_UTC });
    expect(calls).toEqual([{ fn: "verifyLive", arg: { publicationId: "pub-1" } }]);
    expect(outcome).toEqual({ outcome: "ran", subjectId: "pub-1" });
  });
});

describe("lead/nurture — an hourly tick over due work (#182)", () => {
  it("is a clock job on the hour, and carries no idempotency key", async () => {
    const job = await definition("lead/nurture");
    const { NURTURE_TICK_CRON } = await import("@/jobs/lead-nurture");
    expect(job.trigger).toEqual({ kind: "cron", cron: NURTURE_TICK_CRON });
    expect(NURTURE_TICK_CRON).toBe("0 * * * *");
    // A tick carries no payload, so there is no natural key to dedupe on:
    // what stops a double send is the row's own position check.
    expect(job.idempotencyKey).toEqual([]);
  });

  it("an hour is finer than the smallest offset the schedule names, so no touch is late by more than one tick", async () => {
    // The bound this rests on. If `NURTURE_H` ever named an offset under an
    // hour, hourly would stop being enough and this fails rather than
    // silently delivering late.
    expect(Math.min(...NURTURE_H)).toBeGreaterThanOrEqual(1);
  });

  it("hands the tick's own clock to the sweep, and nothing else", async () => {
    const job = await definition("lead/nurture");
    await job.run({ data: {}, now: MONDAY_0600_UTC });
    // `now` is the tick's, injected — the job reads no clock of its own,
    // which is what makes due-ness testable without travelling in time.
    expect(calls).toEqual([{ fn: "advanceDueSequences", arg: MONDAY_0600_UTC }]);
  });

  it("an hour with nothing due is recorded as skipped, never as a run", async () => {
    const job = await definition("lead/nurture");
    const outcome = await job.run({ data: {}, now: MONDAY_0600_UTC });
    expect(outcome).toEqual({ outcome: "skipped", subjectId: null, reason: "not-due" });
  });

  it.each([
    ["a drop", { dropped: 1, released: 0, sent: 0 }],
    ["a release", { dropped: 0, released: 1, sent: 0 }],
    ["a touch", { dropped: 0, released: 0, sent: 1 }],
  ])("an hour that moved %s is a run", async (_what, swept) => {
    // Each of the sweep's three steps counts on its own: a tick that only
    // dropped a lapsed sequence did real work, and reporting it as
    // not-due would hide the one step with no path back.
    results.set("advanceDueSequences", swept);
    const job = await definition("lead/nurture");
    expect(await job.run({ data: {}, now: MONDAY_0600_UTC })).toEqual({
      outcome: "ran",
      subjectId: null,
    });
  });

  it("the job holds no sequence logic — no offsets, no bound, no clock arithmetic", async () => {
    const source = (await import("node:fs")).readFileSync(
      (await import("node:path")).resolve(import.meta.dirname, "../../src/jobs/lead-nurture.ts"),
      "utf8"
    );
    // Comments are stripped first: this file names `NURTURE_H`,
    // `NURTURE_MAX_TOUCHES` and the sequence key in prose, on purpose, to
    // say that each of them is someone else's.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/NURTURE_H|NURTURE_MAX_TOUCHES/);
    expect(code).not.toMatch(/lower\(|\bemail\b/);
    expect(code).not.toMatch(/new Date\(|Date\.now|getTime\(/);
  });
});

describe("account/maintenance — six due-work queries, six hand-offs, no domain logic", () => {
  it("ticks every MAINTENANCE_TICK_MINUTES", async () => {
    const job = await definition("account/maintenance");
    expect(job.trigger).toEqual({ kind: "cron", cron: `*/${MAINTENANCE_TICK_MINUTES} * * * *` });
    expect(MAINTENANCE_TICK_MINUTES).toBe(15);
  });

  it("a tick whose six queries return nothing is six reads and no hand-off", async () => {
    // The sixth is §4.3's setup reminders (issue #36): a founder who paid
    // and has not answered the three questions.
    const job = await definition("account/maintenance");
    const outcome = await job.run({ data: {}, now: MONDAY_0600_UTC });
    expect(calls.map((c) => c.fn)).toEqual([
      "paymentsAwaitingSignIn",
      "paymentsWithoutAccounts",
      "sitesDueHostingEndNotice",
      "sitesDueHostingStop",
      "accountsDueForPurge",
      "sitesDueSetupReminder",
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

describe("scan/run — deep only, and the other two tiers are not job paths (#229)", () => {
  /** The tests below reach the **real** seam, so importing `@/jobs/engine`
   *  pulls `@/lib/scan/deep/run` and its whole graph in. That import is the
   *  cost, not the assertion, and it crosses Vitest's 5 s default on a
   *  loaded box — the same shape, and the same reason, as
   *  `tests/egress/policy.test.ts`'s `ESLINT_BOOT_MS`. */
  const REAL_SEAM_IMPORT_MS = 30_000;

  it("a deep event with a site runs the onboarding pass and nothing else", async () => {
    const job = await definition("scan/run");
    const outcome = await job.run({
      data: { scanId: "setup-site-1", domain: "example.com", tier: "deep", siteId: "site-1" },
      now: MONDAY_0600_UTC,
    });
    expect(calls).toEqual([
      { fn: "runScan", arg: { scanId: "setup-site-1", domain: "example.com", tier: "deep", siteId: "site-1" } },
    ]);
    expect(outcome).toEqual({ outcome: "ran", subjectId: "setup-site-1" });
  });

  it.each(["free", "weekly"] as const)(
    "a %s event is refused as not_a_job_path against the real seam — not as an unbuilt engine",
    async (tier) => {
      // The distinction is the point of #229. `EngineNotBuilt` says an
      // engine is missing and an issue will close it; this says the event
      // should never have been sent, and no issue closes that.
      stubEnv(false);
      const { jobs } = await import("@/jobs");
      const { runJob } = await import("@/jobs/run");
      const { EngineNotBuilt, NotAJobPath } = await import("@/jobs/engine");
      const job = jobs.find((j) => j.id === "scan/run");
      if (job === undefined) throw new Error("no scan/run definition");

      const run = runJob(job, {
        data: { scanId: "s", domain: "example.com", tier },
        now: MONDAY_0600_UTC,
      });
      await expect(run).rejects.toBeInstanceOf(NotAJobPath);
      await expect(run).rejects.not.toBeInstanceOf(EngineNotBuilt);
      await expect(run).rejects.toThrow("not_a_job_path");
    },
    REAL_SEAM_IMPORT_MS
  );

  it("the refusal names where that tier does run, so a dead-letter is readable without this file", async () => {
    stubEnv(false);
    const { runScan } = await import("@/jobs/engine");
    await expect(runScan({ scanId: "s", domain: "example.com", tier: "free" })).rejects.toThrow(
      /POST \/api\/scan/
    );
    await expect(runScan({ scanId: "s", domain: "example.com", tier: "weekly" })).rejects.toThrow(
      /weekly\/refresh/
    );
  }, REAL_SEAM_IMPORT_MS);

  it("a deep event with no siteId is a malformed delivery, named as one", async () => {
    stubEnv(false);
    const { runScan, NotAJobPath } = await import("@/jobs/engine");
    const run = runScan({ scanId: "s", domain: "example.com", tier: "deep" });
    await expect(run).rejects.toThrow(/no siteId/);
    // Not the tier refusal: deep *is* this job's tier, and the payload is
    // what is wrong.
    await expect(run).rejects.not.toBeInstanceOf(NotAJobPath);
  }, REAL_SEAM_IMPORT_MS);

  it("nothing in src/** sends a scan/run event for any tier but deep", async () => {
    // The claim the header rests on, swept rather than asserted from
    // memory: the free report runs inline on the request because §6.4 puts
    // it at "≈60s live" with a human waiting, and the weekly pass comes
    // through `weekly/refresh`'s own claim. A sender for either tier would
    // be a second door, and this is what finds one.
    const { readdirSync, readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const root = path.resolve(import.meta.dirname, "../../src");

    function walk(dir: string): string[] {
      const out: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (entry.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx"))) out.push(full);
      }
      return out;
    }

    const senders: { file: string; tier: string }[] = [];
    for (const file of walk(root)) {
      const source = readFileSync(file, "utf8");
      for (const call of source.matchAll(/sendJobEvent\(\s*"scan\/run"\s*,\s*\{([\s\S]*?)\}\s*\)/g)) {
        const tier = /tier:\s*"(\w+)"/.exec(call[1] ?? "")?.[1] ?? "unstated";
        senders.push({ file: path.relative(root, file), tier });
      }
    }

    // Rule 5.5: a sweep that found no sender at all would pass while
    // proving nothing, so the count is stated too.
    expect(senders.length).toBeGreaterThan(0);
    expect(senders.filter((s) => s.tier !== "deep")).toEqual([]);
  });

  it("and the free path really does run inline, on the request", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const route = readFileSync(
      path.resolve(import.meta.dirname, "../../src/app/api/scan/route.ts"),
      "utf8"
    );
    expect(route).toMatch(/runScan\(\{[^}]*tier:\s*"free"/);
    expect(route).not.toMatch(/sendJobEvent/);
  });
});

describe("nothing fakes work — an unbuilt engine fails loudly", () => {
  // Three ids are excluded, each because its engine landed.
  //
  // `account/maintenance` — issue #33: its first two obligations (the
  // 15-minute chase and the 24-hour backstop) are built, so the tick
  // reaches a real engine before it reaches an unbuilt one. Its own case
  // is below, with the two built queries stood in for, so what is asserted
  // is still that the *unbuilt* third obligation throws.
  //
  // `weekly/refresh` — issue #41: against the real seam it reaches the
  // database, which is the opposite of what this asserts.
  //
  // `publish/verify` — issue #50: the 24-hour check is built and reaches
  // the database for the same reason. Its own suites are
  // `tests/publish/verify/**` and `tests/mail/published/**`.
  //
  // `lead/nurture` — issue #176 built `advanceSequence()` and #182 made
  // this job the hourly sweep instead; either way it reaches
  // `src/lib/mail/leads/sequence`, which reads the lead store. Its own
  // suites are `tests/mail/leads/**` and `tests/jobs/nurture-clock.test.ts`;
  // the wiring — that this job hands the tick's clock to the sweep and maps
  // what it answers — is asserted above, against the recorded seam.
  //
  // The remaining one stays, and an engine that lands moves its id out of
  // here and into a suite of its own. Issue #173 moved two: `draft/generate`
  // (BP-014's site list, `tests/publish/daily/sites.test.ts`) and
  // `publish/execute` (BP-015's approve-and-deliver edge,
  // `tests/publish/attempt/deliver.test.ts`), both also walked end to end
  // by `tests/journeys/05-daily-loop.test.ts`. Issue #200 moved a third,
  // `publish/retry` (§9's retry sweep,
  // `tests/publish/attempt/due.test.ts`).
  // Issue #229 moved the last one, `scan/run`, and moved it for a
  // different reason from the six above: its engine is not unbuilt. The
  // deep arm calls `runDeepPass` and reaches the database; the other two
  // tiers are not job paths at all and now say so. `scan/run — deep only`
  // below is its case.
  const UNBUILT_JOB_IDS = JOB_IDS.filter(
    (id) =>
      id !== "account/maintenance" &&
      id !== "weekly/refresh" &&
      id !== "publish/verify" &&
      id !== "lead/nurture" &&
      id !== "draft/generate" &&
      id !== "publish/execute" &&
      id !== "publish/retry" &&
      id !== "scan/run"
  );

  it("every engine behind the seven is either built or an explicit refusal — none is a stub any more", () => {
    // Rule 5.5: this describe's `it.each` would silently run zero cases
    // now that the list is empty, and a suite that asserts nothing reads
    // exactly like one that passes. So the emptiness is the assertion, and
    // an engine regressing to a stub puts its id back in this list and
    // fails here.
    expect(UNBUILT_JOB_IDS).toEqual([]);
  });

  it("account/maintenance skips an unbuilt obligation rather than dying on it (issue #36), and every obligation behind it still runs", async () => {
    stubEnv(false);
    // All six obligations are built today and read rows: the payment half
    // (issue #33), the hosting pair (issue #34), the purge (issue #52) and
    // §4.3's setup reminders (issue #36). Every one is stood in with
    // nothing due — the ordinary case — so this suite reaches no database.
    // Doubling the whole engine instead would assert nothing.
    //
    // The skip itself has no live subject any more, so it is given one: the
    // **first** obligation in the list is made to fail the way an unbuilt
    // engine fails, and the assertion is that an obligation behind it —
    // the purge, which is fifth — still ran. That was the failure issue #36
    // fixed: before it, a purge was held because an unrelated node had not
    // landed.
    vi.doMock("@/lib/account/provisioning/due-work", () => ({
      paymentsAwaitingSignIn: async () => {
        const { EngineNotBuilt } = await import("@/jobs/engine");
        throw new EngineNotBuilt("BP-032", "paymentsAwaitingSignIn()");
      },
      paymentsWithoutAccounts: async () => [],
    }));
    vi.doMock("@/lib/mail/setup/reminders", () => ({
      sitesDueSetupReminder: async () => [],
      sendSetupReminder: async () => ({ sent: false, reason: "not-due" }),
    }));
    const { jobs } = await import("@/jobs");
    const { runJob } = await import("@/jobs/run");

    // The hosting pair reads through the billing module's own store, and
    // the purge through its own, so both are stood in through their
    // modules' doors rather than by mocking the modules.
    const { setBillingStore } = await import("@/lib/account/billing");
    const { memoryBillingStore, newMemoryBilling } = await import(
      "../account/billing/memory-store"
    );
    setBillingStore(memoryBillingStore(newMemoryBilling()));

    const { setLifecycleStore } = await import("@/lib/account/lifecycle");
    const { memoryLifecycleStore, newMemoryLifecycle, account } = await import(
      "../account/lifecycle/memory-store"
    );
    const lifecycle = newMemoryLifecycle();
    // One account whose promised date has passed, so the purge has
    // something to do and "it ran" is observable rather than vacuous.
    lifecycle.accounts.push(
      account({
        id: "u-1",
        deleted_at: "2026-08-01T00:00:00.000Z",
        purge_due_at: "2026-08-31T00:00:00.000Z",
      })
    );
    setLifecycleStore(memoryLifecycleStore(lifecycle));

    const job = jobs.find((j) => j.id === "account/maintenance");
    if (job === undefined) throw new Error("no definition for account/maintenance");
    await expect(runJob(job, { data: {}, now: MONDAY_0600_UTC })).resolves.toBeDefined();

    // The obligation that failed the way an unbuilt engine fails was
    // skipped, and the fifth still ran.
    expect(lifecycle.deleted.map((step) => step.table)).toContain("users");
    expect(lifecycle.accounts).toEqual([]);

    setLifecycleStore(null);
    setBillingStore(null);
    vi.doUnmock("@/lib/mail/setup/reminders");
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
